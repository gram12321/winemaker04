import { BASE_WORK_UNITS, DEFAULT_VINE_DENSITY, CATEGORY_SKILL_MAPPING} from '@/lib/constants/activityConstants';
import { Staff, WorkCategory } from '@/lib/types/types';

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

// ===== STAFF WORK CONTRIBUTION FUNCTIONS =====

/**
 * Calculate work contribution from assigned staff for an activity
 * Based on v3's calculateStaffWorkContribution logic
 * 
 * Formula: For each staff member:
 *   1. Get relevant skill for the activity category
 *   2. Apply specialization bonus if applicable (20%)
 *   3. Calculate: workforce × effectiveSkill
 *   4. Divide by number of tasks staff is assigned to
 *   5. Sum all contributions
 * 
 * @param assignedStaff - Staff members assigned to this activity
 * @param category - The activity category
 * @param staffTaskCounts - Map of staffId -> number of activities they're assigned to
 * @returns Total work contribution per tick
 */
export function calculateStaffWorkContribution(
  assignedStaff: Staff[],
  category: WorkCategory,
  staffTaskCounts: Map<string, number>
): number {
  if (assignedStaff.length === 0) return 0;
  
  const relevantSkill = CATEGORY_SKILL_MAPPING[category];
  let totalWork = 0;
  
  for (const staff of assignedStaff) {
    // Get relevant skill for this activity type
    const skillValue = staff.skills[relevantSkill];
    
    // Add specialization bonus if applicable (20% boost)
    const hasSpecialization = staff.specializations.includes(relevantSkill);
    const effectiveSkill = hasSpecialization ? skillValue * 1.2 : skillValue;
    
    // Calculate staff contribution: workforce × effective skill level
    const staffContribution = staff.workforce * effectiveSkill;
    
    // Divide by number of tasks this staff is assigned to (multi-tasking penalty)
    const taskCount = staffTaskCounts.get(staff.id) || 1;
    const dividedContribution = staffContribution / taskCount;
    
    totalWork += dividedContribution;
  }
  
  return totalWork;
}

/**
 * Calculate estimated time to complete based on staff assignment
 * 
 * @param assignedStaff - Staff members assigned to the activity
 * @param category - The activity category
 * @param staffTaskCounts - Map of staffId -> number of activities they're assigned to
 * @param remainingWork - Work units remaining
 * @returns Estimated weeks to complete
 */
export function calculateEstimatedWeeks(
  assignedStaff: Staff[],
  category: WorkCategory,
  staffTaskCounts: Map<string, number>,
  remainingWork: number
): number {
  const workPerWeek = calculateStaffWorkContribution(assignedStaff, category, staffTaskCounts);
  
  if (workPerWeek <= 0) return 0;
  
  return Math.ceil(remainingWork / workPerWeek);
}

/**
 * Get the relevant skill name for an activity category
 * Used for UI display purposes
 * 
 * @param category - The activity category
 * @returns The skill name (e.g., 'Field', 'Winery')
 */
export function getRelevantSkillName(category: WorkCategory): string {
  const skillKey = CATEGORY_SKILL_MAPPING[category];
  
  const skillNames: Record<string, string> = {
    field: 'Field',
    winery: 'Winery',
    administration: 'Administration',
    sales: 'Sales',
    maintenance: 'Maintenance'
  };
  
  return skillNames[skillKey] || 'General';
}