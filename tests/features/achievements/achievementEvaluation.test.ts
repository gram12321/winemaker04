import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AchievementUnlock, WineContract, WineOrder } from '@/lib/types/types';
import { achievementsFeature } from '@/lib/features/achievements';

const mocks = vi.hoisted(() => {
  const activeCompany = { id: 'company-a' };
  const unlock: AchievementUnlock = {
    id: 'unlock-1',
    achievementId: 'vineyard_empire_tier_1',
    companyId: 'company-a',
    unlockedAt: { week: 2, season: 'Spring', year: 2026 },
    unlockedAtTimestamp: 2,
    metadata: { value: 1 },
  };

  return {
    activeCompany,
    unlock,
    getCurrentCompanyId: vi.fn(() => activeCompany.id),
    getGameState: vi.fn(() => ({
      week: 2,
      season: 'Spring',
      currentYear: 2026,
      foundedYear: 2025,
      money: 500_000,
      prestige: 250,
    })),
    getAchievementUnlock: vi.fn(async () => null as AchievementUnlock | null),
    getAllAchievementUnlocks: vi.fn(async () => [] as AchievementUnlock[]),
    unlockAchievement: vi.fn(async () => ({ unlock, created: true })),
    loadVineyards: vi.fn(async () => [{
      id: 'vineyard-1',
      name: 'North Field',
      grape: 'Chardonnay',
      vineyardPrestige: 20,
      vineyardTotalValue: 200_000,
      hectares: 10,
    }]),
    loadWineOrders: vi.fn(async (): Promise<Partial<WineOrder>[]> => []),
    loadWineContracts: vi.fn(async (): Promise<Partial<WineContract>[]> => []),
    loadWineBatches: vi.fn(async () => [{ id: 'batch-1', vineyardId: 'vineyard-1' }]),
    loadWineLogByVineyard: vi.fn(async () => [{
      vineyardId: 'vineyard-1',
      grape: 'Chardonnay',
      quantity: 50,
      tasteQualityIndex: 90,
      structureIndex: 90,
      wineScore: 90,
      estimatedPrice: 100,
      vintage: 2025,
    }]),
    getSalesSummary: vi.fn(async () => ({ totalSalesCount: 0, totalSalesValue: 0 })),
    getWineProductionSummary: vi.fn(async () => ({ totalWinesProduced: 1, totalBottlesProduced: 50 })),
    getCompanyFinancialSnapshot: vi.fn(async () => ({
      financialData: {
        income: 0,
        totalAssets: 700_000,
        wineValue: 5_000,
        allVineyardsValue: 200_000,
      },
      companyValue: 700_000,
      transactions: [],
    })),
    insertCompanyReward: vi.fn(async () => true),
    insertVineyardReward: vi.fn(async () => true),
    insertPrestigeEvent: vi.fn(async () => undefined),
    listPrestigeEvents: vi.fn(async () => []),
    triggerGameUpdate: vi.fn(),
    addMessage: vi.fn(async () => null),
  };
});

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId,
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
  getCurrentCompany: () => mocks.activeCompany,
}));

vi.mock('@/lib/database/core/achievementsDB', () => ({
  getAchievementUnlock: mocks.getAchievementUnlock,
  getAllAchievementUnlocks: mocks.getAllAchievementUnlocks,
  unlockAchievement: mocks.unlockAchievement,
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards,
}));

vi.mock('@/lib/database/customers/salesDB', () => ({
  loadWineOrders: mocks.loadWineOrders,
  getSalesSummary: mocks.getSalesSummary,
}));

vi.mock('@/lib/database/sales/contractDB', () => ({
  loadWineContracts: mocks.loadWineContracts,
}));

vi.mock('@/lib/database/activities/inventoryDB', () => ({
  loadWineBatches: mocks.loadWineBatches,
}));

vi.mock('@/lib/features/wineLog', () => ({
  wineLogFeature: {
    records: {
      getVineyardHistory: mocks.loadWineLogByVineyard,
      getProductionSummary: mocks.getWineProductionSummary,
    },
  },
}));

vi.mock('@/lib/services/finance/financeService', () => ({
  getCompanyFinancialSnapshot: mocks.getCompanyFinancialSnapshot,
  calculateFinancialData: vi.fn(async () => mocks.getCompanyFinancialSnapshot().then(result => result.financialData)),
  calculateCompanyValue: vi.fn(async () => 700_000),
  loadTransactions: vi.fn(async () => []),
}));

vi.mock('@/lib/features/prestige/database/prestigeEventsDB', () => ({
  insertPrestigeEvent: mocks.insertPrestigeEvent,
  insertPrestigeEventIfAbsentBySource: mocks.insertCompanyReward,
  insertVineyardAchievementPrestigeEventIfAbsent: mocks.insertVineyardReward,
  listPrestigeEvents: mocks.listPrestigeEvents,
}));

vi.mock('@/hooks', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate,
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.addMessage },
}));

describe('achievement evaluation behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeCompany.id = 'company-a';
    mocks.getAchievementUnlock.mockResolvedValue(null);
    mocks.unlockAchievement.mockResolvedValue({ unlock: mocks.unlock, created: true });
    mocks.loadVineyards.mockResolvedValue([{
      id: 'vineyard-1',
      name: 'North Field',
      grape: 'Chardonnay',
      vineyardPrestige: 20,
      vineyardTotalValue: 200_000,
      hectares: 10,
    }]);
  });

  it('keeps every read and reward scoped to the company captured at evaluation start', async () => {
    mocks.loadVineyards.mockImplementationOnce(async () => {
      mocks.activeCompany.id = 'company-b';
      return [{
        id: 'vineyard-1',
        name: 'North Field',
        grape: 'Chardonnay',
        vineyardPrestige: 20,
        vineyardTotalValue: 200_000,
        hectares: 10,
      }];
    });

    await achievementsFeature.evaluation.checkOne('vineyard_empire_tier_1');

    expect(mocks.loadVineyards).toHaveBeenCalledWith('company-a');
    expect(mocks.loadWineOrders).toHaveBeenCalledWith(undefined, 'company-a');
    expect(mocks.loadWineContracts).toHaveBeenCalledWith('company-a');
    expect(mocks.loadWineBatches).toHaveBeenCalledWith('company-a');
    expect(mocks.loadWineLogByVineyard).toHaveBeenCalledWith('vineyard-1', 'company-a');
    expect(mocks.getCompanyFinancialSnapshot).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({ currentYear: 2026, money: 500_000 })
    );
    expect(mocks.insertCompanyReward).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: 'achievement:vineyard_empire_tier_1',
        payload: expect.objectContaining({
          event: 'achievement_unlock',
          achievementId: 'vineyard_empire_tier_1',
        }),
      }),
      'company-a'
    );
    expect(mocks.addMessage).toHaveBeenCalledWith(
      expect.any(String),
      'achievements.unlock',
      'Achievements',
      expect.any(String),
      expect.objectContaining({
        companyId: 'company-a',
        gameDate: { week: 2, season: 'Spring', year: 2026 },
      })
    );
  });

  it('does not report or notify a raced duplicate unlock as newly created', async () => {
    mocks.unlockAchievement.mockResolvedValueOnce({ unlock: mocks.unlock, created: false });

    const result = await achievementsFeature.evaluation.checkOne('vineyard_empire_tier_1');

    expect(result).toBeNull();
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });

  it('uses the idempotent vineyard achievement reward write', async () => {
    mocks.getAchievementUnlock.mockResolvedValueOnce({
      ...mocks.unlock,
      achievementId: 'vineyard_bottle_production_tier_1',
    });

    await achievementsFeature.evaluation.checkOne('vineyard_bottle_production_tier_1');

    expect(mocks.insertVineyardReward).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: 'vineyard-1',
        payload: expect.objectContaining({ achievementId: 'vineyard_bottle_production_tier_1' }),
      }),
      'company-a'
    );
    expect(mocks.insertPrestigeEvent).not.toHaveBeenCalled();
  });

  it('evaluates fulfilled contract quantity and sale-price percentage achievements', async () => {
    mocks.loadWineContracts.mockResolvedValueOnce([{
      status: 'fulfilled',
      requestedQuantity: 30,
      totalValue: 5_000,
    }]);

    const contractUnlock = await achievementsFeature.evaluation.checkOne('single_contract_bottles_tier_2');

    expect(contractUnlock).not.toBeNull();

    mocks.loadWineOrders.mockResolvedValueOnce([{
      status: 'fulfilled',
      askingPriceAtOrderTime: 100,
      offeredPrice: 110,
      wineBatchId: 'batch-1',
    }]);

    const priceUnlock = await achievementsFeature.evaluation.checkOne('sales_price_over_tier_1');

    expect(priceUnlock).not.toBeNull();
  });

  it('allows deadline achievements before the cutoff and rejects them at the cutoff', async () => {
    mocks.getGameState.mockReturnValueOnce({
      week: 1,
      season: 'Spring',
      currentYear: 2029,
      foundedYear: 2025,
      money: 500_000,
      prestige: 100,
    });

    expect(await achievementsFeature.evaluation.checkOne('prestige_by_year_tier_1')).not.toBeNull();

    mocks.getGameState.mockReturnValueOnce({
      week: 1,
      season: 'Spring',
      currentYear: 2030,
      foundedYear: 2025,
      money: 500_000,
      prestige: 100,
    });

    expect(await achievementsFeature.evaluation.checkOne('prestige_by_year_tier_1')).toBeNull();
  });

  it('builds status and statistics from one company-scoped workspace snapshot', async () => {
    mocks.getAllAchievementUnlocks.mockResolvedValueOnce([mocks.unlock]);

    const workspace = await achievementsFeature.views.getWorkspace();

    expect(workspace.achievements.find((entry) => entry.id === mocks.unlock.achievementId)?.isUnlocked).toBe(true);
    expect(workspace.stats.unlockedCount).toBe(1);
    expect(mocks.getCompanyFinancialSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.getAllAchievementUnlocks).toHaveBeenCalledWith('company-a');
  });

  it('retries a missing company reward for an existing unlock without notifying again', async () => {
    mocks.getAchievementUnlock.mockResolvedValueOnce(mocks.unlock);

    const result = await achievementsFeature.evaluation.checkOne('vineyard_empire_tier_1');

    expect(result).toBeNull();
    expect(mocks.insertCompanyReward).toHaveBeenCalledWith(expect.any(Object), 'company-a');
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });

  it('uses bulk unlock snapshots when checking all achievements and retries existing rewards', async () => {
    mocks.getAllAchievementUnlocks.mockResolvedValue([mocks.unlock]);

    await achievementsFeature.evaluation.checkAll();

    // One snapshot is needed for achievement-completion progress and one for
    // the check-all lookup; no per-achievement unlock queries are made.
    expect(mocks.getAllAchievementUnlocks).toHaveBeenCalledTimes(2);
    expect(mocks.getAllAchievementUnlocks).toHaveBeenNthCalledWith(1, 'company-a');
    expect(mocks.getAllAchievementUnlocks).toHaveBeenNthCalledWith(2, 'company-a');
    expect(mocks.getAchievementUnlock).not.toHaveBeenCalled();
    expect(mocks.insertCompanyReward).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'achievement:vineyard_empire_tier_1' }),
      'company-a'
    );
  });
});
