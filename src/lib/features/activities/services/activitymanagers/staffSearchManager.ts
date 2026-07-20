import { Staff, Activity, GameDate, WorkCategory } from '@/lib/types/types';
import { staffFeature } from '@/lib/features/staff';
import { NotificationCategory } from '@/lib/types/types';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { getSkillLevelInfo, isSpecializedRole, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import {
  StaffSearchOptions,
  calculateStaffSearchCost,
  calculateSearchWork,
  calculateHiringWorkForCandidate
} from '../workcalculators/staffSearchWorkCalculator';
import { formatNumber } from '@/lib/utils/utils';

const notify = (...args: Parameters<(typeof import('@/lib/services/core/notificationService'))['notificationService']['addMessage']>) =>
  import('@/lib/services/core/notificationService').then(({ notificationService }) => notificationService.addMessage(...args));

const getRuntimeGameState = () => import('@/lib/services/core/gameState');

/**
 * Generate random staff candidates based on search parameters
 * Returns array of Staff objects (not yet in database)
 */
export function generateStaffCandidates(options: StaffSearchOptions, hireDate: GameDate): Staff[] {
  const { numberOfCandidates, skillLevel, specializedRoles } = options;
  const candidates: Staff[] = [];

  for (let i = 0; i < numberOfCandidates; i++) {
    const nationality = staffFeature.recruitment.getRandomNationality();
    const firstName = staffFeature.recruitment.getRandomFirstName(nationality);
    const lastName = staffFeature.recruitment.getRandomLastName(nationality);

    // Create staff with the search parameters
    const staff = staffFeature.records.create(
      firstName,
      lastName,
      skillLevel,
      nationality,
      hireDate,
      undefined,
      false,
      specializedRoles
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
    if (!options.specializedRoles.every(isSpecializedRole)) {
      throw new Error('Staff search specialized roles must be valid roles.');
    }

    const { getGameState } = await getRuntimeGameState();
    const gameState = getGameState();
    const searchCost = calculateStaffSearchCost(options);
    const totalWork = calculateSearchWork(options);

    // Check if we have enough money
    const currentMoney = gameState.money || 0;
    if (currentMoney < searchCost) {
      await notify(
        `Insufficient funds for staff search. Need ${formatNumber(searchCost, { currency: true, decimals: 2 })}, have ${formatNumber(currentMoney, { currency: true, decimals: 2 })}`,
        'staffSearchManager.startStaffSearch',
        'Insufficient Funds',
        NotificationCategory.FINANCE_AND_STAFF
      );
      return null;
    }

    // Deduct search cost immediately
    const { addTransaction } = await import('@/lib/services/finance/financeService');
    await addTransaction(
      -searchCost,
      `Staff search for ${options.numberOfCandidates} candidate${options.numberOfCandidates > 1 ? 's' : ''} (${getSkillLevelInfo(options.skillLevel).name} level)`,
      TRANSACTION_CATEGORIES.STAFF_SEARCH,
      false
    );


    // Create the search activity
    const { createActivity } = await import('./activityManager');
    const activityId = await createActivity({
      category: WorkCategory.STAFF_SEARCH,
      title: 'Search Staff',
      totalWork,
      activityDetails: `Cost: ${formatNumber(searchCost, { currency: true, decimals: 2 })}`,
      params: {
        searchOptions: options,
        searchCost,
        candidates: [] // Will be populated on completion
      },
      isCancellable: true
    });

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
    const { getGameState, updateGameState } = await getRuntimeGameState();
    const gameState = getGameState();
    const candidates = generateStaffCandidates(searchOptions, {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2025,
    });

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
    await notify(
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
    const { getGameState } = await getRuntimeGameState();
    const gameState = getGameState();

    // Check if we have enough money for first month's wage
    const currentMoney = gameState.money || 0;
    if (currentMoney < candidate.wage) {
      await notify(
        `Insufficient funds to hire ${candidate.name}. Need ${formatNumber(candidate.wage, { currency: true, decimals: 2 })} for first month's wage.`,
        'staffSearchManager.startHiringProcess',
        'Insufficient Funds',
        NotificationCategory.FINANCE_AND_STAFF
      );
      return null;
    }

    // Calculate work required for hiring this specific candidate
    const hiringWork = calculateHiringWorkForCandidate(candidate);

    // Create the hiring activity
    const { createActivity } = await import('./activityManager');
    const activityId = await createActivity({
      category: WorkCategory.STAFF_HIRING,
      title: `Hiring: ${candidate.name}`,
      totalWork: hiringWork,
      activityDetails: `First month's wage: ${formatNumber(candidate.wage, { currency: true, decimals: 2 })}`,
      params: {
        candidateData: candidate,
        hiringCost: candidate.wage
      },
      isCancellable: true
    });

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
    const addedStaff = await staffFeature.records.add(candidateData);

    if (!addedStaff) {
      console.error(`Failed to hire ${candidateData.name}`);
      return;
    }

    // Deduct first month's wage
    const { addTransaction } = await import('@/lib/services/finance/financeService');
    await addTransaction(
      -hiringCost,
      `Hired ${candidateData.name} - First month's wage`,
      TRANSACTION_CATEGORIES.STAFF_WAGES,
      false
    );

    const roleText = candidateData.specializedRoles.length > 0
      ? ` as ${candidateData.specializedRoles.map(role => SPECIALIZED_ROLES[role].title).join(', ')}`
      : '';

    await notify(
      `${candidateData.name} has joined your winery${roleText}! Monthly wage: ${formatNumber(candidateData.wage, { currency: true, decimals: 2 })}`,
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
export async function clearPendingCandidates(): Promise<void> {
  const { updateGameState } = await getRuntimeGameState();
  updateGameState({
    pendingStaffCandidates: undefined
  });
}
