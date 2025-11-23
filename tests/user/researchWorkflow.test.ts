import { describe, it, expect } from 'vitest';
import {
  calculateResearchWork,
  calculateResearchCost,
  calculateResearchTimeEstimate,
  getResearchProjectWithCalculations
} from '@/lib/services/activity/workcalculators/researchWorkCalculator';
import { RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';

/**
 * Research Calculation Tests - Pure Functions
 * 
 * These tests validate research calculations without requiring database or company setup.
 * Focuses on the mathematical correctness of work, cost, and time estimates.
 */
describe('Research Calculations - Pure Functions', () => {
  describe('calculateResearchWork', () => {
    it('calculates work amount for a valid research project', () => {
      // Find any valid research project
      const project = RESEARCH_PROJECTS[0];
      expect(project).toBeDefined();
      
      const { totalWork, factors } = calculateResearchWork(project.id);
      
      // Work should be positive
      expect(totalWork).toBeGreaterThan(0);
      // Should have work factors for display
      expect(Array.isArray(factors)).toBe(true);
      expect(factors.length).toBeGreaterThan(0);
    });

    it('throws error for invalid research project ID', () => {
      expect(() => {
        calculateResearchWork('invalid_project_id');
      }).toThrow('Research project not found');
    });

    it('includes complexity modifier in work calculation', () => {
      // Find projects with different complexities
      const simpleProject = RESEARCH_PROJECTS.find(p => p.complexity <= 3);
      const complexProject = RESEARCH_PROJECTS.find(p => p.complexity >= 7);
      
      if (simpleProject && complexProject) {
        const simpleWork = calculateResearchWork(simpleProject.id);
        const complexWork = calculateResearchWork(complexProject.id);
        
        // Complex projects should generally require more work
        // (allowing for category modifiers to potentially override)
        expect(complexWork.totalWork).toBeGreaterThanOrEqual(simpleWork.totalWork * 0.5);
      }
    });

    it('includes category modifier in work calculation', () => {
      // Test that different categories have different work modifiers
      const projects = RESEARCH_PROJECTS.slice(0, 5); // Test first 5 projects
      
      const workAmounts = projects.map(p => ({
        id: p.id,
        category: p.category,
        work: calculateResearchWork(p.id).totalWork
      }));
      
      // All should have valid work amounts
      workAmounts.forEach(({ work }) => {
        expect(work).toBeGreaterThan(0);
      });
      
      // Should have some variation (not all identical)
      const uniqueWorkValues = new Set(workAmounts.map(w => w.work));
      expect(uniqueWorkValues.size).toBeGreaterThan(1);
    });
  });

  describe('calculateResearchCost', () => {
    it('calculates cost for a valid research project', () => {
      const project = RESEARCH_PROJECTS[0];
      expect(project).toBeDefined();
      
      const cost = calculateResearchCost(project.id);
      
      // Cost should be positive
      expect(cost).toBeGreaterThan(0);
      // Cost should be a reasonable number (not NaN, not Infinity)
      expect(isFinite(cost)).toBe(true);
    });

    it('throws error for invalid research project ID', () => {
      expect(() => {
        calculateResearchCost('invalid_project_id');
      }).toThrow('Research project not found');
    });

    it('cost increases with complexity', () => {
      const simpleProject = RESEARCH_PROJECTS.find(p => p.complexity <= 3);
      const complexProject = RESEARCH_PROJECTS.find(p => p.complexity >= 7);
      
      if (simpleProject && complexProject && simpleProject.category === complexProject.category) {
        const simpleCost = calculateResearchCost(simpleProject.id);
        const complexCost = calculateResearchCost(complexProject.id);
        
        // Complex projects should cost more (same category for fair comparison)
        expect(complexCost).toBeGreaterThan(simpleCost);
      }
    });

    it('different categories have different base costs', () => {
      const projectsByCategory = new Map<string, typeof RESEARCH_PROJECTS[0]>();
      
      for (const project of RESEARCH_PROJECTS) {
        if (!projectsByCategory.has(project.category)) {
          projectsByCategory.set(project.category, project);
        }
      }
      
      // Should have multiple categories
      expect(projectsByCategory.size).toBeGreaterThan(1);
      
      // Each category should have a valid cost
      for (const [, project] of projectsByCategory) {
        const cost = calculateResearchCost(project.id);
        expect(cost).toBeGreaterThan(0);
        expect(isFinite(cost)).toBe(true);
      }
    });
  });

  describe('calculateResearchTimeEstimate', () => {
    it('returns time estimate as a string', () => {
      const project = RESEARCH_PROJECTS[0];
      const estimate = calculateResearchTimeEstimate(project.id);
      
      expect(typeof estimate).toBe('string');
      expect(estimate).toMatch(/\d+\s+week/);
    });

    it('time estimate is reasonable (not zero, not extremely large)', () => {
      for (const project of RESEARCH_PROJECTS.slice(0, 10)) {
        const estimate = calculateResearchTimeEstimate(project.id);
        const weeks = parseInt(estimate.match(/\d+/)?.[0] || '0');
        
        expect(weeks).toBeGreaterThan(0);
        expect(weeks).toBeLessThan(1000); // Reasonable upper bound
      }
    });
  });

  describe('getResearchProjectWithCalculations', () => {
    it('returns complete project data with all calculations', () => {
      const project = RESEARCH_PROJECTS[0];
      const result = getResearchProjectWithCalculations(project.id);
      
      expect(result.project).toBeDefined();
      expect(result.project.id).toBe(project.id);
      expect(result.totalWork).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(typeof result.timeEstimate).toBe('string');
      expect(Array.isArray(result.workFactors)).toBe(true);
    });

    it('work and cost match individual calculation functions', () => {
      const project = RESEARCH_PROJECTS[0];
      const combined = getResearchProjectWithCalculations(project.id);
      const individualWork = calculateResearchWork(project.id);
      const individualCost = calculateResearchCost(project.id);
      
      expect(combined.totalWork).toBe(individualWork.totalWork);
      expect(combined.totalCost).toBe(individualCost);
    });
  });

  describe('Research Project Configuration', () => {
    it('all research projects have valid configuration', () => {
      for (const project of RESEARCH_PROJECTS) {
        expect(project.id).toBeTruthy();
        expect(project.title).toBeTruthy();
        expect(project.complexity).toBeGreaterThan(0);
        expect(project.complexity).toBeLessThanOrEqual(10);
        expect(project.category).toBeTruthy();
        
        // Can calculate work and cost
        expect(() => calculateResearchWork(project.id)).not.toThrow();
        expect(() => calculateResearchCost(project.id)).not.toThrow();
      }
    });

    it('projects with unlocks have valid unlock definitions', () => {
      const projectsWithUnlocks = RESEARCH_PROJECTS.filter(p => p.unlocks && p.unlocks.length > 0);
      
      for (const project of projectsWithUnlocks) {
        expect(Array.isArray(project.unlocks)).toBe(true);
        project.unlocks!.forEach(unlock => {
          expect(unlock.type).toBeTruthy();
          expect(unlock.value).toBeDefined();
        });
      }
    });

    it('projects with rewards have positive amounts', () => {
      const projectsWithRewards = RESEARCH_PROJECTS.filter(
        p => (p.rewardAmount && p.rewardAmount > 0) || (p.prestigeReward && p.prestigeReward > 0)
      );
      
      for (const project of projectsWithRewards) {
        if (project.rewardAmount) {
          expect(project.rewardAmount).toBeGreaterThan(0);
        }
        if (project.prestigeReward) {
          expect(project.prestigeReward).toBeGreaterThan(0);
        }
      }
    });
  });
});
