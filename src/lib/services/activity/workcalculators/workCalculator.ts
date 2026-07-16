import { BASE_WORK_UNITS, DEFAULT_VINE_DENSITY, WORK_CATEGORY_INFO } from '@/lib/constants/activityConstants';
import { GRAPE_VARIETIES, GrapeVariety, Staff, StaffSkills, WorkCategory } from '@/lib/types/types';
import { normalizeXP } from '@/lib/utils/calculator';
import { calculateEffectiveSkill } from '@/lib/services/user/staffService';
import {
  MAX_TASK_MASTERY_BONUS,
  MAX_COMBINED_SPECIALIZATION_BONUS,
  MAX_GRAPE_MASTERY_BONUS,
  SPECIALIZED_ROLES,
} from '@/lib/constants/staffConstants';

// Work factor interface for UI display
export interface WorkFactor {
  label: string;
  value: string | number;
  unit?: string;
  modifier?: number;      // e.g., 0.15 or -0.12
  modifierLabel?: string; // e.g., "skill level effect", "altitude effect"
  isPrimary?: boolean;    // Optional flag for primary rows like Amount/Task
}

export interface StaffContributionOptions {
  researchSkillMultiplier?: number;
  allStaffWorkMultiplier?: number;
}

export interface StaffWorkAllocation {
  totalWork: number;
  contributions: Map<string, number>;
}

export interface StaffContributionBreakdown {
  roleBonus: number;
  taskBonus: number;
  grapeBonus: number;
  specializationBonus: number;
}

const GRAPE_AWARE_CATEGORIES = new Set<WorkCategory>([
  WorkCategory.PLANTING,
  WorkCategory.HARVESTING,
  WorkCategory.CRUSHING,
  WorkCategory.FERMENTATION,
]);

function isValidGrapeWorkContext(category: WorkCategory, grapeVariety?: string): grapeVariety is GrapeVariety {
  if (!grapeVariety || !GRAPE_AWARE_CATEGORIES.has(category)) {
    return false;
  }

  return GRAPE_VARIETIES.includes(grapeVariety as GrapeVariety);
}

/** Returns display-safe specialization bonuses from the same policy as work calculation. */
export function getStaffContributionBreakdown(
  staff: Staff,
  category: WorkCategory,
  grapeVariety?: string,
): StaffContributionBreakdown {
  const relevantSkill = WORK_CATEGORY_INFO[category].skill;
  const matchingRole = staff.specializedRoles.find(role => SPECIALIZED_ROLES[role].skillBonus === relevantSkill);
  const roleBonus = matchingRole ? SPECIALIZED_ROLES[matchingRole].bonusAmount : 0;
  const taskRawXP = staff.experience?.[`task:${category}`] || 0;
  const taskBonus = Math.min(
    MAX_TASK_MASTERY_BONUS,
    normalizeXP(taskRawXP) * MAX_TASK_MASTERY_BONUS,
  );
  const grapeRawXP = isValidGrapeWorkContext(category, grapeVariety)
    ? staff.experience?.[`grape:${grapeVariety}`] || 0
    : 0;
  const grapeBonus = Math.min(
    MAX_GRAPE_MASTERY_BONUS,
    normalizeXP(grapeRawXP) * MAX_GRAPE_MASTERY_BONUS,
  );

  return {
    roleBonus,
    taskBonus,
    grapeBonus,
    specializationBonus: Math.min(MAX_COMBINED_SPECIALIZATION_BONUS, roleBonus + taskBonus + grapeBonus),
  };
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
 * Enhanced with team efficiency scaling for diminishing returns
 * 
 * Formula: For each staff member:
 *   1. Get relevant skill for the activity category
 *   2. Apply bounded task and grape-mastery specialization bonuses when applicable
 *   3. Calculate: workforce × effectiveSkill
 *   4. Divide by number of tasks staff is assigned to
 *   5. Sum all contributions
 *   6. Apply team size efficiency factor (staffCount^0.92)
 * 
 * Team size scaling:
 *   - 1 staff: 1.0× efficiency (baseline)
 *   - 10 staff: 8.3× efficiency (not 10× - diminishing returns)
 *   - 100 staff: 69× efficiency (not 100× - strong diminishing returns)
 * 
 * @param assignedStaff - Staff members assigned to this activity
 * @param category - The activity category
 * @param staffTaskCounts - Map of staffId -> number of activities they're assigned to
 * @returns Total work contribution per tick
 */
/**
 * Calculate individual work contribution for a single staff member
 * Used for both total work calculation and XP attribution
 * 
 * @param staff - The staff member
 * @param category - The activity category
 * @param staffTaskCounts - Map of staffId -> number of activities assigned
 * @param grapeVariety - Optional grape variety for the activity (for grape XP bonus)
 * @returns Work contribution for this staff member
 */
export function calculateIndividualStaffContribution(
  staff: Staff,
  category: WorkCategory,
  staffTaskCounts: Map<string, number>,
  grapeVariety?: string,
  options: StaffContributionOptions = {}
): number {
  const relevantSkill = WORK_CATEGORY_INFO[category].skill;

  // Get relevant skill for this activity type
  const skillValue = staff.skills[relevantSkill];

  // Get raw XP for this skill
  const rawXP = staff.experience?.[`skill:${relevantSkill}`] || 0;

  // Calculate effective skill with XP
  const skillWithXP = calculateEffectiveSkill(skillValue, rawXP);

  const { specializationBonus } = getStaffContributionBreakdown(staff, category, grapeVariety);
  const effectiveSkill = skillWithXP * (1 + specializationBonus);

  // Calculate staff contribution: workforce × effective skill level
  let staffContribution = staff.workforce * effectiveSkill;

  if (options.allStaffWorkMultiplier) {
    staffContribution *= Math.max(1, options.allStaffWorkMultiplier);
  }

  if (category === WorkCategory.ADMINISTRATION_AND_RESEARCH && options.researchSkillMultiplier) {
    staffContribution *= Math.max(1, options.researchSkillMultiplier);
  }

  // Divide by number of tasks this staff is assigned to (multi-tasking penalty)
  const taskCount = staffTaskCounts.get(staff.id) || 1;
  return staffContribution / taskCount;
}

/**
 * Calculate work contribution from assigned staff for an activity
 * Enhanced with team efficiency scaling for diminishing returns
 * 
 * Formula: For each staff member:
 *   1. Get relevant skill for the activity category
 *   2. Apply bounded task and grape-mastery specialization bonuses when applicable
 *   3. Calculate: workforce × effectiveSkill
 *   4. Divide by number of tasks staff is assigned to
 *   5. Sum all contributions
 *   6. Apply team size efficiency factor (staffCount^0.92)
 * 
 * Team size scaling:
 *   - 1 staff: 1.0× efficiency (baseline)
 *   - 10 staff: 8.3× efficiency (not 10× - diminishing returns)
 *   - 100 staff: 69× efficiency (not 100× - strong diminishing returns)
 * 
 * @param assignedStaff - Staff members assigned to this activity
 * @param category - The activity category
 * @param staffTaskCounts - Map of staffId -> number of activities they're assigned to
 * @param grapeVariety - Optional grape variety for the activity (for grape XP bonus)
 * @returns Total work contribution per tick
 */
export function calculateStaffWorkContribution(
  assignedStaff: Staff[],
  category: WorkCategory,
  staffTaskCounts: Map<string, number>,
  grapeVariety?: string,
  options: StaffContributionOptions = {}
): number {
  return calculateStaffWorkAllocation(
    assignedStaff,
    category,
    staffTaskCounts,
    grapeVariety,
    options,
  ).totalWork;
}

/**
 * Calculate a team's weekly work through one shared allocation. Individual
 * shares include team diminishing returns and always sum to totalWork.
 */
export function calculateStaffWorkAllocation(
  assignedStaff: Staff[],
  category: WorkCategory,
  staffTaskCounts: Map<string, number>,
  grapeVariety?: string,
  options: StaffContributionOptions = {},
): StaffWorkAllocation {
  if (assignedStaff.length === 0) {
    return { totalWork: 0, contributions: new Map() };
  }

  const rawContributions = assignedStaff.map(staff => [
    staff.id,
    calculateIndividualStaffContribution(staff, category, staffTaskCounts, grapeVariety, options),
  ] as const);
  const rawTotal = rawContributions.reduce((total, [, contribution]) => total + contribution, 0);
  const teamScale = Math.pow(assignedStaff.length, 0.92) / assignedStaff.length;
  const contributions = new Map(
    rawContributions.map(([staffId, contribution]) => [staffId, contribution * teamScale]),
  );

  return { totalWork: rawTotal * teamScale, contributions };
}

/**
 * Clamp an allocation to work actually applied this tick. The final share is
 * calculated as the remainder so the returned shares sum exactly to the
 * persisted progress delta.
 */
export function calculateAppliedStaffWorkAllocation(
  allocation: StaffWorkAllocation,
  requestedWork: number,
): StaffWorkAllocation {
  const totalWork = Math.max(0, Math.min(requestedWork, allocation.totalWork));
  if (totalWork === 0 || allocation.totalWork <= 0) {
    return { totalWork: 0, contributions: new Map() };
  }

  const entries = [...allocation.contributions.entries()];
  const contributions = new Map<string, number>();
  let allocated = 0;
  entries.forEach(([staffId, contribution], index) => {
    const share = index === entries.length - 1
      ? totalWork - allocated
      : totalWork * (contribution / allocation.totalWork);
    contributions.set(staffId, share);
    allocated += share;
  });

  return { totalWork, contributions };
}

/**
 * Calculate estimated time to complete based on staff assignment
 * 
 * @param assignedStaff - Staff members assigned to the activity
 * @param category - The activity category
 * @param staffTaskCounts - Map of staffId -> number of activities they're assigned to
 * @param remainingWork - Work units remaining
 * @param grapeVariety - Optional grape variety for the activity (for grape XP bonus)
 * @returns Estimated weeks to complete
 */
export function calculateEstimatedWeeks(
  assignedStaff: Staff[],
  category: WorkCategory,
  staffTaskCounts: Map<string, number>,
  remainingWork: number,
  grapeVariety?: string,
  options: StaffContributionOptions = {}
): number {
  const workPerWeek = calculateStaffWorkAllocation(assignedStaff, category, staffTaskCounts, grapeVariety, options).totalWork;

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
  const skillKey = getRelevantSkillKey(category);

  const skillNames: Record<string, string> = {
    field: 'Field',
    winery: 'Winery',
    maintenance: 'Maintenance',
    financeAndStaff: 'Finance & Staff',
    sales: 'Sales',
    administrationAndResearch: 'Administration & Research'
  };

  return skillNames[skillKey] || 'General';
}

export function getRelevantSkillKey(category: WorkCategory): keyof StaffSkills {
  return WORK_CATEGORY_INFO[category].skill;
}
