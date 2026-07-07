
import { v4 as uuidv4 } from 'uuid';
import { WineBatch, GrapeVariety, WineCharacteristics, GameDate, MarketBatchProvenanceSnapshot, MarketOfferOriginTag, Vineyard, WineBatchOriginSnapshot, WineBatchState } from '../../../types/types';
import { saveWineBatch, loadWineBatches, updateWineBatch } from '../../../database/activities/inventoryDB';
import { loadVineyards } from '../../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../../hooks/useGameUpdates';
import { calculateEstimatedPrice, getTasteQualityIndex } from '../winescore/wineScoreCalculation';
import { calculateCurrentPrestige } from '../../prestige/prestigeService';
import { calculateStructureIndex, RANGE_ADJUSTMENTS, RULES } from '../../../wineStructure';
import { BASE_BALANCED_RANGES, GRAPE_CONST } from '../../../constants/grapeConstants';
import { calculateLandValueModifier } from '../winescore/landValueModifierCalculation';
import { generateDefaultCharacteristics } from '../characteristics/defaultCharacteristics';
import { modifyHarvestCharacteristics } from '../characteristics/harvestCharacteristics';
import { REGION_ALTITUDE_RANGES } from '../../../constants/vineyardConstants';
import { initializeBatchFeatures, processEventTrigger } from '../features/featureService';
import { SEASON_ORDER, WEEKS_PER_SEASON, WEEKS_PER_YEAR } from '@/lib/constants';
import { calculateGrapeSuitabilityMetrics } from '../../vineyard/vineyardValueCalc';
import {
  combineWineAnchorSets,
  computeHarvestWineAnchors,
  resolveWineAnchors,
  WINE_ANCHOR_KEYS
} from '../anchors/wineAnchorService';
import { getAnchorAdjustedStructureRanges } from '../anchors/wineAnchorCharacteristicBridge';
import { appendAnchorEffects, buildAnchorEffectsFromNeutral, diffAnchorEffects } from '../debug/wineAnchorEffectUtils';
import { CrushingOptions, modifyCrushingCharacteristics } from '../characteristics/crushingCharacteristics';
import { FermentationOptions, applyWeeklyFermentationEffects } from '../characteristics/fermentationCharacteristics';
import { applyCrushingToWineAnchors, applyFermentationSetupToWineAnchors, applyWeeklyFermentationContactToWineAnchors } from '../anchors/wineAnchorProcess';

const DEFAULT_TASTE_QUALITY_INDEX = 0.5;

export interface MarketBatchStateProfile {
  state: Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>;
  crushingOptions?: CrushingOptions;
  fermentationOptions?: FermentationOptions;
  fermentationProgress?: number;
  fermentationWeeksApplied?: number;
}

export interface CreateMarketWineBatchInput {
  supplierId: string;
  supplierName: string;
  originTag: MarketOfferOriginTag;
  source: MarketBatchProvenanceSnapshot;
  grape: GrapeVariety;
  quantity: number;
  harvestStartDate: GameDate;
  harvestEndDate: GameDate;
  stateProfile?: MarketBatchStateProfile;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getPseudoVineyardName(supplierName: string, region: string): string {
  return `${supplierName} - ${region}`;
}

function buildTerroirSummary(source: MarketBatchProvenanceSnapshot): string {
  const soils = source.soil.slice(0, 2).join(', ');
  return `${source.region}, ${source.country} • ${source.aspect} aspect • ${Math.round(source.altitude)}m • ${soils}`;
}

function buildMarketOriginSnapshot(
  supplierId: string,
  supplierName: string,
  originTag: MarketOfferOriginTag,
  state: Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>,
  source: MarketBatchProvenanceSnapshot
): WineBatchOriginSnapshot {
  return {
    sourceKind: 'market',
    supplierId,
    supplierName,
    originTag,
    previewState: state,
    terroirSummary: buildTerroirSummary(source),
    provenance: cloneJsonValue(source)
  };
}

function buildPseudoVineyardFromMarketSource(
  source: MarketBatchProvenanceSnapshot,
  vineyardName: string,
  grape: GrapeVariety
): Vineyard {
  return {
    id: 'market_purchase',
    name: vineyardName,
    country: source.country,
    region: source.region,
    hectares: 1,
    grape,
    vineAge: source.vineAge,
    soil: cloneJsonValue(source.soil),
    altitude: source.altitude,
    aspect: source.aspect,
    density: source.density,
    vineyardHealth: source.vineyardHealth,
    landValue: source.landValue,
    vineyardTotalValue: source.landValue,
    status: 'Growing',
    ripeness: source.ripeness,
    vineyardPrestige: source.vineyardPrestige,
    vineYield: 1,
    overgrowth: cloneJsonValue(source.overgrowth) ?? { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
    pendingFeatures: cloneJsonValue(source.pendingFeatures) ?? []
  };
}

function getAbsoluteWeek(date: GameDate): number {
  const idx = SEASON_ORDER.indexOf(date.season as typeof SEASON_ORDER[number]);
  const safeIdx = idx >= 0 ? idx : 0;
  return (date.year - 2024) * WEEKS_PER_YEAR + safeIdx * WEEKS_PER_SEASON + (date.week - 1);
}

interface BuildHarvestStageBatchInput {
  vineyard: Vineyard;
  vineyardId: string;
  vineyardName: string;
  grape: GrapeVariety;
  quantity: number;
  harvestStartDate: GameDate;
  harvestEndDate: GameDate;
  originSnapshot?: WineBatchOriginSnapshot;
  companyPrestige?: number;
  vineyardPrestige?: number;
}

async function buildHarvestStageBatch(input: BuildHarvestStageBatchInput): Promise<WineBatch> {
  const {
    vineyard,
    vineyardId,
    vineyardName,
    grape,
    quantity,
    harvestStartDate,
    harvestEndDate,
    originSnapshot,
    companyPrestige,
    vineyardPrestige
  } = input;

  const grapeMetadata = GRAPE_CONST[grape];
  const base = generateDefaultCharacteristics(grape);
  const country = vineyard.country;
  const region = vineyard.region;
  const altitude = vineyard.altitude;
  const countryAlt = (REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES] ?? {}) as Record<string, readonly [number, number]>;
  const altitudeRange = (countryAlt[region] ?? [0, 100]) as readonly [number, number];
  const [minAlt, maxAlt] = altitudeRange;
  const suitabilityMetrics = calculateGrapeSuitabilityMetrics(
    grape,
    region,
    country,
    altitude,
    vineyard.aspect,
    vineyard.soil
  );
  const suitability = suitabilityMetrics.overall;
  const quality = calculateLandValueModifier(vineyard);
  const wineAnchors = computeHarvestWineAnchors(vineyard, grape, {
    minAltitude: minAlt,
    maxAltitude: maxAlt,
    ripeness: vineyard.ripeness || 0.5,
    landValueModifier: quality
  });

  const { characteristics, breakdown } = modifyHarvestCharacteristics({
    baseCharacteristics: base,
    ripeness: vineyard.ripeness || 0.5,
    qualityFactor: quality,
    suitability,
    altitude,
    medianAltitude: (minAlt + maxAlt) / 2,
    maxAltitude: maxAlt,
    grapeColor: GRAPE_CONST[grape].grapeColor,
    overgrowth: vineyard.overgrowth,
    density: vineyard.density || 0,
    wineAnchors
  });

  const structureRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, wineAnchors);
  const structureIndexResult = calculateStructureIndex(characteristics, structureRanges, RANGE_ADJUSTMENTS, RULES);
  const harvestAnchorEffects = buildAnchorEffectsFromNeutral(
    wineAnchors,
    'Harvest anchor snapshot (grape + vineyard + ripeness/site at harvest)'
  );

  const baseBatch: WineBatch = {
    id: uuidv4(),
    vineyardId,
    vineyardName,
    grape,
    quantity,
    state: 'grapes',
    fermentationProgress: 0,
    landValueModifierHarvestSnapshot: quality,
    structureIndexHarvestSnapshot: structureIndexResult.score,
    landValueModifier: quality,
    tasteQualityIndexHarvestSnapshot: DEFAULT_TASTE_QUALITY_INDEX,
    tasteQualityIndex: DEFAULT_TASTE_QUALITY_INDEX,
    structureIndex: structureIndexResult.score,
    characteristics,
    breakdown: {
      effects: breakdown.effects,
      anchorEffects: harvestAnchorEffects
    },
    estimatedPrice: 0,
    grapeColor: grapeMetadata.grapeColor,
    naturalYield: grapeMetadata.naturalYield,
    fragile: grapeMetadata.fragile,
    proneToOxidation: grapeMetadata.proneToOxidation,
    features: initializeBatchFeatures(),
    originSnapshot: originSnapshot ? cloneJsonValue(originSnapshot) : undefined,
    harvestStartDate,
    harvestEndDate,
    wineAnchors
  };

  const batchWithEventFeatures = await processEventTrigger(baseBatch, 'harvest', vineyard);
  const tasteQualityIndex = getTasteQualityIndex(batchWithEventFeatures);
  const finalizedBatch: WineBatch = {
    ...batchWithEventFeatures,
    tasteQualityIndex,
    tasteQualityIndexHarvestSnapshot: tasteQualityIndex
  };

  finalizedBatch.estimatedPrice = calculateEstimatedPrice(
    finalizedBatch,
    vineyard,
    companyPrestige,
    vineyardPrestige
  );

  return finalizedBatch;
}

async function applyCrushingProfileToBatch(
  batch: WineBatch,
  crushingOptions: CrushingOptions
): Promise<WineBatch> {
  const {
    characteristics: modifiedCharacteristics,
    breakdown: crushingBreakdown,
    yieldMultiplier
  } = modifyCrushingCharacteristics({
    baseCharacteristics: batch.characteristics,
    ...crushingOptions,
    wineAnchors: resolveWineAnchors(batch.wineAnchors)
  });

  const finalQuantity = Math.round(batch.quantity * yieldMultiplier);
  const combinedBreakdown = {
    effects: [
      ...(batch.breakdown?.effects || []),
      ...crushingBreakdown.effects
    ],
    anchorEffects: [...(batch.breakdown?.anchorEffects || [])]
  };

  const updatedBatch = {
    ...batch,
    characteristics: modifiedCharacteristics,
    breakdown: combinedBreakdown,
    quantity: finalQuantity,
    tasteQualityIndex: getTasteQualityIndex(batch)
  };

  const batchWithEventFeatures = await processEventTrigger(
    updatedBatch,
    'crushing',
    { options: crushingOptions, batch: updatedBatch }
  );

  const anchorsBeforeCrushing = resolveWineAnchors(batchWithEventFeatures.wineAnchors);
  const wineAnchors = applyCrushingToWineAnchors(anchorsBeforeCrushing, crushingOptions);
  const crushingAnchorEffects = diffAnchorEffects(
    anchorsBeforeCrushing,
    wineAnchors,
    `Crushing (${crushingOptions.method})`
  );

  const charsAfterCrush = batchWithEventFeatures.characteristics || modifiedCharacteristics;
  const structureRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, wineAnchors);
  const structureIndexResult = calculateStructureIndex(
    charsAfterCrush,
    structureRanges,
    RANGE_ADJUSTMENTS,
    RULES
  );

  const batchAfterCrush: WineBatch = {
    ...batchWithEventFeatures,
    state: 'must_ready',
    characteristics: charsAfterCrush,
    breakdown: appendAnchorEffects(batchWithEventFeatures.breakdown || combinedBreakdown, crushingAnchorEffects),
    quantity: finalQuantity,
    structureIndex: structureIndexResult.score,
    tasteQualityIndex: getTasteQualityIndex({
      ...batchWithEventFeatures,
      characteristics: charsAfterCrush,
      structureIndex: structureIndexResult.score,
      wineAnchors
    }),
    wineAnchors
  };

  if (batchAfterCrush.originSnapshot) {
    batchAfterCrush.originSnapshot = {
      ...batchAfterCrush.originSnapshot,
      previewState: 'must_ready'
    };
  }

  return batchAfterCrush;
}

async function applyFermentationSetupToBatch(
  batch: WineBatch,
  fermentationOptions: FermentationOptions
): Promise<WineBatch> {
  const updatedBatch = {
    ...batch,
    state: 'must_fermenting' as const,
    fermentationOptions
  };
  const batchWithEventFeatures = await processEventTrigger(
    updatedBatch,
    'fermentation',
    { options: fermentationOptions, batch: updatedBatch }
  );

  const anchorsBeforeSetup = resolveWineAnchors(batchWithEventFeatures.wineAnchors);
  const wineAnchors = applyFermentationSetupToWineAnchors(
    anchorsBeforeSetup,
    fermentationOptions
  );
  const setupAnchorEffects = diffAnchorEffects(
    anchorsBeforeSetup,
    wineAnchors,
    `Fermentation setup (${fermentationOptions.method}, ${fermentationOptions.temperature})`
  );

  const structureRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, wineAnchors);
  const structureIndexResult = calculateStructureIndex(
    batchWithEventFeatures.characteristics,
    structureRanges,
    RANGE_ADJUSTMENTS,
    RULES
  );

  const batchAfterSetup: WineBatch = {
    ...batchWithEventFeatures,
    state: 'must_fermenting',
    fermentationOptions,
    breakdown: appendAnchorEffects(batchWithEventFeatures.breakdown, setupAnchorEffects),
    structureIndex: structureIndexResult.score,
    tasteQualityIndex: getTasteQualityIndex({
      ...batchWithEventFeatures,
      structureIndex: structureIndexResult.score,
      wineAnchors
    }),
    wineAnchors
  };

  if (batchAfterSetup.originSnapshot) {
    batchAfterSetup.originSnapshot = {
      ...batchAfterSetup.originSnapshot,
      previewState: 'must_fermenting'
    };
  }

  return batchAfterSetup;
}

function applyFermentationContactWeeks(
  batch: WineBatch,
  weeks: number
): WineBatch {
  let current = batch;

  for (let index = 0; index < weeks; index++) {
    if (!current.fermentationOptions) break;

    const { characteristics: newCharacteristics, breakdown } = applyWeeklyFermentationEffects({
      baseCharacteristics: current.characteristics,
      method: current.fermentationOptions.method,
      temperature: current.fermentationOptions.temperature,
      wineAnchors: resolveWineAnchors(current.wineAnchors)
    });

    const anchorsBeforeWeeklyContact = resolveWineAnchors(current.wineAnchors);
    const wineAnchors = applyWeeklyFermentationContactToWineAnchors(
      anchorsBeforeWeeklyContact,
      current.fermentationOptions
    );
    const weeklyAnchorEffects = diffAnchorEffects(
      anchorsBeforeWeeklyContact,
      wineAnchors,
      'Weekly fermentation contact'
    );
    const structureRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, wineAnchors);
    const structureIndexResult = calculateStructureIndex(
      newCharacteristics,
      structureRanges,
      RANGE_ADJUSTMENTS,
      RULES
    );

    current = {
      ...current,
      characteristics: newCharacteristics,
      tasteQualityIndex: getTasteQualityIndex({
        ...current,
        characteristics: newCharacteristics,
        structureIndex: structureIndexResult.score,
        wineAnchors
      }),
      structureIndex: structureIndexResult.score,
      breakdown: {
        effects: [
          ...(current.breakdown?.effects || []),
          ...breakdown.effects
        ],
        anchorEffects: [
          ...(current.breakdown?.anchorEffects || []),
          ...weeklyAnchorEffects
        ]
      },
      wineAnchors
    };
  }

  return current;
}

async function buildMarketStateBatch(input: CreateMarketWineBatchInput): Promise<WineBatch> {
  const stateProfile = input.stateProfile ?? { state: 'grapes' };
  const pseudoVineyardName = getPseudoVineyardName(input.supplierName, input.source.region);
  const pseudoVineyard = buildPseudoVineyardFromMarketSource(input.source, pseudoVineyardName, input.grape);
  const originSnapshot = buildMarketOriginSnapshot(
    input.supplierId,
    input.supplierName,
    input.originTag,
    stateProfile.state,
    input.source
  );

  const prestigeData = await calculateCurrentPrestige();
  let batch = await buildHarvestStageBatch({
    vineyard: pseudoVineyard,
    vineyardId: 'market_purchase',
    vineyardName: input.supplierName,
    grape: input.grape,
    quantity: input.quantity,
    harvestStartDate: input.harvestStartDate,
    harvestEndDate: input.harvestEndDate,
    originSnapshot,
    companyPrestige: prestigeData.companyPrestige,
    vineyardPrestige: 0
  });

  if (stateProfile.state === 'must_ready') {
    if (!stateProfile.crushingOptions) {
      throw new Error('Market must preview requires crushing options.');
    }
    batch = await applyCrushingProfileToBatch(batch, stateProfile.crushingOptions);
  }

  if (stateProfile.state === 'must_fermenting') {
    if (!stateProfile.crushingOptions || !stateProfile.fermentationOptions) {
      throw new Error('Market fermenting preview requires crushing and fermentation options.');
    }
    batch = await applyCrushingProfileToBatch(batch, stateProfile.crushingOptions);
    batch = await applyFermentationSetupToBatch(batch, stateProfile.fermentationOptions);
    batch = applyFermentationContactWeeks(batch, stateProfile.fermentationWeeksApplied ?? 0);
    batch = {
      ...batch,
      fermentationProgress: stateProfile.fermentationProgress ?? 0
    };
  }

  batch.estimatedPrice = calculateEstimatedPrice(batch, pseudoVineyard, prestigeData.companyPrestige, 0);
  return batch;
}

/**
 * Inventory Service
 * Manages wine batch inventory lifecycle and business logic
 */

// ===== WINE BATCH OPERATIONS =====

/**
 * Find existing compatible wine batch that can be combined with new harvest
 * Compatible batches must have same vineyard ID and same vintage (harvest year)
 * @param vineyardId - ID of the vineyard
 * @param grape - Grape variety
 * @param harvestYear - Year the grapes were harvested
 * @returns Compatible wine batch or null if none found
 */
async function findCompatibleWineBatch(
  vineyardId: string,
  grape: GrapeVariety,
  harvestYear: number
): Promise<WineBatch | null> {
  const existingBatches = await loadWineBatches();
  
  // Find existing batch with same vineyard, grape, and vintage that's still in 'grapes' stage
  const compatibleBatch = existingBatches.find(batch => 
    batch.vineyardId === vineyardId &&
    batch.grape === grape &&
    batch.harvestStartDate.year === harvestYear &&
    batch.state === 'grapes' // Only combine with batches still in grape stage
  );
  
  return compatibleBatch || null;
}

/**
 * Combine two wine batches using weighted averaging for quality properties
 * @param existingBatch - The existing wine batch to combine with
 * @param newQuantity - Quantity of new grapes to add
 * @param newLandValueModifier - Land-value modifier of new grapes
 * @param newCharacteristics - Characteristics of new grapes
 * @param newWineAnchors - Anchors for the incoming harvest portion
 * @returns Updated wine batch with combined properties
 */
function combineWineBatches(
  existingBatch: WineBatch,
  newQuantity: number,
  newLandValueModifier: number,
  newCharacteristics: WineCharacteristics,
  newWineAnchors: WineBatch['wineAnchors']
): WineBatch {
  const totalQuantity = existingBatch.quantity + newQuantity;
  const existingWeight = existingBatch.quantity / totalQuantity;
  const newWeight = newQuantity / totalQuantity;
  
  // Calculate weighted averages for index properties
  const existingLandValueModifier = existingBatch.landValueModifier;
  const combinedTasteQualityIndex = DEFAULT_TASTE_QUALITY_INDEX;
  const combinedLandValueModifier = (existingLandValueModifier * existingWeight) + (newLandValueModifier * newWeight);
  // Combine characteristics using weighted averages
  const combinedCharacteristics: WineCharacteristics = {
    acidity: (existingBatch.characteristics.acidity * existingWeight) + (newCharacteristics.acidity * newWeight),
    aroma: (existingBatch.characteristics.aroma * existingWeight) + (newCharacteristics.aroma * newWeight),
    body: (existingBatch.characteristics.body * existingWeight) + (newCharacteristics.body * newWeight),
    spice: (existingBatch.characteristics.spice * existingWeight) + (newCharacteristics.spice * newWeight),
    sweetness: (existingBatch.characteristics.sweetness * existingWeight) + (newCharacteristics.sweetness * newWeight),
    tannins: (existingBatch.characteristics.tannins * existingWeight) + (newCharacteristics.tannins * newWeight)
  };
  
  // Replace partial harvest effects with combined harvest effects
  // Get the grape base characteristics for calculating net harvest effects
  const grapeBase = GRAPE_CONST[existingBatch.grape].baseCharacteristics;
  
  // Calculate the net harvest effects (combined characteristics - grape base)
  const harvestEffects = Object.keys(combinedCharacteristics).map(characteristic => {
    const baseValue = grapeBase[characteristic as keyof WineCharacteristics];
    const finalValue = combinedCharacteristics[characteristic as keyof WineCharacteristics];
    const netEffect = finalValue - baseValue;
    
    return {
      characteristic: characteristic as keyof WineCharacteristics,
      modifier: netEffect,
      description: getHarvestEffectDescription(characteristic)
    };
  });
  
  const mergedAnchors = combineWineAnchorSets(
    existingBatch.wineAnchors,
    newWineAnchors,
    existingBatch.quantity,
    newQuantity
  );
  const existingSharePct = existingWeight * 100;
  const newSharePct = newWeight * 100;
  const formatAnchorValue = (value: number): string => value.toFixed(3);
  const formatShare = (value: number): string => value.toFixed(1);
  const combinedAnchorEffects = WINE_ANCHOR_KEYS.map((anchor) => {
    const existingValue = existingBatch.wineAnchors[anchor];
    const incomingValue = newWineAnchors[anchor];
    const mergedValue = mergedAnchors[anchor];
    return {
      anchor,
      modifier: mergedValue - 0.5,
      description: `Harvest anchor blend: (${formatAnchorValue(existingValue)} x ${formatShare(existingSharePct)}% existing batch qty ${Math.round(existingBatch.quantity)}) + (${formatAnchorValue(incomingValue)} x ${formatShare(newSharePct)}% new harvest qty ${Math.round(newQuantity)}) = ${formatAnchorValue(mergedValue)}`
    };
  });

  // Create new breakdown with only the combined harvest effects
  // This replaces all individual partial harvest effects
  const combinedBreakdown = {
    effects: harvestEffects,
    anchorEffects: combinedAnchorEffects
  };
  const structureRanges = getAnchorAdjustedStructureRanges(
    BASE_BALANCED_RANGES,
    resolveWineAnchors(mergedAnchors)
  );
  const structureIndexResult = calculateStructureIndex(
    combinedCharacteristics,
    structureRanges,
    RANGE_ADJUSTMENTS,
    RULES
  );

  const combinedBatch: WineBatch = {
    ...existingBatch,
    quantity: totalQuantity,
    landValueModifierHarvestSnapshot: combinedLandValueModifier,
    structureIndexHarvestSnapshot: structureIndexResult.score,
    landValueModifier: combinedLandValueModifier,
    tasteQualityIndex: combinedTasteQualityIndex,
    tasteQualityIndexHarvestSnapshot: combinedTasteQualityIndex,
    structureIndex: structureIndexResult.score,
    characteristics: combinedCharacteristics,
    breakdown: combinedBreakdown,
    wineAnchors: mergedAnchors
    // Note: finalPrice will be recalculated after combination
  };
  const tasteQualityIndex = getTasteQualityIndex(combinedBatch);
  return {
    ...combinedBatch,
    tasteQualityIndex: tasteQualityIndex,
    tasteQualityIndexHarvestSnapshot: tasteQualityIndex
  };
}

// Create wine batch from harvest
export async function createWineBatchFromHarvest(
  vineyardId: string,
  vineyardName: string,
  grape: GrapeVariety,
  quantity: number,
  harvestStartDate: GameDate,  // Required: activity start date
  harvestEndDate: GameDate     // Required: current harvest date for this batch
): Promise<WineBatch> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);

  if (!vineyard) {
    throw new Error(`Vineyard not found: ${vineyardId}`);
  }
  const existingBatch = await findCompatibleWineBatch(vineyardId, grape, harvestStartDate.year);
  const prestigeData = await calculateCurrentPrestige();

  const incomingBatch = await buildHarvestStageBatch({
    vineyard,
    vineyardId,
    vineyardName,
    grape,
    quantity,
    harvestStartDate,
    harvestEndDate,
    companyPrestige: prestigeData.companyPrestige,
    vineyardPrestige: vineyard.vineyardPrestige
  });

  if (existingBatch) {
    const combinedBatch = combineWineBatches(
      existingBatch,
      quantity,
      incomingBatch.landValueModifierHarvestSnapshot,
      incomingBatch.characteristics,
      incomingBatch.wineAnchors
    );

    const estimatedPrice = calculateEstimatedPrice(
      combinedBatch,
      vineyard,
      prestigeData.companyPrestige,
      vineyard.vineyardPrestige
    );
    combinedBatch.estimatedPrice = estimatedPrice;
    const startCandidate = existingBatch.harvestStartDate;
    const endCandidate = existingBatch.harvestEndDate;
    combinedBatch.harvestStartDate = getAbsoluteWeek(harvestStartDate) < getAbsoluteWeek(startCandidate) ? harvestStartDate : startCandidate;
    combinedBatch.harvestEndDate = getAbsoluteWeek(harvestEndDate) > getAbsoluteWeek(endCandidate) ? harvestEndDate : endCandidate;

    await saveWineBatch(combinedBatch);
    triggerGameUpdate();
    return combinedBatch;
  }

  await saveWineBatch(incomingBatch);
  triggerGameUpdate();
  return incomingBatch;
}

export async function buildMarketPreviewBatch(input: CreateMarketWineBatchInput): Promise<WineBatch> {
  return await buildMarketStateBatch(input);
}

export async function createWineBatchFromMarketSource(input: CreateMarketWineBatchInput): Promise<WineBatch> {
  const batch = await buildMarketStateBatch(input);
  await saveWineBatch(batch);
  triggerGameUpdate();
  return batch;
}

// Get all wine batches
export async function getAllWineBatches(): Promise<WineBatch[]> {
  return await loadWineBatches();
}

const getBatchSuffix = (batch: WineBatch): string | null => {
  const groupSize = batch.batchGroupSize ?? 0;
  const batchNumber = batch.batchNumber ?? 0;

  if (groupSize <= 1 || batchNumber <= 0) {
    return null;
  }

  return `Batch ${batchNumber}/${groupSize}`;
};

export function getWineBatchDisplayName(batch: WineBatch): string {
  const baseName = `${batch.grape} - ${batch.vineyardName}`;
  const suffix = getBatchSuffix(batch);
  return suffix ? `${baseName} (${suffix})` : baseName;
}

// Update wine batch
export async function updateInventoryBatch(batchId: string, updates: Partial<WineBatch>): Promise<boolean> {
  const success = await updateWineBatch(batchId, updates);
  if (success) {
    triggerGameUpdate();
  }
  return success;
}

// Format completed wine name
export function formatCompletedWineName(batch: WineBatch): string {
  if (batch.state === 'bottled') {
    const baseName = `${batch.grape}, ${batch.vineyardName}, ${batch.harvestStartDate.year}`;
    const suffix = getBatchSuffix(batch);
    return suffix ? `${baseName} (${suffix})` : baseName;
  }
  return getWineBatchDisplayName(batch);
}

/**
 * Get harvest effect description for a characteristic
 * Maps characteristic names to their vineyard parameter descriptions
 */
function getHarvestEffectDescription(characteristic: string): string {
  switch (characteristic) {
    case 'acidity':
      return 'Grape Ripeness';
    case 'aroma':
      return 'Land Value Modifier';
    case 'body':
      return 'Vineyard Altitude';
    case 'spice':
      return 'Regional Grape Suitability';
    case 'sweetness':
      return 'Vegetation Overgrowth';
    case 'tannins':
      return 'Debris Accumulation';
    default:
      return 'Harvest Effects';
  }
}



