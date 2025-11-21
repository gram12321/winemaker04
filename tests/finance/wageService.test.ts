import { describe, it, expect } from 'vitest';
import { calculateWage } from '@/lib/services/finance/wageService';
import type { StaffSkills } from '@/lib/types/types';

const baseSkills: StaffSkills = {
  field: 0.5,
  winery: 0.5,
  administration: 0.5,
  sales: 0.5,
  maintenance: 0.5
};

describe('calculateWage', () => {
  it('calculates base wage for average skills without specializations', () => {
    const skills: StaffSkills = {
      field: 0.5,
      winery: 0.5,
      administration: 0.5,
      sales: 0.5,
      maintenance: 0.5
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
      administration: 0.3,
      sales: 0.3,
      maintenance: 0.3
    };

    const highSkills: StaffSkills = {
      field: 0.8,
      winery: 0.8,
      administration: 0.8,
      sales: 0.8,
      maintenance: 0.8
    };

    const lowWage = calculateWage(lowSkills, []);
    const highWage = calculateWage(highSkills, []);

    expect(highWage).toBeGreaterThan(lowWage);
  });

  it('applies specialization bonus multiplicatively', () => {
    const skills = baseSkills;

    const noSpecialization = calculateWage(skills, []);
    const oneSpecialization = calculateWage(skills, ['field']);
    const twoSpecializations = calculateWage(skills, ['field', 'winery']);
    const threeSpecializations = calculateWage(skills, ['field', 'winery', 'administration']);

    // Base wage: 500 + (0.5 * 1000) = 1000

    // 1 specialization: 1000 * 1.3 = 1300
    expect(oneSpecialization).toBeGreaterThan(noSpecialization);

    // 2 specializations: 1000 * 1.3^2 = 1000 * 1.69 = 1690
    expect(twoSpecializations).toBeGreaterThan(oneSpecialization);

    // 3 specializations: 1000 * 1.3^3 = 1000 * 2.197 = 2197
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
      administration: 0.333,
      sales: 0.333,
      maintenance: 0.333
    };

    const wage = calculateWage(skills, ['field']);

    // Should be rounded, not fractional
    expect(wage).toBe(Math.round(wage));
    expect(Number.isInteger(wage)).toBe(true);
  });

  it('handles minimum skills (all zeros)', () => {
    const minSkills: StaffSkills = {
      field: 0,
      winery: 0,
      administration: 0,
      sales: 0,
      maintenance: 0
    };

    const wage = calculateWage(minSkills, []);

    // Base: 500 + (0 * 1000) = 500
    expect(wage).toBe(500);
  });

  it('handles maximum skills (all ones)', () => {
    const maxSkills: StaffSkills = {
      field: 1.0,
      winery: 1.0,
      administration: 1.0,
      sales: 1.0,
      maintenance: 1.0
    };

    const wage = calculateWage(maxSkills, []);

    // Base: 500 + (1.0 * 1000) = 1500
    expect(wage).toBe(1500);
  });

  it('calculates correct wage for mixed skill levels', () => {
    const mixedSkills: StaffSkills = {
      field: 0.8,
      winery: 0.6,
      administration: 0.4,
      sales: 0.7,
      maintenance: 0.5
    };

    const wage = calculateWage(mixedSkills, []);

    // Average: (0.8 + 0.6 + 0.4 + 0.7 + 0.5) / 5 = 3.0 / 5 = 0.6
    // Base: 500 + (0.6 * 1000) = 500 + 600 = 1100
    expect(wage).toBe(1100);
  });

  it('handles multiple specializations correctly', () => {
    const skills = baseSkills;

    const wage = calculateWage(skills, ['field', 'winery', 'administration', 'sales', 'maintenance']);

    // Base: 1000
    // 5 specializations: 1000 * 1.3^5 = 1000 * 3.71293 ≈ 3713
    expect(wage).toBeCloseTo(1000 * Math.pow(1.3, 5), 0);
  });
});

