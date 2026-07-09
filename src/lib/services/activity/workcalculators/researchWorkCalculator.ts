import { type WorkFactor } from './workCalculator';
import {
      getResearchProject,
      RESEARCH_PROJECT_ECONOMICS,
      type ResearchProject,
      type ResearchProjectEconomics
} from '@/lib/constants/researchConstants';

const DEFAULT_CATEGORY_MODIFIERS: Record<ResearchProject['category'], number> = {
      administration: -0.04,
      projects: -0.08,
      technology: 0.16,
      agriculture: 0.04,
      efficiency: 0.12,
      marketing: 0.02,
      staff: 0.06
};

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
 * Research economics are readable base anchors. The live workload is enriched
 * by the research profile so complexity, scope, and curve settings all matter.
 */
export function calculateResearchWork(projectId: string, options?: { workMultiplier?: number }): {
      totalWork: number;
      factors: WorkFactor[];
} {
      const { project, economics } = getProjectAndEconomics(projectId);
      const workMultiplier = options?.workMultiplier ?? 1;
      const normalizedMultiplier = Number.isFinite(workMultiplier) ? Math.max(0.5, workMultiplier) : 1;
      const profileScale = calculateResearchWorkProfileScale(project);
      const setupWork = calculateResearchSetupWork(project);
      const profileAdjustedWork = roundResearchWork(economics.workAmount * profileScale + setupWork);
      const adjustedWork = roundResearchWork(profileAdjustedWork * normalizedMultiplier);

      const factors: WorkFactor[] = [
            { label: 'Research Project', value: project.title, isPrimary: true },
            { label: 'Base Work Anchor', value: economics.workAmount, unit: 'work units' },
            { label: 'Research Complexity', value: `Level ${project.complexity}/10` },
            { label: 'Profile Scaling', value: `${profileScale.toFixed(2)}x` },
            { label: 'Profile Work Amount', value: profileAdjustedWork, unit: 'work units' },
            {
                  label: 'Research Type',
                  value: project.category.charAt(0).toUpperCase() + project.category.slice(1)
            }
      ];

      if (normalizedMultiplier !== 1) {
            factors.push({
                  label: 'Administrative Overhead',
                  value: `${Math.round((1 - normalizedMultiplier) * 100)}% less work`
            });
      }

      return { totalWork: adjustedWork, factors };
}

/**
 * Calculate cost for research activity.
 */
export function calculateResearchCost(projectId: string): number {
      const { project, economics } = getProjectAndEconomics(projectId);
      return roundResearchCost(economics.moneyCost * calculateResearchCostProfileScale(project));
}

/**
 * Get research project details with calculated work and cost.
 * Convenience function for UI.
 */
export function getResearchProjectWithCalculations(projectId: string): {
      project: ResearchProject;
      totalWork: number;
      totalCost: number;
      workFactors: WorkFactor[];
} {
      const { project } = getProjectAndEconomics(projectId);
      const { totalWork, factors } = calculateResearchWork(projectId);
      const totalCost = calculateResearchCost(projectId);

      return {
            project,
            totalWork,
            totalCost,
            workFactors: factors
      };
}

function calculateResearchWorkProfileScale(project: ResearchProject): number {
      const complexity = Math.max(1, project.complexity);
      const complexityScale = Math.pow(complexity, 1.5) / 2.75;
      const categoryScale = Math.max(0.65, 1 + resolveCategoryModifier(project));
      const curveScale = resolveCurveScale(project);
      const scope = resolveResearchScope(project);
      const scopeScale = scope > 0
            ? 1 + (Math.log10(Math.max(1, scope) / 100) * 0.1)
            : 1;

      return Math.max(0.75, complexityScale * curveScale * categoryScale * scopeScale);
}

function calculateResearchCostProfileScale(project: ResearchProject): number {
      const profile = project.workProfile;
      const scope = resolveResearchScope(project);
      const curve = profile?.complexityCurve;
      const curvePremium = curve?.kind === 'linear'
            ? curve.multiplier * 0.2
            : curve?.kind === 'exponential'
            ? Math.max(0, curve.base - 1) * 0.5
            : 0;
      const complexityPremium = (project.complexity - 5) * 0.04;
      const categoryPremium = resolveCategoryModifier(project) * 0.35;
      const scopePremium = scope > 0
            ? Math.log10(Math.max(1, scope) / 100) * 0.04
            : 0;

      return Math.max(
            0.65,
            Math.min(1.75, 1 + complexityPremium + categoryPremium + curvePremium + scopePremium)
      );
}

function calculateResearchSetupWork(project: ResearchProject): number {
      const extraInitialWork = project.workProfile?.extraInitialWork ?? project.initialWork ?? 0;
      return extraInitialWork * (1 + (project.complexity / 10));
}

function resolveCategoryModifier(project: ResearchProject): number {
      return project.workProfile?.categoryModifier ?? DEFAULT_CATEGORY_MODIFIERS[project.category] ?? 0;
}

function resolveCurveScale(project: ResearchProject): number {
      const curve = project.workProfile?.complexityCurve;

      if (!curve) {
            return 1;
      }

      if (curve.kind === 'linear') {
            return 1 + curve.multiplier;
      }

      return 1 + Math.max(0, curve.base - 1);
}

function resolveResearchScope(project: ResearchProject): number {
      const profile = project.workProfile;
      return profile?.scopeWorkAmount
            ?? (profile?.scopeWorkAmountPerComplexity !== undefined
                  ? profile.scopeWorkAmountPerComplexity * project.complexity
                  : 0);
}

function roundResearchWork(value: number): number {
      const step = value < 500
            ? 1
            : value < 2000
            ? 5
            : value < 10000
            ? 10
            : 50;

      return Math.max(1, Math.round(value / step) * step);
}

function roundResearchCost(value: number): number {
      const step = value < 10000
            ? 100
            : value < 50000
            ? 500
            : value < 250000
            ? 1000
            : 5000;

      return Math.max(0, Math.round(value / step) * step);
}
