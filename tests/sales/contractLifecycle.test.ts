import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch, WineContract } from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';

const mocks = vi.hoisted(() => ({
  getContractById: vi.fn(),
  updateContractStatus: vi.fn(async () => true),
  getPendingContracts: vi.fn(async (): Promise<WineContract[]> => []),
  updateContractProgress: vi.fn(async () => true),
  getWineBatchById: vi.fn(),
  saveWineBatch: vi.fn(async () => true),
  loadVineyards: vi.fn(async () => []),
  addTransaction: vi.fn(async () => undefined),
  createRelationshipBoost: vi.fn(async () => undefined),
  getGameState: vi.fn(() => ({ week: 3, season: 'Fall', currentYear: 2026 })),
  getCurrentPrestige: vi.fn(async () => 35),
  addSalePrestigeEvent: vi.fn(async () => undefined),
  triggerGameUpdate: vi.fn(() => undefined),
  triggerTopicUpdate: vi.fn(() => undefined),
  notificationAddMessage: vi.fn(async () => undefined)
}));

vi.mock('@/lib/database/sales/contractDB', () => ({
  getContractById: mocks.getContractById,
  updateContractStatus: mocks.updateContractStatus,
  getPendingContracts: mocks.getPendingContracts,
  updateContractProgress: mocks.updateContractProgress
}));

vi.mock('@/lib/database/activities/inventoryDB', () => ({
  getWineBatchById: mocks.getWineBatchById,
  saveWineBatch: mocks.saveWineBatch
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards
}));

vi.mock('@/lib/services/finance/financeService', () => ({
  addTransaction: mocks.addTransaction
}));

vi.mock('@/lib/services/sales/relationshipService', () => ({
  createRelationshipBoost: mocks.createRelationshipBoost
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
  getCurrentPrestige: mocks.getCurrentPrestige
}));

vi.mock('@/lib/services/prestige/prestigeService', () => ({
  addSalePrestigeEvent: mocks.addSalePrestigeEvent
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate,
  triggerTopicUpdate: mocks.triggerTopicUpdate
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.notificationAddMessage }
}));

function bottledWine(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'Contract Vineyard',
    grape: 'Chardonnay',
    quantity: 8,
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
    grapeColor: 'white',
    naturalYield: 0.5,
    fragile: 0.2,
    proneToOxidation: 0.2,
    features: [],
    wineAnchors: { ...NEUTRAL_WINE_ANCHORS },
    harvestStartDate: { week: 1, season: 'Fall', year: 2025 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2025 },
    bottledDate: { week: 1, season: 'Winter', year: 2026 },
    ...overrides
  };
}

function contract(overrides: Partial<WineContract> = {}): WineContract {
  return {
    id: 'contract-1',
    companyId: 'company-1',
    customerId: 'customer-1',
    customerName: 'Nordic Importer',
    customerCountry: 'France',
    customerType: 'Wine Shop',
    requirements: [],
    requestedQuantity: 5,
    offeredPrice: 22,
    totalValue: 110,
    status: 'pending',
    createdWeek: 1,
    createdSeason: 'Spring',
    createdYear: 2026,
    expiresWeek: 12,
    expiresSeason: 'Summer',
    expiresYear: 2026,
    relationshipAtCreation: 50,
    ...overrides
  };
}

describe('contract lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGameState.mockReturnValue({ week: 3, season: 'Fall', currentYear: 2026 });
    mocks.getContractById.mockResolvedValue(contract());
    mocks.getWineBatchById.mockResolvedValue(bottledWine());
  });

  it('fulfills a pending contract by validating wine, deducting inventory, booking revenue, and recording status', async () => {
    const { fulfillContract } = await import('@/lib/services/sales/contractService');

    const result = await fulfillContract('contract-1', [{ wineBatchId: 'batch-1', quantity: 5 }]);

    expect(result).toEqual({
      success: true,
      message: 'Contract fulfilled successfully',
      revenue: 110
    });
    expect(mocks.saveWineBatch).toHaveBeenCalledWith(expect.objectContaining({
      id: 'batch-1',
      quantity: 3
    }));
    expect(mocks.addTransaction).toHaveBeenCalledWith(
      110,
      'Contract fulfilled: Nordic Importer - 5 bottles',
      'Wine Sales',
      false
    );
    expect(mocks.createRelationshipBoost).toHaveBeenCalledWith(
      'customer-1',
      110,
      35,
      'Contract fulfilled: 5 bottles'
    );
    expect(mocks.addSalePrestigeEvent).toHaveBeenCalledWith(
      110,
      'Nordic Importer',
      'Contract (5 bottles)',
      5
    );
    expect(mocks.updateContractStatus).toHaveBeenCalledWith('contract-1', 'fulfilled', {
      fulfilledWeek: 3,
      fulfilledSeason: 'Fall',
      fulfilledYear: 2026,
      fulfilledWineBatchIds: ['batch-1']
    });
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('contracts');
  });

  it('rejects a pending contract with date metadata and a smaller relationship penalty', async () => {
    const { rejectContract } = await import('@/lib/services/sales/contractService');

    await expect(rejectContract('contract-1')).resolves.toEqual({
      success: true,
      message: 'Contract rejected'
    });

    expect(mocks.updateContractStatus).toHaveBeenCalledWith('contract-1', 'rejected', {
      rejectedWeek: 3,
      rejectedSeason: 'Fall',
      rejectedYear: 2026
    });
    expect(mocks.createRelationshipBoost).toHaveBeenCalledWith(
      'customer-1',
      -5,
      0,
      'Contract rejected'
    );
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('contracts');
  });

  it('expires only pending contracts older than the current game date', async () => {
    mocks.getPendingContracts.mockResolvedValue([
      contract({ id: 'expired-contract', expiresWeek: 12, expiresSeason: 'Summer', expiresYear: 2026 }),
      contract({ id: 'current-contract', expiresWeek: 3, expiresSeason: 'Fall', expiresYear: 2026 }),
      contract({ id: 'future-contract', expiresWeek: 4, expiresSeason: 'Fall', expiresYear: 2026 })
    ]);

    const { expireOldContracts } = await import('@/lib/services/sales/contractService');

    await expect(expireOldContracts()).resolves.toBe(1);

    expect(mocks.updateContractStatus).toHaveBeenCalledTimes(1);
    expect(mocks.updateContractStatus).toHaveBeenCalledWith('expired-contract', 'expired');
    expect(mocks.createRelationshipBoost).toHaveBeenCalledWith(
      'customer-1',
      -3,
      0,
      'Contract expired (not accepted)'
    );
    expect(mocks.notificationAddMessage).toHaveBeenCalledWith(
      '1 contract expired',
      'contractService.expireOldContracts',
      'Contracts Expired',
      expect.anything()
    );
  });
});
