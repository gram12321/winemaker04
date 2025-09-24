import { BASE_WORK_UNITS, DEFAULT_VINE_DENSITY} from '@/lib/constants/activityConstants';

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
    ? rate / (density / DEFAULT_VINE_DENSITY) 
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


