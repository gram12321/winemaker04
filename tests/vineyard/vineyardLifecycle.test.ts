import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCategory, type Activity, type Vineyard } from '@/lib/types/types';

const mocks = vi.hoisted(() => {
  let vineyards: Vineyard[] = [];
  let activities: Activity[] = [];

  return {
    setVineyards: (next: Vineyard[]) => {
      vineyards = next;
    },
    setActivities: (next: Activity[]) => {
      activities = next;
    },
    loadVineyards: vi.fn(async () => vineyards),
    saveVineyard: vi.fn(async (vineyard: Vineyard) => {
      vineyards = vineyards.map(candidate => candidate.id === vineyard.id ? vineyard : candidate);
      return true;
    }),
    bulkUpdateVineyards: vi.fn(async (updates: Vineyard[]) => {
      vineyards = vineyards.map(vineyard => updates.find(update => update.id === vineyard.id) || vineyard);
      return true;
    }),
    loadActivitiesFromDb: vi.fn(async () => activities),
    updateActivityInDb: vi.fn(async (activityId: string, updates: Partial<Activity>) => {
      activities = activities.map(activity =>
        activity.id === activityId ? { ...activity, ...updates } : activity
      );
      return true;
    }),
    removeActivityFromDb: vi.fn(async () => true),
    notificationAddMessage: vi.fn(async () => undefined),
    getGameState: vi.fn(() => ({ week: 5, season: 'Fall', currentYear: 2026 })),
    updateGameState: vi.fn(async () => undefined),
    createWineBatchFromHarvest: vi.fn(async () => undefined),
    getResearchPermanentEffects: vi.fn(async () => ({ vineyardHealthDecayMultiplier: 0.8, activeEffects: [] })),
    getCurrentCompanyId: vi.fn(() => 'company-1'),
    updateBaseVineyardPrestigeEvent: vi.fn(async () => undefined)
  };
});

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards,
  saveVineyard: mocks.saveVineyard,
  bulkUpdateVineyards: mocks.bulkUpdateVineyards
}));

vi.mock('@/lib/database/activities/activityDB', () => ({
  loadActivitiesFromDb: mocks.loadActivitiesFromDb,
  updateActivityInDb: mocks.updateActivityInDb,
  removeActivityFromDb: mocks.removeActivityFromDb
}));

vi.mock('@/lib/services/activity', () => ({
  WorkCategory: {
    PLANTING: 'PLANTING',
    HARVESTING: 'HARVESTING'
  }
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.notificationAddMessage }
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
  updateGameState: mocks.updateGameState
}));

vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  createWineBatchFromHarvest: mocks.createWineBatchFromHarvest
}));

vi.mock('@/lib/services/research/researchPermanentEffectsService', () => ({
  getResearchPermanentEffects: mocks.getResearchPermanentEffects
}));

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId
}));

vi.mock('@/lib/services/prestige/prestigeService', () => ({
  updateBaseVineyardPrestigeEvent: mocks.updateBaseVineyardPrestigeEvent
}));

let randomSpy: any = null;

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'vineyard-1',
    name: 'Lifecycle Vineyard',
    country: 'France',
    region: 'Bourgogne',
    hectares: 1,
    grape: 'Pinot Noir',
    vineAge: 12,
    soil: ['Clay', 'Limestone'],
    altitude: 300,
    aspect: 'Southeast',
    density: 5000,
    vineyardHealth: 0.9,
    landValue: 250000,
    vineyardTotalValue: 250000,
    status: 'Growing',
    ripeness: 0.85,
    vineyardPrestige: 1,
    vineYield: 1,
    overgrowth: { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
    pendingFeatures: [],
    ...overrides
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    category: WorkCategory.HARVESTING,
    title: 'Harvest Lifecycle Vineyard',
    totalWork: 100,
    completedWork: 0,
    targetId: 'vineyard-1',
    params: { grape: 'Pinot Noir', harvestedSoFar: 0 },
    status: 'active',
    gameWeek: 2,
    gameSeason: 'Fall',
    gameYear: 2026,
    isCancellable: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
  };
}

describe('vineyard lifecycle services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setVineyards([vineyard()]);
    mocks.setActivities([]);
    mocks.getGameState.mockReturnValue({ week: 5, season: 'Fall', currentYear: 2026 });
  });

  afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  it('resets harvested vineyards at Spring week 1 and cancels stale harvest activities', async () => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    mocks.setVineyards([vineyard({ status: 'Harvested', ripeness: 0.6 })]);
    mocks.setActivities([activity()]);
    const { updateVineyardRipeness } = await import('@/lib/services/vineyard/vineyardManager');

    await updateVineyardRipeness('Spring', 1);

    const updatedVineyard = mocks.bulkUpdateVineyards.mock.calls[0][0][0];
    expect(updatedVineyard).toMatchObject({
      id: 'vineyard-1',
      status: 'Growing',
      isRipenessDeclining: false
    });
    expect(updatedVineyard.ripeness).toBeGreaterThan(0);
    expect(updatedVineyard.ripeness).toBeLessThan(0.1);
    expect(mocks.updateActivityInDb).toHaveBeenCalledWith('activity-1', { status: 'cancelled' });
    expect(mocks.updateGameState).toHaveBeenCalledWith({ activities: [] });
  }, 15000);

  it('applies season health degradation with research permanent-effect multipliers', async () => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { updateVineyardHealthDegradation } = await import('@/lib/services/vineyard/vineyardManager');

    await updateVineyardHealthDegradation('Fall', 1);

    expect(mocks.getResearchPermanentEffects).toHaveBeenCalledWith('company-1');
    expect(mocks.bulkUpdateVineyards).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'vineyard-1',
        vineyardHealth: expect.closeTo(0.892, 4),
        healthTrend: expect.objectContaining({
          seasonalDecay: expect.closeTo(0.008, 4)
        })
      })
    ]);
  }, 15000);

  it('creates partial harvest batches as activity work progresses and records harvested-so-far state', async () => {
    const harvestActivity = activity({ totalWork: 100, completedWork: 0 });
    mocks.setActivities([harvestActivity]);
    const { handlePartialHarvesting } = await import('@/lib/services/vineyard/vineyardManager');

    await handlePartialHarvesting(harvestActivity, 0, 50);

    expect(mocks.createWineBatchFromHarvest).toHaveBeenCalledWith(
      'vineyard-1',
      'Lifecycle Vineyard',
      'Pinot Noir',
      expect.any(Number),
      { week: 2, season: 'Fall', year: 2026 },
      { week: 5, season: 'Fall', year: 2026 }
    );
    expect(mocks.updateActivityInDb).toHaveBeenCalledWith('activity-1', {
      params: expect.objectContaining({
        harvestedSoFar: expect.any(Number),
        currentTotalYield: expect.any(Number)
      })
    });
    expect(mocks.saveVineyard).toHaveBeenCalledWith(expect.objectContaining({
      id: 'vineyard-1',
      status: 'Growing'
    }));
  }, 15000);
});
