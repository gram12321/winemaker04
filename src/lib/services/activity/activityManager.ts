import { v4 as uuidv4 } from 'uuid';
import { Activity, ActivityCreationOptions, ActivityProgress } from '@/lib/types/types';
import { WorkCategory } from '@/lib/services/activity';
import { getGameState, updateGameState } from '@/lib/services/core/gameState';
import { 
  saveActivityToDb, 
  loadActivitiesFromDb, 
  updateActivityInDb, 
  removeActivityFromDb,
  hasActiveActivity 
} from '@/lib/database/activity/activityService';
import { plantVineyard } from '@/lib/services';
import { createWineBatchFromHarvest } from '../wine/wineBatchService';
import { saveVineyard, loadVineyards } from '@/lib/database/database';
import { calculateVineyardYield } from '../vineyard/vineyardManager';
import { notificationService } from '@/components/layout/NotificationCenter';
import { completeBookkeeping } from './WorkCalculators/BookkeepingWorkCalculator';
import { completeCrushing } from './WorkCalculators/CrushingWorkCalculator';

// Completion handlers for each activity type
const completionHandlers: Record<WorkCategory, (activity: Activity) => Promise<void>> = {
  [WorkCategory.PLANTING]: async (activity: Activity) => {
    if (activity.targetId && activity.params.grape && activity.params.density) {
      await plantVineyard(activity.targetId, activity.params.grape, activity.params.density);
      notificationService.success(`Successfully planted ${activity.params.grape} in ${activity.params.targetName || 'vineyard'}!`);
    }
  },
  
  [WorkCategory.HARVESTING]: async (activity: Activity) => {
    if (activity.targetId && activity.params.grape) {
      // Harvest any remaining yield and finalize the vineyard status
      const vineyards = await loadVineyards();
      const vineyard = vineyards.find(v => v.id === activity.targetId);
      
      if (vineyard) {
        // Calculate final total yield based on current ripeness
        const currentTotalYield = calculateVineyardYield(vineyard);
        const harvestedSoFar = activity.params.harvestedSoFar || 0;
        const remainingYield = Math.max(0, currentTotalYield - harvestedSoFar);
        
        if (remainingYield > 1) { // Only create batch if at least 1kg remaining
          await createWineBatchFromHarvest(
            vineyard.id, 
            vineyard.name, 
            activity.params.grape, 
            remainingYield
          );
        }
        
        // Check current season to determine final status
        const gameState = getGameState();
        const currentSeason = gameState.season;
        
        // If harvest completes in Winter, go directly to Dormant
        // Otherwise, set to Harvested (will transition to Dormant at Winter week 1)
        const finalStatus = currentSeason === 'Winter' ? 'Dormant' : 'Harvested';
        
        // Update vineyard status and reset ripeness
        const updatedVineyard = {
          ...vineyard,
          status: finalStatus,
          ripeness: 0 // Reset ripeness after harvest
        };
        await saveVineyard(updatedVineyard);
        
        const totalHarvested = harvestedSoFar + remainingYield;
        const statusMessage = finalStatus === 'Dormant' 
          ? 'Harvest complete! Vineyard is now dormant for winter.'
          : 'Harvest complete! Vineyard will go dormant in winter.';
        
        notificationService.success(`${statusMessage} Total: ${Math.round(totalHarvested)}kg of ${activity.params.grape} from ${activity.params.targetName || 'vineyard'}`);
      }
    }
  },
  
  [WorkCategory.CLEARING]: async (_activity: Activity) => {
    // TODO: Implement clearing completion
  },
  
  [WorkCategory.UPROOTING]: async (_activity: Activity) => {
    // TODO: Implement uprooting completion
  },
  
  [WorkCategory.ADMINISTRATION]: async (activity: Activity) => {
    await completeBookkeeping(activity);
  },
  
  [WorkCategory.BUILDING]: async (_activity: Activity) => {
    // TODO: Implement building completion
  },
  
  [WorkCategory.UPGRADING]: async (_activity: Activity) => {
    // TODO: Implement upgrading completion
  },
  
  [WorkCategory.MAINTENANCE]: async (_activity: Activity) => {
    // TODO: Implement maintenance completion
  },
  
  [WorkCategory.CRUSHING]: async (activity: Activity) => {
    if (activity.params.batchId && activity.params.crushingOptions) {
      await completeCrushing(activity);
      notificationService.success(`Crushing completed for ${activity.params.vineyardName} ${activity.params.grape}!`);
    }
  },
  
  [WorkCategory.FERMENTATION]: async (_activity: Activity) => {
    // TODO: Implement fermentation completion
  },
  
  [WorkCategory.STAFF_SEARCH]: async (_activity: Activity) => {
    // TODO: Implement staff search completion
  }
};

/**
 * Create a new activity
 */
export async function createActivity(options: ActivityCreationOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    
    // Check for conflicting activities
    if (options.targetId) {
      const hasConflict = await hasActiveActivity(options.targetId, options.category);
      if (hasConflict) {
        notificationService.warning(`An activity of type ${options.category} is already in progress for this target.`);
        return null;
      }
    }
    
    const activity: Activity = {
      id: uuidv4(),
      category: options.category,
      title: options.title,
      totalWork: options.totalWork,
      completedWork: 0,
      targetId: options.targetId,
      params: options.params || {},
      status: 'active',
      gameWeek: gameState.week || 1,
      gameSeason: gameState.season || 'Spring',
      gameYear: gameState.currentYear || 2025,
      isCancellable: options.isCancellable !== false, // default to true
      createdAt: new Date()
    };
    
    const success = await saveActivityToDb(activity);
    if (success) {
      // Update local game state
      const currentActivities = await loadActivitiesFromDb();
      updateGameState({ activities: currentActivities });
      
      notificationService.info(`Started ${activity.title} - ${activity.totalWork} work units required`);
      return activity.id;
    }
    
    return null;
  } catch (error) {
    console.error('Error creating activity:', error);
    return null;
  }
}

/**
 * Get all active activities
 */
export async function getAllActivities(): Promise<Activity[]> {
  const activities = await loadActivitiesFromDb();
  return activities.filter(activity => activity.status === 'active');
}

/**
 * Get activity by ID
 */
export async function getActivityById(activityId: string): Promise<Activity | null> {
  const activities = await loadActivitiesFromDb();
  return activities.find(activity => activity.id === activityId) || null;
}

/**
 * Cancel an activity
 */
export async function cancelActivity(activityId: string): Promise<boolean> {
  try {
    const activity = await getActivityById(activityId);
    if (!activity) {
      console.warn(`Activity ${activityId} not found`);
      return false;
    }
    
    if (!activity.isCancellable) {
      console.warn(`Activity ${activityId} is not cancellable`);
      return false;
    }
    
    const success = await updateActivityInDb(activityId, { status: 'cancelled' });
    if (success) {
      // Update local game state
      const currentActivities = await loadActivitiesFromDb();
      updateGameState({ activities: currentActivities.filter(a => a.status === 'active') });
      
      notificationService.warning(`Cancelled activity: ${activity.title}`);
    }
    
    return success;
  } catch (error) {
    console.error('Error cancelling activity:', error);
    return false;
  }
}

/**
 * Progress all activities by a fixed amount (called from game tick)
 */
export async function progressActivities(workPerTick: number = 50): Promise<void> {
  try {
    const activities = await getAllActivities();
    const completedActivities: Activity[] = [];
    
    for (const activity of activities) {
      const oldCompletedWork = activity.completedWork;
      const newCompletedWork = Math.min(
        activity.totalWork, 
        activity.completedWork + workPerTick
      );
      
      // Handle partial harvesting for HARVESTING activities
      if (activity.category === WorkCategory.HARVESTING && activity.targetId) {
        await handlePartialHarvesting(activity, oldCompletedWork, newCompletedWork);
      }
      
      // Update the activity
      await updateActivityInDb(activity.id, { completedWork: newCompletedWork });
      
      // Check if activity is complete
      if (newCompletedWork >= activity.totalWork) {
        completedActivities.push({ ...activity, completedWork: newCompletedWork });
      }
    }
    
    // Handle completed activities
    for (const completedActivity of completedActivities) {
      try {
        // Execute completion callback
        const handler = completionHandlers[completedActivity.category];
        if (handler) {
          await handler(completedActivity);
        }
        
        // Remove the completed activity
        await removeActivityFromDb(completedActivity.id);
        
        // Completion notification handled by individual completion handlers
      } catch (error) {
        console.error(`Error completing activity ${completedActivity.id}:`, error);
      }
    }
    
    // Update local game state
    const currentActivities = await getAllActivities();
    updateGameState({ activities: currentActivities });
    
  } catch (error) {
    console.error('Error progressing activities:', error);
  }
}

/**
 * Handle partial harvesting for harvesting activities
 * Creates wine batches incrementally based on work progress
 */
async function handlePartialHarvesting(
  activity: Activity, 
  oldCompletedWork: number, 
  newCompletedWork: number
): Promise<void> {
  try {
    const workProgress = newCompletedWork / activity.totalWork;
    const oldProgress = oldCompletedWork / activity.totalWork;
    const progressThisTick = workProgress - oldProgress;
    
    if (progressThisTick <= 0) return; // No progress this tick
    
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === activity.targetId);
    
    if (!vineyard || !vineyard.grape) return;
    
    // Calculate current total yield based on current ripeness
    const currentTotalYield = calculateVineyardYield(vineyard);
    
    // Get the harvest progress as a percentage (0-1)
    const harvestProgress = workProgress;
    
    // Calculate how much should be harvested by now based on current yield
    const expectedHarvestedByNow = currentTotalYield * harvestProgress;
    const previouslyHarvested = activity.params.harvestedSoFar || 0;
    
    // Calculate how much to harvest this tick
    const yieldThisTick = Math.max(0, expectedHarvestedByNow - previouslyHarvested);
    
    // Only create wine batch if we're harvesting at least 5kg this tick
    if (yieldThisTick >= 5) {
      // Create wine batch for this tick's harvest
      await createWineBatchFromHarvest(
        vineyard.id,
        vineyard.name,
        vineyard.grape,
        Math.round(yieldThisTick)
      );
      
      // Update the harvested amount in activity params
      const newHarvestedSoFar = previouslyHarvested + yieldThisTick;
      await updateActivityInDb(activity.id, {
        params: {
          ...activity.params,
          harvestedSoFar: newHarvestedSoFar,
          // Store current total yield for completion handler
          currentTotalYield: currentTotalYield
        }
      });
      
      // Update vineyard status to show progress
      const updatedVineyard = {
        ...vineyard,
        status: 'Growing'
      };
      await saveVineyard(updatedVineyard);
    }
  } catch (error) {
    console.error(`Error in partial harvesting for activity ${activity.id}:`, error);
  }
}

/**
 * Get progress information for an activity
 */
export async function getActivityProgress(activityId: string): Promise<ActivityProgress | null> {
  const activity = await getActivityById(activityId);
  if (!activity) return null;
  
  const progress = (activity.completedWork / activity.totalWork) * 100;
  const isComplete = progress >= 100;
  
  // Estimate time remaining (assuming 50 work units per tick)
  const remainingWork = activity.totalWork - activity.completedWork;
  const ticksRemaining = Math.ceil(remainingWork / 50);
  const timeRemaining = ticksRemaining === 1 ? '1 week' : `${ticksRemaining} weeks`;
  
  return {
    activityId,
    progress: Math.min(100, progress),
    isComplete,
    timeRemaining: isComplete ? 'Complete' : timeRemaining
  };
}

/**
 * Initialize activity system (load activities from database)
 */
export async function initializeActivitySystem(): Promise<void> {
  try {
    const activities = await loadActivitiesFromDb();
    const activeActivities = activities.filter(a => a.status === 'active');
    updateGameState({ activities: activeActivities });
    
            // Activities loaded successfully
  } catch (error) {
    console.error('Error initializing activity system:', error);
    updateGameState({ activities: [] });
  }
}
