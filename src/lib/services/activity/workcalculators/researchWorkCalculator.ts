import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/types/types';
import {
      getResearchProject,
      RESEARCH_BASE_COST,
      RESEARCH_COMPLEXITY_WORK_MULTIPLIER,
      RESEARCH_COMPLEXITY_COST_MULTIPLIER,
      ResearchProject
} from '@/lib/constants/researchConstants';

/**
 * Calculate work required for research activity
 * Work increases with research complexity
 */
export function calculateResearchWork(projectId: string): {
      totalWork: number;
      factors: WorkFactor[];
} {
      const project = getResearchProject(projectId);

      if (!project) {
            throw new Error(`Research project not found: ${projectId}`);
      }

      const rate = TASK_RATES[WorkCategory.ADMINISTRATION_AND_RESEARCH];
      const initialWork = INITIAL_WORK[WorkCategory.ADMINISTRATION_AND_RESEARCH];

      // Complexity modifier: each complexity point adds work
      // Complexity 1-10, multiplier 0.15 = 0% to 135% additional work
      const complexityModifier = (project.complexity - 1) * RESEARCH_COMPLEXITY_WORK_MULTIPLIER;

      // Category-based modifier (grants are slightly easier)
      let categoryModifier = 0;
      switch (project.category) {
            case 'grant':
                  categoryModifier = -0.1; // 10% less work (paperwork focused)
                  break;
            case 'technology':
                  categoryModifier = 0.15; // 15% more work (experimental)
                  break;
            case 'upgrade':
                  categoryModifier = 0.05; // 5% more work (implementation planning)
                  break;
      }

      const workModifiers = [complexityModifier, categoryModifier];

      // Calculate total work using standard work calculator
      const totalWork = calculateTotalWork(1, {
            rate,
            initialWork,
            workModifiers
      });

      // Build work factors for UI display
      const factors: WorkFactor[] = [
            { label: 'Research Project', value: project.title, isPrimary: true },
            { label: 'Processing Rate', value: rate, unit: '€/week' },
            { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
      ];

      // Add complexity factor
      if (complexityModifier > 0) {
            factors.push({
                  label: 'Research Complexity',
                  value: `Level ${project.complexity}/10`,
                  modifier: complexityModifier,
                  modifierLabel: 'complexity difficulty'
            });
      }

      // Add category factor
      if (categoryModifier !== 0) {
            const categoryLabel = project.category.charAt(0).toUpperCase() + project.category.slice(1);
            factors.push({
                  label: 'Research Type',
                  value: categoryLabel,
                  modifier: categoryModifier,
                  modifierLabel: 'category adjustment'
            });
      }

      return { totalWork, factors };
}

/**
 * Calculate cost for research activity
 * Cost increases with complexity and varies by category
 */
export function calculateResearchCost(projectId: string): number {
      const project = getResearchProject(projectId);

      if (!project) {
            throw new Error(`Research project not found: ${projectId}`);
      }

      // Get base cost for this category
      const baseCost = RESEARCH_BASE_COST[project.category];

      // Complexity multiplier: each complexity point adds cost
      // Complexity 1-10, multiplier 0.20 = 0% to 180% additional cost
      const complexityMultiplier = 1 + ((project.complexity - 1) * RESEARCH_COMPLEXITY_COST_MULTIPLIER);

      // Calculate final cost
      const totalCost = Math.round(baseCost * complexityMultiplier);

      return totalCost;
}

/**
 * Calculate estimated time to complete research
 * Based on work amount and no staff assigned (baseline)
 */
export function calculateResearchTimeEstimate(projectId: string): string {
      const { totalWork } = calculateResearchWork(projectId);

      // Calculate weeks assuming no staff (baseline estimate)
      const weeks = Math.ceil(totalWork / BASE_WORK_UNITS);

      return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

/**
 * Get research project details with calculated work and cost
 * Convenience function for UI
 */
export function getResearchProjectWithCalculations(projectId: string): {
      project: ResearchProject;
      totalWork: number;
      totalCost: number;
      timeEstimate: string;
      workFactors: WorkFactor[];
} {
      const project = getResearchProject(projectId);

      if (!project) {
            throw new Error(`Research project not found: ${projectId}`);
      }

      const { totalWork, factors } = calculateResearchWork(projectId);
      const totalCost = calculateResearchCost(projectId);
      const timeEstimate = calculateResearchTimeEstimate(projectId);

      return {
            project,
            totalWork,
            totalCost,
            timeEstimate,
            workFactors: factors
      };
}
