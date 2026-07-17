import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const result = { data: [{ score_value: 12 }], error: null };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  return {
    from: vi.fn(() => query),
    rpc: vi.fn(async (name: string) => name === 'get_company_leaderboard_context'
      ? {
          data: {
            position: 2,
            total: 3,
            startIndex: 0,
            entries: [{
              id: 'score-a',
              company_id: 'company-a',
              company_name: 'Estate A',
              score_type: 'lowest_price',
              score_value: 12,
              achieved_at: '2026-07-17T12:00:00.000Z',
              created_at: '2026-07-17T12:00:00.000Z',
            }],
          },
          error: null,
        }
      : { data: { success: true }, error: null }),
    query,
  };
});

vi.mock('@/lib/database/core/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));

import { loadCompanyLeaderboardContext, upsertCompanyAggregateHighscore } from '@/lib/database/core/highscoresDB';

describe('highscores database adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the one-company ranking projection from the database RPC', async () => {
    await expect(loadCompanyLeaderboardContext('company-a', 'lowest_price', 1)).resolves.toMatchObject({
      position: 2,
      total: 3,
      entries: [{ id: 'score-a', scoreValue: 12 }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith('get_company_leaderboard_context', {
      p_company_id: 'company-a',
      p_score_type: 'lowest_price',
      p_window: 1,
    });
  });

  it('uses the database RPC for atomic aggregate company score writes', async () => {
    await expect(upsertCompanyAggregateHighscore({
      company_id: 'company-a',
      company_name: 'Estate A',
      score_type: 'company_value',
      score_value: 250_000,
      achieved_at: '2026-07-17T12:00:00.000Z',
    })).resolves.toEqual({ success: true });

    expect(mocks.rpc).toHaveBeenCalledWith('upsert_company_aggregate_highscore', expect.objectContaining({
      p_company_id: 'company-a',
      p_score_type: 'company_value',
      p_score_value: 250_000,
    }));
  });
});
