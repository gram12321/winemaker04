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
  [WorkCategory.UPROOTING]: 0.23,   // hectares/week (0.56 acres = ~0.23 hectares)
  [WorkCategory.BUILDING]: 100000,  // €/week
  [WorkCategory.UPGRADING]: 100000, // €/week
  [WorkCategory.MAINTENANCE]: 500000, // €/week
  [WorkCategory.STAFF_SEARCH]: 5.0,  // candidates/week
  [WorkCategory.ADMINISTRATION]: 500 // tasks/week; with BASE_WORK_UNITS 50 => 0.1 work/tx
};

// Harvest yield rate - how much grapes can be harvested per week
export const HARVEST_YIELD_RATE = 500; // kg/week

// Define initial work for each category
export const INITIAL_WORK: Record<WorkCategory, number> = {
  [WorkCategory.PLANTING]: 30,
  [WorkCategory.HARVESTING]: 25,
  [WorkCategory.CRUSHING]: 10,
  [WorkCategory.FERMENTATION]: 100,
  [WorkCategory.CLEARING]: 5, // Base initial work for clearing category
  [WorkCategory.UPROOTING]: 10,
  [WorkCategory.BUILDING]: 200,
  [WorkCategory.UPGRADING]: 150,
  [WorkCategory.MAINTENANCE]: 10,
  [WorkCategory.STAFF_SEARCH]: 25,
  [WorkCategory.ADMINISTRATION]: 25
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
  [WorkCategory.UPROOTING]: {
    displayName: 'Uprooting',
    icon: 'icon_uprooting.webp',
    isDensityBased: true,
    skill: 'field'
  },
  [WorkCategory.ADMINISTRATION]: {
    displayName: 'Administration',
    icon: 'icon_administration.webp',
    isDensityBased: false,
    skill: 'administration'
  },
  [WorkCategory.BUILDING]: {
    displayName: 'Building',
    icon: 'icon_building.webp',
    isDensityBased: false,
    skill: 'maintenance'
  },
  [WorkCategory.UPGRADING]: {
    displayName: 'Upgrading',
    icon: 'icon_upgrade.webp',
    isDensityBased: false,
    skill: 'maintenance'
  },
  [WorkCategory.MAINTENANCE]: {
    displayName: 'Maintenance',
    icon: 'icon_maintenance.webp',
    isDensityBased: false,
    skill: 'maintenance'
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
    skill: 'administration'
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


