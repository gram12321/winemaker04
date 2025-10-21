import { Staff, Activity, WorkCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '../../core/gameState';
import { createActivity } from './activityManager';
import { addStaff, createStaff, getRandomFirstName, getRandomLastName, getRandomNationality } from '../../user/staffService';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';
import { addTransaction } from '../../user/financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { getSkillLevelInfo } from '@/lib/constants/staffConstants';
import {
  StaffSearchOptions, SearchWorkEstimate, HiringWorkEstimate, SearchPreviewStats,
  calculateStaffSearchCost, calculateSearchWork, calculateHiringWorkRange,
  calculateHiringWorkForCandidate, calculateSearchPreview
} from '../workcalculators/staffSearchWorkCalculator';

/**
 * Generate random staff candidates based on search parameters
 * Returns array of Staff objects (not yet in database)
 */
export function generateStaffCandidates(options: StaffSearchOptions): Staff[] {
  const { numberOfCandidates, skillLevel, specializations } = options;
  const candidates: Staff[] = [];
  
  for (let i = 0; i < numberOfCandidates; i++) {
    const nationality = getRandomNationality();
    const firstName = getRandomFirstName(nationality);
    const lastName = getRandomLastName(nationality);
    
    // Create staff with the search parameters
    const staff = createStaff(
      firstName,
      lastName,
      skillLevel,
      specializations,
      nationality
    );
    
    candidates.push(staff);
  }
  
  return candidates;
}

/**
 * Start a staff search activity
 * Deducts search cost and creates the activity
 */
export async function startStaffSearch(options: StaffSearchOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    const searchCost = calculateStaffSearchCost(options);
    const totalWork = calculateSearchWork(options);
    
    // Check if we have enough money
    const currentMoney = gameState.money || 0;
    if (currentMoney < searchCost) {
      await notificationService.addMessage(
        `Insufficient funds for staff search. Need €${searchCost.toFixed(2)}, have €${currentMoney.toFixed(2)}`,
        'staffSearchManager.startStaffSearch',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      return null;
    }
    
    // Deduct search cost immediately
    await addTransaction(
      -searchCost,
      `Staff search for ${options.numberOfCandidates} candidate${options.numberOfCandidates > 1 ? 's' : ''} (${getSkillLevelInfo(options.skillLevel).name} level)`,
      TRANSACTION_CATEGORIES.STAFF_SEARCH,
      false
    );
    
  
    // Create the search activity
    const activityId = await createActivity({
      category: WorkCategory.STAFF_SEARCH,
      title: 'Search Staff',
      totalWork,
      params: {
        searchOptions: options,
        searchCost,
        candidates: [] // Will be populated on completion
      },
      isCancellable: true
    });
    
    if (activityId) {
      await notificationService.addMessage(
        `Staff search started! Cost: €${searchCost.toFixed(2)}`,
        'staffSearchManager.startStaffSearch',
        'Staff Search Started',
        NotificationCategory.ACTIVITIES_TASKS
      );
    }
    
    return activityId;
  } catch (error) {
    console.error('Error starting staff search:', error);
    return null;
  }
}

/**
 * Complete staff search activity
 * Generates candidates and stores them in activity params
 * Called by activity completion handler
 */
export async function completeStaffSearch(activity: Activity): Promise<void> {
  try {
    const searchOptions = activity.params.searchOptions as StaffSearchOptions;
    
    if (!searchOptions) {
      console.error('No search options found in activity params');
      return;
    }
    
    // Generate candidates based on search parameters
    const candidates = generateStaffCandidates(searchOptions);
    
    // Store candidates in game state for modal to access
    updateGameState({
      pendingStaffCandidates: {
        activityId: activity.id,
        candidates,
        searchOptions,
        timestamp: Date.now()
      }
    });
    
    const skillInfo = getSkillLevelInfo(searchOptions.skillLevel);
    await notificationService.addMessage(
      `Staff search complete! Found ${candidates.length} ${skillInfo.name}-level candidate${candidates.length > 1 ? 's' : ''}.`,
      'staffSearchManager.completeStaffSearch',
      'Staff Search Complete',
      NotificationCategory.ACTIVITIES_TASKS
    );
  } catch (error) {
    console.error('Error completing staff search:', error);
  }
}

/**
 * Start hiring process for a specific candidate
 * Creates an ADMINISTRATION activity for onboarding
 */
export async function startHiringProcess(candidate: Staff): Promise<string | null> {
  try {
    const gameState = getGameState();
    
    // Check if we have enough money for first month's wage
    const currentMoney = gameState.money || 0;
    if (currentMoney < candidate.wage) {
      await notificationService.addMessage(
        `Insufficient funds to hire ${candidate.name}. Need €${candidate.wage.toFixed(2)} for first month's wage.`,
        'staffSearchManager.startHiringProcess',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      return null;
    }
    
    // Calculate work required for hiring this specific candidate
    const hiringWork = calculateHiringWorkForCandidate(candidate);
    
    // Create the hiring activity
    const activityId = await createActivity({
      category: WorkCategory.STAFF_HIRING,
      title: `Hiring: ${candidate.name}`,
      totalWork: hiringWork,
      params: {
        candidateData: candidate,
        hiringCost: candidate.wage
      },
      isCancellable: true
    });
    
    if (activityId) {
      await notificationService.addMessage(
        `Started hiring process for ${candidate.name}. First month's wage will be €${candidate.wage.toFixed(2)}`,
        'staffSearchManager.startHiringProcess',
        'Hiring Process Started',
        NotificationCategory.STAFF_MANAGEMENT
      );
    }
    
    return activityId;
  } catch (error) {
    console.error('Error starting hiring process:', error);
    return null;
  }
}

/**
 * Complete hiring process activity
 * Adds staff to company and deducts first month's wage
 * Called by activity completion handler
 */
export async function completeHiringProcess(activity: Activity): Promise<void> {
  try {
    const candidateData = activity.params.candidateData as Staff;
    const hiringCost = activity.params.hiringCost as number;
    
    if (!candidateData) {
      console.error('No candidate data found in hiring activity');
      return;
    }
    
    // Add the staff member to the company
    const addedStaff = await addStaff(candidateData);
    
    if (!addedStaff) {
      console.error(`Failed to hire ${candidateData.name}`);
      return;
    }
    
    // Deduct first month's wage
    await addTransaction(
      -hiringCost,
      `Hired ${candidateData.name} - First month's wage`,
      TRANSACTION_CATEGORIES.STAFF_WAGES,
      false
    );
    
    // Build specialization text
    const specText = candidateData.specializations.length > 0
      ? ` specializing in ${candidateData.specializations.join(', ')}`
      : '';
    
    await notificationService.addMessage(
      `${candidateData.name} has joined your winery${specText}! Monthly wage: €${candidateData.wage.toFixed(2)}`,
      'staffSearchManager.completeHiringProcess',
      'Staff Hired',
      NotificationCategory.STAFF_MANAGEMENT
    );
  } catch (error) {
    console.error('Error completing hiring process:', error);
  }
}

/**
 * Clear pending staff candidates (call when starting new search or closing modal)
 */
export function clearPendingCandidates(): void {
  updateGameState({
    pendingStaffCandidates: undefined
  });
}

// Re-export types and functions from calculator for convenience
export type { StaffSearchOptions, SearchWorkEstimate, HiringWorkEstimate, SearchPreviewStats };
export { 
  calculateStaffSearchCost,
  calculateSearchWork,
  calculateHiringWorkRange,
  calculateHiringWorkForCandidate,
  calculateSearchPreview
};
