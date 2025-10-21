// Staff Search Work Calculator
// Calculates work required for staff search and hiring activities

import { Staff, WorkCategory } from '@/lib/types/types';
import { calculateTotalWork } from './workCalculator';
import { TASK_RATES, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { BASE_WEEKLY_WAGE, SKILL_WAGE_MULTIPLIER } from '@/lib/constants/staffConstants';

export interface StaffSearchOptions {
  numberOfCandidates: number;
  skillLevel: number;
  specializations: string[];
}

export interface SearchWorkEstimate {
  totalWork: number;
  timeEstimate: string;
  cost: number;
}

export interface HiringWorkEstimate {
  minWork: number;
  maxWork: number;
  timeEstimate: string;
}

/**
 * Calculate the cost of a staff search
 */
export function calculateStaffSearchCost(options: StaffSearchOptions): number {
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
 * Calculate hiring work for a specific candidate
 * Based on their skills and wage
 */
export function calculateHiringWorkForCandidate(candidate: Staff): number {
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
