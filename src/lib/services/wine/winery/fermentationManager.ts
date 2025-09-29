import { WineBatch } from '../../../types/types';
import { updateWineBatch } from '../../../database/activities/inventoryDB';
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
  
  if (!batch || batch.stage !== 'must' || batch.process !== 'none') {
    return false;
  }

  return await updateWineBatch(batchId, {
    process: 'fermentation',
    fermentationProgress: 0
  });
}

/**
 * Stop Fermentation: Complete fermentation and move to aging
 */
export async function stopFermentation(batchId: string): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.process !== 'fermentation') {
    return false;
  }

  return await updateWineBatch(batchId, {
    stage: 'wine',
    process: 'aging',
    fermentationProgress: 100
  });
}

/**
 * Bottling: Complete wine production
 */
export async function bottleWine(batchId: string): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.process !== 'aging') {
    return false;
  }

  const gameState = getGameState();
  
  const success = await updateWineBatch(batchId, {
    stage: 'bottled',
    process: 'bottled',
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
      
      if (bottledBatch && bottledBatch.stage === 'bottled') {
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
  
  if (!batch || batch.process !== 'fermentation') {
    return false;
  }

  const newProgress = Math.min(100, (batch.fermentationProgress || 0) + progressIncrement);
  
  // Auto-complete fermentation at 100%
  if (newProgress >= 100) {
    return await stopFermentation(batchId);
  }

  return await updateWineBatch(batchId, {
    fermentationProgress: newProgress
  });
}

/**
 * Check if fermentation action is available for a batch
 */
export function isFermentationActionAvailable(batch: WineBatch, action: 'ferment' | 'stop' | 'bottle'): boolean {
  switch (action) {
    case 'ferment':
      return batch.stage === 'must' && batch.process === 'none';
    case 'stop':
      return batch.process === 'fermentation' && (batch.fermentationProgress || 0) > 0;
    case 'bottle':
      return batch.process === 'aging';
    default:
      return false;
  }
}
