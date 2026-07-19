import { WineBatch } from '../../../types/types';
import { bottleStorageBackedWineBatch, loadWineBatches, bulkUpdateWineBatches, updateWineBatch } from '../../../database/activities/inventoryDB';
import { getGameState } from '../../core/gameState';
import { recordBottledWine } from '../../user/wineLogService';
import { processEventTrigger } from '../features/featureService';
import { activitiesFeature } from '@/lib/features/activities';
import { WorkCategory } from '@/lib/types/types';
import { FermentationOptions, applyWeeklyFermentationEffects } from '../characteristics/fermentationCharacteristics';
import { resolveWineAnchors } from '../anchors/wineAnchorService';
import { getAnchorAdjustedStructureRanges } from '../anchors/wineAnchorCharacteristicBridge';
import { calculateStructureIndex, RANGE_ADJUSTMENTS, RULES } from '../../../wineStructure';
import { BASE_BALANCED_RANGES } from '../../../constants/grapeConstants';
import { calculateWineScore, getTasteQualityIndex } from '../winescore/wineScoreCalculation';
import { applyWeeklyFermentationContactToWineAnchors } from '../anchors/wineAnchorProcess';
import { diffAnchorEffects } from '../debug/wineAnchorEffectUtils';
import { assertBatchHasUsableStorage } from './storageVesselAllocationService';
import { isBatchEmptyingInProgress } from './storageVesselMaintenanceService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { triggerGameUpdate } from '@/hooks/useGameUpdates';

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
    if (isBatchEmptyingInProgress(batch.id)) {
      return { success: false, error: 'This batch is scheduled to be emptied.' };
    }
    // Validate batch state
    if (batch.state !== 'must_ready') {
      return { success: false, error: 'Batch must be in must_ready stage for fermentation' };
    }
    const storageValidation = await assertBatchHasUsableStorage(batch);
    if (!storageValidation.valid) {
      return { success: false, error: storageValidation.reason };
    }

    // Calculate work and cost
    const { totalWork, cost } = activitiesFeature.work.calculateFermentation(batch, options);

    // Create the fermentation activity
    await activitiesFeature.lifecycle.create({
      category: WorkCategory.FERMENTATION,
      title: `Fermentation Setup - ${batch.grape},  ${batch.harvestStartDate.year}, ${batch.vineyardName}`,
      totalWork,
      activityDetails: `Method: ${options.method}, Temperature: ${options.temperature}`,
      targetId: batch.id,
      params: {
        batchId: batch.id,
        grape: batch.grape, // Add grape for XP bonus
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
  if (isBatchEmptyingInProgress(batch.id)) return false;

  const gameState = getGameState();

  // Calculate wine score at bottling for snapshot
  const wineScoreBottlingSnapshot = calculateWineScore(batch);
  const tasteQualityIndexBottlingSnapshot = getTasteQualityIndex(batch);
  const landValueModifierBottlingSnapshot = batch.landValueModifier;

  // Preserve all wine batch values and update necessary fields + create bottling snapshots
  const companyId = getCurrentCompanyId();
  if (!companyId) return false;
  const success = await bottleStorageBackedWineBatch({
    companyId,
    batchId,
    quantity: batch.quantity / 1.5,
    bottledWeek: gameState.week || 1,
    bottledSeason: gameState.season || 'Spring',
    bottledYear: gameState.currentYear || 2024,
    tasteQualityIndexBottlingSnapshot,
    landValueModifierBottlingSnapshot,
    structureIndexBottlingSnapshot: batch.structureIndex,
    wineScoreBottlingSnapshot,
  });

  // Record the bottled wine in the production log and trigger bottling events
  if (success) {
    triggerGameUpdate();
    try {
      // Get the updated batch to record in the log
      const updatedBatches = await loadWineBatches();
      const bottledBatch = updatedBatches.find(b => b.id === batchId);

      if (bottledBatch && bottledBatch.state === 'bottled') {
        await recordBottledWine(bottledBatch);

        // Trigger bottling event for wine features (e.g., bottle aging)
        const batchWithEventFeatures = await processEventTrigger(bottledBatch, 'bottling', {});

        // Update batch if features modified characteristics or breakdown
        if (batchWithEventFeatures.characteristics !== bottledBatch.characteristics ||
          batchWithEventFeatures.breakdown !== bottledBatch.breakdown ||
          batchWithEventFeatures.tasteQualityIndex !== bottledBatch.tasteQualityIndex) {
          const updatedTasteQuality = getTasteQualityIndex(batchWithEventFeatures);
          await updateWineBatch(batchId, {
            characteristics: batchWithEventFeatures.characteristics,
            breakdown: batchWithEventFeatures.breakdown,
            tasteQualityIndex: updatedTasteQuality,
            features: batchWithEventFeatures.features
          });
        }
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
 * OPTIMIZED: Loads vineyards once and uses bulk updates
 */
export async function processWeeklyFermentation(): Promise<void> {
  try {
    const batches = await loadWineBatches();
    const fermentingBatches = batches.filter(batch =>
      batch.state === 'must_fermenting' && batch.fermentationOptions
    );

    if (fermentingBatches.length === 0) return;

    // OPTIMIZATION: Collect all updates to perform bulk update
    const updates: Array<{ id: string; updates: Partial<WineBatch> }> = [];

    for (const batch of fermentingBatches) {
      if (!batch.fermentationOptions) continue;

      // Apply weekly fermentation effects
      const { characteristics: newCharacteristics, breakdown } = applyWeeklyFermentationEffects({
        baseCharacteristics: batch.characteristics,
        method: batch.fermentationOptions.method,
        temperature: batch.fermentationOptions.temperature,
        wineAnchors: resolveWineAnchors(batch.wineAnchors)
      });

      const anchorsBeforeWeeklyContact = resolveWineAnchors(batch.wineAnchors);
      const wineAnchors = applyWeeklyFermentationContactToWineAnchors(
        anchorsBeforeWeeklyContact,
        batch.fermentationOptions
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

      const currentTasteQualityIndex = getTasteQualityIndex({
        ...batch,
        characteristics: newCharacteristics,
        structureIndex: structureIndexResult.score,
        wineAnchors
      });

      // Combine existing breakdown with new fermentation breakdown
      const combinedBreakdown = {
        effects: [
          ...(batch.breakdown?.effects || []),
          ...breakdown.effects
        ],
        anchorEffects: [
          ...(batch.breakdown?.anchorEffects || []),
          ...weeklyAnchorEffects
        ]
      };

      // Collect update instead of immediately saving
      updates.push({
        id: batch.id,
        updates: {
          characteristics: newCharacteristics,
          tasteQualityIndex: currentTasteQualityIndex,
          structureIndex: structureIndexResult.score,
          breakdown: combinedBreakdown,
          wineAnchors
        }
      });
    }

    // OPTIMIZATION: Single bulk update for all batches
    if (updates.length > 0) {
      await bulkUpdateWineBatches(updates);
    }
  } catch (error) {
    console.error('Error processing weekly fermentation:', error);
  }
}

