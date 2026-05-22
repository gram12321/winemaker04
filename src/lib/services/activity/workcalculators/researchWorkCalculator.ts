import { calculateTotalWork, WorkFactor } from './workCalculator';
import { BASE_WORK_UNITS, TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/types/types';
import {
      getResearchProject,
      RESEARCH_BASE_MONEY_COST,
      RESEARCH_PROJECT_COMPLEXITY_WORK_MULTIPLIER,
      RESEARCH_PROJECT_COMPLEXITY_COST_MULTIPLIER,
      ResearchProject
} from '@/lib/constants/researchConstants';

const RESEARCH_CATEGORY_WORK_MODIFIERS: Record<ResearchProject['category'], number> = {
      administration: -0.15,
      projects: -0.1,
      technology: 0.15,
      agriculture: 0.05,
      efficiency: 0.1,
      marketing: -0.05,
      staff: 0.05
};

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

      // Get base work rate and initial work from activity constants
      const baseRate = TASK_RATES[WorkCategory.ADMINISTRATION_AND_RESEARCH]; // 25 work units/week
      const baseInitialWork = INITIAL_WORK[WorkCategory.ADMINISTRATION_AND_RESEARCH];

      const workProfile = project.workProfile;
      
      // Add project-specific extra initial work if provided
      const initialWork = baseInitialWork + (project.initialWork || 0) + (workProfile?.extraInitialWork || 0);

      // Generic scope amount: either a fixed scope, a complexity-scaled scope, or legacy baseWorkAmount.
      const scopeWorkAmount = (workProfile?.scopeWorkAmount || project.baseWorkAmount || 0)
            + ((workProfile?.scopeWorkAmountPerComplexity || 0) * project.complexity);

      // Complexity curve operates on the normalized research complexity axis (1-10).
      // For grape projects, grape difficulty is mapped to this axis in research constants.
      // Default to the current linear behavior unless a project overrides it.
      const complexityModifier = workProfile?.complexityCurve
            ? (workProfile.complexityCurve.kind === 'linear'
                  ? (project.complexity - 1) * workProfile.complexityCurve.multiplier
                  : Math.pow(workProfile.complexityCurve.base, project.complexity - 1) - 1)
            : (project.complexity - 1) * RESEARCH_PROJECT_COMPLEXITY_WORK_MULTIPLIER;

      // Category-based modifier: default category behavior unless the project overrides it.
      const categoryModifier = workProfile?.categoryModifier ?? RESEARCH_CATEGORY_WORK_MODIFIERS[project.category];

      const workModifiers = [complexityModifier, categoryModifier];

      // Calculate total work using standard work calculator
      // scopeWorkAmount is the amount (work units), rate is 25 work units/week
      // This means: workWeeks = scopeWorkAmount / 25, then workUnits = workWeeks * 25 = scopeWorkAmount
      // So the rate-based calculation effectively just adds baseWorkAmount work units
      const totalWork = calculateTotalWork(scopeWorkAmount, {
            rate: baseRate,
            initialWork,
            workModifiers
      });

      // Build work factors for UI display
      const factors: WorkFactor[] = [
            { label: 'Research Project', value: project.title, isPrimary: true },
            { label: 'Processing Rate', value: baseRate, unit: 'work units/week' },
            { label: 'Base Initial Work', value: baseInitialWork, unit: 'work units' }
      ];
      
      // Add extra initial work factor if project has it
      if (project.initialWork && project.initialWork > 0) {
            factors.push({
                  label: 'Extra Initial Work',
                  value: project.initialWork,
                  unit: 'work units',
                  modifier: 0, // This is additive, not a multiplier
                  modifierLabel: 'project-specific setup'
            });
      }

      // Add scope factor if project has it
      if (scopeWorkAmount > 0) {
            factors.push({
                  label: 'Scope Work Amount',
                  value: scopeWorkAmount,
                  unit: 'work units',
                  modifier: 0, // This is additive, not a multiplier
                  modifierLabel: 'research project scope'
            });
      }

      // Add complexity scaling profile factor when present
      if (workProfile?.scopeWorkAmountPerComplexity && workProfile.scopeWorkAmountPerComplexity > 0) {
            factors.push({
                  label: 'Scope per Complexity',
                  value: workProfile.scopeWorkAmountPerComplexity,
                  unit: 'work units / complexity',
                  modifier: 0,
                  modifierLabel: 'project complexity scaling'
            });
      }

      // Add complexity factor
      if (complexityModifier > 0) {
            factors.push({
                  label: 'Research Complexity',
                  value: workProfile?.complexityCurve
                        ? `Level ${project.complexity}/10 (${workProfile.complexityCurve.kind})`
                        : `Level ${project.complexity}/10`,
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

      // Get base money cost for this category
      const baseCost = RESEARCH_BASE_MONEY_COST[project.category];

      // Complexity multiplier: each complexity point adds cost
      // Complexity 1-10, multiplier 0.20 = 0% to 180% additional cost
      const complexityMultiplier = 1 + ((project.complexity - 1) * RESEARCH_PROJECT_COMPLEXITY_COST_MULTIPLIER);

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
