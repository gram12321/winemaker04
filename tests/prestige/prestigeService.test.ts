import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrestigeEvent, Vineyard } from '@/lib/types/types';

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
});
