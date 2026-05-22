import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUnlockedResearchIds: vi.fn(async (): Promise<string[]> => []),
  getCurrentCompanyId: vi.fn(() => 'company-1')
}));

vi.mock('@/lib/database/core/researchUnlocksDB', () => ({
  getUnlockedResearchIds: mocks.getUnlockedResearchIds
}));

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId
}));

describe('research permanent effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentCompanyId.mockReturnValue('company-1');
    mocks.getUnlockedResearchIds.mockResolvedValue([]);
  });

  it('returns neutral multipliers when no completed research has permanent effects', async () => {
    const { getResearchPermanentEffects } = await import('@/lib/services/research/researchPermanentEffectsService');

    await expect(getResearchPermanentEffects()).resolves.toEqual({
      vineyardHealthDecayMultiplier: 1,
      activeEffects: []
    });
    expect(mocks.getUnlockedResearchIds).toHaveBeenCalledWith('company-1');
  });

  it('aggregates completed permanent effects from research unlocks', async () => {
    mocks.getUnlockedResearchIds.mockResolvedValue(['tech_vineyard_health_monitoring']);
    const { getResearchPermanentEffects } = await import('@/lib/services/research/researchPermanentEffectsService');

    const summary = await getResearchPermanentEffects('company-2');

    expect(summary.vineyardHealthDecayMultiplier).toBeCloseTo(0.8);
    expect(summary.activeEffects).toEqual([
      expect.objectContaining({
        projectId: 'tech_vineyard_health_monitoring',
        projectTitle: 'Vineyard Health Monitoring System',
        kind: 'vineyard_health_decay_multiplier'
      })
    ]);
    expect(mocks.getUnlockedResearchIds).toHaveBeenCalledWith('company-2');
  });
});
