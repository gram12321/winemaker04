import { v4 as uuidv4 } from 'uuid';
import type { Aspect, GrapeVariety, Season, Vineyard, WineBatch, WineLogEntry } from '@/lib/types/types';
import { WorkCategory } from '@/lib/types/types';
import { companyFeature } from '@/lib/features/company';
import { getCurrentCompany, setActiveCompany } from '@/lib/services/core/gameState';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { saveVineyard } from '@/lib/database/activities/vineyardDB';
import { createWineBatchFromHarvest, getAllWineBatches, updateInventoryBatch } from '@/lib/services/wine/winery/inventoryService';
import { startCrushingActivity } from '@/lib/services/wine/winery/crushingManager';
import { startFermentationActivity, processWeeklyFermentation, bottleWine } from '@/lib/services/wine/winery/fermentationManager';
import { completeActivityNow, getAllActivities } from '@/lib/services/activity/activitymanagers/activityManager';
import { loadWineLogByVineyard } from '@/lib/database';
import type { CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import type { FermentationOptions } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import { applyFeatureEffectsToBatch } from '@/lib/services/wine/features/featureService';
import { calculateEstimatedPrice, getTasteQualityIndex } from '@/lib/services/wine/winescore/wineScoreCalculation';
import { calculateCurrentPrestige } from '@/lib/services/prestige/prestigeService';
import { calculateStructureIndex, RANGE_ADJUSTMENTS, RULES } from '@/lib/wineStructure';
import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import { getAnchorAdjustedStructureRanges } from '@/lib/services/wine/anchors/wineAnchorCharacteristicBridge';
import { withTestLabPrefix } from './runId';
import { insertStorageVessels } from '@/lib/database/winery/storageVesselsDB';
import { createStorageAllocationPlan } from '@/lib/services/wine/winery/storageVesselAllocationService';

export interface TestLabCompanyResult {
  company: Awaited<ReturnType<typeof companyFeature.records.get>>;
}

export interface TestLabVineyardResult {
  company: NonNullable<TestLabCompanyResult['company']>;
  vineyard: Vineyard;
}

export interface TestLabBatchResult extends TestLabVineyardResult {
  batch: WineBatch;
  wineLogEntry?: WineLogEntry;
}

const numberParam = (
  params: Record<string, string | number | boolean>,
  key: string,
  fallback: number
): number => {
  const value = params[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringParam = (
  params: Record<string, string | number | boolean>,
  key: string,
  fallback: string
): string => {
  const value = params[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const booleanParam = (
  params: Record<string, string | number | boolean>,
  key: string,
  fallback: boolean
): boolean => {
  const value = params[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const optionalNumberParam = (
  params: Record<string, string | number | boolean>,
  key: string
): number | null => {
  const value = params[key];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type TestLabFeaturePreset =
  | 'none'
  | 'terroir-forward'
  | 'oxidation-risk'
  | 'noble-rot-risk'
  | 'cellar-evolution';

const getFeatureIndex = (batch: WineBatch, featureId: string): number =>
  (batch.features || []).findIndex(feature => feature.id === featureId);

const setFeatureRisk = (batch: WineBatch, featureId: string, risk: number): WineBatch => {
  const nextFeatures = [...(batch.features || [])];
  const featureIndex = getFeatureIndex(batch, featureId);
  if (featureIndex === -1) return batch;
  nextFeatures[featureIndex] = {
    ...nextFeatures[featureIndex],
    risk: clamp01(risk)
  };
  return { ...batch, features: nextFeatures };
};

const setFeatureSeverity = (
  batch: WineBatch,
  featureId: string,
  severity: number,
  isPresent: boolean = true
): WineBatch => {
  const nextFeatures = [...(batch.features || [])];
  const featureIndex = getFeatureIndex(batch, featureId);
  if (featureIndex === -1) return batch;
  nextFeatures[featureIndex] = {
    ...nextFeatures[featureIndex],
    isPresent,
    severity: clamp01(severity)
  };
  return { ...batch, features: nextFeatures };
};

const applyPresetOverrides = (batch: WineBatch, preset: TestLabFeaturePreset): WineBatch => {
  if (preset === 'none') return batch;

  let nextBatch = {
    ...batch,
    wineAnchors: { ...batch.wineAnchors }
  };

  switch (preset) {
    case 'terroir-forward':
      nextBatch.wineAnchors.terroirExpression = Math.max(nextBatch.wineAnchors.terroirExpression, 0.88);
      nextBatch.wineAnchors.aromaticPotential = Math.max(nextBatch.wineAnchors.aromaticPotential, 0.74);
      nextBatch = setFeatureSeverity(nextBatch, 'terroir', 0.62);
      return nextBatch;
    case 'oxidation-risk':
      nextBatch.wineAnchors.oxidationPressure = Math.max(nextBatch.wineAnchors.oxidationPressure, 0.82);
      nextBatch = setFeatureRisk(nextBatch, 'oxidation', 0.45);
      return nextBatch;
    case 'noble-rot-risk':
      nextBatch.wineAnchors.sugarPotential = Math.max(nextBatch.wineAnchors.sugarPotential, 0.8);
      nextBatch.wineAnchors.terroirExpression = Math.max(nextBatch.wineAnchors.terroirExpression, 0.7);
      nextBatch = setFeatureRisk(nextBatch, 'noble_rot', 0.55);
      return nextBatch;
    case 'cellar-evolution':
      nextBatch.wineAnchors.maturationState = Math.max(nextBatch.wineAnchors.maturationState, 0.75);
      nextBatch.wineAnchors.processFootprint = Math.max(nextBatch.wineAnchors.processFootprint, 0.58);
      nextBatch = setFeatureSeverity(nextBatch, 'terroir', 0.55);
      nextBatch = setFeatureSeverity(nextBatch, 'bottle_aging', 0.55);
      if (nextBatch.state === 'bottled') {
        nextBatch.agingProgress = Math.max(nextBatch.agingProgress || 0, 52);
      }
      return nextBatch;
  }
};

const getAnchorTargets = (
  params: Record<string, string | number | boolean>
): Partial<WineBatch['wineAnchors']> => {
  const preset = stringParam(params, 'featurePreset', 'none') as TestLabFeaturePreset;
  const targets: Partial<WineBatch['wineAnchors']> = {};

  switch (preset) {
    case 'terroir-forward':
      targets.terroirExpression = 0.88;
      targets.aromaticPotential = 0.74;
      break;
    case 'oxidation-risk':
      targets.oxidationPressure = 0.82;
      break;
    case 'noble-rot-risk':
      targets.sugarPotential = 0.8;
      targets.terroirExpression = 0.7;
      break;
    case 'cellar-evolution':
      targets.maturationState = 0.75;
      targets.processFootprint = 0.58;
      break;
  }

  const terroirExpressionOverride = optionalNumberParam(params, 'terroirExpressionOverride');
  const oxidationPressureOverride = optionalNumberParam(params, 'oxidationPressureOverride');
  const maturationStateOverride = optionalNumberParam(params, 'maturationStateOverride');

  if (terroirExpressionOverride !== null) {
    targets.terroirExpression = clamp01(terroirExpressionOverride);
  }
  if (oxidationPressureOverride !== null) {
    targets.oxidationPressure = clamp01(oxidationPressureOverride);
  }
  if (maturationStateOverride !== null) {
    targets.maturationState = clamp01(maturationStateOverride);
  }

  return targets;
};

export function applyTestLabBatchOverrides(
  batch: WineBatch,
  params: Record<string, string | number | boolean>
): WineBatch {
  const preset = stringParam(params, 'featurePreset', 'none') as TestLabFeaturePreset;
  const anchorTargets = getAnchorTargets(params);
  let nextBatch = applyPresetOverrides(batch, preset);
  const terroirSeverityOverride = optionalNumberParam(params, 'terroirSeverityOverride');
  const oxidationRiskOverride = optionalNumberParam(params, 'oxidationRiskOverride');
  const nobleRotRiskOverride = optionalNumberParam(params, 'nobleRotRiskOverride');
  const greyRotRiskOverride = optionalNumberParam(params, 'greyRotRiskOverride');
  const agingProgressWeeksOverride = optionalNumberParam(params, 'agingProgressWeeksOverride');

  nextBatch = {
    ...nextBatch,
    wineAnchors: {
      ...nextBatch.wineAnchors,
      ...anchorTargets
    }
  };

  if (terroirSeverityOverride !== null) {
    nextBatch = setFeatureSeverity(nextBatch, 'terroir', terroirSeverityOverride);
  }
  if (oxidationRiskOverride !== null) {
    nextBatch = setFeatureRisk(nextBatch, 'oxidation', oxidationRiskOverride);
  }
  if (nobleRotRiskOverride !== null) {
    nextBatch = setFeatureRisk(nextBatch, 'noble_rot', nobleRotRiskOverride);
  }
  if (greyRotRiskOverride !== null) {
    nextBatch = setFeatureRisk(nextBatch, 'grey_rot', greyRotRiskOverride);
  }
  if (agingProgressWeeksOverride !== null && nextBatch.state === 'bottled') {
    nextBatch = {
      ...nextBatch,
      agingProgress: Math.max(0, Math.floor(agingProgressWeeksOverride))
    };
  }

  const batchWithFeatureEffects = applyFeatureEffectsToBatch(nextBatch);
  const finalAnchors = {
    ...batchWithFeatureEffects.wineAnchors,
    ...anchorTargets
  };
  const structureRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, finalAnchors);
  const structureIndexResult = calculateStructureIndex(
    batchWithFeatureEffects.characteristics,
    structureRanges,
    RANGE_ADJUSTMENTS,
    RULES
  );
  const finalBatch = {
    ...batchWithFeatureEffects,
    wineAnchors: finalAnchors,
    structureIndex: structureIndexResult.score
  };

  return {
    ...finalBatch,
    tasteQualityIndex: getTasteQualityIndex(finalBatch)
  };
}

async function applyAndPersistBatchOverrides(
  batch: WineBatch,
  vineyard: Vineyard,
  params: Record<string, string | number | boolean>
): Promise<WineBatch> {
  const overriddenBatch = applyTestLabBatchOverrides(batch, params);
  const prestigeData = await calculateCurrentPrestige();
  const estimatedPrice = calculateEstimatedPrice(
    overriddenBatch,
    vineyard,
    prestigeData.companyPrestige,
    vineyard.vineyardPrestige
  );
  const persistedBatch = {
    ...overriddenBatch,
    estimatedPrice
  };

  await updateInventoryBatch(batch.id, {
    characteristics: persistedBatch.characteristics,
    breakdown: persistedBatch.breakdown,
    features: persistedBatch.features,
    wineAnchors: persistedBatch.wineAnchors,
    structureIndex: persistedBatch.structureIndex,
    tasteQualityIndex: persistedBatch.tasteQualityIndex,
    estimatedPrice: persistedBatch.estimatedPrice,
    agingProgress: persistedBatch.agingProgress
  });

  return getBatchById(batch.id);
}

async function getBatchById(batchId: string): Promise<WineBatch> {
  const batches = await getAllWineBatches();
  const batch = batches.find(candidate => candidate.id === batchId);
  if (!batch) {
    throw new Error(`Wine batch ${batchId} not found`);
  }
  return batch;
}

async function completeActivityForBatch(batchId: string, category: WorkCategory): Promise<void> {
  const activities = await getAllActivities();
  const activity = activities.find(candidate =>
    candidate.category === category &&
    candidate.params?.batchId === batchId
  );

  if (!activity) {
    throw new Error(`No ${category} activity found for batch ${batchId}`);
  }

  const result = await completeActivityNow(activity.id);
  if (!result.success) {
    throw new Error(result.error || `Failed to complete ${category} activity`);
  }
}

// Creates an isolated test company; used only by the company.create-isolated scenario.
export async function createTestLabCompany(
  runId: string,
  params: Record<string, string | number | boolean>
): Promise<NonNullable<TestLabCompanyResult['company']>> {
  const companyName = withTestLabPrefix(runId, stringParam(params, 'companyName', 'Admin Test Lab Company'));
  const result = await companyFeature.records.create({
    name: companyName
  });

  if (!result.success || !result.company) {
    throw new Error(result.error || 'Failed to create test company');
  }

  await setActiveCompany(result.company);
  return result.company;
}

export async function createHarvestReadyVineyard(
  runId: string,
  params: Record<string, string | number | boolean>
): Promise<TestLabVineyardResult> {
  // Use the currently active company — the test lab never creates a new company for vineyard scenarios.
  const company = getCurrentCompany();
  if (!company) {
    throw new Error('No active company. Log in and select a company before using the test lab.');
  }

  // If vineyardId is set to an existing vineyard, use it directly.
  const vineyardId = stringParam(params, 'vineyardId', 'new');
  if (vineyardId !== 'new') {
    const vineyards = await loadVineyards();
    const existing = vineyards.find(v => v.id === vineyardId);
    if (!existing) {
      throw new Error(`Vineyard ${vineyardId} not found in current company.`);
    }
    return { company, vineyard: existing };
  }

  // Create a fresh test vineyard tagged with the run id for later cleanup.
  const vineyardName = withTestLabPrefix(runId, 'Test Vineyard');
  const hectares = numberParam(params, 'hectares', 1);
  const landValue = numberParam(params, 'landValue', 250000);
  const vineyard: Vineyard = {
    id: uuidv4(),
    name: vineyardName,
    country: stringParam(params, 'country', 'France'),
    region: stringParam(params, 'region', 'Bourgogne'),
    hectares,
    grape: stringParam(params, 'grape', 'Pinot Noir') as GrapeVariety,
    vineAge: numberParam(params, 'vineAge', 12),
    soil: stringParam(params, 'soil', 'Clay,Limestone').split(',').map(soil => soil.trim()).filter(Boolean),
    altitude: numberParam(params, 'altitude', 320),
    aspect: stringParam(params, 'aspect', 'Southeast') as Aspect,
    density: numberParam(params, 'density', 5000),
    vineyardHealth: numberParam(params, 'vineyardHealth', 0.9),
    landValue,
    vineyardTotalValue: landValue * hectares,
    status: 'Growing',
    ripeness: numberParam(params, 'ripeness', 0.92),
    vineyardPrestige: 0,
    vineYield: 1,
    overgrowth: {
      vegetation: 0,
      debris: 0,
      uproot: 0,
      replant: 0
    },
    pendingFeatures: []
  };

  await saveVineyard(vineyard);
  return { company, vineyard };
}

export async function createGrapeBatch(
  runId: string,
  params: Record<string, string | number | boolean>
): Promise<TestLabBatchResult> {
  const result = await createHarvestReadyVineyard(runId, params);
  const harvestDate = {
    week: numberParam(params, 'week', 2),
    season: stringParam(params, 'season', 'Fall') as Season,
    year: numberParam(params, 'year', 2024)
  };
  // Tag the batch's vineyard name with the run id so cleanup can find it even when
  // the vineyard itself belongs to the user's real company and has no prefix.
  const batchVineyardName = withTestLabPrefix(runId, result.vineyard.name);
  const vesselId = uuidv4();
  const inserted = await insertStorageVessels([{
    id: vesselId,
    ownerKind: 'company',
    ownerCompanyId: result.company.id,
    vesselType: 'container',
    material: 'stainless_steel',
    qualityScore: 0.5,
    productionYear: harvestDate.year,
    capacityLitres: 10000,
    acquisitionPrice: 0,
    sourceOfferId: `test_lab_${runId}`,
    operationalStatus: 'operational',
    cleanliness: 'clean',
    condition: 1,
    fillHistory: 0,
    occupancy: 'available',
    purchasedYear: harvestDate.year,
    purchasedSeason: harvestDate.season,
    purchasedWeek: harvestDate.week,
  }]);
  if (inserted.error) throw inserted.error;
  const plan = await createStorageAllocationPlan({ requiredLitres: numberParam(params, 'quantityKg', 1200) * 0.5, vesselIds: [vesselId] });
  if (!plan.planId) throw new Error(plan.error || 'Could not reserve test-lab storage vessel.');
  const batch = await createWineBatchFromHarvest(
    result.vineyard.id,
    batchVineyardName,
    result.vineyard.grape || 'Pinot Noir',
    numberParam(params, 'quantityKg', 1200),
    harvestDate,
    harvestDate,
    plan.planId
  );
  const hydratedBatch = await applyAndPersistBatchOverrides(batch, result.vineyard, params);

  return { ...result, batch: hydratedBatch };
}

export async function createMustReadyBatch(
  runId: string,
  params: Record<string, string | number | boolean>
): Promise<TestLabBatchResult> {
  const result = await createGrapeBatch(runId, params);
  const crushingOptions: CrushingOptions = {
    method: stringParam(params, 'crushingMethod', 'Mechanical Press') as CrushingOptions['method'],
    destemming: booleanParam(params, 'destemming', true),
    coldSoak: booleanParam(params, 'coldSoak', false),
    pressingIntensity: numberParam(params, 'pressingIntensity', 0.5)
  };

  const startResult = await startCrushingActivity(result.batch, crushingOptions);
  if (!startResult.success) {
    throw new Error(startResult.error || 'Failed to start crushing activity');
  }

  await completeActivityForBatch(result.batch.id, WorkCategory.CRUSHING);
  const batch = await getBatchById(result.batch.id);
  return { ...result, batch };
}

export async function createFermentingBatch(
  runId: string,
  params: Record<string, string | number | boolean>
): Promise<TestLabBatchResult> {
  const result = await createMustReadyBatch(runId, params);
  const fermentationOptions: FermentationOptions = {
    method: stringParam(params, 'fermentationMethod', 'Basic') as FermentationOptions['method'],
    temperature: stringParam(params, 'fermentationTemperature', 'Ambient') as FermentationOptions['temperature']
  };

  const startResult = await startFermentationActivity(result.batch, fermentationOptions);
  if (!startResult.success) {
    throw new Error(startResult.error || 'Failed to start fermentation activity');
  }

  await completeActivityForBatch(result.batch.id, WorkCategory.FERMENTATION);
  const batch = await getBatchById(result.batch.id);
  return { ...result, batch };
}

export async function createBottledWine(
  runId: string,
  params: Record<string, string | number | boolean>
): Promise<TestLabBatchResult> {
  const result = await createFermentingBatch(runId, params);
  const fermentationWeeks = Math.max(0, Math.floor(numberParam(params, 'fermentationWeeks', 4)));

  for (let i = 0; i < fermentationWeeks; i += 1) {
    await processWeeklyFermentation();
  }

  const bottled = await bottleWine(result.batch.id);
  if (!bottled) {
    throw new Error('Failed to bottle wine batch');
  }

  const bottledBatch = await getBatchById(result.batch.id);
  const adjustedBottledBatch = await applyAndPersistBatchOverrides(bottledBatch, result.vineyard, params);

  const askingPrice = numberParam(params, 'askingPrice', 0);
  if (askingPrice > 0) {
    await updateInventoryBatch(result.batch.id, { askingPrice });
  }

  const batch = askingPrice > 0
    ? await getBatchById(result.batch.id)
    : adjustedBottledBatch;
  const wineLogEntries = await loadWineLogByVineyard(result.vineyard.id);
  const wineLogEntry = wineLogEntries.find(entry =>
    entry.vineyardId === result.vineyard.id &&
    entry.grape === batch.grape &&
    entry.vintage === batch.harvestStartDate.year
  );

  return { ...result, batch, wineLogEntry };
}
