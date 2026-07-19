import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCategory, type Activity, type Vineyard, type WineBatch } from '@/lib/types/types';
import type { CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import type { FermentationOptions } from '@/lib/services/wine/characteristics/fermentationCharacteristics';

const mocks = vi.hoisted(() => {
  let vineyards: Vineyard[] = [];
  let batches: WineBatch[] = [];

  const replaceBatch = (batchId: string, updates: Partial<WineBatch>): boolean => {
    const index = batches.findIndex(batch => batch.id === batchId);
    if (index < 0) return false;
    batches[index] = { ...batches[index], ...updates };
    return true;
  };

  return {
    setVineyards: (next: Vineyard[]) => {
      vineyards = next;
    },
    setBatches: (next: WineBatch[]) => {
      batches = next;
    },
    getBatches: () => batches,
    loadVineyards: vi.fn(async () => vineyards),
    loadWineBatches: vi.fn(async () => batches),
    getWineBatchById: vi.fn(async (batchId: string) => batches.find(batch => batch.id === batchId) ?? null),
    deleteWineBatch: vi.fn(async (batchId: string) => { batches = batches.filter(batch => batch.id !== batchId); return true; }),
    saveWineBatch: vi.fn(async (batch: WineBatch) => {
      const existingIndex = batches.findIndex(candidate => candidate.id === batch.id);
      if (existingIndex >= 0) {
        batches[existingIndex] = batch;
      } else {
        batches = [...batches, batch];
      }
      return true;
    }),
    appendStorageBackedHarvestBatch: vi.fn(async (_companyId: string, batch: WineBatch) => {
      const existingIndex = batches.findIndex(candidate => candidate.id === batch.id);
      if (existingIndex < 0) return false;
      batches[existingIndex] = batch;
      return true;
    }),
    bottleStorageBackedWineBatch: vi.fn(async (input: any) => replaceBatch(input.batchId, {
      state: 'bottled',
      quantity: Math.floor(input.quantity),
      bottledDate: { week: input.bottledWeek, season: input.bottledSeason, year: input.bottledYear },
      tasteQualityIndexBottlingSnapshot: input.tasteQualityIndexBottlingSnapshot,
      landValueModifierBottlingSnapshot: input.landValueModifierBottlingSnapshot,
      structureIndexBottlingSnapshot: input.structureIndexBottlingSnapshot,
      wineScoreBottlingSnapshot: input.wineScoreBottlingSnapshot,
    })),
    updateWineBatch: vi.fn(async (batchId: string, updates: Partial<WineBatch>) => replaceBatch(batchId, updates)),
    bulkUpdateWineBatches: vi.fn(async (updates: Array<{ id: string; updates: Partial<WineBatch> }>) => {
      for (const update of updates) {
        replaceBatch(update.id, update.updates);
      }
      return true;
    }),
    createActivity: vi.fn(async (..._args: any[]) => 'activity-1'),
    triggerGameUpdate: vi.fn(() => undefined),
    addTransaction: vi.fn(async () => undefined),
    getGameState: vi.fn(() => ({ week: 7, season: 'Winter', currentYear: 2027 })),
    calculateCurrentPrestige: vi.fn(async () => ({ companyPrestige: 0, vineyardPrestigeEvents: [] })),
    initializeBatchFeatures: vi.fn(() => []),
    processEventTrigger: vi.fn(async (batch: WineBatch) => batch),
    simulateMarketFeatureLifecycle: vi.fn((batch: WineBatch) => batch),
    recordBottledWine: vi.fn(async () => undefined)
  };
});

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards
}));

vi.mock('@/lib/database/activities/inventoryDB', () => ({
  loadWineBatches: mocks.loadWineBatches,
  getWineBatchById: mocks.getWineBatchById,
  deleteWineBatch: mocks.deleteWineBatch,
  saveWineBatch: mocks.saveWineBatch,
  appendStorageBackedHarvestBatch: mocks.appendStorageBackedHarvestBatch,
  bottleStorageBackedWineBatch: mocks.bottleStorageBackedWineBatch,
  updateWineBatch: mocks.updateWineBatch,
  bulkUpdateWineBatches: mocks.bulkUpdateWineBatches
}));

vi.mock('@/lib/features/activities/services/activitymanagers/activityManager', () => ({
  createActivity: mocks.createActivity
}));

vi.mock('@/lib/features/activities', () => ({
  WorkCategory: {
    CRUSHING: 'CRUSHING',
    FERMENTATION: 'FERMENTATION'
  }
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate
}));

vi.mock('@/lib/services', () => ({
  addTransaction: mocks.addTransaction
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState
}));

vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: () => 'company-1' }));

vi.mock('@/lib/services/prestige/prestigeService', () => ({
  calculateCurrentPrestige: mocks.calculateCurrentPrestige,
  BoundedVineyardPrestigeFactor: () => ({ boundedFactor: 1 })
}));

vi.mock('@/lib/services/wine/features/featureService', () => ({
  initializeBatchFeatures: mocks.initializeBatchFeatures,
  processEventTrigger: mocks.processEventTrigger,
  simulateMarketFeatureLifecycle: mocks.simulateMarketFeatureLifecycle
}));

vi.mock('@/lib/services/wine/winery/storageVesselAllocationService', () => ({
  initializeHarvestVolumeLitres: (kg: number) => Math.ceil(kg * 0.5),
  canStoragePlanHoldVolume: vi.fn(async () => true),
  activateStoragePlanForBatch: vi.fn(async () => true),
  assertBatchHasUsableStorage: vi.fn(async () => ({ valid: true })),
}));

vi.mock('@/lib/services/user/wineLogService', () => ({
  recordBottledWine: mocks.recordBottledWine
}));

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'vineyard-1',
    name: 'Lifecycle Vineyard',
    country: 'France',
    region: 'Bourgogne',
    hectares: 1,
    grape: 'Pinot Noir',
    vineAge: 15,
    soil: ['Clay', 'Limestone'],
    altitude: 300,
    aspect: 'Southeast',
    density: 5000,
    vineyardHealth: 0.9,
    landValue: 250000,
    vineyardTotalValue: 250000,
    status: 'Growing',
    ripeness: 0.92,
    vineyardPrestige: 1,
    vineYield: 1,
    overgrowth: { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
    pendingFeatures: [],
    ...overrides
  };
}

function activityFromParams(
  category: WorkCategory,
  params: Record<string, unknown>
): Activity {
  return {
    id: `${category}-activity`,
    category,
    title: category,
    totalWork: 10,
    completedWork: 10,
    status: 'active',
    gameWeek: 2,
    gameSeason: 'Fall',
    gameYear: 2026,
    params,
    isCancellable: true,
    createdAt: new Date('2026-01-01T00:00:00Z')
  };
}

describe('winery harvest-to-bottle lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setVineyards([vineyard()]);
    mocks.setBatches([]);
    mocks.createActivity.mockResolvedValue('activity-1');
  });

  it('creates grapes, starts and completes crush/fermentation, processes weekly fermentation, and bottles with log snapshot', async () => {
    const { createWineBatchFromHarvest } = await import('@/lib/services/wine/winery/inventoryService');
    const { startCrushingActivity } = await import('@/lib/services/wine/winery/crushingManager');
    const { completeCrushing } = await import('@/lib/features/activities/services/workcalculators/crushingWorkCalculator');
    const { completeFermentationSetup } = await import('@/lib/features/activities/services/workcalculators/fermentationWorkCalculator');
    const {
      startFermentationActivity,
      processWeeklyFermentation,
      bottleWine
    } = await import('@/lib/services/wine/winery/fermentationManager');

    const harvestDate = { week: 2, season: 'Fall' as const, year: 2026 };
    let grapes = await createWineBatchFromHarvest(
      'vineyard-1',
      'Lifecycle Vineyard',
      'Pinot Noir',
      1200,
      harvestDate,
      harvestDate,
      'plan-1',
      'batch-1'
    );

    expect(grapes).toMatchObject({
      vineyardId: 'vineyard-1',
      grape: 'Pinot Noir',
      quantity: 1200,
      state: 'grapes',
      harvestStartDate: harvestDate,
      harvestEndDate: harvestDate
    });
    expect(grapes.characteristics).toBeDefined();
    expect(grapes.wineAnchors).toBeDefined();
    expect(mocks.saveWineBatch).toHaveBeenCalledWith(expect.objectContaining({ state: 'grapes' }));

    const continuedGrapes = await createWineBatchFromHarvest(
      'vineyard-1',
      'Lifecycle Vineyard',
      'Pinot Noir',
      120,
      harvestDate,
      { week: 3, season: 'Fall', year: 2026 },
      'plan-1',
      'batch-1'
    );
    expect(continuedGrapes).toMatchObject({ id: grapes.id, quantity: 1320 });
    expect(mocks.appendStorageBackedHarvestBatch).toHaveBeenCalledWith('company-1', expect.objectContaining({ id: grapes.id, quantity: 1320 }));
    grapes = continuedGrapes;

    const crushingOptions: CrushingOptions = {
      method: 'Mechanical Press',
      destemming: true,
      coldSoak: false,
      pressingIntensity: 0.5
    };
    await expect(startCrushingActivity(grapes, crushingOptions)).resolves.toEqual({ success: true });
    expect(mocks.createActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: WorkCategory.CRUSHING,
        params: expect.objectContaining({
          batchId: grapes.id,
          crushingOptions
        })
      })
    );

    const crushingCall = mocks.createActivity.mock.calls[mocks.createActivity.mock.calls.length - 1];
    const crushingParams = crushingCall?.[0].params as Record<string, unknown>;
    await completeCrushing(activityFromParams(WorkCategory.CRUSHING, crushingParams));
    const mustReady = mocks.getBatches().find(batch => batch.id === grapes.id);
    expect(mustReady).toMatchObject({ state: 'must_ready' });
    expect(mustReady?.quantity).toBeGreaterThan(0);

    const fermentationOptions: FermentationOptions = {
      method: 'Basic',
      temperature: 'Ambient'
    };
    await expect(startFermentationActivity(mustReady!, fermentationOptions)).resolves.toEqual({ success: true });
    expect(mocks.createActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: WorkCategory.FERMENTATION,
        params: expect.objectContaining({
          batchId: grapes.id,
          fermentationOptions
        })
      })
    );

    const fermentationCall = mocks.createActivity.mock.calls[mocks.createActivity.mock.calls.length - 1];
    const fermentationParams = fermentationCall?.[0].params as Record<string, unknown>;
    await completeFermentationSetup(activityFromParams(WorkCategory.FERMENTATION, fermentationParams));
    const fermenting = mocks.getBatches().find(batch => batch.id === grapes.id);
    expect(fermenting).toMatchObject({
      state: 'must_fermenting',
      fermentationOptions
    });

    await processWeeklyFermentation();
    expect(mocks.bulkUpdateWineBatches).toHaveBeenCalledWith([
      expect.objectContaining({
        id: grapes.id,
        updates: expect.objectContaining({
          characteristics: expect.any(Object),
          tasteQualityIndex: expect.any(Number),
          structureIndex: expect.any(Number),
          wineAnchors: expect.any(Object)
        })
      })
    ]);

    await expect(bottleWine(grapes.id)).resolves.toBe(true);
    expect(mocks.bottleStorageBackedWineBatch).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-1', batchId: grapes.id }));
    const bottled = mocks.getBatches().find(batch => batch.id === grapes.id);
    expect(bottled).toMatchObject({
      state: 'bottled',
      bottledDate: { week: 7, season: 'Winter', year: 2027 },
      tasteQualityIndexBottlingSnapshot: expect.any(Number),
      landValueModifierBottlingSnapshot: expect.any(Number),
      structureIndexBottlingSnapshot: expect.any(Number),
      wineScoreBottlingSnapshot: expect.any(Number)
    });
    expect(bottled!.quantity).toBe(Math.floor(fermenting!.quantity / 1.5));
    expect(mocks.recordBottledWine).toHaveBeenCalledWith(expect.objectContaining({
      id: grapes.id,
      state: 'bottled'
    }));
  });

  it('creates a market-origin batch from pseudo-vineyard inputs with harvest-equivalent identity', async () => {
    const { createWineBatchFromMarketSource } = await import('@/lib/services/wine/winery/inventoryService');

    const harvestDate = { week: 3, season: 'Spring' as const, year: 2026 };
    const batch = await createWineBatchFromMarketSource({
      supplierId: 'bulk_supplier',
      supplierName: 'Bulk Supply Syndicate',
      originTag: 'country_special',
      source: {
        country: 'France',
        region: 'Bourgogne',
        soil: ['Clay', 'Limestone'],
        aspect: 'Southeast',
        altitude: 280,
        density: 4800,
        vineyardHealth: 0.84,
        ripeness: 0.76,
        vineAge: 18,
        landValue: 210000,
        vineyardPrestige: 0.58,
        overgrowth: { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
        pendingFeatures: [],
        baseQualityScore: 0.76
      },
      grape: 'Pinot Noir',
      quantity: 900,
      harvestStartDate: harvestDate,
      harvestEndDate: harvestDate,
      storagePlanId: 'plan-2'
    });

    expect(batch).toMatchObject({
      vineyardId: 'market_purchase',
      vineyardName: 'Bulk Supply Syndicate',
      grape: 'Pinot Noir',
      quantity: 900,
      state: 'grapes',
      harvestStartDate: harvestDate,
      harvestEndDate: harvestDate,
      originSnapshot: expect.objectContaining({
        sourceKind: 'market',
        supplierId: 'bulk_supplier',
        supplierName: 'Bulk Supply Syndicate',
        originTag: 'country_special',
        terroirSummary: expect.any(String)
      })
    });
    expect(batch.characteristics).toBeDefined();
    expect(batch.wineAnchors).toBeDefined();
    expect(batch.breakdown?.anchorEffects?.length).toBeGreaterThan(0);
    expect(batch.estimatedPrice).toBeGreaterThanOrEqual(0);
    expect(mocks.saveWineBatch).toHaveBeenCalledWith(expect.objectContaining({
      vineyardId: 'market_purchase',
      originSnapshot: expect.objectContaining({ sourceKind: 'market' })
    }));
  });
});
