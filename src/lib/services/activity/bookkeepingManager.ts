import { getGameState } from '@/lib/services/core/gameState';
import { WorkCategory } from '@/lib/types/types';
// Import createActivity directly to avoid circular dependency
import { createActivity } from '@/lib/services/activity/activityManager';
import { removeActivityFromDb, loadActivitiesFromDb } from '@/lib/database/activity/activityService';
import { calculateTotalBookkeepingWork } from './BookkeepingWorkCalculator';
import { notificationService } from '@/components/layout/NotificationCenter';
import { supabase } from '@/lib/database/supabase';
import { v4 as uuidv4 } from 'uuid';
import { calculateAbsoluteWeeks } from '@/lib/utils/utils';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Bookkeeping Manager
 * Handles automatic creation of bookkeeping activities and spillover logic
 */

/**
 * Check if bookkeeping activity should be triggered and create it if needed
 * Called from game tick system
 */
export async function checkAndTriggerBookkeeping(): Promise<void> {
  const gameState = getGameState();
  const { week } = gameState;
  
  // Only trigger on first week of any season
  if (week !== 1) return;
  
  try {
    // Calculate bookkeeping work requirements
    const calculation = await calculateTotalBookkeepingWork();
    const { totalWork, spilloverData, seasonData } = calculation;
    
    // Don't create bookkeeping activity if there are no transactions to process
    if (seasonData.transactionCount === 0 && spilloverData.spilloverWork === 0) {
      return; // No bookkeeping needed
    }
    
    // Apply prestige penalty for incomplete tasks
    if (spilloverData.incompleteTaskCount > 0) {
      await applyPrestigePenalty(spilloverData.prestigePenalty, spilloverData.incompleteTaskCount);
      
      // Remove incomplete bookkeeping tasks (they're now rolled into the new task)
      await cleanupIncompleteBookkeeping();
      
      // Notify about spillover
      notificationService.warning(
        `Incomplete bookkeeping from previous seasons has affected company prestige! ` +
        `Lost ${spilloverData.prestigePenalty.toFixed(2)} prestige points. ` +
        `${spilloverData.spilloverWork.toFixed(0)} extra work units added to new bookkeeping task.`
      );
    }
    
    // Create new bookkeeping activity
    const activityId = await createActivity({
      category: WorkCategory.ADMINISTRATION,
      title: `Bookkeeping for ${seasonData.prevSeason} ${seasonData.prevYear}`,
      totalWork,
      params: {
        prevSeason: seasonData.prevSeason,
        prevYear: seasonData.prevYear,
        transactionCount: seasonData.transactionCount,
        spilloverWork: spilloverData.spilloverWork,
        incompleteTaskCount: spilloverData.incompleteTaskCount
      },
      isCancellable: true
    });
    
    if (activityId) {
      const message = spilloverData.incompleteTaskCount > 0 
        ? `New bookkeeping task created for ${seasonData.prevSeason} ${seasonData.prevYear} with spillover penalties.`
        : `New bookkeeping task created for ${seasonData.prevSeason} ${seasonData.prevYear}.`;
      
      notificationService.info(
        `${message} Processing ${seasonData.transactionCount} transactions (${totalWork} work units).`
      );
    }
    
  } catch (error) {
    console.error('Error in checkAndTriggerBookkeeping:', error);
    notificationService.error('Failed to create bookkeeping activity.');
  }
}

/**
 * Apply prestige penalty for incomplete bookkeeping
 */
async function applyPrestigePenalty(penalty: number, taskCount: number): Promise<void> {
  try {
    const gameState = getGameState();
    const companyId = getCurrentCompanyId();
    
    await supabase
      .from('prestige_events')
      .insert([{
        id: uuidv4(),
        company_id: companyId,
        type: 'penalty',
        amount: -penalty,
        created_game_week: calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!),
        decay_rate: 0.90, // Penalty decays over time but slowly
        description: `Incomplete bookkeeping penalty (${taskCount} tasks)`,
        source_id: 'bookkeeping_penalty'
      }]);
  } catch (error) {
    console.error('Error applying prestige penalty:', error);
  }
}

/**
 * Clean up incomplete bookkeeping tasks (they're now rolled into the new task)
 */
async function cleanupIncompleteBookkeeping(): Promise<void> {
  try {
    // Find existing incomplete bookkeeping tasks
    const activities = await loadActivitiesFromDb();
    const incompleteBookkeeping = activities.filter(activity => 
      activity.category === WorkCategory.ADMINISTRATION && 
      activity.title.includes('Bookkeeping') &&
      activity.status === 'active'
    );
    
    // Remove them from the database
    for (const task of incompleteBookkeeping) {
      await removeActivityFromDb(task.id);
    }
  } catch (error) {
    console.error('Error cleaning up incomplete bookkeeping:', error);
  }
}

