// Staff System Constants
// Centralized configuration for staff-related constants

import { Nationality, StaffSkills, SpecializedRole } from '@/lib/types/types';
import { NAMES } from './namesConstants';

// ===== WAGE CALCULATION CONSTANTS =====

// Base weekly wage (from v3)
export const BASE_WEEKLY_WAGE = 500;

// Skill wage multiplier - how much extra wage per skill point
export const SKILL_WAGE_MULTIPLIER = 1000;

// ===== FOUNDER ECONOMY CONSTANTS =====

// Percentage of yearly net profit each active founder receives as a Founder Return
// Range 15–25 %; tunable here without touching service logic
export const FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT = 20;

// Cost to buy out a single founder, expressed as a fraction of total company asset value
export const FOUNDER_BUYOUT_PERCENT_OF_ASSETS = 0.15;

// ===== NATIONALITY CONSTANTS =====

export const NATIONALITIES: Nationality[] = ['Italy', 'Germany', 'France', 'Spain', 'United States'];

// Helper function to get male names for a nationality
export function getMaleNamesForNationality(nationality: Nationality): string[] {
  const names = NAMES[nationality];
  return Array.from(names.firstNames.male);
}

// Helper function to get female names for a nationality
export function getFemaleNamesForNationality(nationality: Nationality): string[] {
  const names = NAMES[nationality];
  return Array.from(names.firstNames.female);
}

// Helper function to get last names for a nationality
export function getLastNamesForNationality(nationality: Nationality): string[] {
  const names = NAMES[nationality];
  return Array.from(names.lastNames);
}

// ===== SKILL LEVEL DEFINITIONS =====

export const SKILL_LEVELS: Record<number, { name: string; description: string }> = {
  0.1: { name: 'Novice', description: 'Just starting out' },
  0.2: { name: 'Beginner', description: 'Learning the ropes' },
  0.3: { name: 'Apprentice', description: 'Learning the basics' },
  0.4: { name: 'Intermediate', description: 'Developing skills' },
  0.5: { name: 'Competent', description: 'Solid foundation' },
  0.6: { name: 'Skilled', description: 'Experienced worker' },
  0.7: { name: 'Proficient', description: 'Experienced professional' },
  0.8: { name: 'Advanced', description: 'Highly skilled' },
  0.9: { name: 'Expert', description: 'Master of the craft' },
  1.0: { name: 'Master', description: 'Best in the business' }
};

// Helper to get skill level info for a given skill value
export function getSkillLevelInfo(skillLevel: number): { name: string; description: string } {
  // Round to nearest 0.1
  const rounded = Math.round(skillLevel * 10) / 10;
  return SKILL_LEVELS[rounded] || SKILL_LEVELS[0.5];
}

// ===== LEARNED TASK MASTERY DEFINITIONS =====

// Mastering an exact activity category through task XP grants up to this extra work.
export const MAX_TASK_MASTERY_BONUS = 0.2;

// Grape mastery contributes a smaller additive bonus than learned task mastery.
export const MAX_GRAPE_MASTERY_BONUS = 0.1;

// Role, task, and grape bonuses are additive, but never exceed this combined cap.
export const MAX_COMBINED_SPECIALIZATION_BONUS = 0.5;

// Each distinct primary-skill group represented by innate specialized roles raises wages by this amount.
export const DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM = 0.3;

// Broad career roles retained from the original staff system. These are a
// distinct persisted capability from learned exact activity task mastery.
export const SPECIALIZED_ROLES: Record<SpecializedRole, {
  title: string;
  description: string;
  skillBonus: keyof StaffSkills;
  bonusAmount: number;
}> = {
  field: { title: 'Vineyard Manager', description: 'Expert in vineyard operations', skillBonus: 'field', bonusAmount: 0.2 },
  winery: { title: 'Master Winemaker', description: 'Specialist in wine production', skillBonus: 'winery', bonusAmount: 0.2 },
  maintenance: { title: 'Maintenance Technician', description: 'Specialist in cellar and equipment upkeep', skillBonus: 'maintenance', bonusAmount: 0.2 },
  administrationAndResearch: { title: 'Administration & Research Manager', description: 'Expert in Administration and Research', skillBonus: 'administrationAndResearch', bonusAmount: 0.2 },
  sales: { title: 'Sales Director', description: 'Specialist in wine marketing and sales', skillBonus: 'sales', bonusAmount: 0.2 },
  financeAndStaff: { title: 'Finance Director', description: 'Expert in finance and staff management', skillBonus: 'financeAndStaff', bonusAmount: 0.2 },
};

export function isSpecializedRole(value: unknown): value is SpecializedRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPECIALIZED_ROLES, value);
}

export function getStaffRoleDisplayName(specializedRoles: SpecializedRole[]): string {
  return specializedRoles.length === 0 ? 'General Worker' : SPECIALIZED_ROLES[specializedRoles[0]].title;
}

// Staff-search scaling stays centralized with the rest of the staff tuning.
export const STAFF_SEARCH_SPECIALIZATION_COST_MULTIPLIER = 2;
export const STAFF_SEARCH_SPECIALIZATION_WORK_BASE = 1.3;
export const STAFF_HIRING_SPECIALIZATION_WORK_BASE = 1.5;
export const STAFF_SEARCH_BASE_COST = 2000;
export const STAFF_SEARCH_SKILL_MULTIPLIER_OFFSET = 0.5;
export const STAFF_SEARCH_SKILL_MULTIPLIER_SCALE = 9.5;
export const STAFF_SEARCH_CANDIDATE_COST_EXPONENT = 1.5;
export const STAFF_SEARCH_SKILL_COST_EXPONENT = 1.8;
export const STAFF_SEARCH_WORK_SKILL_THRESHOLD = 0.5;
export const STAFF_SEARCH_WORK_SKILL_SCALE = 0.4;
export const STAFF_HIRING_SKILL_RANGE_MIN_SCALE = 0.4;
export const STAFF_HIRING_SKILL_RANGE_MAX_BASE = 0.6;
export const STAFF_HIRING_WAGE_REFERENCE = 1000;

// ===== EXPERIENCE & LEVELING CONSTANTS =====

// Base XP required for the first level
export const BASE_XP_PER_LEVEL = 1000;

// Growth factor for subsequent levels (1.5 means each level needs 50% more XP than the last)
export const XP_GROWTH_FACTOR = 1.5;

/**
 * Calculate the level based on total XP
 * Formula: Level = floor(log(XP / BASE_XP * (GROWTH - 1) + 1) / log(GROWTH)) + 1
 * Simplified for linear/exponential hybrid or just simple thresholds
 * 
 * For now, using a simple geometric sequence:
 * Level 1: 0 - 1000
 * Level 2: 1000 - 2500 (1000 + 1500)
 * Level 3: 2500 - 4750 (2500 + 2250)
 */
export function calculateLevelFromXP(xp: number): number {
  if (xp < BASE_XP_PER_LEVEL) return 1;

  let level = 1;
  let currentXpThreshold = BASE_XP_PER_LEVEL;
  let nextLevelCost = BASE_XP_PER_LEVEL * XP_GROWTH_FACTOR;

  while (xp >= currentXpThreshold) {
    level++;
    currentXpThreshold += nextLevelCost;
    nextLevelCost *= XP_GROWTH_FACTOR;
  }

  return level;
}

/**
 * Get the XP required to reach the next level
 */
export function getNextLevelThreshold(currentLevel: number): number {
  let threshold = BASE_XP_PER_LEVEL;
  let cost = BASE_XP_PER_LEVEL;

  for (let i = 1; i < currentLevel; i++) {
    cost *= XP_GROWTH_FACTOR;
    threshold += cost;
  }

  return threshold;
}

/**
 * Get the XP required to reach the current level (floor)
 */
export function getCurrentLevelBaseXP(currentLevel: number): number {
  if (currentLevel === 1) return 0;

  let threshold = BASE_XP_PER_LEVEL;
  let cost = BASE_XP_PER_LEVEL;

  for (let i = 2; i < currentLevel; i++) {
    cost *= XP_GROWTH_FACTOR;
    threshold += cost;
  }

  return threshold;
}
