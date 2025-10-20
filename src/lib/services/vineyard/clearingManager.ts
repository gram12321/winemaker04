import { Activity, WorkCategory } from '@/lib/types/types';
import { CLEARING_TASKS } from '@/lib/constants/activityConstants';
import { createActivity } from '../activity/activitymanagers/activityManager';
import { updateVineyardHealth } from './clearingService';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { NotificationCategory } from '@/lib/types/types';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { getGameState } from '../core/gameState';
import { calculateClearingWork } from '../activity/workcalculators/clearingWorkCalculator';

export interface ClearingActivityOptions {
  tasks: { [key: string]: boolean };
  replantingIntensity: number;
}

// Work calculation is now handled by clearingWorkCalculator.ts

/**
 * Create a clearing activity for a vineyard
 */
export async function createClearingActivity(
  vineyardId: string,
  vineyardName: string,
  options: ClearingActivityOptions
): Promise<boolean> {
  try {
    // Get vineyard data for proper work calculation
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === vineyardId);
    
    if (!vineyard) {
      throw new Error(`Vineyard ${vineyardName} not found`);
    }
    
    // Check yearly limits for individual clearing tasks
    const currentYear = getGameState().currentYear ?? 0;
    const vegetationYears = vineyard.overgrowth?.vegetation ?? 0;
    const debrisYears = vineyard.overgrowth?.debris ?? 0;
    const lastClearVegetationYear = vegetationYears > 0 ? currentYear - vegetationYears : 0;
    const lastRemoveDebrisYear = debrisYears > 0 ? currentYear - debrisYears : 0;
    
    // Check if clear vegetation was already done this year
    if (options.tasks['clear-vegetation'] && currentYear === lastClearVegetationYear) {
      await notificationService.addMessage(
        `Clear vegetation can only be performed once per year. This vineyard was already cleared of vegetation in ${currentYear}.`,
        'clearingManager.createClearingActivity',
        'Clearing Limit Reached',
        NotificationCategory.VINEYARD_OPERATIONS
      );
      return false;
    }
    
    // Check if remove debris was already done this year
    if (options.tasks['remove-debris'] && currentYear === lastRemoveDebrisYear) {
      await notificationService.addMessage(
        `Remove debris can only be performed once per year. This vineyard was already cleared of debris in ${currentYear}.`,
        'clearingManager.createClearingActivity',
        'Clearing Limit Reached',
        NotificationCategory.VINEYARD_OPERATIONS
      );
      return false;
    }

    // Calculate work using the dedicated clearing work calculator
    const workResult = calculateClearingWork(vineyard, options);
    
    if (workResult.selectedTasks.length === 0) {
      throw new Error('No clearing tasks selected');
    }

    // Create activity title - simplified for clearing activities
    const title = `Clearing ${vineyardName}`;

    // Create the activity
    await createActivity({
      category: WorkCategory.CLEARING,
      title,
      totalWork: workResult.totalWork,
      targetId: vineyardId,
      params: {
        tasks: options.tasks,
        replantingIntensity: options.replantingIntensity,
        selectedTasks: workResult.selectedTasks,
        vineyardHectares: vineyard.hectares, // Store for reference
      },
      isCancellable: true,
    });

    // Add notification
    await notificationService.addMessage(
      `Started clearing activity on ${vineyardName}`,
      'clearingManager.createClearingActivity',
      'Clearing Started',
      NotificationCategory.VINEYARD_OPERATIONS
    );

    return true;
  } catch (error) {
    console.error('Error creating clearing activity:', error);
    await notificationService.addMessage(
      `Failed to start clearing activity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'clearingManager.createClearingActivity',
      'Clearing Failed',
      NotificationCategory.VINEYARD_OPERATIONS
    );
    return false;
  }
}

/**
 * Complete a clearing activity and apply health improvements
 */
export async function completeClearingActivity(activity: Activity): Promise<void> {
  try {
    if (!activity.targetId) {
      throw new Error('Clearing activity has no target vineyard');
    }

    const vineyardId = activity.targetId;
    const tasks = activity.params?.tasks as { [key: string]: boolean } || {};
    const replantingIntensity = activity.params?.replantingIntensity as number || 100;

    // Apply health improvements to the vineyard using new calculation system
    await updateVineyardHealth(vineyardId, tasks, replantingIntensity);

    // Activity completion is handled automatically by the activity manager
    // when work reaches total work

    // Add success notification
    const taskNames = Object.entries(tasks)
      .filter(([_, isSelected]) => isSelected)
      .map(([taskId, _]) => {
        const task = Object.values(CLEARING_TASKS).find(t => t.id === taskId);
        return task?.name || taskId;
      });
    
    await notificationService.addMessage(
      `Clearing completed on ${activity.title}. Tasks: ${taskNames.join(', ')}`,
      'clearingActivityManager.completeClearingActivity',
      'Clearing Completed',
      NotificationCategory.VINEYARD_OPERATIONS
    );

  } catch (error) {
    console.error('Error completing clearing activity:', error);
    await notificationService.addMessage(
      `Failed to complete clearing activity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'clearingActivityManager.completeClearingActivity',
      'Clearing Failed',
      NotificationCategory.VINEYARD_OPERATIONS
    );
  }
}
