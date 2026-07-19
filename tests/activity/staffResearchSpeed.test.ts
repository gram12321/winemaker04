import { describe, expect, it } from 'vitest';
import { WorkCategory, type Staff } from '@/lib/types/types';
import { calculateStaffWorkAllocation } from '@/lib/features/activities/services/workcalculators/workCalculator';

const calculateContribution = (...args: Parameters<typeof calculateStaffWorkAllocation>): number =>
  calculateStaffWorkAllocation(...args).totalWork;

function researchStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'staff-1',
    name: 'Research Specialist',
    nationality: 'France',
    skillLevel: 0.5,
    specializedRoles: [],
    skills: {
      field: 0.5,
      winery: 0.5,
      maintenance: 0.5,
      financeAndStaff: 0.5,
      sales: 0.5,
      administrationAndResearch: 0.5,
    },
    wage: 1000,
    workforce: 50,
    hireDate: { week: 1, season: 'Spring', year: 2026 },
    teamIds: [],
    experience: {},
    ...overrides,
  };
}

describe('research speed staff contribution', () => {
  it('applies research skill multiplier only to administration and research work', () => {
    const staff = [researchStaff()];
    const staffTaskCounts = new Map<string, number>([['staff-1', 1]]);

    const baseResearchContribution = calculateContribution(
      staff,
      WorkCategory.ADMINISTRATION_AND_RESEARCH,
      staffTaskCounts
    );
    const boostedResearchContribution = calculateContribution(
      staff,
      WorkCategory.ADMINISTRATION_AND_RESEARCH,
      staffTaskCounts,
      undefined,
      { researchSkillMultiplier: 1.25 }
    );
    const fieldContribution = calculateContribution(
      staff,
      WorkCategory.PLANTING,
      staffTaskCounts,
      undefined,
      { researchSkillMultiplier: 1.25 }
    );

    expect(boostedResearchContribution).toBeCloseTo(baseResearchContribution * 1.25);
    expect(fieldContribution).toBe(baseResearchContribution);
  });

  it('applies all-staff multiplier to both administration and field work', () => {
    const staff = [researchStaff()];
    const staffTaskCounts = new Map<string, number>([['staff-1', 1]]);

    const baseResearchContribution = calculateContribution(
      staff,
      WorkCategory.ADMINISTRATION_AND_RESEARCH,
      staffTaskCounts
    );
    const baseFieldContribution = calculateContribution(
      staff,
      WorkCategory.PLANTING,
      staffTaskCounts
    );

    const boostedResearchContribution = calculateContribution(
      staff,
      WorkCategory.ADMINISTRATION_AND_RESEARCH,
      staffTaskCounts,
      undefined,
      { allStaffWorkMultiplier: 1.1 }
    );
    const boostedFieldContribution = calculateContribution(
      staff,
      WorkCategory.PLANTING,
      staffTaskCounts,
      undefined,
      { allStaffWorkMultiplier: 1.1 }
    );

    expect(boostedResearchContribution).toBeCloseTo(baseResearchContribution * 1.1);
    expect(boostedFieldContribution).toBeCloseTo(baseFieldContribution * 1.1);
  });
});
