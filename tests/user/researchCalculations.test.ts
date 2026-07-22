import { describe, it, expect } from 'vitest';
import {
  calculateResearchWork,
  calculateResearchCost,
  getResearchProjectWithCalculations
} from '@/lib/features/activities/services/workcalculators/researchWorkCalculator';
import {
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_ECONOMICS,
} from '@/lib/features/researchUpgrade/constants/researchCatalog';
import { getResearchProject } from '@/lib/features/researchUpgrade/services/research/researchCatalogService';
import { GRAPE_VARIETIES } from '@/lib/types/types';
import { calculateGrapeDifficulty } from '@/lib/services/wine/features/grapeDifficulty';

/**
 * Research Calculation Tests - Pure Functions
 * 
 * These tests validate research calculations without requiring database or company setup.
 * Focuses on the mathematical correctness of work and cost.
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

    it('paces research as multi-month work for the expected company tier', () => {
      expect(calculateResearchWork('foundation_admin_baseline').totalWork).toBeGreaterThanOrEqual(150);
      expect(calculateResearchWork('tech_fermentation').totalWork).toBeGreaterThanOrEqual(2500);
      expect(calculateResearchWork('mkt_old_world_exchange').totalWork).toBeGreaterThanOrEqual(12000);
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

    it('keeps cost-per-work-unit in a similar range for ordinary non-grant research', () => {
      const representativeProjectIds = [
        'tech_soil_analysis',
        'tech_fermentation',
        'mkt_restaurant_program',
        'eff_bulk_chain_optimization',
        'foundation_staff_training',
      ];

      const ratios = representativeProjectIds.map(projectId =>
        calculateResearchCost(projectId) / calculateResearchWork(projectId).totalWork
      );

      expect(Math.max(...ratios) / Math.min(...ratios)).toBeLessThanOrEqual(2);
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
        expect(RESEARCH_PROJECT_ECONOMICS[project.id]).toEqual({
          workAmount: expect.any(Number),
          moneyCost: expect.any(Number),
        });
        
        // Can calculate work and cost
        expect(() => calculateResearchWork(project.id)).not.toThrow();
        expect(() => calculateResearchCost(project.id)).not.toThrow();
      }
    });

    it('keeps grape difficulty aligned with the corresponding research demands', () => {
      const rows = GRAPE_VARIETIES.map(grape => {
        const project = getResearchProject(`agri_${grape.toLowerCase().replace(/\s+/g, '_')}`);
        expect(project, `Missing grape research project for ${grape}`).toBeDefined();

        return {
          score: Number(calculateGrapeDifficulty(grape).score.toFixed(3)),
          complexity: project!.complexity,
          work: calculateResearchWork(project!.id).totalWork,
          cost: calculateResearchCost(project!.id),
        };
      }).sort((left, right) => left.score - right.score);

      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index].complexity).toBeGreaterThanOrEqual(rows[index - 1].complexity);
        expect(rows[index].work).toBeGreaterThanOrEqual(rows[index - 1].work);
        expect(rows[index].cost).toBeGreaterThanOrEqual(rows[index - 1].cost);
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

    it('defines a chained research-speed path with escalating gates', () => {
      const speedChain = [
        'foundation_admin_methodology',
        'foundation_admin_office',
        'tech_experimental_cellar_lab',
        'tech_innovation_program',
        'tech_research_institute_network',
      ].map(projectId => {
        const project = RESEARCH_PROJECTS.find(candidate => candidate.id === projectId);
        expect(project, projectId).toBeDefined();
        return project!;
      });

      for (const project of speedChain) {
        expect(project.permanentEffects).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: 'research_skill_multiplier',
              multiplier: expect.any(Number),
            }),
          ])
        );
      }

      expect(speedChain[1].prerequisites).toContain(speedChain[0].id);
      expect(speedChain[2].prerequisites).toEqual(expect.arrayContaining([speedChain[1].id, 'tech_fermentation']));
      expect(speedChain[3].requiredAchievementIds).toContain('wine_score_tier_1');
      expect(speedChain[4].requiredPrestige).toBeGreaterThan(speedChain[3].requiredPrestige ?? 0);
    });
  });
});
