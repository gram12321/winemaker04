import { type ResearchProject } from '@/lib/constants/researchConstants';
import { getAllAchievementUnlocks } from '@/lib/database/core/achievementsDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { getMaxBuyerLoyaltyLevel, type BuyerLoyaltyLevel } from '@/lib/services';
import { formatNumber } from '@/lib/utils/utils';

export interface ResearchEligibilityContext {
  currentPrestige: number;
  completedResearch: Set<string>;
  companyValue: number;
  maxBuyerLoyaltyLevel: BuyerLoyaltyLevel;
  unlockedAchievementIds: Set<string>;
}

// Shared eligibility data used by both the research panel and the start workflow.
// researchManager.ts remains the enforcement point; this helper only assembles and evaluates requirements.
export async function loadResearchEligibilityContext(
  currentPrestige: number,
  completedResearch: Set<string>,
  companyId?: string
): Promise<ResearchEligibilityContext> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  const [companyValue, maxBuyerLoyaltyLevel, unlocks] = await Promise.all([
    calculateCompanyValue(),
    getMaxBuyerLoyaltyLevel(),
    getAllAchievementUnlocks(targetCompanyId),
  ]);

  return {
    currentPrestige,
    completedResearch,
    companyValue,
    maxBuyerLoyaltyLevel,
    unlockedAchievementIds: new Set(unlocks.map(unlock => unlock.achievementId)),
  };
}

export function getResearchRequirementReasons(project: ResearchProject, context: ResearchEligibilityContext): string[] {
  const reasons: string[] = [];

  if (project.requiredPrestige !== undefined && context.currentPrestige < project.requiredPrestige) {
    reasons.push(`Requires ${project.requiredPrestige} prestige (you have ${Math.floor(context.currentPrestige)})`);
  }

  if (project.prerequisites?.length) {
    const missing = project.prerequisites.filter(id => !context.completedResearch.has(id));
    if (missing.length > 0) {
      reasons.push(`Complete prerequisite research: ${missing.join(', ')}`);
    }
  }

  if (project.requiredCompanyValue !== undefined && context.companyValue < project.requiredCompanyValue) {
    reasons.push(`Requires company value ${formatNumber(Math.floor(project.requiredCompanyValue), { currency: true, decimals: 0 })} (you have ${formatNumber(Math.floor(context.companyValue), { currency: true, decimals: 0 })})`);
  }

  if (project.requiredBuyerLoyaltyLevel !== undefined && context.maxBuyerLoyaltyLevel < project.requiredBuyerLoyaltyLevel) {
    reasons.push(`Requires buyer loyalty level ${project.requiredBuyerLoyaltyLevel} (your best level is ${context.maxBuyerLoyaltyLevel})`);
  }

  if (project.requiredAchievementIds?.length) {
    const missingAchievements = project.requiredAchievementIds.filter(id => !context.unlockedAchievementIds.has(id));
    if (missingAchievements.length > 0) {
      reasons.push(`Requires achievements: ${missingAchievements.join(', ')}`);
    }
  }

  return reasons;
}

export function isResearchProjectEligible(project: ResearchProject, context: ResearchEligibilityContext): boolean {
  return getResearchRequirementReasons(project, context).length === 0;
}
