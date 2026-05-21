import { v4 as uuidv4 } from 'uuid';
import type { Aspect, GrapeVariety, Season, Vineyard, WineBatch, WineLogEntry } from '@/lib/types/types';
import { WorkCategory } from '@/lib/types/types';
import { companyService } from '@/lib/services/user/companyService';
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
import { withTestLabPrefix } from './runId';

export interface TestLabCompanyResult {
  company: Awaited<ReturnType<typeof companyService.getCompany>>;
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
  const result = await companyService.createCompany({
    name: companyName,
    associateWithUser: false
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
  const batch = await createWineBatchFromHarvest(
    result.vineyard.id,
    batchVineyardName,
    result.vineyard.grape || 'Pinot Noir',
    numberParam(params, 'quantityKg', 1200),
    harvestDate,
    harvestDate
  );

  return { ...result, batch };
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

  const askingPrice = numberParam(params, 'askingPrice', 0);
  if (askingPrice > 0) {
    await updateInventoryBatch(result.batch.id, { askingPrice });
  }

  const batch = await getBatchById(result.batch.id);
  const wineLogEntries = await loadWineLogByVineyard(result.vineyard.id);
  const wineLogEntry = wineLogEntries.find(entry =>
    entry.vineyardId === result.vineyard.id &&
    entry.grape === batch.grape &&
    entry.vintage === batch.harvestStartDate.year
  );

  return { ...result, batch, wineLogEntry };
}
