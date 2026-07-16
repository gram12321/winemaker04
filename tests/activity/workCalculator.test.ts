import { describe, it, expect } from 'vitest';

import {
  calculateTotalWork,
  calculateAppliedStaffWorkAllocation,
  calculateIndividualStaffContribution,
  calculateStaffWorkAllocation,
  calculateStaffWorkContribution,
  calculateEstimatedWeeks
} from '@/lib/services/activity/workcalculators/workCalculator';
import { WorkCategory, type Staff } from '@/lib/types/types';
import {
  getStaffSpecializationCategories,
  isStaffSpecializationCategory
} from '@/lib/constants/activityConstants';

const baseHireDate = {
  week: 1,
  season: 'Spring' as const,
  year: 1
};

const createStaff = (overrides: Partial<Staff> = {}): Staff => {
  const defaultSkills = {
    field: 0.5,
    winery: 0.5,
    maintenance: 0.5,
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
    specializedRoles: [],
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

describe('task-specialization contract', () => {
  it('accepts activity categories but rejects former broad-role values', () => {
    expect(isStaffSpecializationCategory(WorkCategory.PLANTING)).toBe(true);
    expect(isStaffSpecializationCategory('field')).toBe(false);
    expect(getStaffSpecializationCategories()).toContain(WorkCategory.PLANTING);
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
      experience: { 'task:PLANTING': 100_000_000 },
      skills: {
        field: 0.8,
        winery: 0.4,
        maintenance: 0.4,
        administrationAndResearch: 0.2,
        sales: 0.3,
        financeAndStaff: 0.3
      }
    });

    const staffB = createStaff({
      id: 'b',
      workforce: 40,
      skills: {
        field: 0.5,
        winery: 0.6,
        maintenance: 0.6,
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

  it('uses the dedicated Maintenance skill for maintenance work', () => {
    const staff = createStaff({
      workforce: 100,
      skills: {
        field: 0.5,
        winery: 1,
        maintenance: 0.2,
        administrationAndResearch: 0.5,
        sales: 0.5,
        financeAndStaff: 0.5,
      },
    });

    expect(calculateStaffWorkContribution([staff], WorkCategory.MAINTENANCE, new Map())).toBe(20);
  });

  it('applies learned task mastery only to its exact activity category', () => {
    const specialist = createStaff({
      workforce: 100,
      skills: { field: 1, winery: 0.5, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 },
      experience: { 'task:PLANTING': 100_000_000 },
    });

    expect(calculateIndividualStaffContribution(specialist, WorkCategory.PLANTING, new Map())).toBeCloseTo(120, 1);
    expect(calculateIndividualStaffContribution(specialist, WorkCategory.HARVESTING, new Map())).toBe(100);
  });

  it('applies a broad role to every activity using its matching primary skill', () => {
    const specialist = createStaff({
      workforce: 100,
      skills: { field: 1, winery: 0.5, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 },
      specializedRoles: ['field'],
    });

    expect(calculateIndividualStaffContribution(specialist, WorkCategory.PLANTING, new Map())).toBe(120);
    expect(calculateIndividualStaffContribution(specialist, WorkCategory.HARVESTING, new Map())).toBe(120);
    expect(calculateIndividualStaffContribution(specialist, WorkCategory.CRUSHING, new Map())).toBe(50);
  });

  it.each([
    WorkCategory.PLANTING,
    WorkCategory.HARVESTING,
    WorkCategory.CRUSHING,
    WorkCategory.FERMENTATION,
  ])('applies Pinot Noir mastery to %s but not another grape', category => {
    const master = createStaff({
      workforce: 100,
      skills: { field: 1, winery: 1, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 },
      experience: { 'grape:Pinot Noir': 100_000_000 },
    });

    expect(calculateIndividualStaffContribution(master, category, new Map(), 'Pinot Noir')).toBeGreaterThan(109);
    expect(calculateIndividualStaffContribution(master, category, new Map(), 'Pinot Noir')).toBeLessThanOrEqual(110);
    expect(calculateIndividualStaffContribution(master, category, new Map(), 'Barbera')).toBe(100);
  });

  it('caps combined task and grape bonuses at the named maximum', () => {
    const specialist = createStaff({
      workforce: 100,
      skills: { field: 1, winery: 0.5, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 },
      experience: { 'task:PLANTING': 100_000_000, 'grape:Pinot Noir': 100_000_000 },
    });

    expect(calculateIndividualStaffContribution(specialist, WorkCategory.PLANTING, new Map(), 'Pinot Noir')).toBeGreaterThan(129);
    expect(calculateIndividualStaffContribution(specialist, WorkCategory.PLANTING, new Map(), 'Pinot Noir')).toBeLessThanOrEqual(130);
  });

  it('stacks role, task, and grape bonuses up to the three-layer cap', () => {
    const specialist = createStaff({
      workforce: 100,
      skills: { field: 1, winery: 0.5, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 },
      specializedRoles: ['field'],
      experience: { 'task:PLANTING': 100_000_000, 'grape:Pinot Noir': 100_000_000 },
    });

    expect(calculateIndividualStaffContribution(specialist, WorkCategory.PLANTING, new Map(), 'Pinot Noir')).toBeCloseTo(150, 1);
  });

  it('does not apply grape mastery outside the validated grape-aware categories', () => {
    const master = createStaff({
      workforce: 100,
      skills: { field: 1, winery: 0.5, maintenance: 1, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 },
      experience: { 'grape:Pinot Noir': 100_000_000 },
    });

    expect(calculateIndividualStaffContribution(master, WorkCategory.MAINTENANCE, new Map(), 'Pinot Noir')).toBe(100);
  });

  it('keeps team shares and applied shares aligned with the total work', () => {
    const staff = [
      createStaff({ id: 'a', workforce: 100, skills: { field: 1, winery: 0.5, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 } }),
      createStaff({ id: 'b', workforce: 50, skills: { field: 1, winery: 0.5, maintenance: 0.5, administrationAndResearch: 0.5, sales: 0.5, financeAndStaff: 0.5 } }),
    ];
    const allocation = calculateStaffWorkAllocation(staff, WorkCategory.PLANTING, new Map());
    const applied = calculateAppliedStaffWorkAllocation(allocation, 10);

    expect([...allocation.contributions.values()].reduce((sum, value) => sum + value, 0)).toBeCloseTo(allocation.totalWork);
    expect([...applied.contributions.values()].reduce((sum, value) => sum + value, 0)).toBe(10);
    expect(applied.contributions.get('a')).toBeCloseTo(applied.contributions.get('b')! * 2);
  });
});

describe('calculateEstimatedWeeks', () => {
  it('derives timeline from staff contribution output', () => {
    const staff = [
      createStaff({
        id: 'a',
        workforce: 60,
        experience: { 'task:PLANTING': 100_000_000 },
        skills: {
          field: 0.8,
          winery: 0.4,
          maintenance: 0.4,
          administrationAndResearch: 0.2,
          sales: 0.3,
          financeAndStaff: 0.3
        }
      }),
      createStaff({
        id: 'b',
        workforce: 40,
        skills: {
          field: 0.5,
          winery: 0.6,
          maintenance: 0.6,
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

