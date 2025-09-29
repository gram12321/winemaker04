import { WineBatch } from '../../../types/types';
import { updateInventoryBatch } from '../inventoryService';
import { loadWineBatches } from '../../../database/activities/inventoryDB';
import { getGameState } from '../../core/gameState';
import { recordBottledWine } from '../../user/wineLogService';

/**
 * Fermentation Manager
 * Handles fermentation workflow and wine production processes
 */

/**
 * Start Fermentation: Begin fermentation process
 */
export async function startFermentation(batchId: string): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.state !== 'must_ready') {
    return false;
  }

  return await updateInventoryBatch(batchId, {
    state: 'must_fermenting',
    fermentationProgress: 0
  });
}

/**
 * Stop Fermentation: Complete fermentation and move to aging
 */
export async function stopFermentation(batchId: string): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.state !== 'must_fermenting') {
    return false;
  }

  return await updateInventoryBatch(batchId, {
    state: 'wine_aging',
    fermentationProgress: 100
  });
}

/**
 * Bottling: Complete wine production
 */
export async function bottleWine(batchId: string): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.state !== 'wine_aging') {
    return false;
  }

  const gameState = getGameState();
  
  const success = await updateInventoryBatch(batchId, {
    state: 'bottled',
    quantity: Math.floor(batch.quantity / 1.5), // Convert kg to bottles (1.5kg per bottle)
    completedAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    }
  });

  // Record the bottled wine in the production log
  if (success) {
    try {
      // Get the updated batch to record in the log
      const updatedBatches = await loadWineBatches();
      const bottledBatch = updatedBatches.find(b => b.id === batchId);
      
      if (bottledBatch && bottledBatch.state === 'bottled') {
        await recordBottledWine(bottledBatch);
      }
    } catch (error) {
      console.error('Failed to record bottled wine in production log:', error);
      // Don't fail the bottling process if logging fails
    }
  }

  return success;
}

/**
 * Progress Fermentation: Simulate fermentation progress over time
 */
export async function progressFermentation(batchId: string, progressIncrement: number = 10): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.state !== 'must_fermenting') {
    return false;
  }

  const newProgress = Math.min(100, (batch.fermentationProgress || 0) + progressIncrement);
  
  // Auto-complete fermentation at 100%
  if (newProgress >= 100) {
    return await stopFermentation(batchId);
  }

  return await updateInventoryBatch(batchId, {
    fermentationProgress: newProgress
  });
}

/**
 * Check if fermentation action is available for a batch
 */
export function isFermentationActionAvailable(batch: WineBatch, action: 'ferment' | 'stop' | 'bottle'): boolean {
  switch (action) {
    case 'ferment':
      return batch.state === 'must_ready';
    case 'stop':
      return batch.state === 'must_fermenting' && (batch.fermentationProgress || 0) > 0;
    case 'bottle':
      return batch.state === 'wine_aging';
    default:
      return false;
  }
}
