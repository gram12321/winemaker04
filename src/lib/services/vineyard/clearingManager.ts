import { Activity, WorkCategory } from '@/lib/types/types';
import { CLEARING_TASKS } from '@/lib/constants/activityConstants';
import { createActivity } from '../activity/activitymanagers/activityManager';
import { updateVineyardHealth } from './clearingService';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { NotificationCategory } from '@/lib/types/types';
import { calculateTotalWork } from '../activity/workcalculators/workCalculator';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { getAltitudeRating } from '../vineyard/vineyardValueCalc';
import { SOIL_DIFFICULTY_MODIFIERS } from '../../constants/vineyardConstants';

export interface ClearingActivityOptions {
  tasks: { [key: string]: boolean };
  replantingIntensity: number;
}

// Work modifier functions for clearing activities

/**
 * Get soil type modifier for clearing work using the proper soil difficulty system
 * Different soil types affect clearing difficulty based on predefined modifiers
 */
function getSoilTypeModifier(soil: string[]): number {
  let totalModifier = 0;
  let validSoils = 0;
  
  soil.forEach(soilType => {
    const modifier = SOIL_DIFFICULTY_MODIFIERS[soilType as keyof typeof SOIL_DIFFICULTY_MODIFIERS];
    if (modifier !== undefined) {
      totalModifier += modifier;
      validSoils++;
    }
  });
  
  // Average the modifiers if multiple soil types
  return validSoils > 0 ? totalModifier / validSoils : 0;
}

/**
 * Get overgrowth modifier based on years since last clearing
 * Uses diminishing returns: 1 year = 10%, 2 years = 15%, 3 years = 17.5%, etc.
 */
function getOvergrowthModifier(yearsSinceLastClearing: number): number {
  if (yearsSinceLastClearing <= 0) return 0;
  
  // Diminishing returns formula: base * (1 - (1 - decay)^years)
  // This gives: 1 year = 10%, 2 years = 15%, 3 years = 17.5%, max ~200%
  const baseIncrease = 0.10; // 10% base increase per year
  const decayRate = 0.5; // Diminishing factor
  
  const maxModifier = baseIncrease / decayRate; // Theoretical maximum
  const actualModifier = maxModifier * (1 - Math.pow(1 - decayRate, yearsSinceLastClearing));
  
  return Math.min(actualModifier, 2.0); // Cap at 200%
}

/**
 * Get vine age modifier for vine removal
 * Older vines are harder to remove, with diminishing returns
 * Theoretical max vine age: 200 years, practical max: 100 years
 */
function getVineAgeModifier(vineAge: number | null): number {
  if (!vineAge || vineAge <= 0) return 0;
  
  // Diminishing returns formula for vine age
  // 10 years = 5%, 25 years = 10%, 50 years = 15%, 100 years = 180%
  const maxAge = 100; // Practical maximum
  const ageRatio = Math.min(vineAge / maxAge, 1); // Normalize to 0-1
  
  // Diminishing returns: more age = more work, but with diminishing effect
  const baseModifier = 1.8; // Maximum 180% work increase
  const actualModifier = baseModifier * (1 - Math.exp(-3 * ageRatio)); // Exponential decay function
  
  return actualModifier;
}

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

    // Calculate work modifiers for this vineyard
    const soilModifier = getSoilTypeModifier(vineyard.soil);
    const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
    const terrainModifier = altitudeRating * 1.5; // Up to +150% work for very high altitude
    
    // Get overgrowth modifier based on years since last clearing
    const overgrowthModifier = getOvergrowthModifier(vineyard.yearsSinceLastClearing || 0);
    
    // Calculate total work for all selected tasks using proper work calculator
    let totalWork = 0;
    const selectedTasks: string[] = [];

    Object.entries(options.tasks).forEach(([taskId, isSelected]) => {
      if (!isSelected) return;

      const task = Object.values(CLEARING_TASKS).find(t => t.id === taskId);
      if (!task) return;

      selectedTasks.push(task.name);
      
      // Calculate work for this task using the proper work calculator
      let taskAmount = vineyard.hectares;
      
      // Handle uprooting and replanting with intensity scaling
      if (taskId === 'uproot-vines' || taskId === 'replant-vines') {
        taskAmount *= (options.replantingIntensity / 100);
      }

      if (taskAmount <= 0) return;

      // Get task-specific modifiers
      let taskModifiers = [soilModifier, terrainModifier, overgrowthModifier];
      
      // Add vine age modifier for vine uprooting and replanting tasks
      if (taskId === 'uproot-vines' || taskId === 'replant-vines') {
        const vineAgeModifier = getVineAgeModifier(vineyard.vineAge);
        taskModifiers.push(vineAgeModifier);
      }

      // Use the proper work calculator
      const taskWork = calculateTotalWork(taskAmount, {
        rate: task.rate,
        initialWork: task.initialWork,
        useDensityAdjustment: taskId === 'uproot-vines' || taskId === 'replant-vines', // Vine uprooting and replanting use density adjustment
        density: vineyard.density,
        workModifiers: taskModifiers
      });
      
      totalWork += taskWork;
    });

    if (selectedTasks.length === 0) {
      throw new Error('No clearing tasks selected');
    }

    // Create activity title
    const taskNames = selectedTasks.join(', ');
    const title = `Clear ${vineyardName}: ${taskNames}`;

    // Create the activity
    await createActivity({
      category: WorkCategory.CLEARING,
      title,
      totalWork,
      targetId: vineyardId,
      params: {
        tasks: options.tasks,
        replantingIntensity: options.replantingIntensity,
        selectedTasks,
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
