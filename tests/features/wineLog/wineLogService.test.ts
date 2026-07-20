import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch } from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: vi.fn(() => 'company-1')
}));

const leaderboardMocks = vi.hoisted(() => ({ submitWineHighscores: vi.fn(), submitVineyardProductivityHighscore: vi.fn() }));
vi.mock('@/lib/features/leaderboards', () => ({
  leaderboardsFeature: { record: { wine: leaderboardMocks.submitWineHighscores, vineyard: leaderboardMocks.submitVineyardProductivityHighscore } }
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: vi.fn(() => ({
    week: 4,
    season: 'Fall',
    currentYear: 2026
  })),
  getCurrentCompany: vi.fn(() => ({
    id: 'company-1',
    name: 'Test Winery'
  }))
}));

vi.mock('@/lib/database', () => ({
  insertWineLogEntry: vi.fn(async () => ({ success: true })),
  loadWineLogByVineyard: vi.fn(async () => [])
}));

const { insertWineLogEntry } = await import('@/lib/database');
const { recordBottledWine } = await import('@/lib/features/wineLog/services/wineLogService');

const mockedInsertWineLogEntry = vi.mocked(insertWineLogEntry);
const mockedSubmitWineHighscores = leaderboardMocks.submitWineHighscores;

function bottledWine(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'Snapshot Vineyard',
    grape: 'Pinot Noir',
    quantity: 120,
    state: 'bottled',
    fermentationProgress: 100,
    landValueModifierHarvestSnapshot: 0.5,
    structureIndexHarvestSnapshot: 0.7,
    tasteQualityIndexHarvestSnapshot: 0.5,
    landValueModifier: 0.58,
    structureIndex: 0.21,
    tasteQualityIndex: 0.51,
    tasteQualityIndexBottlingSnapshot: 0.66,
    landValueModifierBottlingSnapshot: 0.59,
    structureIndexBottlingSnapshot: 0.84,
    wineScoreBottlingSnapshot: 0.75,
    characteristics: {
      acidity: 0.5,
      aroma: 0.5,
      body: 0.5,
      spice: 0.5,
      sweetness: 0.5,
      tannins: 0.5
    },
    estimatedPrice: 42,
    grapeColor: 'red',
    naturalYield: 0.5,
    fragile: 0.3,
    proneToOxidation: 0.3,
    features: [],
    wineAnchors: { ...NEUTRAL_WINE_ANCHORS },
    harvestStartDate: { week: 1, season: 'Fall', year: 2026 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2026 },
    bottledDate: { week: 8, season: 'Winter', year: 2026 },
    ...overrides
  };
}

describe('recordBottledWine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInsertWineLogEntry.mockResolvedValue({ success: true });
  });

  it('uses bottling snapshots for wine log data and highscore submissions', async () => {
    await recordBottledWine(bottledWine());

    expect(mockedInsertWineLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        taste_quality_index: 0.66,
        land_value_modifier: 0.59,
        structure_index: 0.84,
        wine_score: 0.75
      })
    );
    expect(mockedSubmitWineHighscores).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        companyName: 'Test Winery',
        gameWeek: 4,
        gameSeason: 'Fall',
        gameYear: 2026,
        tasteQualityIndex: 0.66,
        structureIndex: 0.84,
        wineScore: 0.75
      })
    );
  });
});
