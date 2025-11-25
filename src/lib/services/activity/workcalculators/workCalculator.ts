import { BASE_WORK_UNITS, DEFAULT_VINE_DENSITY, WORK_CATEGORY_INFO } from '@/lib/constants/activityConstants';
import { Staff, WorkCategory } from '@/lib/types/types';
import { normalizeXP } from '@/lib/utils/calculator';
import { calculateEffectiveSkill } from '@/lib/services/user/staffService';

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
 * Enhanced with team efficiency scaling for diminishing returns
 * 
 * Formula: For each staff member:
 *   1. Get relevant skill for the activity category
 *   2. Apply specialization bonus if applicable (20%)
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
  grapeVariety?: string
): number {
  const relevantSkill = WORK_CATEGORY_INFO[category].skill;

  // Get relevant skill for this activity type
  const skillValue = staff.skills[relevantSkill];

  // Get raw XP for this skill
  const rawXP = staff.experience?.[`skill:${relevantSkill}`] || 0;

  // Calculate effective skill with XP
  const skillWithXP = calculateEffectiveSkill(skillValue, rawXP);

  // Add specialization bonus if applicable (20% boost)
  const hasSpecialization = staff.specializations.includes(relevantSkill);
  const effectiveSkill = hasSpecialization ? skillWithXP * 1.2 : skillWithXP;

  // Calculate staff contribution: workforce × effective skill level
  let staffContribution = staff.workforce * effectiveSkill;

  // Apply grape variety experience bonus if applicable
  // Formula: contribution × (normalizeXP(grapeXP) + 1)
  // This gives 1x-2x multiplier (100% to 200% speed)
  if (grapeVariety) {
    const grapeXPKey = `grape:${grapeVariety}`;
    const grapeRawXP = staff.experience?.[grapeXPKey] || 0;

    if (grapeRawXP > 0) {
      const grapeXPBonus = normalizeXP(grapeRawXP) + 1; // 1.0 to 2.0 multiplier
      staffContribution *= grapeXPBonus;
    }
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
 *   2. Apply specialization bonus if applicable (20%)
 *   3. Calculate: workforce × effectiveSkill
 *   4. Apply grape variety XP bonus if applicable (1x-2x multiplier)
 *   5. Divide by number of tasks staff is assigned to
 *   6. Sum all contributions
 *   7. Apply team size efficiency factor (staffCount^0.92)
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
  grapeVariety?: string
): number {
  if (assignedStaff.length === 0) return 0;

  let totalIndividualWork = 0;

  for (const staff of assignedStaff) {
    totalIndividualWork += calculateIndividualStaffContribution(staff, category, staffTaskCounts, grapeVariety);
  }

  // Apply team size efficiency factor with diminishing returns
  // Formula: staffCount^0.92
  // This prevents linear scaling while still providing strong benefits
  const teamSizeFactor = Math.pow(assignedStaff.length, 0.92);
  const averageWorkPerStaff = totalIndividualWork / assignedStaff.length;
  const scaledWork = averageWorkPerStaff * teamSizeFactor;

  return scaledWork;
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
  grapeVariety?: string
): number {
  const workPerWeek = calculateStaffWorkContribution(assignedStaff, category, staffTaskCounts, grapeVariety);

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
  const skillKey = WORK_CATEGORY_INFO[category].skill;

  const skillNames: Record<string, string> = {
    field: 'Field',
    winery: 'Winery',
    administration: 'Administration',
    sales: 'Sales',
    maintenance: 'Maintenance'
  };

  return skillNames[skillKey] || 'General';
}