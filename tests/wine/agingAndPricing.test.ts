import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch } from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';

const mocks = vi.hoisted(() => ({
  getGameState: vi.fn(() => ({ week: 1, season: 'Spring', currentYear: 2027 }))
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState
}));

function wineBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'Aging Vineyard',
    grape: 'Pinot Noir',
    quantity: 100,
    state: 'bottled',
    fermentationProgress: 100,
    landValueModifierHarvestSnapshot: 0.5,
    structureIndexHarvestSnapshot: 0.7,
    tasteQualityIndexHarvestSnapshot: 0.7,
    landValueModifier: 0.5,
    tasteQualityIndex: 0.7,
    structureIndex: 0.7,
    characteristics: {
      acidity: 0.55,
      aroma: 0.6,
      body: 0.55,
      spice: 0.45,
      sweetness: 0.35,
      tannins: 0.55
    },
    estimatedPrice: 20,
    grapeColor: 'red',
    naturalYield: 0.5,
    fragile: 0.3,
    proneToOxidation: 0.3,
    features: [],
    wineAnchors: { ...NEUTRAL_WINE_ANCHORS },
    harvestStartDate: { week: 1, season: 'Fall', year: 2025 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2025 },
    bottledDate: { week: 1, season: 'Winter', year: 2026 },
    agingProgress: 0,
    ...overrides
  };
}

describe('wine aging and pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGameState.mockReturnValue({ week: 1, season: 'Spring', currentYear: 2027 });
  });

  it('calculates wine age from harvest, bottle age from stored progress, and bottle-aging severity only for bottled wine', async () => {
    const {
      calculateAgingStatus,
      getBottleAgingSeverity,
      getWineAgeFromBottling,
      getWineAgeFromHarvest
    } = await import('@/lib/services/wine/features/agingService');

    const bottled = wineBatch({ agingProgress: 156 });
    const unbottled = wineBatch({ state: 'must_fermenting', bottledDate: undefined, agingProgress: 156 });

    expect(getWineAgeFromHarvest(bottled.harvestStartDate)).toBeGreaterThan(0);
    expect(getWineAgeFromBottling(bottled)).toBe(156);
    expect(getWineAgeFromBottling(unbottled)).toBe(0);

    const status = calculateAgingStatus(bottled);
    expect(status).toMatchObject({
      ageInWeeks: 156,
      ageInYears: 3,
      agingStage: 'Maturing'
    });
    expect(status.progressPercent).toBeGreaterThan(0);
    expect(getBottleAgingSeverity(bottled)).toBe(status.agingProgress);
    expect(getBottleAgingSeverity(unbottled)).toBe(0);
  });

  it('exposes the price contribution of land value, features, company prestige, and vineyard prestige', async () => {
    const {
      calculateEstimatedPriceBreakdown,
      calculateLandValuePriceMultiplier
    } = await import('@/lib/services/wine/winescore/wineScoreCalculation');

    const lowSite = wineBatch({ landValueModifier: 0.1 });
    const highSite = wineBatch({ landValueModifier: 0.9 });
    const oxidized = wineBatch({
      features: [
        {
          id: 'oxidation',
          name: 'Oxidation',
          icon: '',
          isPresent: true,
          severity: 1,
          risk: 1
        }
      ]
    });

    const lowBreakdown = calculateEstimatedPriceBreakdown(lowSite, undefined, 0, 0);
    const highBreakdown = calculateEstimatedPriceBreakdown(highSite, undefined, 0, 0);
    const oxidizedBreakdown = calculateEstimatedPriceBreakdown(oxidized, undefined, 0, 0);
    const prestigeBreakdown = calculateEstimatedPriceBreakdown(highSite, undefined, 500, 300);

    expect(calculateLandValuePriceMultiplier(highSite)).toBeGreaterThan(calculateLandValuePriceMultiplier(lowSite));
    expect(highBreakdown.finalPrice).toBeGreaterThan(lowBreakdown.finalPrice);
    expect(oxidizedBreakdown.featurePriceMultiplier).toBeLessThan(1);
    expect(oxidizedBreakdown.finalPrice).toBeLessThan(calculateEstimatedPriceBreakdown(wineBatch(), undefined, 0, 0).finalPrice);
    expect(prestigeBreakdown.companyPrestigeMultiplier).toBeGreaterThan(1);
    expect(prestigeBreakdown.vineyardPrestigeMultiplier).toBeGreaterThan(1);
    expect(prestigeBreakdown.finalPrice).toBeGreaterThan(highBreakdown.finalPrice);
  });
});
