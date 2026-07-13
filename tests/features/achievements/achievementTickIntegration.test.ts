import { beforeEach, describe, expect, it, vi } from 'vitest';
import { achievementsFeature } from '@/lib/features/achievements';
import { resetAchievementTickScheduleForTests } from '@/lib/features/achievements/achievementTickService';

const mocks = vi.hoisted(() => ({
  companyId: 'company-a',
  checkAllAchievements: vi.fn(async (): Promise<unknown> => []),
  getGameState: vi.fn(() => ({ week: 1, season: 'Spring', currentYear: 2026 })),
}));

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: vi.fn(() => mocks.companyId),
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
}));

vi.mock('@/lib/features/achievements/achievementService', () => ({
  checkAllAchievements: mocks.checkAllAchievements,
}));

describe('achievement tick integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAchievementTickScheduleForTests();
    mocks.companyId = 'company-a';
    mocks.checkAllAchievements.mockResolvedValue([]);
  });

  it('retries the same company and week after an evaluation failure', async () => {
    mocks.checkAllAchievements.mockRejectedValueOnce(new Error('temporary failure'));

    await expect(achievementsFeature.ticks.checkAfterWeekAdvance()).rejects.toThrow('temporary failure');
    await achievementsFeature.ticks.checkAfterWeekAdvance();

    expect(mocks.checkAllAchievements).toHaveBeenCalledTimes(2);
    expect(mocks.checkAllAchievements).toHaveBeenLastCalledWith(
      'company-a',
      expect.objectContaining({ week: 1, currentYear: 2026 })
    );
  });

  it('prevents overlapping checks while keeping schedules independent by company', async () => {
    let releaseFirstCheck!: () => void;
    mocks.checkAllAchievements.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseFirstCheck = resolve;
    }));

    const firstCheck = achievementsFeature.ticks.checkAfterWeekAdvance();
    await achievementsFeature.ticks.checkAfterWeekAdvance();
    expect(mocks.checkAllAchievements).toHaveBeenCalledTimes(1);

    releaseFirstCheck();
    await firstCheck;

    mocks.companyId = 'company-b';
    await achievementsFeature.ticks.checkAfterWeekAdvance();
    expect(mocks.checkAllAchievements).toHaveBeenCalledTimes(2);
    expect(mocks.checkAllAchievements).toHaveBeenLastCalledWith(
      'company-b',
      expect.objectContaining({ week: 1, currentYear: 2026 })
    );
  });
});
