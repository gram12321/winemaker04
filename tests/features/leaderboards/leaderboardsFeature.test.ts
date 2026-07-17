import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getExistingScore: vi.fn(async () => null), upsertHighscore: vi.fn(async () => ({ success: true })),
  loadHighscores: vi.fn(async () => []), getCompanyScore: vi.fn(async () => null), countHigherScores: vi.fn(async () => 0),
  countTotalScores: vi.fn(async () => 0), deleteHighscores: vi.fn(async () => ({ success: true })), loadHighscoresRange: vi.fn(async () => []),
}));
vi.mock('@/lib/database', () => mocks);
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: vi.fn(async () => undefined) } }));

describe('leaderboardsFeature', () => {
  it('exposes separate recording, views, maintenance, and UI capabilities', async () => {
    const { leaderboardsFeature } = await import('@/lib/features/leaderboards');
    expect(Object.keys(leaderboardsFeature).sort()).toEqual(['maintenance', 'record', 'ui', 'views']);
  });

  it('records company aggregates through the facade with an explicit company identity', async () => {
    const { leaderboardsFeature } = await import('@/lib/features/leaderboards');
    await leaderboardsFeature.record.company({ companyId: 'company-a', companyName: 'Estate A', gameWeek: 1, gameSeason: 'Spring', gameYear: 2026, foundedYear: 2024, companyValue: 250000 });
    expect(mocks.upsertHighscore).toHaveBeenCalledWith(expect.objectContaining({ company_id: 'company-a', score_type: 'company_value' }));
    expect(mocks.upsertHighscore).toHaveBeenCalledWith(expect.objectContaining({ company_id: 'company-a', score_type: 'company_value_per_week' }));
  });
});
