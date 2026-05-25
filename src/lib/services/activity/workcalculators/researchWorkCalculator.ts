import { type WorkFactor } from './workCalculator';
import {
      getResearchProject,
      RESEARCH_PROJECT_ECONOMICS,
      type ResearchProject,
      type ResearchProjectEconomics
} from '@/lib/constants/researchConstants';

function getProjectAndEconomics(projectId: string): {
      project: ResearchProject;
      economics: ResearchProjectEconomics;
} {
      const project = getResearchProject(projectId);

      if (!project) {
            throw new Error(`Research project not found: ${projectId}`);
      }

      const economics = RESEARCH_PROJECT_ECONOMICS[projectId];
      if (!economics) {
            throw new Error(`Research economics not configured: ${projectId}`);
      }

      return { project, economics };
}

/**
 * Calculate work required for a research activity.
 * Research economics are explicit balance constants; they are not recalculated
 * from the planning model that was used to derive the current values.
 */
export function calculateResearchWork(projectId: string): {
      totalWork: number;
      factors: WorkFactor[];
} {
      const { project, economics } = getProjectAndEconomics(projectId);

      const factors: WorkFactor[] = [
            { label: 'Research Project', value: project.title, isPrimary: true },
            { label: 'Work Amount', value: economics.workAmount, unit: 'work units' },
            { label: 'Research Complexity', value: `Level ${project.complexity}/10` },
            {
                  label: 'Research Type',
                  value: project.category.charAt(0).toUpperCase() + project.category.slice(1)
            }
      ];

      return { totalWork: economics.workAmount, factors };
}

/**
 * Calculate cost for research activity.
 */
export function calculateResearchCost(projectId: string): number {
      return getProjectAndEconomics(projectId).economics.moneyCost;
}

/**
 * Calculate estimated time to complete research.
 */
export function calculateResearchTimeEstimate(projectId: string): string {
      const weeks = getProjectAndEconomics(projectId).economics.estimatedWeeks;
      return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

/**
 * Get research project details with calculated work and cost.
 * Convenience function for UI.
 */
export function getResearchProjectWithCalculations(projectId: string): {
      project: ResearchProject;
      totalWork: number;
      totalCost: number;
      timeEstimate: string;
      workFactors: WorkFactor[];
} {
      const { project } = getProjectAndEconomics(projectId);
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
