// Staff Search Work Calculator
// Calculates work required for staff search and hiring activities

import { Staff, WorkCategory, SpecializedRole } from '@/lib/types/types';
import { calculateTotalWork } from './workCalculator';
import { TASK_RATES, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { BASE_WEEKLY_WAGE, DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM, SKILL_WAGE_MULTIPLIER, STAFF_HIRING_SKILL_RANGE_MAX_BASE, STAFF_HIRING_SKILL_RANGE_MIN_SCALE, STAFF_HIRING_SPECIALIZATION_WORK_BASE, STAFF_HIRING_WAGE_REFERENCE, STAFF_SEARCH_BASE_COST, STAFF_SEARCH_CANDIDATE_COST_EXPONENT, STAFF_SEARCH_SKILL_COST_EXPONENT, STAFF_SEARCH_SKILL_MULTIPLIER_OFFSET, STAFF_SEARCH_SKILL_MULTIPLIER_SCALE, STAFF_SEARCH_SPECIALIZATION_COST_MULTIPLIER, STAFF_SEARCH_SPECIALIZATION_WORK_BASE, STAFF_SEARCH_WORK_SKILL_SCALE, STAFF_SEARCH_WORK_SKILL_THRESHOLD } from '@/lib/constants/staffConstants';
import { getDistinctSpecializationSkillGroupCount } from '@/lib/services/finance/wageService';

export interface StaffSearchOptions {
  numberOfCandidates: number;
  skillLevel: number;
  specializedRoles: SpecializedRole[];
}

function getSpecializationSkillGroupCount(specializedRoles: SpecializedRole[] = []): number {
  return getDistinctSpecializationSkillGroupCount(specializedRoles);
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
  const { numberOfCandidates, skillLevel, specializedRoles } = options;
  const baseCost = STAFF_SEARCH_BASE_COST;
  
  // Get skill multiplier (0.1 -> 1.0, 1.0 -> 10.0)
  const skillMultiplier = STAFF_SEARCH_SKILL_MULTIPLIER_OFFSET + (skillLevel * STAFF_SEARCH_SKILL_MULTIPLIER_SCALE); // 1.0 to 10.0
  
  // Exponential scaling based on candidates and skill
  const candidateScaling = Math.pow(numberOfCandidates, STAFF_SEARCH_CANDIDATE_COST_EXPONENT);
  const skillScaling = Math.pow(skillMultiplier, STAFF_SEARCH_SKILL_COST_EXPONENT);
  
  const specializationMultiplier = Math.pow(STAFF_SEARCH_SPECIALIZATION_COST_MULTIPLIER, getSpecializationSkillGroupCount(specializedRoles));
  
  // Combine all scalings
  const totalMultiplier = candidateScaling * skillScaling * specializationMultiplier;
  
  return Math.round(baseCost * totalMultiplier);
}

/**
 * Calculate work required for staff search activity
 */
export function calculateSearchWork(options: StaffSearchOptions): number {
  const { numberOfCandidates, skillLevel, specializedRoles } = options;
  
  const rate = TASK_RATES[WorkCategory.STAFF_SEARCH];
  const initialWork = INITIAL_WORK[WorkCategory.STAFF_SEARCH];
  
  // Calculate skill and specialization modifiers
  const searchSkillModifier = skillLevel > STAFF_SEARCH_WORK_SKILL_THRESHOLD
    ? (skillLevel - STAFF_SEARCH_WORK_SKILL_THRESHOLD) * STAFF_SEARCH_WORK_SKILL_SCALE
    : 0;
  const searchSpecModifier = Math.pow(STAFF_SEARCH_SPECIALIZATION_WORK_BASE, getSpecializationSkillGroupCount(specializedRoles)) - 1;
  
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
  specializedRoles: SpecializedRole[] = []
): HiringWorkEstimate {
  // Get min/max possible skills for this search level
  const minSkill = skillLevel * STAFF_HIRING_SKILL_RANGE_MIN_SCALE;  // Minimum possible skill
  const maxSkill = STAFF_HIRING_SKILL_RANGE_MAX_BASE + (skillLevel * STAFF_HIRING_SKILL_RANGE_MIN_SCALE);  // Maximum possible skill
  
  // Calculate wages based on min/max skills
  const specializationBonus = Math.pow(1 + DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM, getSpecializationSkillGroupCount(specializedRoles));
  const minWeeklyWage = (BASE_WEEKLY_WAGE + (minSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;
  const maxWeeklyWage = (BASE_WEEKLY_WAGE + (maxSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;

  // Base work factors for hiring
  const rate = TASK_RATES[WorkCategory.STAFF_HIRING];
  const initialWork = INITIAL_WORK[WorkCategory.STAFF_HIRING];
  
  // Calculate modifiers
  const skillModifier = Math.pow(skillLevel * 2, 2) - 1;     // Skill impact
  const specModifier = Math.pow(STAFF_HIRING_SPECIALIZATION_WORK_BASE, getSpecializationSkillGroupCount(specializedRoles)) - 1;
  
  // Min work calculation
  const minWageModifier = Math.pow(minWeeklyWage / STAFF_HIRING_WAGE_REFERENCE, 2) - 1;
  const minWork = calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers: [skillModifier, specModifier, minWageModifier]
  });
  
  // Max work calculation
  const maxWageModifier = Math.pow(maxWeeklyWage / STAFF_HIRING_WAGE_REFERENCE, 2) - 1;
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
  const rate = TASK_RATES[WorkCategory.STAFF_HIRING];
  const initialWork = INITIAL_WORK[WorkCategory.STAFF_HIRING];
  
  // Calculate modifiers based on candidate
  const avgSkill = (
    candidate.skills.field +
    candidate.skills.winery +
    candidate.skills.administrationAndResearch +
    candidate.skills.sales +
    candidate.skills.financeAndStaff
  ) / 5;
  
  const skillModifier = Math.pow(avgSkill * 2, 2) - 1;
  const specModifier = Math.pow(STAFF_HIRING_SPECIALIZATION_WORK_BASE, getSpecializationSkillGroupCount(candidate.specializedRoles)) - 1;
  const wageModifier = Math.pow(candidate.wage / STAFF_HIRING_WAGE_REFERENCE, 2) - 1;
  
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
  const minSkill = options.skillLevel * STAFF_HIRING_SKILL_RANGE_MIN_SCALE;  // Minimum possible skill
  const maxSkill = STAFF_HIRING_SKILL_RANGE_MAX_BASE + (options.skillLevel * STAFF_HIRING_SKILL_RANGE_MIN_SCALE);  // Maximum possible skill
  
  // Calculate specialization bonus (matches calculateWage logic)
  const specializationBonus = Math.pow(1 + DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM, getSpecializationSkillGroupCount(options.specializedRoles));
  
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
    specializationBonusText: options.specializedRoles.length > 0
      ? `+${Math.round((specializationBonus - 1) * 100)}% wage bonus`
      : 'None'
  };
}
