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

import { getResearchPermanentEffects } from '@/lib/services/research/researchPermanentEffectsService';

describe('research permanent effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentCompanyId.mockReturnValue('company-1');
    mocks.getUnlockedResearchIds.mockResolvedValue([]);
  });

  it('returns neutral multipliers when no completed research has permanent effects', async () => {
    await expect(getResearchPermanentEffects()).resolves.toEqual({
      vineyardHealthDecayMultiplier: 1,
      researchSkillMultiplier: 1,
      administrationAndResearchWorkMultiplier: 1,
      activeEffects: []
    });
    expect(mocks.getUnlockedResearchIds).toHaveBeenCalledWith('company-1');
  });

  it('aggregates completed permanent effects from research unlocks', async () => {
    mocks.getUnlockedResearchIds.mockResolvedValue(['tech_vineyard_health_monitoring']);

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

  it('compounds completed research-speed effects into a staff skill multiplier', async () => {
    mocks.getUnlockedResearchIds.mockResolvedValue(['admin_research_methodology', 'admin_research_office']);

    const summary = await getResearchPermanentEffects('company-2');

    expect(summary.researchSkillMultiplier).toBeCloseTo(1.232);
    expect(summary.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        projectId: 'admin_research_methodology',
        kind: 'research_skill_multiplier'
      }),
      expect.objectContaining({
        projectId: 'admin_research_office',
        kind: 'research_skill_multiplier'
      })
    ]));
  });

  it('applies admin overhead work reduction from basic administration', async () => {
    mocks.getUnlockedResearchIds.mockResolvedValue(['admin_basic']);

    const summary = await getResearchPermanentEffects('company-2');

    expect(summary.administrationAndResearchWorkMultiplier).toBeCloseTo(0.88);
    expect(summary.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        projectId: 'admin_basic',
        kind: 'administration_and_research_work_multiplier'
      })
    ]));
  });
});
