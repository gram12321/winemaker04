import { describe, expect, it } from 'vitest';
import { resolveWineLogAchievementScore } from '@/lib/services/user/achievementScoreUtils';

describe('resolveWineLogAchievementScore', () => {
  it('uses the persisted wine score when present', () => {
    expect(
      resolveWineLogAchievementScore({
        wineScore: 0.91
      })
    ).toBe(0.91);
  });

  it('does not derive a score when persisted wine score is missing', () => {
    expect(
      resolveWineLogAchievementScore({
        wineScore: undefined
      })
    ).toBe(0);
  });

  it('ignores non-finite persisted wine scores', () => {
    expect(
      resolveWineLogAchievementScore({
        wineScore: Number.NaN
      })
    ).toBe(0);
  });
});
