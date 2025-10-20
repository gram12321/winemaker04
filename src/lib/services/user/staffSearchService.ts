// Staff Search Service
// Business logic for searching and hiring staff through the activity system

import { Staff, Activity, WorkCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { createActivity } from '../activity/activitymanagers/activityManager';
import { addStaff, createStaff, getRandomFirstName, getRandomLastName, getRandomNationality } from './staffService';
import { notificationService } from '@/lib/services/core/notificationService';
import { NotificationCategory } from '@/lib/types/types';
import { addTransaction } from './financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateTotalWork } from '../activity/workcalculators/workCalculator';
import { TASK_RATES, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { BASE_WEEKLY_WAGE, SKILL_WAGE_MULTIPLIER, getSkillLevelInfo } from '@/lib/constants/staffConstants';

/**
 * Staff search options interface
 */
export interface StaffSearchOptions {
  numberOfCandidates: number;
  skillLevel: number;
  specializations: string[];
}

/**
 * Search work estimate with cost
 */
export interface SearchWorkEstimate {
  totalWork: number;
  timeEstimate: string;
  cost: number;
}

/**
 * Hiring work estimate with min/max range
 */
export interface HiringWorkEstimate {
  minWork: number;
  maxWork: number;
  timeEstimate: string;
}

/**
 * Calculate the cost of a staff search based on parameters
 * Based on v3 implementation
 */
export function calculateSearchCost(options: StaffSearchOptions): number {
  const { numberOfCandidates, skillLevel, specializations } = options;
  const baseCost = 2000;
  
  // Get skill multiplier (0.1 -> 1.0, 1.0 -> 10.0)
  const skillMultiplier = 0.5 + (skillLevel * 9.5); // 1.0 to 10.0
  
  // Exponential scaling based on candidates and skill
  const candidateScaling = Math.pow(numberOfCandidates, 1.5);
  const skillScaling = Math.pow(skillMultiplier, 1.8);
  
  // Linear scaling for specialized roles (2x per role)
  const specializationMultiplier = specializations.length > 0 ? 
    Math.pow(2, specializations.length) : 1;
  
  // Combine all scalings
  const totalMultiplier = candidateScaling * skillScaling * specializationMultiplier;
  
  return Math.round(baseCost * totalMultiplier);
}

/**
 * Calculate work required for staff search activity
 */
export function calculateSearchWork(options: StaffSearchOptions): number {
  const { numberOfCandidates, skillLevel, specializations } = options;
  
  const rate = TASK_RATES[WorkCategory.STAFF_SEARCH];
  const initialWork = INITIAL_WORK[WorkCategory.STAFF_SEARCH];
  
  // Calculate skill and specialization modifiers
  const searchSkillModifier = skillLevel > 0.5 ? (skillLevel - 0.5) * 0.4 : 0;
  const searchSpecModifier = specializations.length > 0 ? 
    Math.pow(1.3, specializations.length) - 1 : 0;
  
  const workModifiers = [searchSkillModifier, searchSpecModifier];
  
  return calculateTotalWork(numberOfCandidates, {
    rate,
    initialWork,
    workModifiers
  });
}

/**
 * Calculate hiring work range (min/max based on candidate quality)
 */
export function calculateHiringWorkRange(
  skillLevel: number, 
  specializations: string[]
): HiringWorkEstimate {
  // Get min/max possible skills for this search level
  const minSkill = skillLevel * 0.4;  // Minimum possible skill
  const maxSkill = 0.6 + (skillLevel * 0.4);  // Maximum possible skill
  
  // Calculate wages based on min/max skills
  const specializationBonus = specializations.length > 0 ? 
    Math.pow(1.3, specializations.length) : 1;
  const minWeeklyWage = (BASE_WEEKLY_WAGE + (minSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;
  const maxWeeklyWage = (BASE_WEEKLY_WAGE + (maxSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;

  // Base work factors for hiring
  const rate = TASK_RATES[WorkCategory.ADMINISTRATION];
  const initialWork = INITIAL_WORK[WorkCategory.ADMINISTRATION];
  
  // Calculate modifiers
  const skillModifier = Math.pow(skillLevel * 2, 2) - 1;     // Skill impact
  const specModifier = Math.pow(1.5, specializations.length) - 1;  // Role impact
  
  // Min work calculation
  const minWageModifier = Math.pow(minWeeklyWage / 1000, 2) - 1;
  const minWork = calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers: [skillModifier, specModifier, minWageModifier]
  });
  
  // Max work calculation
  const maxWageModifier = Math.pow(maxWeeklyWage / 1000, 2) - 1;
  const maxWork = calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers: [skillModifier, specModifier, maxWageModifier]
  });

  // Calculate time estimates
  const minWeeks = Math.ceil(minWork / BASE_WORK_UNITS);
  const maxWeeks = Math.ceil(maxWork / BASE_WORK_UNITS);
  const timeEstimate = minWeeks === maxWeeks 
    ? `${minWeeks} week${minWeeks === 1 ? '' : 's'}`
    : `${minWeeks} - ${maxWeeks} weeks`;

  return {
    minWork: Math.round(minWork),
    maxWork: Math.round(maxWork),
    timeEstimate
  };
}

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
    const searchCost = calculateSearchCost(options);
    const totalWork = calculateSearchWork(options);
    
    // Check if we have enough money
    const currentMoney = gameState.money || 0;
    if (currentMoney < searchCost) {
      await notificationService.addMessage(
        `Insufficient funds for staff search. Need €${searchCost.toFixed(2)}, have €${currentMoney.toFixed(2)}`,
        'staffSearchService.startStaffSearch',
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
    
    // Get specialization names for title
    const skillInfo = getSkillLevelInfo(options.skillLevel);
    const specText = options.specializations.length > 0 
      ? ` (${options.specializations.join(', ')})` 
      : '';
    
    // Create the search activity
    const activityId = await createActivity({
      category: WorkCategory.STAFF_SEARCH,
      title: `Search: ${options.numberOfCandidates} ${skillInfo.name} candidate${options.numberOfCandidates > 1 ? 's' : ''}${specText}`,
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
        'staffSearchService.startStaffSearch',
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
      'staffSearchService.completeStaffSearch',
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
        'staffSearchService.startHiringProcess',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      return null;
    }
    
    // Calculate work required for hiring this specific candidate
    const hiringWork = calculateHiringWorkForCandidate(candidate);
    
    // Create the hiring activity
    const activityId = await createActivity({
      category: WorkCategory.ADMINISTRATION,
      title: `Hiring: ${candidate.name}`,
      totalWork: hiringWork,
      params: {
        isHiringActivity: true, // Flag to distinguish from bookkeeping
        candidateData: candidate,
        hiringCost: candidate.wage
      },
      isCancellable: true
    });
    
    if (activityId) {
      await notificationService.addMessage(
        `Started hiring process for ${candidate.name}. First month's wage will be €${candidate.wage.toFixed(2)}`,
        'staffSearchService.startHiringProcess',
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
 * Calculate hiring work for a specific candidate
 * Based on their skills and wage
 */
function calculateHiringWorkForCandidate(candidate: Staff): number {
  const rate = TASK_RATES[WorkCategory.ADMINISTRATION];
  const initialWork = INITIAL_WORK[WorkCategory.ADMINISTRATION];
  
  // Calculate modifiers based on candidate
  const avgSkill = (
    candidate.skills.field +
    candidate.skills.winery +
    candidate.skills.administration +
    candidate.skills.sales +
    candidate.skills.maintenance
  ) / 5;
  
  const skillModifier = Math.pow(avgSkill * 2, 2) - 1;
  const specModifier = Math.pow(1.5, candidate.specializations.length) - 1;
  const wageModifier = Math.pow(candidate.wage / 1000, 2) - 1;
  
  return calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers: [skillModifier, specModifier, wageModifier]
  });
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
      'staffSearchService.completeHiringProcess',
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

/**
 * Calculate preview statistics for staff search options
 * Returns skill range, wage range, and specialization bonus info
 */
export interface SearchPreviewStats {
  minSkill: number;
  maxSkill: number;
  skillRange: string;
  minWeeklyWage: number;
  maxWeeklyWage: number;
  wageRange: string;
  specializationBonus: number;
  specializationBonusText: string;
}

export function calculateSearchPreview(options: StaffSearchOptions): SearchPreviewStats {
  // Calculate skill range based on search level
  // These values match the generateRandomSkills function logic
  const minSkill = options.skillLevel * 0.4;  // Minimum possible skill
  const maxSkill = 0.6 + (options.skillLevel * 0.4);  // Maximum possible skill
  
  // Calculate specialization bonus (matches calculateWage logic)
  const specializationBonus = options.specializations.length > 0 ? 
    Math.pow(1.3, options.specializations.length) : 1;
  
  // Calculate wage range using same formula as calculateWage
  const minWeeklyWage = (BASE_WEEKLY_WAGE + (minSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;
  const maxWeeklyWage = (BASE_WEEKLY_WAGE + (maxSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;
  
  return {
    minSkill,
    maxSkill,
    skillRange: `${Math.round(minSkill * 100)}% - ${Math.round(maxSkill * 100)}%`,
    minWeeklyWage,
    maxWeeklyWage,
    wageRange: `${Math.round(minWeeklyWage)} - ${Math.round(maxWeeklyWage)}`,
    specializationBonus,
    specializationBonusText: options.specializations.length > 0 
      ? `+${Math.round((specializationBonus - 1) * 100)}% wage bonus`
      : 'None'
  };
}

