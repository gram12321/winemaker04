import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrestigeEvent, Vineyard, WineBatch } from '@/lib/types/types';
import type { FeatureConfig } from '@/lib/types/wineFeatures';

const mocks = vi.hoisted(() => {
  let events: PrestigeEvent[] = [];
  let vineyards: Vineyard[] = [];

  return {
    setEvents: (next: PrestigeEvent[]) => {
      events = next;
    },
    setVineyards: (next: Vineyard[]) => {
      vineyards = next;
    },
    listPrestigeEventsForUI: vi.fn(async () => events),
    listPrestigeEvents: vi.fn(async () => []),
    upsertPrestigeEventBySource: vi.fn(async () => undefined),
    insertPrestigeEvent: vi.fn(async () => undefined),
    loadVineyards: vi.fn(async () => vineyards),
    saveVineyard: vi.fn(async (vineyard: Vineyard) => {
      vineyards = vineyards.map(candidate => candidate.id === vineyard.id ? vineyard : candidate);
      return true;
    }),
    getGameState: vi.fn(() => ({ week: 1, season: 'Spring', currentYear: 2026 })),
    calculateCompanyValue: vi.fn(async () => 0),
    triggerGameUpdate: vi.fn(() => undefined)
  };
});

vi.mock('@/lib/database/customers/prestigeEventsDB', () => ({
  listPrestigeEventsForUI: mocks.listPrestigeEventsForUI,
  listPrestigeEvents: mocks.listPrestigeEvents,
  upsertPrestigeEventBySource: mocks.upsertPrestigeEventBySource,
  insertPrestigeEvent: mocks.insertPrestigeEvent
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards,
  saveVineyard: mocks.saveVineyard
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState
}));

vi.mock('@/lib/services/finance/financeService', () => ({
  calculateCompanyValue: mocks.calculateCompanyValue
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate
}));

vi.mock('@/lib/services/wine/winescore/landValueModifierCalculation', () => ({
  getMaxLandValue: () => 1000000
}));

vi.mock('@/lib/services/wine/winescore/wineScoreCalculation', () => ({
  getTasteQualityIndex: vi.fn(() => 0.7)
}));

function prestigeEvent(overrides: Partial<PrestigeEvent>): PrestigeEvent {
  return {
    id: overrides.id ?? 'event-1',
    type: overrides.type ?? 'sale',
    amount: overrides.amount ?? 0,
    timestamp: overrides.timestamp ?? 1,
    decayRate: overrides.decayRate ?? 0,
    sourceId: overrides.sourceId,
    metadata: overrides.metadata,
    ...overrides
  } as PrestigeEvent;
}

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'vineyard-1',
    name: 'Prestige Vineyard',
    country: 'France',
    region: 'Bourgogne',
    hectares: 1,
    grape: 'Pinot Noir',
    vineAge: 10,
    soil: ['Clay'],
    altitude: 250,
    aspect: 'South',
    density: 5000,
    vineyardHealth: 0.9,
    landValue: 200000,
    vineyardTotalValue: 200000,
    status: 'Growing',
    ripeness: 0.5,
    vineyardPrestige: 0,
    vineYield: 1,
    ...overrides
  };
}

function wineBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'Prestige Vineyard',
    grape: 'Pinot Noir',
    quantity: 10,
    state: 'bottled',
    fermentationProgress: 100,
    landValueModifierHarvestSnapshot: 1,
    structureIndexHarvestSnapshot: 0.7,
    tasteQualityIndexHarvestSnapshot: 0.7,
    landValueModifier: 1,
    tasteQualityIndex: 0.7,
    structureIndex: 0.7,
    characteristics: {
      acidity: 0.5,
      aroma: 0.5,
      body: 0.5,
      spice: 0.5,
      sweetness: 0.5,
      tannins: 0.5
    },
    estimatedPrice: 18,
    grapeColor: 'red',
    naturalYield: 0.5,
    fragile: 0.2,
    proneToOxidation: 0.2,
    features: [
      { id: 'terroir', isPresent: true, severity: 0.5, name: 'Terroir Expression', icon: 'T' }
    ],
    harvestStartDate: { week: 1, season: 'Fall', year: 2026 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2026 },
    bottledDate: { week: 1, season: 'Winter', year: 2027 },
    ...overrides
  } as WineBatch;
}

const terroirSaleConfig: FeatureConfig = {
  id: 'terroir',
  name: 'Terroir Expression',
  icon: 'T',
  description: 'Expressive site character',
  behavior: 'evolving',
  behaviorConfig: {
    spawnActive: true,
    severityGrowth: { rate: 0.01, cap: 1 }
  },
  effects: {
    prestige: {
      onSale: {
        company: {
          calculation: 'dynamic',
          baseAmount: 0.05,
          decayRate: 0.95,
          maxImpact: 8
        },
        vineyard: {
          calculation: 'dynamic',
          baseAmount: 0.08,
          decayRate: 0.95,
          maxImpact: 12
        }
      }
    }
  },
  customerSensitivity: {} as FeatureConfig['customerSensitivity'],
  displayPriority: 1,
  badgeColor: 'success'
};

describe('prestige service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setEvents([]);
    mocks.setVineyards([vineyard()]);
  });

  it('uses the shared company value prestige formula without hook-specific doubling', async () => {
    const { calculateCompanyValuePrestige } = await import('@/lib/services/prestige/prestigeService');

    expect(calculateCompanyValuePrestige(1000000, 1000000)).toBeCloseTo(Math.log(2));
  });

  it('aggregates company-level wine feature events as company prestige and vineyard-level feature events as vineyard prestige', async () => {
    mocks.setEvents([
      prestigeEvent({
        id: 'company-feature',
        type: 'wine_feature',
        amount: 5,
        sourceId: undefined,
        metadata: { level: 'company', featureId: 'bottle_aging' }
      }),
      prestigeEvent({
        id: 'vineyard-feature',
        type: 'wine_feature',
        amount: 3,
        sourceId: 'vineyard-1',
        metadata: { level: 'vineyard', featureId: 'terroir' }
      })
    ]);

    const { calculateCurrentPrestige } = await import('@/lib/services/prestige/prestigeService');

    const result = await calculateCurrentPrestige();

    expect(result.companyPrestige).toBe(5);
    expect(result.vineyardPrestige).toBe(3);
    expect(result.totalPrestige).toBe(8);
    expect(mocks.saveVineyard).toHaveBeenCalledWith(expect.objectContaining({
      id: 'vineyard-1',
      vineyardPrestige: 3
    }));
  });

  it('soft-caps planting completion prestige near +2 for high-base vineyards', async () => {
    const { addVineyardAchievementPrestigeEvent } = await import('@/lib/services/prestige/prestigeService');

    await addVineyardAchievementPrestigeEvent('planting', 'vineyard-1', 50);

    const event = (mocks.insertPrestigeEvent as any).mock.calls[0][0];
    expect(event.amount_base).toBeGreaterThan(1.8);
    expect(event.amount_base).toBeLessThanOrEqual(2);
  });

  it('uses fulfilled sale size and dynamic vineyard reputation for feature sale prestige', async () => {
    const { addFeaturePrestigeEvent } = await import('@/lib/services/prestige/prestigeService');

    await addFeaturePrestigeEvent(wineBatch(), terroirSaleConfig, 'sale', {
      customerName: 'North Cellars',
      order: {
        requestedQuantity: 10,
        totalValue: 200,
        fulfillableQuantity: 6,
        fulfillableValue: 120
      } as any,
      vineyard: vineyard({ vineyardPrestige: 80 }),
      currentCompanyPrestige: 100
    });

    expect(mocks.insertPrestigeEvent).toHaveBeenCalledTimes(2);
    const companyEvent = (mocks.insertPrestigeEvent as any).mock.calls
      .map((call: any[]) => call[0])
      .find((event: any) => event.payload.level === 'company');
    const vineyardEvent = (mocks.insertPrestigeEvent as any).mock.calls
      .map((call: any[]) => call[0])
      .find((event: any) => event.payload.level === 'vineyard');

    expect(companyEvent.payload).toEqual(expect.objectContaining({
      saleVolume: 6,
      saleValue: 120,
      featureSeverity: 0.5
    }));
    expect(vineyardEvent.payload).toEqual(expect.objectContaining({
      saleVolume: 6,
      saleValue: 120,
      featureSeverity: 0.5
    }));
    expect(vineyardEvent.amount_base).not.toBe(0.08);
  });

  it('falls back to a generic achievement display when metadata is missing', async () => {
    const { getEventDisplayData } = await import('@/lib/services/prestige/prestigeService');

    const displayData = getEventDisplayData(prestigeEvent({
      type: 'achievement',
      amount: 1.5,
      metadata: undefined
    }));

    expect(displayData).toEqual(expect.objectContaining({
      titleBase: 'Achievement',
      amountText: '+1.50 prestige'
    }));
  });
});
