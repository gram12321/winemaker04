
import { v4 as uuidv4 } from 'uuid';
import { WineBatch, GrapeVariety, WineCharacteristics, GameDate } from '../../../types/types';
import { saveWineBatch, loadWineBatches, updateWineBatch } from '../../../database/activities/inventoryDB';
import { loadVineyards } from '../../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../../hooks/useGameUpdates';
import { calculateEstimatedPrice } from '../winescore/wineScoreCalculation';
import { calculateCurrentPrestige } from '../../prestige/prestigeService';
import { calculateWineBalance, RANGE_ADJUSTMENTS, RULES } from '../../../balance';
import { BASE_BALANCED_RANGES } from '../../../constants/grapeConstants';
import { calculateGrapeQuality } from '../winescore/grapeQualityCalculation';
import { generateDefaultCharacteristics } from '../characteristics/defaultCharacteristics';
import { modifyHarvestCharacteristics } from '../characteristics/harvestCharacteristics';
import { REGION_ALTITUDE_RANGES, REGION_GRAPE_SUITABILITY } from '../../../constants/vineyardConstants';
import { GRAPE_CONST } from '../../../constants/grapeConstants';
import { initializeBatchFeatures, processEventTrigger } from '../features/featureService';

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
 * @param newQuality - Quality of new grapes
 * @param newBalance - Balance of new grapes
 * @param newCharacteristics - Characteristics of new grapes
 * @returns Updated wine batch with combined properties
 */
function combineWineBatches(
  existingBatch: WineBatch,
  newQuantity: number,
  newQuality: number,
  newBalance: number,
  newCharacteristics: WineCharacteristics
): WineBatch {
  const totalQuantity = existingBatch.quantity + newQuantity;
  const existingWeight = existingBatch.quantity / totalQuantity;
  const newWeight = newQuantity / totalQuantity;
  
  // Calculate weighted averages for quality properties
  const combinedQuality = (existingBatch.grapeQuality * existingWeight) + (newQuality * newWeight);
  const combinedBalance = (existingBatch.balance * existingWeight) + (newBalance * newWeight);
  
  // Combine characteristics using weighted averages
  const combinedCharacteristics: WineCharacteristics = {
    acidity: (existingBatch.characteristics.acidity * existingWeight) + (newCharacteristics.acidity * newWeight),
    aroma: (existingBatch.characteristics.aroma * existingWeight) + (newCharacteristics.aroma * newWeight),
    body: (existingBatch.characteristics.body * existingWeight) + (newCharacteristics.body * newWeight),
    spice: (existingBatch.characteristics.spice * existingWeight) + (newCharacteristics.spice * newWeight),
    sweetness: (existingBatch.characteristics.sweetness * existingWeight) + (newCharacteristics.sweetness * newWeight),
    tannins: (existingBatch.characteristics.tannins * existingWeight) + (newCharacteristics.tannins * newWeight)
  };
  
  // Combine breakdown effects (append new effects to existing ones)
  const combinedBreakdown = {
    effects: [
      ...(existingBatch.breakdown?.effects || [])
    ]
  };

  // Return updated batch with combined properties
  return {
    ...existingBatch,
    quantity: totalQuantity,
    grapeQuality: combinedQuality,
    balance: combinedBalance,
    characteristics: combinedCharacteristics,
    breakdown: combinedBreakdown
    // Note: finalPrice will be recalculated after combination
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
  // Get vineyard data for pricing calculations
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard) {
    throw new Error(`Vineyard not found: ${vineyardId}`);
  }
  
  // Get grape metadata
  const grapeMetadata = GRAPE_CONST[grape];
  
  // Derive starting characteristics from grape base + vineyard conditions
  const base = generateDefaultCharacteristics(grape);
  const country = vineyard.country;
  const region = vineyard.region;
  const altitude = vineyard.altitude;
  const countryAlt = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES] || {} as any;
  const [minAlt, maxAlt] = (countryAlt[region as keyof typeof countryAlt] as [number, number]) || [0, 100];
  const suitCountry = REGION_GRAPE_SUITABILITY[country as keyof typeof REGION_GRAPE_SUITABILITY] || {} as any;
  const suitability = (suitCountry[region as keyof typeof suitCountry]?.[grape as any] ?? 0.5) as number;
  const { characteristics, breakdown } = modifyHarvestCharacteristics({
    baseCharacteristics: base,
    ripeness: vineyard.ripeness || 0.5,
    qualityFactor: calculateGrapeQuality(vineyard), // Use actual vineyard grape quality instead of hardcoded 0.5
    suitability,
    altitude,
    medianAltitude: (minAlt + maxAlt) / 2,
    maxAltitude: maxAlt,
    grapeColor: GRAPE_CONST[grape].grapeColor,
    overgrowth: vineyard.overgrowth,
    density: vineyard.density || 0
  });
  
  // Calculate balance using the sophisticated balance system
  const balanceResult = calculateWineBalance(characteristics, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES);
  
  // Calculate quality from vineyard factors (land value, prestige, altitude, etc.)
  const quality = calculateGrapeQuality(vineyard);
  
  // Check for existing compatible wine batch
  const existingBatch = await findCompatibleWineBatch(vineyardId, grape, harvestStartDate.year);
  
  if (existingBatch) {
    // Combine with existing batch
    const combinedBatch = combineWineBatches(
      existingBatch,
      quantity,
      quality, // Use vineyard quality
      balanceResult.score, // Use balance score
      characteristics
    );
    
    // Recalculate estimated price for the combined batch with prestige multipliers
    const prestigeData = await calculateCurrentPrestige();
    const estimatedPrice = calculateEstimatedPrice(
      combinedBatch, 
      vineyard, 
      prestigeData.companyPrestige, 
      vineyard.vineyardPrestige
    );
    combinedBatch.estimatedPrice = estimatedPrice;
    
    // Update harvest period bounds
    const startCandidate = existingBatch.harvestStartDate;
    const endCandidate = existingBatch.harvestEndDate;
    
    // Helper to compare dates as absolute weeks
    const toAbs = (d: { week: number; season: string; year: number }): number => {
      const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
      const idx = seasons.indexOf(d.season);
      return (d.year - 2024) * 52 + idx * 13 + (d.week - 1);
    };
    const newStart = toAbs(harvestStartDate) < toAbs(startCandidate) ? harvestStartDate : startCandidate;
    const newEnd = toAbs(harvestEndDate) > toAbs(endCandidate) ? harvestEndDate : endCandidate;
    combinedBatch.harvestStartDate = newStart as any;
    combinedBatch.harvestEndDate = newEnd as any;
    
    await saveWineBatch(combinedBatch);
    triggerGameUpdate();
    return combinedBatch;
  } else {
    // Create new wine batch
    const wineBatch: WineBatch = {
      id: uuidv4(),
      vineyardId,
      vineyardName,
      grape,
      quantity,
      state: 'grapes',
      fermentationProgress: 0,
      // Set born values (immutable snapshots at harvest)
      bornGrapeQuality: quality, // Original vineyard quality
      bornBalance: balanceResult.score, // Original balance
      // Set current values (will be modified by features)
      grapeQuality: quality, // Use vineyard quality (land value, prestige, altitude, etc.)
      balance: balanceResult.score, // Use calculated balance from wine characteristics
      characteristics,
      breakdown, // Store breakdown data
      estimatedPrice: 0, // Will be calculated below
      grapeColor: grapeMetadata.grapeColor,
      naturalYield: grapeMetadata.naturalYield,
      fragile: grapeMetadata.fragile,
      proneToOxidation: grapeMetadata.proneToOxidation,
      features: initializeBatchFeatures(), // Initialize features array
      harvestStartDate: harvestStartDate,
      harvestEndDate: harvestEndDate
    };

    // Calculate estimated price using the pricing service with prestige multipliers
    const prestigeData = await calculateCurrentPrestige();
    const estimatedPrice = calculateEstimatedPrice(
      wineBatch, 
      vineyard, 
      prestigeData.companyPrestige, 
      vineyard.vineyardPrestige
    );
    wineBatch.estimatedPrice = estimatedPrice;

    // Process harvest event triggers (e.g., green flavor from underripe grapes)
    const batchWithEventFeatures = await processEventTrigger(wineBatch, 'harvest', vineyard);

    await saveWineBatch(batchWithEventFeatures);
    triggerGameUpdate();
    return batchWithEventFeatures;
  }
}

// Get all wine batches
export async function getAllWineBatches(): Promise<WineBatch[]> {
  return await loadWineBatches();
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
    return `${batch.grape}, ${batch.vineyardName}, ${batch.harvestStartDate.year}`;
  }
  return `${batch.grape} (${batch.state})`;
}
