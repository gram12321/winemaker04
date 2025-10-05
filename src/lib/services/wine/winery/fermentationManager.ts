import { WineBatch } from '../../../types/types';
import { updateInventoryBatch } from '../inventoryService';
import { loadWineBatches, updateWineBatch } from '../../../database/activities/inventoryDB';
import { getGameState } from '../../core/gameState';
import { recordBottledWine } from '../../user/wineLogService';
import { createActivity } from '../../activity/activitymanagers/activityManager';
import { WorkCategory } from '../../activity';
import { calculateFermentationWork } from '../../activity/workcalculators/fermentationWorkCalculator';
import { FermentationOptions, applyWeeklyFermentationEffects } from '../characteristics/fermentationCharacteristics';
import { calculateWineBalance, RANGE_ADJUSTMENTS, RULES } from '../../../balance';
import { BASE_BALANCED_RANGES } from '../../../constants/grapeConstants';
import { calculateWineQuality } from '../wineQualityCalculationService';
import { loadVineyards } from '../../../database/activities/vineyardDB';

/**
 * Fermentation Manager
 * Handles fermentation workflow and wine production processes
 */

/**
 * Start Fermentation Activity: Create activity to begin fermentation process
 */
export async function startFermentationActivity(
  batch: WineBatch, 
  options: FermentationOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate batch state
    if (batch.state !== 'must_ready') {
      return { success: false, error: 'Batch must be in must_ready stage for fermentation' };
    }

    // Calculate work and cost
    const { totalWork, cost } = calculateFermentationWork(batch, options);

    // Create the fermentation activity
    await createActivity({
      category: WorkCategory.FERMENTATION,
      title: `Fermentation Setup - ${batch.grape} from ${batch.vineyardName}`,
      totalWork,
      targetId: batch.id,
      params: {
        batchId: batch.id,
        fermentationOptions: options,
        cost,
        targetName: `${batch.grape} from ${batch.vineyardName}`
      },
      isCancellable: false // Fermentation setup should not be cancellable once started
    });

    return { success: true };
  } catch (error) {
    console.error('Error starting fermentation activity:', error);
    return { success: false, error: 'Failed to start fermentation activity' };
  }
}

/**
 * Bottling: Complete wine production (updated for new fermentation system)
 */
export async function bottleWine(batchId: string): Promise<boolean> {
  const batches = await loadWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  // Updated to accept must_fermenting state (no wine_aging state)
  if (!batch || batch.state !== 'must_fermenting') {
    return false;
  }

  const gameState = getGameState();
  
  // Preserve all wine batch values and only update necessary fields
  const success = await updateInventoryBatch(batchId, {
    state: 'bottled',
    quantity: Math.floor(batch.quantity / 1.5), // Convert kg to bottles (1.5kg per bottle)
    bottledDate: {
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
 * Check if fermentation action is available for a batch (updated for new system)
 */
export function isFermentationActionAvailable(batch: WineBatch, action: 'ferment' | 'bottle'): boolean {
  switch (action) {
    case 'ferment':
      // Check if batch is in correct state
      if (batch.state !== 'must_ready') {
        return false;
      }
      
      // Check if there's already an active fermentation activity for this batch
      const gameState = getGameState();
      const activeActivities = gameState.activities || [];
      const hasActiveFermentation = activeActivities.some(activity => 
        activity.category === WorkCategory.FERMENTATION &&
        activity.targetId === batch.id &&
        activity.status === 'active'
      );
      
      return !hasActiveFermentation;
      
    case 'bottle':
      return batch.state === 'must_fermenting'; // Updated: no wine_aging state
    default:
      return false;
  }
}

/**
 * Process weekly fermentation effects for all fermenting batches
 * Called by game tick system
 */
export async function processWeeklyFermentation(): Promise<void> {
  try {
    const batches = await loadWineBatches();
    const fermentingBatches = batches.filter(batch => 
      batch.state === 'must_fermenting' && batch.fermentationOptions
    );

    for (const batch of fermentingBatches) {
      if (!batch.fermentationOptions) continue;

      // Apply weekly fermentation effects
      const { characteristics: newCharacteristics, breakdown } = applyWeeklyFermentationEffects({
        baseCharacteristics: batch.characteristics,
        method: batch.fermentationOptions.method,
        temperature: batch.fermentationOptions.temperature
      });

      // Recalculate balance based on new characteristics
      const balanceResult = calculateWineBalance(newCharacteristics, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES);
      
      // Calculate quality from vineyard factors (land value, prestige, altitude, etc.)
      const vineyards = await loadVineyards();
      const vineyard = vineyards.find(v => v.id === batch.vineyardId);
      const newQuality = vineyard ? calculateWineQuality(vineyard) : batch.quality;

      // Combine existing breakdown with new fermentation breakdown
      const combinedBreakdown = {
        effects: [
          ...(batch.breakdown?.effects || []),
          ...breakdown.effects
        ]
      };

      // Update the batch with new characteristics, quality, and balance
      await updateWineBatch(batch.id, {
        characteristics: newCharacteristics,
        quality: newQuality,
        balance: balanceResult.score,
        breakdown: combinedBreakdown
      });
    }
  } catch (error) {
    console.error('Error processing weekly fermentation:', error);
  }
}
