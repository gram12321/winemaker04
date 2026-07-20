import { describe, it, expect } from 'vitest';
import {
  calculateStaffSearchCost,
  calculateSearchWork,
  calculateHiringWorkForCandidate,
  calculateHiringWorkRange,
  calculateSearchPreview,
  type StaffSearchOptions
} from '@/lib/features/activities/services/workcalculators/staffSearchWorkCalculator';
import { staffFeature } from '@/lib/features/staff';
import { generateStaffCandidates } from '@/lib/features/activities/services/activitymanagers/staffSearchManager';
import { type Staff, type SpecializedRole } from '@/lib/types/types';

describe('staff search calculations', () => {
  const baseSearchOptions: StaffSearchOptions = {
    numberOfCandidates: 3,
    skillLevel: 0.5,
    specializedRoles: []
  };

  it('keeps search cost and work finite and responsive to every search driver', () => {
    const variants = [
      { ...baseSearchOptions, numberOfCandidates: 5 },
      { ...baseSearchOptions, skillLevel: 0.8 },
      { ...baseSearchOptions, specializedRoles: ['field'] as SpecializedRole[] },
    ];
    const baseCost = calculateStaffSearchCost(baseSearchOptions);
    const baseWork = calculateSearchWork(baseSearchOptions);

    expect(baseCost).toBeGreaterThan(0);
    expect(Number.isFinite(baseCost)).toBe(true);
    expect(baseWork).toBeGreaterThan(0);
    expect(Number.isFinite(baseWork)).toBe(true);

    for (const options of variants) {
      expect(calculateStaffSearchCost(options)).toBeGreaterThan(baseCost);
      expect(calculateSearchWork(options)).toBeGreaterThanOrEqual(baseWork);
    }
  });

  it('carries selected broad roles into generated search candidates', () => {
    const candidates = generateStaffCandidates(
      { ...baseSearchOptions, numberOfCandidates: 2, specializedRoles: ['field'] as SpecializedRole[] },
      { week: 1, season: 'Spring', year: 2026 },
    );

    expect(candidates).toHaveLength(2);
    expect(candidates.every(candidate => candidate.specializedRoles.includes('field'))).toBe(true);
  });

  it('keeps hiring work ranges ordered and increases them for harder searches', () => {
    const baseline = calculateHiringWorkRange(0.3, []);
    const harder = calculateHiringWorkRange(0.8, ['field']);

    expect(baseline.minWork).toBeGreaterThan(0);
    expect(baseline.maxWork).toBeGreaterThanOrEqual(baseline.minWork);
    expect(harder.maxWork).toBeGreaterThanOrEqual(harder.minWork);
    expect(typeof harder.timeEstimate).toBe('string');
    expect(harder.minWork).toBeGreaterThan(baseline.minWork);
    expect(harder.maxWork).toBeGreaterThan(baseline.maxWork);
  });

  describe('calculateHiringWorkForCandidate', () => {
    const fixedSkills: Staff['skills'] = {
      field: 0.5,
      winery: 0.5,
      maintenance: 0.5,
      financeAndStaff: 0.5,
      sales: 0.5,
      administrationAndResearch: 0.5
    };

    const candidate = (overrides: Partial<Staff> = {}): Staff => ({
      ...staffFeature.records.create({ firstName: 'Test', lastName: 'Staff', skillLevel: 0.5, nationality: 'United States', hireDate: { week: 1, season: 'Spring', year: 2026 } }),
      skills: fixedSkills,
      ...overrides
    });

    it('keeps candidate hiring work finite and sensitive to wage and broad roles', () => {
      const base = calculateHiringWorkForCandidate(candidate({ wage: 1000 }));
      const higherWage = calculateHiringWorkForCandidate(candidate({ wage: 3000 }));
      const specialized = calculateHiringWorkForCandidate(candidate({
        wage: 3000,
        specializedRoles: ['field', 'winery']
      }));

      expect(base).toBeGreaterThan(0);
      expect(Number.isFinite(base)).toBe(true);
      expect(higherWage).toBeGreaterThan(base);
      expect(specialized).toBeGreaterThan(higherWage);
    });
  });

  it('keeps search previews valid and reflects skill and specialization choices', () => {
    const preview = calculateSearchPreview(baseSearchOptions);
    const higherSkill = calculateSearchPreview({ ...baseSearchOptions, skillLevel: 0.7 });
    const specialized = calculateSearchPreview({
      ...baseSearchOptions,
      specializedRoles: ['field']
    });

    expect(preview.minSkill).toBeGreaterThanOrEqual(0);
    expect(preview.maxSkill).toBeLessThanOrEqual(1);
    expect(preview.maxSkill).toBeGreaterThanOrEqual(preview.minSkill);
    expect(preview.minWeeklyWage).toBeGreaterThan(0);
    expect(preview.maxWeeklyWage).toBeGreaterThanOrEqual(preview.minWeeklyWage);
    expect(typeof preview.skillRange).toBe('string');
    expect(typeof preview.wageRange).toBe('string');
    expect(preview.specializationBonus).toBe(1);
    expect(higherSkill.minSkill).toBeGreaterThan(preview.minSkill);
    expect(higherSkill.maxSkill).toBeGreaterThan(preview.maxSkill);
    expect(specialized.minWeeklyWage).toBeGreaterThan(preview.minWeeklyWage);
    expect(specialized.maxWeeklyWage).toBeGreaterThan(preview.maxWeeklyWage);
    expect(specialized.specializationBonus).toBeGreaterThan(preview.specializationBonus);
    expect(specialized.specializationBonus).toBeCloseTo(1.3);
  });
});
