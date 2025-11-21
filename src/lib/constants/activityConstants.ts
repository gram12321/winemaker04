// Activity and Work Category Constants
// Centralized configuration for all activity-related constants

import { WorkCategory, StaffSkills } from '@/lib/types/types';

// ===== INDIVIDUAL CONSTANTS =====

// Base work units per standard week
export const BASE_WORK_UNITS = 25;

// Default vine density used for density-based calculations
export const DEFAULT_VINE_DENSITY = 5000;

// Base processing rates for different tasks (updated for hectares)
export const TASK_RATES: Record<WorkCategory, number> = {
  [WorkCategory.PLANTING]: 0.28,     // hectares/week (0.7 acres = ~0.28 hectares)
  [WorkCategory.HARVESTING]: 1.78,   // hectares/week (4.4 acres = ~1.78 hectares)
  [WorkCategory.CRUSHING]: 2.5,     // tons/week
  [WorkCategory.FERMENTATION]: 5.0,  // kL/week
  [WorkCategory.CLEARING]: 0.4,     // hectares/week (1.0 acres = ~0.4 hectares)
  [WorkCategory.BUILDING]: 100000,  // €/week
  [WorkCategory.UPGRADING]: 100000, // €/week
  [WorkCategory.ADMINISTRATION_AND_RESEARCH]: 500000, // €/week
  [WorkCategory.STAFF_SEARCH]: 5.0,  // candidates/week
  [WorkCategory.STAFF_HIRING]: 2.0,  // hires/week
  [WorkCategory.LAND_SEARCH]: 15,   // properties/week
  [WorkCategory.LENDER_SEARCH]: 2.0, // lender offers/week
  [WorkCategory.TAKE_LOAN]: 0.5,    // loans/week
  [WorkCategory.FINANCE_AND_STAFF]: 250 // transactions/week; with BASE_WORK_UNITS 25 => 10 work unit per transaction
};

// Harvest yield rate - how much grapes can be harvested per week
export const HARVEST_YIELD_RATE = 500; // kg/week

// ===== CLEARING TASK CONSTANTS =====

// Clearing subtask types and their health improvements
export const CLEARING_TASKS = {
  CLEAR_VEGETATION: {
    id: 'clear-vegetation',
    name: 'Clear vegetation',
    healthImprovement: 0.10, // +10% health
    rate: 0.5, // hectares/week
    initialWork: 5
  },
  REMOVE_DEBRIS: {
    id: 'remove-debris',
    name: 'Remove debris',
    healthImprovement: 0.05, // +5% health
    rate: 0.4, // hectares/week
    initialWork: 3
  },
  UPROOT_VINES: {
    id: 'uproot-vines',
    name: 'Uproot vines',
    setHealth: 0.5, // Set health to absolute 50% (no gradual improvement)
    rate: 0.35, // hectares/week (just removing vines)
    initialWork: 8
  },
  REPLANT_VINES: {
    id: 'replant-vines',
    name: 'Replant vines',
    setHealth: 0.5, // Set health to 50% initially, then gradual improvement via plantingHealthBonus
    rate: 0.155, // hectares/week (calculated: 1/(1/0.35 + 1/0.28) = 0.155)
    initialWork: 12 // Starting threshold for replanting task (not additive)
  }
} as const;

// Define initial work for each category
export const INITIAL_WORK: Record<WorkCategory, number> = {
  [WorkCategory.PLANTING]: 30,
  [WorkCategory.HARVESTING]: 25,
  [WorkCategory.CRUSHING]: 10,
  [WorkCategory.FERMENTATION]: 100,
  [WorkCategory.CLEARING]: 5, // Base initial work for clearing category
  [WorkCategory.BUILDING]: 200,
  [WorkCategory.UPGRADING]: 150,
  [WorkCategory.ADMINISTRATION_AND_RESEARCH]: 10,
  [WorkCategory.STAFF_SEARCH]: 25,
  [WorkCategory.STAFF_HIRING]: 25,
  [WorkCategory.LAND_SEARCH]: 75,
  [WorkCategory.LENDER_SEARCH]: 50,
  [WorkCategory.TAKE_LOAN]: 50,
  [WorkCategory.FINANCE_AND_STAFF]: 5
};

// ===== WORK CATEGORY INFO =====

/**
 * Display and styling information for work categories
 * Contains UI-related properties separate from game mechanics
 */
export const WORK_CATEGORY_INFO: Record<WorkCategory, {
  displayName: string;
  icon: string;
  isDensityBased: boolean;
  // Primary staff skill driving visuals and calculations
  skill: keyof StaffSkills;
}> = {
  [WorkCategory.PLANTING]: {
    displayName: 'Planting',
    icon: 'icon_planting.webp',
    isDensityBased: true,
    skill: 'field'
  },
  [WorkCategory.HARVESTING]: {
    displayName: 'Harvesting',
    icon: 'icon_harvesting.webp',
    isDensityBased: true,
    skill: 'field'
  },
  [WorkCategory.CLEARING]: {
    displayName: 'Clearing',
    icon: 'icon_clearing.webp',
    isDensityBased: false,
    skill: 'field'
  },
  [WorkCategory.FINANCE_AND_STAFF]: {
    displayName: 'Administration',
    icon: 'icon_administration.webp',
    isDensityBased: false,
    skill: 'financeAndStaff'
  },
  [WorkCategory.BUILDING]: {
    displayName: 'Building',
    icon: 'icon_building.webp',
    isDensityBased: false,
    skill: 'administrationAndResearch'
  },
  [WorkCategory.UPGRADING]: {
    displayName: 'Upgrading',
    icon: 'icon_upgrade.webp',
    isDensityBased: false,
    skill: 'administrationAndResearch'
  },
  [WorkCategory.ADMINISTRATION_AND_RESEARCH]: {
    displayName: 'Maintenance',
    icon: 'icon_maintenance.webp',
    isDensityBased: false,
    skill: 'administrationAndResearch'
  },
  [WorkCategory.CRUSHING]: {
    displayName: 'Crushing',
    icon: 'icon_crushing.webp',
    isDensityBased: false,
    skill: 'winery'
  },
  [WorkCategory.FERMENTATION]: {
    displayName: 'Fermentation',
    icon: 'icon_fermentation.webp',
    isDensityBased: false,
    skill: 'winery'
  },
  [WorkCategory.STAFF_SEARCH]: {
    displayName: 'Staff Search',
    icon: 'icon_hiring.webp',
    isDensityBased: false,
    skill: 'financeAndStaff'
  },
  [WorkCategory.STAFF_HIRING]: {
    displayName: 'Staff Hiring',
    icon: 'icon_hiring.webp',
    isDensityBased: false,
    skill: 'financeAndStaff'
  },
  [WorkCategory.LAND_SEARCH]: {
    displayName: 'Land Search',
    icon: 'icon_research.webp',
    isDensityBased: false,
    skill: 'financeAndStaff'
  },
  [WorkCategory.LENDER_SEARCH]: {
    displayName: 'Lender Search',
    icon: 'icon_bookkeeping.webp',
    isDensityBased: false,
    skill: 'financeAndStaff'
  },
  [WorkCategory.TAKE_LOAN]: {
    displayName: 'Take Loan',
    icon: 'icon_bookkeeping.webp',
    isDensityBased: false,
    skill: 'financeAndStaff'
  }
};

// ===== DERIVED HELPERS =====

/**
 * Check whether a category uses density adjustments
 */
export function isDensityBased(category: WorkCategory): boolean {
  return WORK_CATEGORY_INFO[category].isDensityBased;
}

/**
 * Get display name for a work category
 */
export function getWorkCategoryDisplayName(category: WorkCategory): string {
  return WORK_CATEGORY_INFO[category].displayName;
}

/**
 * Get display name for a task type string (lowercase WorkCategory)
 */
export function getTaskTypeDisplayName(taskType: string): string {
  // Find the matching WorkCategory enum value
  const matchingCategory = Object.values(WorkCategory).find(
    category => category.toLowerCase() === taskType.toLowerCase()
  );

  if (matchingCategory) {
    return WORK_CATEGORY_INFO[matchingCategory].displayName;
  }

  // Fallback: capitalize first letter
  return taskType.charAt(0).toUpperCase() + taskType.slice(1);
}


