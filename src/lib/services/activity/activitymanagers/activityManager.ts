import { v4 as uuidv4 } from 'uuid';
import { Activity, ActivityCreationOptions, ActivityProgress, NotificationCategory, WorkCategory } from '@/lib/types/types';
import { getGameState, updateGameState, notificationService, completePlanting, createWineBatchFromHarvest, calculateVineyardYield, completeClearingActivity, getTeamForCategory, handlePartialPlanting, handlePartialHarvesting } from '@/lib/services';
import { completeLandSearch } from './landSearchManager';
import { saveActivityToDb, loadActivitiesFromDb, updateActivityInDb, removeActivityFromDb, hasActiveActivity } from '@/lib/database/activities/activityDB';
import { loadVineyards, saveVineyard } from '@/lib/database/activities/vineyardDB';
import { awardExperience } from '@/lib/services/user/staffService';
import { WORK_CATEGORY_INFO } from '@/lib/constants/activityConstants';
import { calculateAppliedStaffWorkAllocation } from '../workcalculators/workCalculator';
import { completeCrushing } from '../workcalculators/crushingWorkCalculator';
import { completeFermentationSetup } from '../workcalculators/fermentationWorkCalculator';
import { completeBookkeeping } from '../workcalculators/bookkeepingWorkCalculator';
import { calculateActivityStaffWorkPreview, getActivityStaffWorkContext } from '../activityWorkPreviewService';
import { completeStaffSearch, completeHiringProcess } from './staffSearchManager';
import { triggerGameUpdateImmediate } from '@/hooks/useGameUpdates';
import { releaseStorageAllocationPlan, releaseReservedStorageAllocationPlan } from '@/lib/services/wine/winery/storageVesselAllocationService';
import { completeEmptyStorageVesselActivity } from '@/lib/services/wine/winery/storageVesselMaintenanceService';
import { formatNumber } from '@/lib/utils';
import { loanLenderFeature } from '@/lib/features/loanLender';
import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { createWeatherWeekContext, resolveWeatherOperationImpact } from '@/lib/features/weather';



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

        // Check current season to determine final status
        const gameState = getGameState();
        const currentSeason = gameState.season;

        if (harvestedSoFar <= 0 && remainingYield <= 0 && activity.params.storagePlanId) {
          await releaseStorageAllocationPlan(activity.params.storagePlanId);
        }

        if (remainingYield > 0.1) { // Only create batch if at least 0.1kg remaining (allow small batches)
          // Create harvest dates: start is activity start, end is current date
          const harvestStartDate = {
            week: activity.gameWeek,
            season: activity.gameSeason as any,
            year: activity.gameYear
          };

          const harvestEndDate = {
            week: gameState.week || 1,
            season: gameState.season || 'Spring',
            year: gameState.currentYear || 2024
          };

          // Round to 2 decimal places to preserve small batches
          const roundedYield = Math.round(remainingYield * 100) / 100;
          await createWineBatchFromHarvest(
            vineyard.id,
            vineyard.name,
            activity.params.grape,
            roundedYield,
            harvestStartDate,
            harvestEndDate,
            activity.params.storagePlanId,
            activity.params.outputBatchId
          );
        }

        // If harvest completes in Winter, go directly to Dormant
        // Otherwise, set to Harvested (will transition to Dormant at Winter week 1)
        const finalStatus = currentSeason === 'Winter' ? 'Dormant' : 'Harvested';

        // Update vineyard status and reset ripeness
        const updatedVineyard = {
          ...vineyard,
          status: finalStatus,
          ripeness: 0, // Reset ripeness after harvest
          pendingFeatures: [] // Clear any vineyard features (e.g., Noble Rot) post-harvest
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

  [WorkCategory.MAINTENANCE]: async (activity: Activity) => {
    const result = await completeEmptyStorageVesselActivity(activity);
    if (!result.success) {
      notificationService.addMessage(result.error ?? 'The vessel could not be emptied.', 'winemaking.emptyVessel', 'Empty Vessel', NotificationCategory.WINEMAKING_PROCESS);
      throw new Error(result.error ?? 'The vessel could not be emptied.');
    }
    notificationService.addMessage(
      `Emptied ${result.emptiedLitres ?? 0} L of ${result.batch?.grape ?? 'wine'} from ${result.vesselName ?? 'the selected vessel'}. The remaining batch volume is ${result.remainingLitres ?? 0} L.`,
      'winemaking.emptyVessel',
      'Empty Vessel',
      NotificationCategory.WINEMAKING_PROCESS,
    );
  },

  [WorkCategory.CLEARING]: async (activity: Activity) => {
    await completeClearingActivity(activity);
  },

  [WorkCategory.BUILDING]: async (_activity: Activity) => {
    // TODO: Implement building completion
  },

  [WorkCategory.UPGRADING]: async (_activity: Activity) => {
    // TODO: Implement upgrading completion
  },

  [WorkCategory.ADMINISTRATION_AND_RESEARCH]: async (activity: Activity) => {
    const activityType = typeof activity.params?.type === 'string'
      ? activity.params.type.toLowerCase()
      : '';
    const isBookkeepingActivity =
      activityType === 'bookkeeping' ||
      activity.title.includes('Bookkeeping') ||
      (activity.params?.prevSeason !== undefined && activity.params?.prevYear !== undefined);

    if (isBookkeepingActivity) {
      await completeBookkeeping(activity);
      return;
    }

    const isResearchActivity =
      activityType === 'research' ||
      typeof activity.params?.researchId === 'string';

    if (isResearchActivity) {
      await researchUpgradeFeature.workflow.completeResearch(activity);
      return;
    }

    console.warn(
      `Unknown administration/research activity type for ${activity.id}; no completion handler executed.`
    );
  },

  [WorkCategory.STAFF_SEARCH]: async (activity: Activity) => {
    await completeStaffSearch(activity);
  },

  [WorkCategory.STAFF_HIRING]: async (activity: Activity) => {
    await completeHiringProcess(activity);
  },

  [WorkCategory.LAND_SEARCH]: async (activity: Activity) => {
    await completeLandSearch(activity);
  },

  [WorkCategory.LENDER_SEARCH]: async (activity: Activity) => {
      await loanLenderFeature.workflow.completeLenderSearch(activity);
  },

  [WorkCategory.TAKE_LOAN]: async (activity: Activity) => {
      await loanLenderFeature.workflow.completeTakeLoan(activity);
  },

  [WorkCategory.FINANCE_AND_STAFF]: async (activity: Activity) => {
    await completeBookkeeping(activity);
  }
};

/**
 * Create a new activity with optional auto-assignment
 */
export interface ActivityCreationResult {
  activityId: string | null;
  reason?: string;
}

export async function createActivityWithResult(options: ActivityCreationOptions): Promise<ActivityCreationResult> {
  try {
    const gameState = getGameState();

    if (options.category === WorkCategory.PLANTING || options.category === WorkCategory.HARVESTING) {
      const vineyard = (await loadVineyards()).find(candidate => candidate.id === options.targetId);
      if (!vineyard) {
        const reason = `Cannot create ${options.category.toLowerCase()} activity without a vineyard target.`;
        console.warn(reason);
        return { activityId: null, reason };
      }

      const operation = options.category === WorkCategory.PLANTING ? 'planting' : 'harvesting';
      const season = gameState.season ?? 'Spring';
      const impact = resolveWeatherOperationImpact({
        weather: createWeatherWeekContext(gameState),
        operation,
        season,
      });

      if (!impact.allowed) {
        console.warn(`Cannot create ${operation} activity: ${impact.reason}`);
        return { activityId: null, reason: impact.reason };
      }
    }

    // Check for conflicting activities
    if (options.targetId) {
      const hasConflict = await hasActiveActivity(options.targetId, options.category);
      if (hasConflict) {
        console.warn(`An activity of type ${options.category} is already in progress for this target.`);
        return { activityId: null, reason: `An activity of type ${options.category.toLowerCase()} is already in progress for this target.` };
      }
    }

    const activity: Activity = {
      id: options.id ?? uuidv4(),
      category: options.category,
      title: options.title,
      totalWork: options.totalWork,
      completedWork: 0,
      targetId: options.targetId,
      params: options.params || {},
      status: options.initialStatus ?? 'active',
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

      // Only send default notification if not skipped
      if (!options.skipNotification) {
        const assignedCount = activity.params.assignedStaffIds?.length || 0;
        const formattedTotalWork = formatNumber(activity.totalWork, { smartDecimals: true, smartMaxDecimals: true });
        const formattedAssignedCount = formatNumber(assignedCount, { smartDecimals: true, smartMaxDecimals: true });
        const baseAssignmentMessage = assignedCount > 0
          ? `Started ${activity.title} - ${formattedTotalWork} work units required (${formattedAssignedCount} staff auto-assigned)`
          : `Started ${activity.title} - ${formattedTotalWork} work units required`;

        // Optional activity details provided as a typed option
        const assignmentMessage = options.activityDetails
          ? `${baseAssignmentMessage} - ${options.activityDetails}`
          : baseAssignmentMessage;

        notificationService.addMessage(assignmentMessage, 'activity.creation', 'Activity Creation', NotificationCategory.ACTIVITIES_TASKS);
      }
      return { activityId: activity.id };
    }

    return { activityId: null, reason: 'The activity could not be saved. Check the activity category/schema and try again.' };
  } catch (error) {
    console.error('Error creating activity:', error);
    return { activityId: null, reason: getActivityCreationErrorMessage(error) };
  }
}

function getActivityCreationErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unknown activity creation error.';
}

/** Create an activity and return its ID for existing callers. */
export async function createActivity(options: ActivityCreationOptions): Promise<string | null> {
  return (await createActivityWithResult(options)).activityId;
}

/**
 * Get all visible activities (active + paused) for the UI
 */
export async function getAllActivities(): Promise<Activity[]> {
  const activities = await loadActivitiesFromDb();
  return activities.filter(activity => activity.status === 'active' || activity.status === 'paused');
}

async function refreshVisibleActivities(triggerUpdate = true): Promise<void> {
  updateGameState({ activities: await getAllActivities() });
  if (triggerUpdate) triggerGameUpdateImmediate();
}

/**
 * Get activity by ID
 */
export async function getActivityById(activityId: string): Promise<Activity | null> {
  const activities = await loadActivitiesFromDb();
  return activities.find(activity => activity.id === activityId) || null;
}

export async function updateActivity(activityId: string, updates: Partial<Activity>): Promise<boolean> {
  try {
    const success = await updateActivityInDb(activityId, updates);
    if (!success) {
      return false;
    }

    await refreshVisibleActivities();
    return true;
  } catch (error) {
    console.error('Error updating activity:', error);
    return false;
  }
}

/**
 * Pause an activity - staff will not contribute work until resumed
 */
export async function pauseActivity(activityId: string): Promise<boolean> {
  try {
    const activity = await getActivityById(activityId);
    if (!activity) {
      console.warn(`Activity ${activityId} not found`);
      return false;
    }
    if (activity.status !== 'active') {
      console.warn(`Activity ${activityId} is not active (status: ${activity.status})`);
      return false;
    }
    const success = await updateActivityInDb(activityId, { status: 'paused' });
    if (success) {
      await refreshVisibleActivities();
    }
    return success;
  } catch (error) {
    console.error('Error pausing activity:', error);
    return false;
  }
}

/**
 * Resume a paused activity
 */
export async function resumeActivity(activityId: string): Promise<boolean> {
  try {
    const activity = await getActivityById(activityId);
    if (!activity) {
      console.warn(`Activity ${activityId} not found`);
      return false;
    }
    if (activity.status !== 'paused') {
      console.warn(`Activity ${activityId} is not paused (status: ${activity.status})`);
      return false;
    }
    const success = await updateActivityInDb(activityId, {
      status: 'active',
      params: { ...activity.params, storageCapacityBlocked: false },
    });
    if (success) {
      await refreshVisibleActivities();
    }
    return success;
  } catch (error) {
    console.error('Error resuming activity:', error);
    return false;
  }
}

export async function activateActivityWithParams(activityId: string, params: Record<string, any>): Promise<boolean> {
  const success = await updateActivityInDb(activityId, { status: 'active', params });
  if (success) {
    await refreshVisibleActivities();
  }
  return success;
}

/**
 * Complete an activity immediately using the same completion handlers as weekly progress.
 * This is intended for development/test tooling where waiting for ticks would hide bugs.
 */
export async function completeActivityNow(activityId: string): Promise<{ success: boolean; error?: string; activity?: Activity }> {
  try {
    const activity = await getActivityById(activityId);
    if (!activity) {
      return { success: false, error: `Activity ${activityId} not found` };
    }

    if (activity.status === 'cancelled') {
      return { success: false, error: `Activity ${activityId} is cancelled`, activity };
    }

    const completedActivity: Activity = {
      ...activity,
      completedWork: activity.totalWork
    };

    await updateActivityInDb(activity.id, { completedWork: activity.totalWork });

    const handler = completionHandlers[completedActivity.category];
    if (handler) {
      await handler(completedActivity);
    }

    await removeActivityFromDb(completedActivity.id);

    await refreshVisibleActivities();

    return { success: true, activity: completedActivity };
  } catch (error) {
    console.error(`Error force-completing activity ${activityId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete activity'
    };
  }
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
      if (activity.params.storagePlanId) {
        await releaseReservedStorageAllocationPlan(activity.params.storagePlanId);
      }
      // Update local game state
      await refreshVisibleActivities(false);

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
    const allActivities = await getAllActivities();
    // Only active activities receive work each tick; paused activities are skipped
    const activities = allActivities.filter(a => a.status === 'active');
    const gameState = getGameState();
    const allStaff = gameState.staff || [];
    const completedActivities: Activity[] = [];

    // Process each active activity
    for (const activity of activities) {
      const assignedStaffIds = activity.params.assignedStaffIds || [];
      const assignedStaff = allStaff.filter(s => assignedStaffIds.includes(s.id));
      const workContext = await getActivityStaffWorkContext(
        activity,
        activities,
        gameState,
        assignedStaffIds,
      );

      // Calculate preliminary team work. XP is deliberately delayed until the
      // persistable work amount (weather, final-tick, and storage limits) is known.
      const preliminaryAllocation = calculateActivityStaffWorkPreview(
        activity,
        assignedStaff,
        workContext,
      ).allocation;

      const oldCompletedWork = activity.completedWork;
      let newCompletedWork = Math.min(
        activity.totalWork,
        activity.completedWork + preliminaryAllocation.totalWork
      );

      // Handle partial planting for PLANTING activities
      if (activity.category === WorkCategory.PLANTING && activity.targetId) {
        await handlePartialPlanting(activity, oldCompletedWork, newCompletedWork);
      }

      // Handle partial harvesting for HARVESTING activities
      let storageCapacityBlocked = false;
      let harvestedParams: Activity['params'] | undefined;
      let statusUpdate: Activity['status'] | undefined;
      if (activity.category === WorkCategory.HARVESTING && activity.targetId) {
        const harvestProgress = await handlePartialHarvesting(activity, oldCompletedWork, newCompletedWork);
        storageCapacityBlocked = harvestProgress?.storageCapacityBlocked ?? false;
        harvestedParams = harvestProgress?.params;
        newCompletedWork = harvestProgress?.completedWork
          ?? (storageCapacityBlocked ? oldCompletedWork : newCompletedWork);
        statusUpdate = harvestProgress?.status;
      }

      const appliedAllocation = calculateAppliedStaffWorkAllocation(
        preliminaryAllocation,
        newCompletedWork - oldCompletedWork,
      );
      const update: Partial<Activity> = {
        completedWork: newCompletedWork,
        ...(harvestedParams ? { params: harvestedParams } : {}),
        ...(statusUpdate ? { status: statusUpdate } : {}),
      };
      const persisted = await updateActivityInDb(activity.id, update);
      if (!persisted) {
        console.error(`Failed to persist progress for activity ${activity.id}; skipping XP and completion.`);
        continue;
      }

      if (appliedAllocation.totalWork > 0) {
        const relevantSkill = WORK_CATEGORY_INFO[activity.category].skill;
        const xpCategories = [`skill:${relevantSkill}`, `task:${activity.category}`];
        if (workContext.grapeVariety) xpCategories.push(`grape:${workContext.grapeVariety}`);

        for (const [staffId, appliedWork] of appliedAllocation.contributions) {
          await awardExperience(staffId, appliedWork, xpCategories);
        }
      }

      // Check if activity is complete
      if (!storageCapacityBlocked && newCompletedWork >= activity.totalWork) {
        completedActivities.push({ ...activity, ...(harvestedParams ? { params: harvestedParams } : {}), completedWork: newCompletedWork });
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
    await refreshVisibleActivities(completedActivities.length > 0);

  } catch (error) {
    console.error('Error progressing activities:', error);
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

    // Get staff assigned to this activity
    const assignedStaffIds = activity.params.assignedStaffIds || [];
    const assignedStaff = allStaff.filter(s => assignedStaffIds.includes(s.id));
    const workContext = await getActivityStaffWorkContext(activity, allActivities, gameState, assignedStaffIds);

    if (assignedStaff.length > 0) {
      const { workPerWeek, weeksToComplete } = calculateActivityStaffWorkPreview(activity, assignedStaff, workContext);

      if (workPerWeek > 0) {
        timeRemaining = weeksToComplete === 1 ? '1 week' : `${weeksToComplete} weeks`;
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
    const visibleActivities = activities.filter(a => a.status === 'active' || a.status === 'paused');
    updateGameState({ activities: visibleActivities });

    // Activities loaded successfully
  } catch (error) {
    console.error('Error initializing activity system:', error);
    updateGameState({ activities: [] });
  }
}
