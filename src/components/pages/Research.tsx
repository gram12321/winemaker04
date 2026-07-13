import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { achievementsFeature } from '@/lib/features/achievements';

export function ResearchPage() {
  return researchUpgradeFeature.ui.renderResearchPage({
    getAchievementTitle: achievementsFeature.catalog.getTitle,
  });
}
