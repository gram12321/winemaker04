import { describe, it, expect } from 'vitest';
import {
  calculateStaffSearchCost,
  calculateSearchWork,
  calculateHiringWorkForCandidate,
  calculateHiringWorkRange,
  calculateSearchPreview,
  type StaffSearchOptions
} from '@/lib/services/activity/workcalculators/staffSearchWorkCalculator';
import { createStaff } from '@/lib/services/user/staffService';
import type { Staff } from '@/lib/types/types';

/**
 * Staff Search Calculations - Pure Functions
 * 
 * These tests validate staff search and hiring calculations without requiring database setup.
 * Focuses on cost, work, and preview calculation correctness.
 */
describe('Staff Search Calculations - Pure Functions', () => {
  const baseSearchOptions: StaffSearchOptions = {
    numberOfCandidates: 3,
    skillLevel: 0.5,
    specializations: []
  };

  describe('calculateStaffSearchCost', () => {
    it('calculates cost for basic search', () => {
      const cost = calculateStaffSearchCost(baseSearchOptions);
      expect(cost).toBeGreaterThan(0);
      expect(isFinite(cost)).toBe(true);
    });

    it('cost increases with more candidates', () => {
      const options1 = { ...baseSearchOptions, numberOfCandidates: 2 };
      const options2 = { ...baseSearchOptions, numberOfCandidates: 5 };
      
      const cost1 = calculateStaffSearchCost(options1);
      const cost2 = calculateStaffSearchCost(options2);
      
      expect(cost2).toBeGreaterThan(cost1);
    });

    it('cost increases with higher skill level', () => {
      const options1 = { ...baseSearchOptions, skillLevel: 0.3 };
      const options2 = { ...baseSearchOptions, skillLevel: 0.8 };
      
      const cost1 = calculateStaffSearchCost(options1);
      const cost2 = calculateStaffSearchCost(options2);
      
      expect(cost2).toBeGreaterThan(cost1);
    });

    it('cost increases with specializations', () => {
      const options1 = { ...baseSearchOptions, specializations: [] };
      const options2 = { ...baseSearchOptions, specializations: ['field'] };
      const options3 = { ...baseSearchOptions, specializations: ['field', 'winery'] };
      
      const cost1 = calculateStaffSearchCost(options1);
      const cost2 = calculateStaffSearchCost(options2);
      const cost3 = calculateStaffSearchCost(options3);
      
      expect(cost2).toBeGreaterThan(cost1);
      expect(cost3).toBeGreaterThan(cost2);
    });
  });

  describe('calculateSearchWork', () => {
    it('calculates work amount for search', () => {
      const work = calculateSearchWork(baseSearchOptions);
      expect(work).toBeGreaterThan(0);
      expect(isFinite(work)).toBe(true);
    });

    it('work increases with more candidates', () => {
      const options1 = { ...baseSearchOptions, numberOfCandidates: 2 };
      const options2 = { ...baseSearchOptions, numberOfCandidates: 5 };
      
      const work1 = calculateSearchWork(options1);
      const work2 = calculateSearchWork(options2);
      
      expect(work2).toBeGreaterThan(work1);
    });

    it('work increases with higher skill requirements', () => {
      const options1 = { ...baseSearchOptions, skillLevel: 0.3 };
      const options2 = { ...baseSearchOptions, skillLevel: 0.8 };
      
      const work1 = calculateSearchWork(options1);
      const work2 = calculateSearchWork(options2);
      
      expect(work2).toBeGreaterThanOrEqual(work1);
    });

    it('work increases with specializations', () => {
      const options1 = { ...baseSearchOptions, specializations: [] };
      const options2 = { ...baseSearchOptions, specializations: ['field', 'winery'] };
      
      const work1 = calculateSearchWork(options1);
      const work2 = calculateSearchWork(options2);
      
      expect(work2).toBeGreaterThan(work1);
    });
  });

  describe('calculateHiringWorkRange', () => {
    it('returns valid work range', () => {
      const range = calculateHiringWorkRange(0.5, []);
      
      expect(range.minWork).toBeGreaterThan(0);
      expect(range.maxWork).toBeGreaterThanOrEqual(range.minWork);
      expect(typeof range.timeEstimate).toBe('string');
    });

    it('max work is greater than or equal to min work', () => {
      const range1 = calculateHiringWorkRange(0.3, []);
      const range2 = calculateHiringWorkRange(0.7, ['field']);
      
      expect(range1.maxWork).toBeGreaterThanOrEqual(range1.minWork);
      expect(range2.maxWork).toBeGreaterThanOrEqual(range2.minWork);
    });

    it('work increases with higher skill level', () => {
      const range1 = calculateHiringWorkRange(0.3, []);
      const range2 = calculateHiringWorkRange(0.8, []);
      
      expect(range2.minWork).toBeGreaterThan(range1.minWork);
      expect(range2.maxWork).toBeGreaterThan(range1.maxWork);
    });

    it('work increases with specializations', () => {
      const range1 = calculateHiringWorkRange(0.5, []);
      const range2 = calculateHiringWorkRange(0.5, ['field', 'winery']);
      
      expect(range2.minWork).toBeGreaterThan(range1.minWork);
      expect(range2.maxWork).toBeGreaterThan(range1.maxWork);
    });
  });

  describe('calculateHiringWorkForCandidate', () => {
    // Create a minimal staff object for testing (without needing gameState)
    const createTestStaff = (overrides: Partial<Staff> = {}): Staff => {
      const baseStaff = createStaff('Test', 'Staff', 0.5, [], 'United States');
      return {
        ...baseStaff,
        ...overrides
      };
    };

    it('calculates work for a candidate', () => {
      const candidate = createTestStaff();
      const work = calculateHiringWorkForCandidate(candidate);
      
      expect(work).toBeGreaterThan(0);
      expect(isFinite(work)).toBe(true);
    });

    it('work increases with candidate wage', () => {
      const candidate1 = createTestStaff({ wage: 1000 });
      const candidate2 = createTestStaff({ wage: 3000 });
      
      const work1 = calculateHiringWorkForCandidate(candidate1);
      const work2 = calculateHiringWorkForCandidate(candidate2);
      
      expect(work2).toBeGreaterThan(work1);
    });

    it('work increases with candidate specializations', () => {
      const candidate1 = createTestStaff({ specializations: [] });
      const candidate2 = createTestStaff({ specializations: ['field', 'winery'] });
      
      const work1 = calculateHiringWorkForCandidate(candidate1);
      const work2 = calculateHiringWorkForCandidate(candidate2);
      
      expect(work2).toBeGreaterThan(work1);
    });
  });

  describe('calculateSearchPreview', () => {
    it('returns valid preview statistics', () => {
      const preview = calculateSearchPreview(baseSearchOptions);
      
      expect(preview.minSkill).toBeGreaterThanOrEqual(0);
      expect(preview.maxSkill).toBeLessThanOrEqual(1);
      expect(preview.maxSkill).toBeGreaterThanOrEqual(preview.minSkill);
      expect(preview.minWeeklyWage).toBeGreaterThan(0);
      expect(preview.maxWeeklyWage).toBeGreaterThanOrEqual(preview.minWeeklyWage);
      expect(typeof preview.skillRange).toBe('string');
      expect(typeof preview.wageRange).toBe('string');
      expect(preview.specializationBonus).toBeGreaterThanOrEqual(1);
    });

    it('skill range increases with search skill level', () => {
      const preview1 = calculateSearchPreview({ ...baseSearchOptions, skillLevel: 0.3 });
      const preview2 = calculateSearchPreview({ ...baseSearchOptions, skillLevel: 0.7 });
      
      expect(preview2.minSkill).toBeGreaterThan(preview1.minSkill);
      expect(preview2.maxSkill).toBeGreaterThan(preview1.maxSkill);
    });

    it('wage range increases with specializations', () => {
      const preview1 = calculateSearchPreview({ ...baseSearchOptions, specializations: [] });
      const preview2 = calculateSearchPreview({ ...baseSearchOptions, specializations: ['field'] });
      
      expect(preview2.minWeeklyWage).toBeGreaterThan(preview1.minWeeklyWage);
      expect(preview2.maxWeeklyWage).toBeGreaterThan(preview1.maxWeeklyWage);
    });

    it('specialization bonus is calculated correctly', () => {
      const preview1 = calculateSearchPreview({ ...baseSearchOptions, specializations: [] });
      const preview2 = calculateSearchPreview({ ...baseSearchOptions, specializations: ['field'] });
      const preview3 = calculateSearchPreview({ ...baseSearchOptions, specializations: ['field', 'winery'] });
      
      expect(preview1.specializationBonus).toBe(1);
      expect(preview2.specializationBonus).toBeGreaterThan(1);
      expect(preview3.specializationBonus).toBeGreaterThan(preview2.specializationBonus);
    });
  });

  describe('generateStaffCandidates', () => {
    // This can be tested if we import it - it's also a pure function
    // (though it calls createStaff which uses gameState, we can mock that)
    it.skip('generates correct number of candidates', () => {
      // Test implementation would go here if we want to test candidate generation
      // Might require mocking getGameState() if createStaff depends on it
    });
  });
});
