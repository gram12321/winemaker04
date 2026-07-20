import { describe, it, expect } from 'vitest';
import { staffFeature } from '@/lib/features/staff';
import { type StaffSkills } from '@/lib/types/types';

const calculateWage = staffFeature.wages.calculate;

const baseSkills: StaffSkills = {
  field: 0.5,
  winery: 0.5,
  maintenance: 0.5,
  administrationAndResearch: 0.5,
  sales: 0.5,
  financeAndStaff: 0.5
};

describe('calculateWage', () => {
  it('calculates base wage for average skills without career roles', () => {
    const skills: StaffSkills = {
      field: 0.5,
      winery: 0.5,
      maintenance: 0.5,
      administrationAndResearch: 0.5,
      sales: 0.5,
      financeAndStaff: 0.5
    };

    const wage = calculateWage(skills, []);

    // Base: 500 + (0.5 * 1000) = 500 + 500 = 1000
    // No specialization bonus
    expect(wage).toBe(1000);
  });

  it('increases wage with higher average skills', () => {
    const lowSkills: StaffSkills = {
      field: 0.3,
      winery: 0.3,
      maintenance: 0.3,
      administrationAndResearch: 0.3,
      sales: 0.3,
      financeAndStaff: 0.3
    };

    const highSkills: StaffSkills = {
      field: 0.8,
      winery: 0.8,
      maintenance: 0.8,
      administrationAndResearch: 0.8,
      sales: 0.8,
      financeAndStaff: 0.8
    };

    const lowWage = calculateWage(lowSkills, []);
    const highWage = calculateWage(highSkills, []);

    expect(highWage).toBeGreaterThan(lowWage);
  });

  it('includes maintenance in the average skill', () => {
    const withoutMaintenance = { ...baseSkills, maintenance: 0 };
    const withMaintenance = { ...baseSkills, maintenance: 1 };
    expect(calculateWage(withMaintenance)).toBeGreaterThan(calculateWage(withoutMaintenance));
  });

  it('includes primary-skill XP in the wage calculation', () => {
    const noXpWage = calculateWage(baseSkills);
    const fieldXpWage = calculateWage(baseSkills, [], { 'skill:field': 100_000_000 });

    expect(fieldXpWage).toBeGreaterThan(noXpWage);
  });

  it('applies broad-role wage premiums multiplicatively', () => {
    const skills = baseSkills;

    const noSpecialization = calculateWage(skills, []);
    const oneSpecialization = calculateWage(skills, ['field']);
    const twoSpecializations = calculateWage(skills, ['field', 'winery']);
    const threeSpecializations = calculateWage(skills, ['field', 'winery', 'maintenance']);

    // Base wage: 500 + (0.5 * 1000) = 1000

    // 1 specialization: 1000 * 1.3 = 1300
    expect(oneSpecialization).toBeGreaterThan(noSpecialization);

    // Two distinct primary-skill groups: 1000 * 1.3^2 = 1690.
    expect(twoSpecializations).toBeGreaterThan(oneSpecialization);

    // Three distinct primary-skill groups: 1000 * 1.3^3 = 2197.
    expect(threeSpecializations).toBeGreaterThan(twoSpecializations);

    // Verify the multiplication is correct
    expect(oneSpecialization).toBeCloseTo(noSpecialization * 1.3, 0);
    expect(twoSpecializations).toBeCloseTo(noSpecialization * Math.pow(1.3, 2), 0);
    expect(threeSpecializations).toBeCloseTo(noSpecialization * Math.pow(1.3, 3), 0);
  });

  it('rounds wage to nearest integer', () => {
    const skills: StaffSkills = {
      field: 0.333,
      winery: 0.333,
      maintenance: 0.333,
      administrationAndResearch: 0.333,
      sales: 0.333,
      financeAndStaff: 0.333
    };

    const wage = calculateWage(skills, ['field']);

    // Should be rounded, not fractional
    expect(wage).toBe(Math.round(wage));
    expect(Number.isInteger(wage)).toBe(true);
  });

  it.each([
    ['minimum skills', {
      field: 0,
      winery: 0,
      maintenance: 0,
      administrationAndResearch: 0,
      sales: 0,
      financeAndStaff: 0
    }, 500],
    ['maximum skills', {
      field: 1.0,
      winery: 1.0,
      maintenance: 1.0,
      administrationAndResearch: 1.0,
      sales: 1.0,
      financeAndStaff: 1.0
    }, 1500],
    ['mixed skills', {
      field: 0.8,
      winery: 0.6,
      maintenance: 0.6,
      administrationAndResearch: 0.4,
      sales: 0.7,
      financeAndStaff: 0.5
    }, 1100],
  ] as const)('%s skills have the expected base wage', (_label, skills, expected) => {
    expect(calculateWage(skills, [])).toBe(expected);
  });

  it('handles multiple broad roles correctly', () => {
    const skills = baseSkills;

    const fieldTaskWage = calculateWage(skills, ['field']);
    const multipleFieldTaskWage = calculateWage(skills, ['field']);
    const wage = calculateWage(skills, ['field', 'winery', 'maintenance', 'financeAndStaff', 'administrationAndResearch']);

    // Base: 1000
    // Five distinct primary-skill groups: 1000 * 1.3^5 ≈ 3713.
    expect(multipleFieldTaskWage).toBe(fieldTaskWage);
    expect(wage).toBeCloseTo(1000 * Math.pow(1.3, 5), 0);
  });

  it('includes broad roles in wage premiums without double-counting their skill group', () => {
    const baseWage = calculateWage(baseSkills);
    const fieldRoleWage = calculateWage(baseSkills, ['field']);
    const duplicatedFieldWage = calculateWage(baseSkills, ['field']);
    const fieldAndWineryWage = calculateWage(baseSkills, ['field', 'winery']);

    expect(fieldRoleWage).toBeCloseTo(baseWage * 1.3, 0);
    expect(duplicatedFieldWage).toBe(fieldRoleWage);
    expect(fieldAndWineryWage).toBeCloseTo(baseWage * Math.pow(1.3, 2), 0);
  });
});

