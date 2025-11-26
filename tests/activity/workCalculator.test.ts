import { describe, it, expect } from 'vitest';

import {
  calculateTotalWork,
  calculateStaffWorkContribution,
  calculateEstimatedWeeks
} from '@/lib/services/activity/workcalculators/workCalculator';
import { WorkCategory, type Staff } from '@/lib/types/types';

const baseHireDate = {
  week: 1,
  season: 'Spring' as const,
  year: 1
};

const createStaff = (overrides: Partial<Staff> = {}): Staff => {
  const defaultSkills = {
    field: 0.5,
    winery: 0.5,
    administrationAndResearch: 0.5,
    sales: 0.5,
    financeAndStaff: 0.5
  };

  const { skills, experience, ...rest } = overrides;

  return {
    id: 'staff-default',
    name: 'Test Staff',
    nationality: 'Italy',
    skillLevel: 0.7,
    specializations: [],
    wage: 1500,
    teamIds: [],
    skills: { ...defaultSkills, ...(skills ?? {}) },
    workforce: 50,
    experience: experience ?? {},
    hireDate: { ...baseHireDate },
    ...rest
  };
};

describe('calculateTotalWork', () => {
  it('applies density adjustments and modifiers before rounding up', () => {
    const workUnits = calculateTotalWork(10, {
      rate: 2,
      initialWork: 5,
      density: 2500,
      useDensityAdjustment: true,
      workModifiers: [0.1, -0.05]
    });

    expect(workUnits).toBe(71);
  });

  it('falls back to base rate when density is absent or zero', () => {
    const withDensity = calculateTotalWork(10, {
      rate: 2,
      density: 0,
      useDensityAdjustment: true
    });

    const withoutDensity = calculateTotalWork(10, {
      rate: 2,
      useDensityAdjustment: false
    });

    expect(withDensity).toBe(withoutDensity);
  });
});

describe('calculateStaffWorkContribution', () => {
  it('returns zero when no staff are assigned', () => {
    const contribution = calculateStaffWorkContribution(
      [],
      WorkCategory.PLANTING,
      new Map()
    );

    expect(contribution).toBe(0);
  });

  it('honors specialization bonuses and multitask penalties', () => {
    const staffA = createStaff({
      id: 'a',
      workforce: 60,
      specializations: ['field'],
      skills: {
        field: 0.8,
        winery: 0.4,
        administrationAndResearch: 0.2,
        sales: 0.3,
        financeAndStaff: 0.3
      }
    });

    const staffB = createStaff({
      id: 'b',
      workforce: 40,
      specializations: [],
      skills: {
        field: 0.5,
        winery: 0.6,
        administrationAndResearch: 0.4,
        sales: 0.3,
        financeAndStaff: 0.2
      }
    });

    const contribution = calculateStaffWorkContribution(
      [staffA, staffB],
      WorkCategory.PLANTING,
      new Map([
        ['a', 1],
        ['b', 2]
      ])
    );

    expect(contribution).toBeCloseTo(64, 0);
  });
});

describe('calculateEstimatedWeeks', () => {
  it('derives timeline from staff contribution output', () => {
    const staff = [
      createStaff({
        id: 'a',
        workforce: 60,
        specializations: ['field'],
        skills: {
          field: 0.8,
          winery: 0.4,
          administrationAndResearch: 0.2,
          sales: 0.3,
          financeAndStaff: 0.3
        }
      }),
      createStaff({
        id: 'b',
        workforce: 40,
        specializations: [],
        skills: {
          field: 0.5,
          winery: 0.6,
          administrationAndResearch: 0.4,
          sales: 0.3,
          financeAndStaff: 0.2
        }
      })
    ];

    const staffTaskCounts = new Map([
      ['a', 1],
      ['b', 2]
    ]);

    const weeks = calculateEstimatedWeeks(
      staff,
      WorkCategory.PLANTING,
      staffTaskCounts,
      200
    );

    expect(weeks).toBe(4);
  });
});

