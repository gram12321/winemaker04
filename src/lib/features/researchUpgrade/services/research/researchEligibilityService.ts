import { type ResearchProject } from '@/lib/features/researchUpgrade/constants/researchCatalog';
import { GAME_INITIALIZATION } from '@/lib/constants/constants';
import { achievementsFeature } from '@/lib/features/achievements';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { getGameState } from '@/lib/services/core/gameState';
import { type BuyerLoyaltyLevel } from '@/lib/services/sales/grapeBuyerLoyaltyService';
import { getMaxBuyerLoyaltyLevel } from '@/lib/services/sales/grapeBuyerLoyaltyService';
import { calculateAbsoluteWeeks } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/utils';

export interface ResearchEligibilityContext {
  currentPrestige: number;
  completedResearch: Set<string>;
  companyValue: number;
  companyAgeWeeks: number;
  maxBuyerLoyaltyLevel: BuyerLoyaltyLevel;
  unlockedAchievementIds: Set<string>;
}

export async function loadResearchEligibilityContext(
  currentPrestige: number,
  completedResearch: Set<string>
): Promise<ResearchEligibilityContext> {
  const [companyValue, maxBuyerLoyaltyLevel, unlockedAchievementIds] = await Promise.all([
    calculateCompanyValue(),
    getMaxBuyerLoyaltyLevel(),
    achievementsFeature.progression.getUnlockedIds(),
  ]);

  const gameState = getGameState();
  const currentAbsoluteWeeks = calculateAbsoluteWeeks(
    gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
    (gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON) as never,
    gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR
  );
  const initialAbsoluteWeeks = calculateAbsoluteWeeks(
    GAME_INITIALIZATION.STARTING_WEEK,
    GAME_INITIALIZATION.STARTING_SEASON,
    GAME_INITIALIZATION.STARTING_YEAR
  );
  const companyAgeWeeks = Math.max(0, currentAbsoluteWeeks - initialAbsoluteWeeks);
  return {
    currentPrestige,
    completedResearch,
    companyValue,
    companyAgeWeeks,
    maxBuyerLoyaltyLevel,
    unlockedAchievementIds,
  };
}

export function getResearchRequirementReasons(project: ResearchProject, context: ResearchEligibilityContext): string[] {
  const reasons: string[] = [];

  if (project.requiredPrestige !== undefined && context.currentPrestige < project.requiredPrestige) {
    reasons.push(`Requires ${project.requiredPrestige} prestige (you have ${Math.floor(context.currentPrestige)})`);
  }

  if (project.prerequisites?.length) {
    const missing = project.prerequisites.filter((id) => !context.completedResearch.has(id));
    if (missing.length > 0) {
      reasons.push(`Complete prerequisite research: ${missing.join(', ')}`);
    }
  }

  if (project.requiredCompanyValue !== undefined && context.companyValue < project.requiredCompanyValue) {
    reasons.push(
      `Requires company value ${formatNumber(Math.floor(project.requiredCompanyValue), { currency: true, decimals: 0 })} (you have ${formatNumber(Math.floor(context.companyValue), { currency: true, decimals: 0 })})`
    );
  }

  if (project.requiredCompanyAgeWeeks !== undefined && context.companyAgeWeeks < project.requiredCompanyAgeWeeks) {
    reasons.push(`Requires company age ${project.requiredCompanyAgeWeeks} weeks (you have ${Math.floor(context.companyAgeWeeks)})`);
  }

  if (project.requiredBuyerLoyaltyLevel !== undefined && context.maxBuyerLoyaltyLevel < project.requiredBuyerLoyaltyLevel) {
    reasons.push(`Requires buyer loyalty level ${project.requiredBuyerLoyaltyLevel} (your best level is ${context.maxBuyerLoyaltyLevel})`);
  }

  if (project.requiredAchievementIds?.length) {
    const missingAchievements = project.requiredAchievementIds.filter((id) => !context.unlockedAchievementIds.has(id));
    if (missingAchievements.length > 0) {
      reasons.push(`Requires achievements: ${missingAchievements.join(', ')}`);
    }
  }

  return reasons;
}

export function isResearchProjectEligible(project: ResearchProject, context: ResearchEligibilityContext): boolean {
  return getResearchRequirementReasons(project, context).length === 0;
}
