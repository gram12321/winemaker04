// Wine batch management service for winery operations
import { v4 as uuidv4 } from 'uuid';
import { WineBatch, GrapeVariety } from '../types';
import { saveWineBatch, loadWineBatches, loadVineyards } from '../database/database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { getGameState } from './gameState';
import { generateWineCharacteristics } from './sales/wineQualityIndexCalculationService';
import { calculateFinalWinePrice } from './sales/pricingService';
import { getCurrentCompany } from './gameState';

// ===== WINE BATCH OPERATIONS =====

// Create wine batch from harvest
export async function createWineBatchFromHarvest(
  vineyardId: string,
  vineyardName: string,
  grape: GrapeVariety,
  quantity: number
): Promise<WineBatch> {
  const currentCompany = getCurrentCompany();
  const companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  const gameState = getGameState();
  
  // Get vineyard data for pricing calculations
  const vineyards = await loadVineyards(companyId);
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard) {
    throw new Error(`Vineyard not found: ${vineyardId}`);
  }
  
  // Generate wine quality characteristics using the new quality service
  const { quality, balance } = generateWineCharacteristics(grape, vineyardId);
  
  // Create initial wine batch without final price
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
    finalPrice: 0, // Will be calculated below
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

  // Calculate final price using the new pricing service
  const finalPrice = calculateFinalWinePrice(wineBatch, vineyard);
  wineBatch.finalPrice = finalPrice;

  await saveWineBatch(wineBatch, companyId);
  triggerGameUpdate();
  return wineBatch;
}


// Get all wine batches
export async function getAllWineBatches(): Promise<WineBatch[]> {
  const currentCompany = getCurrentCompany();
  const companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  return await loadWineBatches(companyId);
}

// Update wine batch
export async function updateWineBatch(batchId: string, updates: Partial<WineBatch>): Promise<boolean> {
  const currentCompany = getCurrentCompany();
  const companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  const batches = await loadWineBatches(companyId);
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch) {
    return false;
  }

  const updatedBatch: WineBatch = {
    ...batch,
    ...updates
  };

  await saveWineBatch(updatedBatch, companyId);
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
