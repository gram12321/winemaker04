import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsertCompanyAggregateHighscore: vi.fn(async () => ({ success: true })),
  upsertHighscore: vi.fn(async () => ({ success: true })),
  loadHighscores: vi.fn(async () => []),
  loadCompanyLeaderboardContext: vi.fn(async () => null as {
    position: number;
    total: number;
    startIndex: number;
    entries: [];
  } | null),
  deleteHighscores: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/database', () => mocks);

describe('leaderboardsFeature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes separate recording, views, maintenance, and UI capabilities', async () => {
    const { leaderboardsFeature } = await import('@/lib/features/leaderboards');
    expect(Object.keys(leaderboardsFeature).sort()).toEqual(['maintenance', 'record', 'ui', 'views']);
  });

  it('records company aggregates atomically through an explicit company input', async () => {
    const { leaderboardsFeature } = await import('@/lib/features/leaderboards');

    await leaderboardsFeature.record.company({
      companyId: 'company-a',
      companyName: 'Estate A',
      gameWeek: 1,
      gameSeason: 'Spring',
      gameYear: 2026,
      foundedYear: 2024,
      companyValue: 250_000,
    });

    expect(mocks.upsertCompanyAggregateHighscore).toHaveBeenCalledWith(expect.objectContaining({
      company_id: 'company-a',
      score_type: 'company_value',
    }));
    expect(mocks.upsertCompanyAggregateHighscore).toHaveBeenCalledWith(expect.objectContaining({
      company_id: 'company-a',
      score_type: 'company_value_per_week',
    }));
    expect(mocks.upsertHighscore).not.toHaveBeenCalled();
  });

  it('records wine entries through one explicit input object', async () => {
    const { leaderboardsFeature } = await import('@/lib/features/leaderboards');

    await leaderboardsFeature.record.wine({
      companyId: 'company-a',
      companyName: 'Estate A',
      gameWeek: 3,
      gameSeason: 'Summer',
      gameYear: 2026,
      vineyardId: 'vineyard-a',
      vineyardName: 'North Slope',
      vintage: 2026,
      grape: 'Pinot Noir',
      quantity: 500,
      tasteQualityIndex: 0.75,
      structureIndex: 0.8,
      wineScore: 0.775,
      price: 42,
    });

    expect(mocks.upsertHighscore).toHaveBeenCalledTimes(6);
    expect(mocks.upsertHighscore).toHaveBeenCalledWith(expect.objectContaining({
      company_id: 'company-a',
      score_type: 'lowest_price',
      score_value: 42,
    }));
  });

  it('ranks lowest-price entries by lower values and uses the selected best company entry', async () => {
    mocks.loadCompanyLeaderboardContext.mockResolvedValue({
      position: 3,
      total: 8,
      startIndex: 1,
      entries: [],
    });
    const { leaderboardsFeature } = await import('@/lib/features/leaderboards');

    await expect(leaderboardsFeature.views.context('company-a', 'lowest_price', 1)).resolves.toMatchObject({
      position: 3,
      total: 8,
    });
    expect(mocks.loadCompanyLeaderboardContext).toHaveBeenCalledWith('company-a', 'lowest_price', 1);
  });
});
