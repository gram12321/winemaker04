import { describe, expect, it } from 'vitest';
import { filterAchievementSeriesForDisplay } from '../../../src/lib/features/achievements/achievementPresentationService';
import { ALL_ACHIEVEMENTS } from '../../../src/lib/features/achievements/achievementDefinitions';
import type { AchievementWithStatus } from '../../../src/lib/types/types';

function achievement(id: string, isUnlocked: boolean): AchievementWithStatus {
  return {
    id,
    name: id,
    description: id,
    icon: '🏆',
    category: 'production',
    achievementLevel: 1,
    condition: { type: 'production_count', threshold: 1 },
    isUnlocked,
  };
}

describe('achievement presentation', () => {
  it('does not expose grape-tenure tiers until grape-change history is persisted', () => {
    expect(ALL_ACHIEVEMENTS.some((entry) => entry.id.startsWith('vineyard_time_tier_'))).toBe(false);
  });

  it('shows unlocked tiers and the next tier in each series alongside individual achievements', () => {
    const displayed = filterAchievementSeriesForDisplay([
      achievement('wine_score_tier_3', false),
      achievement('independent_milestone', false),
      achievement('wine_score_tier_1', true),
      achievement('wine_score_tier_2', false),
    ]);

    expect(displayed.map((entry) => entry.id)).toEqual([
      'wine_score_tier_1',
      'wine_score_tier_2',
      'independent_milestone',
    ]);
  });
});
