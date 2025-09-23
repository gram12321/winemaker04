import { v4 as uuidv4 } from 'uuid';
import { Activity, ActivityCreationOptions, ActivityProgress } from '@/lib/types/activity';
import { WorkCategory } from '@/lib/services/work';
import { getGameState, updateGameState } from '@/lib/services/gameState';
import { 
  saveActivityToDb, 
  loadActivitiesFromDb, 
  updateActivityInDb, 
  removeActivityFromDb,
  hasActiveActivity 
} from '@/lib/database/activityService';
import { plantVineyard } from '@/lib/services';
import { notificationService } from '@/components/layout/NotificationCenter';

// Completion handlers for each activity type
const completionHandlers: Record<WorkCategory, (activity: Activity) => Promise<void>> = {
  [WorkCategory.PLANTING]: async (activity: Activity) => {
    if (activity.targetId && activity.params.grape && activity.params.density) {
      await plantVineyard(activity.targetId, activity.params.grape, activity.params.density);
      notificationService.success(`Successfully planted ${activity.params.grape} in ${activity.params.targetName || 'vineyard'}!`);
    }
  },
  
  [WorkCategory.HARVESTING]: async (activity: Activity) => {
    // TODO: Implement harvesting completion
    console.log(`Harvesting completed for ${activity.targetId}`);
  },
  
  [WorkCategory.CLEARING]: async (activity: Activity) => {
    // TODO: Implement clearing completion
    console.log(`Clearing completed for ${activity.targetId}`);
  },
  
  [WorkCategory.UPROOTING]: async (activity: Activity) => {
    // TODO: Implement uprooting completion
    console.log(`Uprooting completed for ${activity.targetId}`);
  },
  
  [WorkCategory.ADMINISTRATION]: async (activity: Activity) => {
    // TODO: Implement administration completion (e.g., bookkeeping)
    console.log(`Administration task completed: ${activity.title}`);
  },
  
  [WorkCategory.BUILDING]: async (activity: Activity) => {
    // TODO: Implement building completion
    console.log(`Building completed: ${activity.title}`);
  },
  
  [WorkCategory.UPGRADING]: async (activity: Activity) => {
    // TODO: Implement upgrading completion
    console.log(`Upgrade completed: ${activity.title}`);
  },
  
  [WorkCategory.MAINTENANCE]: async (activity: Activity) => {
    // TODO: Implement maintenance completion
    console.log(`Maintenance completed: ${activity.title}`);
  },
  
  [WorkCategory.CRUSHING]: async (activity: Activity) => {
    // TODO: Implement crushing completion
    console.log(`Crushing completed: ${activity.title}`);
  },
  
  [WorkCategory.FERMENTATION]: async (activity: Activity) => {
    // TODO: Implement fermentation completion
    console.log(`Fermentation completed: ${activity.title}`);
  },
  
  [WorkCategory.STAFF_SEARCH]: async (activity: Activity) => {
    // TODO: Implement staff search completion
    console.log(`Staff search completed: ${activity.title}`);
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
      const newCompletedWork = Math.min(
        activity.totalWork, 
        activity.completedWork + workPerTick
      );
      
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
