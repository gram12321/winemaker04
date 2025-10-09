import { WineBatch } from '../../../types/types';
import { WorkCategory } from '../../../types/types';
import { createActivity } from '../../activity/activitymanagers/activityManager';
import { calculateCrushingWork, validateCrushingBatch } from '../../activity/workcalculators/crushingWorkCalculator';
import { CrushingOptions } from '../characteristics/crushingCharacteristics';
import { notificationService } from '../../../../components/layout/NotificationCenter';

/**
 * Crushing Manager
 * Handles crushing workflow, validation, and activity creation
 */

/**
 * Validate crushing options and wine batch
 */
export function validateCrushingActivity(batch: WineBatch, options: CrushingOptions): { valid: boolean; reason?: string } {
  // Validate batch first
  const batchValidation = validateCrushingBatch(batch);
  if (!batchValidation.valid) {
    return batchValidation;
  }
  
  // Validate crushing options
  if (!options.method) {
    return { valid: false, reason: 'Crushing method must be selected' };
  }
  
  const validMethods = ['Hand Press', 'Mechanical Press', 'Pneumatic Press'];
  if (!validMethods.includes(options.method)) {
    return { valid: false, reason: 'Invalid crushing method selected' };
  }
  
  return { valid: true };
}

/**
 * Start crushing activity for a wine batch
 */
export async function startCrushingActivity(batch: WineBatch, options: CrushingOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate the crushing activity
    const validation = validateCrushingActivity(batch, options);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    
    // Calculate work and cost
    const { totalWork, cost } = calculateCrushingWork(batch, options);
    
    // Create the crushing activity
    const activityId = await createActivity({
      category: WorkCategory.CRUSHING,
      title: `Crushing ${batch.grape} from ${batch.vineyardName}`,
      targetId: batch.vineyardId,
      totalWork,
      params: {
        batchId: batch.id,
        vineyardName: batch.vineyardName,
        grape: batch.grape,
        crushingOptions: options,
        cost
      },
      isCancellable: true
    });
    
    if (!activityId) {
      return { success: false, error: 'Failed to create crushing activity' };
    }
    
    await notificationService.addMessage(`Started crushing ${batch.grape} from ${batch.vineyardName}`, 'crushingManager.startCrushingActivity', 'Crushing Started', 'Activities & Tasks');
    return { success: true };
    
  } catch (error) {
    console.error('Error starting crushing activity:', error);
    return { success: false, error: 'Failed to start crushing activity' };
  }
}


