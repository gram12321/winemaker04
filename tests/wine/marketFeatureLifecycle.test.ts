import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch } from '@/lib/types/types';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { initializeBatchFeatures, processEventTrigger, simulateMarketFeatureLifecycle } from '@/lib/services/wine/features/featureService';

const mocks = vi.hoisted(() => ({
  addMessage: vi.fn(async () => undefined),
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: {
    addMessage: mocks.addMessage,
  },
}));

function makeMarketBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'market-preview',
    vineyardId: 'market_purchase',
    vineyardName: 'Market Supplier',
    grape: 'Pinot Noir',
    quantity: 500,
    state: 'must_fermenting',
    fermentationProgress: 40,
    fermentationOptions: { method: 'Extended Maceration', temperature: 'Warm' },
    landValueModifierHarvestSnapshot: 0.6,
    structureIndexHarvestSnapshot: 0.6,
    tasteQualityIndexHarvestSnapshot: 0.6,
    landValueModifier: 0.6,
    structureIndex: 0.6,
    tasteQualityIndex: 0.6,
    characteristics: { acidity: 0.6, aroma: 0.6, body: 0.6, spice: 0.5, sweetness: 0.5, tannins: 0.6 },
    estimatedPrice: 0,
    grapeColor: 'red',
    naturalYield: 0.7,
    fragile: 0.5,
    proneToOxidation: 0.6,
    features: initializeBatchFeatures(),
    wineAnchors: resolveWineAnchors(undefined),
    harvestStartDate: { week: 1, season: 'Fall', year: 2026 },
    harvestEndDate: { week: 1, season: 'Fall', year: 2026 },
    ...overrides,
  };
}

describe('market feature lifecycle simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds meaningful terroir development and oxidation risk for a fermenting offer', () => {
    const simulated = simulateMarketFeatureLifecycle(makeMarketBatch(), 3);

    expect(simulated.features.find((feature) => feature.id === 'terroir')?.severity).toBeGreaterThan(0.07);
    expect(simulated.features.find((feature) => feature.id === 'oxidation')?.risk).toBeGreaterThan(0);
  });

  it('uses direct process options when calculating processing-event risks', async () => {
    const batch = makeMarketBatch({ state: 'must_ready', fermentationOptions: undefined });
    const processed = await processEventTrigger(batch, 'crushing', {
      options: { method: 'Mechanical Press', destemming: false, coldSoak: false, pressingIntensity: 0.6 },
      batch,
    }, { suppressSideEffects: true });

    expect(processed.features.find((feature) => feature.id === 'green_flavor')?.risk).toBeGreaterThan(0);
  });

  it('keeps market-triggered manifestations silent while preserving the feature result', async () => {
    const batch = makeMarketBatch({
      state: 'must_ready',
      fermentationOptions: undefined,
      features: initializeBatchFeatures().map((feature) => feature.id === 'green_flavor'
        ? { ...feature, risk: 0.99 }
        : feature),
    });

    const processed = await processEventTrigger(
      batch,
      'crushing',
      {
        options: { method: 'Mechanical Press', destemming: false, coldSoak: false, pressingIntensity: 0.6 },
        batch,
      },
      { suppressSideEffects: true }
    );

    expect(processed.features.find((feature) => feature.id === 'green_flavor')?.isPresent).toBe(true);
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });
});
