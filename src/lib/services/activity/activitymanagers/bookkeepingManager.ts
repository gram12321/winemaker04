import { getGameState, updateGameState } from '@/lib/services';
import { WorkCategory, NotificationCategory } from '@/lib/types/types';
import { createActivity } from '@/lib/services/activity/activitymanagers/activityManager';
import { removeActivityFromDb, loadActivitiesFromDb } from '@/lib/database/activities/activityDB';
import { calculateTotalBookkeepingWork } from '../workcalculators/bookkeepingWorkCalculator';
import { notificationService } from '@/lib/services';
import { v4 as uuidv4 } from 'uuid';
import { calculateAbsoluteWeeks } from '@/lib/utils/utils';
import { insertPrestigeEvent } from '@/lib/database';

export async function checkAndTriggerBookkeeping(): Promise<void> {
  const gameState = getGameState();
  const { week } = gameState;
  
  if (week !== 1) return;
  
  try {
    const calculation = await calculateTotalBookkeepingWork();
    const { totalWork, spilloverData, seasonData } = calculation;
    
    if (seasonData.transactionCount === 0 && spilloverData.spilloverWork === 0 && seasonData.loanPenaltyWork === 0) {
      return;
    }
    
    if (spilloverData.incompleteTaskCount > 0) {
      await handleSpilloverPenalties(spilloverData);
    }
    
    // Create activity details including loan penalty work
    let activityDetails = `Processing ${seasonData.transactionCount} transactions (${totalWork} work units).`;
    if (spilloverData.incompleteTaskCount > 0) {
      activityDetails += ' Spillover penalties applied.';
    }
    if (seasonData.loanPenaltyWork > 0) {
      activityDetails += ` Loan penalty work: ${seasonData.loanPenaltyWork} units.`;
    }
    
    await createActivity({
      category: WorkCategory.ADMINISTRATION,
      title: `Bookkeeping for ${seasonData.prevSeason} ${seasonData.prevYear}`,
      totalWork,
      activityDetails,
      params: {
        prevSeason: seasonData.prevSeason,
        prevYear: seasonData.prevYear,
        transactionCount: seasonData.transactionCount,
        spilloverWork: spilloverData.spilloverWork,
        incompleteTaskCount: spilloverData.incompleteTaskCount,
        loanPenaltyWork: seasonData.loanPenaltyWork
      },
      isCancellable: true
    });
    
    // Clear loan penalty work from game state after creating the activity
    if (seasonData.loanPenaltyWork > 0) {
      const updatedGameState = { ...gameState, loanPenaltyWork: 0 };
      updateGameState(updatedGameState);
      console.log(`🔔 Cleared ${seasonData.loanPenaltyWork} loan penalty work units from game state`);
    }
    
  } catch (error) {
    console.error('Error in checkAndTriggerBookkeeping:', error);
  }
}

// Handle spillover penalties from incomplete bookkeeping
async function handleSpilloverPenalties(spilloverData: {
  spilloverWork: number;
  prestigePenalty: number;
  incompleteTaskCount: number;
}): Promise<void> {
  try {
    await applyPrestigePenalty(spilloverData.prestigePenalty, spilloverData.incompleteTaskCount);
    
    await cleanupIncompleteBookkeeping();
    
    await notificationService.addMessage(
      `Incomplete bookkeeping from previous seasons has affected company prestige! ` +
      `Lost ${spilloverData.prestigePenalty.toFixed(2)} prestige points. ` +
      `${spilloverData.spilloverWork.toFixed(0)} extra work units added to new bookkeeping task.`,
      'bookkeepingManager.handleSpillovers',
      'Bookkeeping Penalty',
      NotificationCategory.ADMINISTRATION
    );
  } catch (error) {
    console.error('Error handling spillover penalties:', error);
  }
}

// Apply prestige penalty for incomplete bookkeeping
async function applyPrestigePenalty(penalty: number, taskCount: number): Promise<void> {
  const gameState = getGameState();
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'penalty',
    amount_base: -penalty,
    created_game_week: calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!),
    decay_rate: 0.90,
    payload: {
      description: `Incomplete bookkeeping penalty (${taskCount} tasks)`,
      taskCount
    },
    source_id: 'bookkeeping_penalty'
  });
}


// Clean up incomplete bookkeeping tasks
async function cleanupIncompleteBookkeeping(): Promise<void> {
  const activities = await loadActivitiesFromDb();
  const incompleteBookkeeping = activities.filter(activity => 
    activity.category === WorkCategory.ADMINISTRATION && 
    activity.title.includes('Bookkeeping') &&
    activity.status === 'active'
  );
  
  await Promise.all(
    incompleteBookkeeping.map(task => removeActivityFromDb(task.id))
  );
}

