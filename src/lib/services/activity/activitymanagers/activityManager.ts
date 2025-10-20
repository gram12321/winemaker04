import { v4 as uuidv4 } from 'uuid';
import { Activity, ActivityCreationOptions, ActivityProgress } from '@/lib/types/types';
import { WorkCategory } from '@/lib/services/activity';
import { getGameState, updateGameState } from '@/lib/services/core/gameState';
import { saveActivityToDb, loadActivitiesFromDb, updateActivityInDb, removeActivityFromDb, hasActiveActivity } from '@/lib/database/activities/activityDB';
import { completePlanting } from '../../vineyard/vineyardService';
import { createWineBatchFromHarvest } from '../../wine/winery/inventoryService';
import { saveVineyard, loadVineyards } from '@/lib/database/activities/vineyardDB';
import { calculateVineyardYield } from '../../vineyard/vineyardManager';
import { notificationService } from '@/lib/services/core/notificationService';
import { NotificationCategory } from '@/lib/types/types';
import { completeCrushing } from '../workcalculators/crushingWorkCalculator';
import { completeFermentationSetup } from '../workcalculators/fermentationWorkCalculator';
import { completeBookkeeping } from '../workcalculators/bookkeepingWorkCalculator';
import { calculateStaffWorkContribution } from '../workcalculators/workCalculator';
import { completeStaffSearch, completeHiringProcess } from '../../user/staffSearchService';
import { completeLandSearch } from '../../vineyard/landSearchService';
import { getTeamForCategory } from '../../user/teamService';
import { triggerGameUpdateImmediate } from '@/hooks/useGameUpdates';
import { completeClearingActivity } from '../../vineyard/clearingManager';

// Completion handlers for each activity type
const completionHandlers: Record<WorkCategory, (activity: Activity) => Promise<void>> = {
  [WorkCategory.PLANTING]: async (activity: Activity) => {
    if (activity.targetId && activity.params.density) {
      // Complete the planting and finalize the status
      await completePlanting(activity.targetId, activity.params.density);
      
      const targetDensity = activity.params.density;
      const grape = activity.params.grape;
      notificationService.addMessage(
        `Successfully planted ${targetDensity} vines/ha of ${grape} in ${activity.params.targetName || 'vineyard'}!`, 
        'vineyard.planting', 
        'Vineyard Planting', 
        NotificationCategory.VINEYARD_OPERATIONS
      );
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

        notificationService.addMessage(`${statusMessage} Total: ${Math.round(totalHarvested)}kg of ${activity.params.grape} from ${activity.params.targetName || 'vineyard'}`, 'vineyard.harvesting', 'Vineyard Harvesting', NotificationCategory.VINEYARD_OPERATIONS);
      }
    }
  },

  [WorkCategory.CRUSHING]: async (activity: Activity) => {
    if (activity.params.batchId && activity.params.crushingOptions) {
      await completeCrushing(activity);
      notificationService.addMessage(`Crushing completed for ${activity.params.vineyardName} ${activity.params.grape}!`, 'winemaking.crushing', 'Grape Crushing', NotificationCategory.WINEMAKING_PROCESS);
    }
  },

  [WorkCategory.FERMENTATION]: async (activity: Activity) => {
    await completeFermentationSetup(activity);
    notificationService.addMessage(`Successfully started fermentation for ${activity.params.targetName}!`, 'winemaking.fermentation', 'Fermentation', NotificationCategory.WINEMAKING_PROCESS);
  },

  [WorkCategory.CLEARING]: async (activity: Activity) => {
    await completeClearingActivity(activity);
  },

  [WorkCategory.UPROOTING]: async (_activity: Activity) => {
    // TODO: Implement uprooting completion
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

  [WorkCategory.STAFF_SEARCH]: async (activity: Activity) => {
    await completeStaffSearch(activity);
  },

  [WorkCategory.LAND_SEARCH]: async (activity: Activity) => {
    await completeLandSearch(activity);
  },

  [WorkCategory.ADMINISTRATION]: async (activity: Activity) => {
    // Check if this is a hiring activity (distinguished by isHiringActivity param)
    // Otherwise it's a bookkeeping/administration activity
    if (activity.params.isHiringActivity) {
      await completeHiringProcess(activity);
    } else {
      await completeBookkeeping(activity);
    }
  }
};

/**
 * Create a new activity with optional auto-assignment
 */
export async function createActivity(options: ActivityCreationOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    
    // Check for conflicting activities
    if (options.targetId) {
      const hasConflict = await hasActiveActivity(options.targetId, options.category);
      if (hasConflict) {
        console.warn(`An activity of type ${options.category} is already in progress for this target.`);
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
    
    // Auto-assign staff from matching team if no staff already assigned
    if (!activity.params.assignedStaffIds || activity.params.assignedStaffIds.length === 0) {
      const matchingTeam = getTeamForCategory(options.category);
      if (matchingTeam && matchingTeam.memberIds.length > 0) {
        activity.params.assignedStaffIds = matchingTeam.memberIds;
      }
    }
    
    const success = await saveActivityToDb(activity);
    if (success) {
      // Update local game state
      const currentActivities = await loadActivitiesFromDb();
      updateGameState({ activities: currentActivities });
      
      // Trigger immediate UI update for critical activity creation
      triggerGameUpdateImmediate();
      
      const assignedCount = activity.params.assignedStaffIds?.length || 0;
      const assignmentMessage = assignedCount > 0 
        ? `Started ${activity.title} - ${activity.totalWork} work units required (${assignedCount} staff auto-assigned)`
        : `Started ${activity.title} - ${activity.totalWork} work units required`;
      
      notificationService.addMessage(assignmentMessage, 'activity.creation', 'Activity Creation', NotificationCategory.ACTIVITIES_TASKS);
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
      
      // Trigger immediate UI update for critical activity cancellation
      triggerGameUpdateImmediate();
    }
    
    return success;
  } catch (error) {
    console.error('Error cancelling activity:', error);
    return false;
  }
}

/**
 * Progress all activities based on assigned staff work contribution
 * Called from game tick (weekly)
 */
export async function progressActivities(): Promise<void> {
  try {
    const activities = await getAllActivities();
    const gameState = getGameState();
    const allStaff = gameState.staff || [];
    const completedActivities: Activity[] = [];
    
    // Build staff task count map to handle multi-tasking
    const staffTaskCounts = new Map<string, number>();
    for (const activity of activities) {
      const assignedStaffIds = activity.params.assignedStaffIds || [];
      for (const staffId of assignedStaffIds) {
        staffTaskCounts.set(staffId, (staffTaskCounts.get(staffId) || 0) + 1);
      }
    }
    
    // Process each activity
    for (const activity of activities) {
      const assignedStaffIds = activity.params.assignedStaffIds || [];
      const assignedStaff = allStaff.filter(s => assignedStaffIds.includes(s.id));
      
      // Calculate work contribution from staff (0 if no staff assigned)
      const workThisTick = assignedStaff.length > 0
        ? calculateStaffWorkContribution(assignedStaff, activity.category, staffTaskCounts)
        : 0;
      
      const oldCompletedWork = activity.completedWork;
      const newCompletedWork = Math.min(
        activity.totalWork,
        activity.completedWork + workThisTick
      );
      
      // Handle partial planting for PLANTING activities
      if (activity.category === WorkCategory.PLANTING && activity.targetId) {
        await handlePartialPlanting(activity, oldCompletedWork, newCompletedWork);
      }
      
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
    
    // Trigger immediate UI update if any activities were completed
    if (completedActivities.length > 0) {
      triggerGameUpdateImmediate();
    }
    
  } catch (error) {
    console.error('Error progressing activities:', error);
  }
}

/**
 * Handle partial planting for planting activities
 * Increases vine density incrementally based on work progress
 */
async function handlePartialPlanting(
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
    
    if (!vineyard) return;
    
    const targetDensity = activity.params.density || 0;
    if (targetDensity <= 0) return;
    
    // Calculate current density based on work progress
    const expectedDensityByNow = Math.round(targetDensity * workProgress);
    const currentDensity = vineyard.density || 0;
    
    // Calculate density increase this tick
    const densityIncrease = expectedDensityByNow - currentDensity;
    
    // Only update if there's a meaningful increase (at least 1 vine/ha)
    if (densityIncrease >= 1) {
      const newDensity = Math.min(targetDensity, currentDensity + densityIncrease);
      
      // Update vineyard density
      const updatedVineyard = {
        ...vineyard,
        density: newDensity
      };
      await saveVineyard(updatedVineyard);
    }
  } catch (error) {
    console.error(`Error in partial planting for activity ${activity.id}:`, error);
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
 * Calculates accurate ETA based on assigned staff and their multi-tasking load
 */
export async function getActivityProgress(activityId: string): Promise<ActivityProgress | null> {
  const activity = await getActivityById(activityId);
  if (!activity) return null;
  
  const progress = (activity.completedWork / activity.totalWork) * 100;
  const isComplete = progress >= 100;
  
  // Calculate accurate time remaining based on actual staff assignments
  const remainingWork = activity.totalWork - activity.completedWork;
  let timeRemaining = 'N/A';
  
  if (!isComplete && remainingWork > 0) {
    const gameState = getGameState();
    const allStaff = gameState.staff || [];
    const allActivities = await getAllActivities();
    
    // Build staff task count map to handle multi-tasking
    const staffTaskCounts = new Map<string, number>();
    for (const act of allActivities) {
      const assignedStaffIds = act.params.assignedStaffIds || [];
      for (const staffId of assignedStaffIds) {
        staffTaskCounts.set(staffId, (staffTaskCounts.get(staffId) || 0) + 1);
      }
    }
    
    // Get staff assigned to this activity
    const assignedStaffIds = activity.params.assignedStaffIds || [];
    const assignedStaff = allStaff.filter(s => assignedStaffIds.includes(s.id));
    
    if (assignedStaff.length > 0) {
      // Calculate actual work contribution per week
      const workPerWeek = calculateStaffWorkContribution(assignedStaff, activity.category, staffTaskCounts);
      
      if (workPerWeek > 0) {
        const weeksRemaining = Math.ceil(remainingWork / workPerWeek);
        timeRemaining = weeksRemaining === 1 ? '1 week' : `${weeksRemaining} weeks`;
      } else {
        timeRemaining = 'No progress';
      }
    } else {
      timeRemaining = 'No staff assigned';
    }
  }
  
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
