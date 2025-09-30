// Activity and Work Category Constants
// Centralized configuration for all activity-related constants

import { WorkCategory } from '@/lib/types/types';

// ===== INDIVIDUAL CONSTANTS =====

// Base work units per standard week
export const BASE_WORK_UNITS = 50;

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
  [WorkCategory.PLANTING]: 10,
  [WorkCategory.HARVESTING]: 5,
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
  color: string;
  icon: string;
  isDensityBased: boolean;
}> = {
  [WorkCategory.PLANTING]: {
    displayName: 'Planting',
    color: 'border-l-green-500',
    icon: 'icon_planting.webp',
    isDensityBased: true
  },
  [WorkCategory.HARVESTING]: {
    displayName: 'Harvesting',
    color: 'border-l-yellow-500',
    icon: 'icon_harvesting.webp',
    isDensityBased: true
  },
  [WorkCategory.CLEARING]: {
    displayName: 'Clearing',
    color: 'border-l-orange-500',
    icon: 'icon_clearing.webp',
    isDensityBased: false
  },
  [WorkCategory.UPROOTING]: {
    displayName: 'Uprooting',
    color: 'border-l-red-500',
    icon: 'icon_uprooting.webp',
    isDensityBased: true
  },
  [WorkCategory.ADMINISTRATION]: {
    displayName: 'Administration',
    color: 'border-l-blue-500',
    icon: 'icon_administration.webp',
    isDensityBased: false
  },
  [WorkCategory.BUILDING]: {
    displayName: 'Building',
    color: 'border-l-gray-500',
    icon: 'icon_building.webp',
    isDensityBased: false
  },
  [WorkCategory.UPGRADING]: {
    displayName: 'Upgrading',
    color: 'border-l-purple-500',
    icon: 'icon_upgrade.webp',
    isDensityBased: false
  },
  [WorkCategory.MAINTENANCE]: {
    displayName: 'Maintenance',
    color: 'border-l-gray-600',
    icon: 'icon_maintenance.webp',
    isDensityBased: false
  },
  [WorkCategory.CRUSHING]: {
    displayName: 'Crushing',
    color: 'border-l-purple-600',
    icon: 'icon_crushing.webp',
    isDensityBased: false
  },
  [WorkCategory.FERMENTATION]: {
    displayName: 'Fermentation',
    color: 'border-l-wine',
    icon: 'icon_fermentation.webp',
    isDensityBased: false
  },
  [WorkCategory.STAFF_SEARCH]: {
    displayName: 'Staff Search',
    color: 'border-l-indigo-500',
    icon: 'icon_hiring.webp',
    isDensityBased: false
  }
};

// ===== DERIVED CONSTANTS =====

// Derived: Get density-based tasks from WORK_CATEGORY_INFO
export const DENSITY_BASED_TASKS: WorkCategory[] = Object.keys(WORK_CATEGORY_INFO).filter(
  category => WORK_CATEGORY_INFO[category as WorkCategory].isDensityBased
) as WorkCategory[];
