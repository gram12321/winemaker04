// Wine batch management service for winery operations
import { v4 as uuidv4 } from 'uuid';
import { WineBatch, GrapeVariety } from '../types';
import { saveWineBatch, loadWineBatches } from '../database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { getGameState } from '../gameState';
import { SALES_CONSTANTS, WINE_QUALITY_CONSTANTS, PRICING_PLACEHOLDER_CONSTANTS } from '../constants';
import { calculateBaseWinePrice, calculateAsymmetricalMultiplier } from '../utils/calculator';

// ===== WINE BATCH OPERATIONS =====

// Create wine batch from harvest
export async function createWineBatchFromHarvest(
  vineyardId: string,
  vineyardName: string,
  grape: GrapeVariety,
  quantity: number
): Promise<WineBatch> {
  const gameState = getGameState();
  
  // Initialize wine quality properties with placeholder values and random variation
  // TODO: Later this will be influenced by grape variety, vineyard characteristics, weather, etc.
  const baseQuality = WINE_QUALITY_CONSTANTS.BASE_QUALITY;
  const baseBalance = WINE_QUALITY_CONSTANTS.BASE_BALANCE;
  
  // Add random variation (QUALITY_VARIATION already handles the math)
  const quality = Math.max(0, Math.min(1, baseQuality + (Math.random() - 0.5) * WINE_QUALITY_CONSTANTS.QUALITY_VARIATION));
  const balance = Math.max(0, Math.min(1, baseBalance + (Math.random() - 0.5) * WINE_QUALITY_CONSTANTS.QUALITY_VARIATION));
  
  // Calculate base price using new sophisticated system
  // Base Price = (Land Value + Prestige) × Base Rate (with placeholders)
  const basePrice = calculateBaseWinePrice(
    PRICING_PLACEHOLDER_CONSTANTS.LAND_VALUE_PLACEHOLDER, 
    PRICING_PLACEHOLDER_CONSTANTS.PRESTIGE_PLACEHOLDER, 
    SALES_CONSTANTS.BASE_RATE_PER_BOTTLE
  );
  
  // Calculate quality/balance multiplier (50/50 combination)
  const combinedScore = (quality + balance) / 2;
  const qualityMultiplier = calculateAsymmetricalMultiplier(combinedScore);
  
  // Calculate final price: Base Price × Quality/Balance Multiplier
  const finalPrice = Math.max(
    SALES_CONSTANTS.MIN_PRICE_PER_BOTTLE, 
    Math.round(basePrice * qualityMultiplier * 100) / 100
  );
  
  const wineBatch: WineBatch = {
    id: uuidv4(),
    vineyardId,
    vineyardName,
    grape,
    quantity,
    stage: 'grapes',
    process: 'none',
    fermentationProgress: 0,
    quality,
    balance,
    finalPrice: finalPrice,
    harvestDate: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    },
    createdAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    }
  };

  await saveWineBatch(wineBatch);
  triggerGameUpdate();
  return wineBatch;
}


// Get all wine batches
export async function getAllWineBatches(): Promise<WineBatch[]> {
  return await loadWineBatches();
}

// Update wine batch
export async function updateWineBatch(batchId: string, updates: Partial<WineBatch>): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return false;
  }

  const updatedBatch: WineBatch = {
    ...batch,
    ...updates
  };

  await saveWineBatch(updatedBatch);
  triggerGameUpdate();
  return true;
}

// Format completed wine name
export function formatCompletedWineName(batch: WineBatch): string {
  if (batch.process === 'bottled') {
    return `${batch.grape}, ${batch.vineyardName}, ${batch.harvestDate.year}`;
  }
  return `${batch.grape} (${batch.stage})`;
}
