
// Import constants that will be defined in constants file
const BASELINE_VINE_DENSITY = 5000; // vines per hectare

// Base work units per standard week
export const BASE_WORK_UNITS = 50;

// WorkCategory enum - defines all activity types in the game
export enum WorkCategory {
  PLANTING = 'PLANTING',
  HARVESTING = 'HARVESTING',
  CRUSHING = 'CRUSHING',
  FERMENTATION = 'FERMENTATION',
  CLEARING = 'CLEARING',
  UPROOTING = 'UPROOTING',
  BUILDING = 'BUILDING',
  UPGRADING = 'UPGRADING',
  UPGRADE = 'UPGRADING', // Alias for UPGRADING
  MAINTENANCE = 'MAINTENANCE',
  STAFF_SEARCH = 'STAFF_SEARCH',
  ADMINISTRATION = 'ADMINISTRATION'
}

// Default vine density used for density-based calculations
export const DEFAULT_VINE_DENSITY = 5000;

// Define density-based tasks
export const DENSITY_BASED_TASKS = [
  WorkCategory.PLANTING,
  WorkCategory.UPROOTING, 
  WorkCategory.HARVESTING
];

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
  [WorkCategory.ADMINISTRATION]: 1.0 // default administration rate
};

// Define initial work for each category
export const INITIAL_WORK: Record<WorkCategory, number> = {
  [WorkCategory.PLANTING]: 10,
  [WorkCategory.HARVESTING]: 5,
  [WorkCategory.CRUSHING]: 10,
  [WorkCategory.FERMENTATION]: 25,
  [WorkCategory.CLEARING]: 5, // Base initial work for clearing category
  [WorkCategory.UPROOTING]: 10,
  [WorkCategory.BUILDING]: 200,
  [WorkCategory.UPGRADING]: 150,
  [WorkCategory.MAINTENANCE]: 10,
  [WorkCategory.STAFF_SEARCH]: 25,
  [WorkCategory.ADMINISTRATION]: 5
};

// Work factor interface for UI display
export interface WorkFactor {
  label: string;
  value: string | number;
  unit?: string;
  modifier?: number;      // e.g., 0.15 or -0.12
  modifierLabel?: string; // e.g., "skill level effect", "altitude effect"
  isPrimary?: boolean;    // Optional flag for primary rows like Amount/Task
}

/**
 * Core work calculation function - simplified to be a generic calculator
 * without special case handling for different activities
 */
export function calculateTotalWork(
  amount: number,
  factors: {
    rate: number; // Processing rate (units/week)
    initialWork?: number; // Initial setup work
    density?: number; // Vine density for density-based tasks
    useDensityAdjustment?: boolean; // Whether to adjust for density 
    workModifiers?: number[]; // Percentage modifiers (0.2 = +20%, -0.1 = -10%)
  }
): number {
  const { 
    rate, 
    initialWork = 0, 
    density, 
    useDensityAdjustment = false,
    workModifiers = [] 
  } = factors;
  
  // Adjust rate for density if needed
  // Only apply density adjustment if density is provided and > 0
  const adjustedRate = (useDensityAdjustment && density && density > 0) 
    ? rate / (density / BASELINE_VINE_DENSITY) 
    : rate;
  
  // Calculate work units
  const workWeeks = amount / adjustedRate;
  const workUnits = workWeeks * BASE_WORK_UNITS;
  
  // Base work = initial setup + calculated work units
  const baseWork = initialWork + workUnits;
  
  // Apply modifiers (e.g., skill bonuses, environmental factors)
  const totalWork = workModifiers.reduce((work, modifier) => 
    work * (1 + modifier), baseWork);
  
  return Math.ceil(totalWork);
}


