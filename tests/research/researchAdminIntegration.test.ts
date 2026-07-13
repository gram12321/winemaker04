import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteResearchUnlocksByIds: vi.fn(),
  getAllResearchUnlocks: vi.fn(),
  unlockResearch: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  GAME_INITIALIZATION: {
    STARTING_WEEK: 1,
    STARTING_SEASON: 'Spring',
    STARTING_YEAR: 2024,
  },
}));

vi.mock('@/lib/constants/researchConstants', () => ({
  RESEARCH_PROJECTS: [
    { id: 'research-a', unlocks: [{ type: 'grape', value: 'Chardonnay' }] },
    { id: 'research-b', unlocks: [] },
  ],
}));

vi.mock('@/lib/database/core/researchUnlocksDB', () => mocks);
vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: () => ({ week: 3, season: 'Summer', currentYear: 2028 }),
}));
vi.mock('@/lib/utils', () => ({ calculateAbsoluteWeeks: () => 999 }));
vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: () => 'company-1' }));

describe('Research Admin integration', () => {
  it('grants only missing projects through Research-owned persistence', async () => {
    mocks.getAllResearchUnlocks.mockResolvedValue([{ id: 'unlock-a', researchId: 'research-a' }]);
    mocks.unlockResearch.mockResolvedValue({});
    const { researchUpgradeAdminIntegration } = await import('@/lib/features/researchUpgrade/adminIntegration');

    await expect(researchUpgradeAdminIntegration.grantAllResearch()).resolves.toEqual({
      success: true,
      unlocked: 1,
      alreadyUnlocked: 1,
    });
    expect(mocks.unlockResearch).toHaveBeenCalledWith(expect.objectContaining({
      researchId: 'research-b',
      companyId: 'company-1',
      unlockedAtTimestamp: 999,
    }));
  });

  it('removes the active company unlocks through the database module', async () => {
    mocks.getAllResearchUnlocks.mockResolvedValue([
      { id: 'unlock-a', researchId: 'research-a' },
      { id: 'unlock-b', researchId: 'research-b' },
    ]);
    mocks.deleteResearchUnlocksByIds.mockResolvedValue(undefined);
    const { researchUpgradeAdminIntegration } = await import('@/lib/features/researchUpgrade/adminIntegration');

    await expect(researchUpgradeAdminIntegration.removeAllResearch()).resolves.toEqual({ success: true, removed: 2 });
    expect(mocks.deleteResearchUnlocksByIds).toHaveBeenCalledWith(['unlock-a', 'unlock-b']);
  });
});
