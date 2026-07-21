import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const contains = vi.fn();
  const limit = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();

  return { insert, contains, limit, eq, select, from };
});

vi.mock('@/lib/database/core/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: () => 'company-1',
}));

import { insertPrestigeEventIfAbsentBySource } from '@/lib/features/prestige/database/prestigeEventsDB';

describe('prestige event persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select, insert: mocks.insert });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ eq: mocks.eq, limit: mocks.limit, contains: mocks.contains });
    mocks.contains.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('inserts a missing source-keyed event without an invalid ON CONFLICT target', async () => {
    await expect(insertPrestigeEventIfAbsentBySource({
      id: 'event-1',
      type: 'achievement',
      amount_base: 1,
      created_game_week: 1,
      decay_rate: 0,
      source_id: 'achievement:first_sale',
      payload: { event: 'achievement_unlock', achievementId: 'first_sale' },
    }, 'company-1')).resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({ company_id: 'company-1' })]);
  });

  it('uses the supplied company instead of resolving the active company', async () => {
    await insertPrestigeEventIfAbsentBySource({
      id: 'event-2',
      type: 'achievement',
      amount_base: 1,
      created_game_week: 1,
      decay_rate: 0,
      source_id: 'achievement:second_sale',
      payload: { event: 'achievement_unlock', achievementId: 'second_sale' },
    }, 'company-2');

    expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({ company_id: 'company-2' })]);
  });
});
