import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch, WineContract } from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';

const mocks = vi.hoisted(() => ({
  getContractById: vi.fn(),
  updateContractStatus: vi.fn(async () => true),
  getPendingContracts: vi.fn(async (): Promise<WineContract[]> => []),
  updateContractProgress: vi.fn(async () => true),
  getInventoryBatchById: vi.fn(),
  saveInventoryBatch: vi.fn(async () => true),
  getAllWineBatches: vi.fn(async (): Promise<WineBatch[]> => []),
  loadVineyards: vi.fn(async () => []),
  addTransaction: vi.fn(async () => undefined),
  createRelationshipBoost: vi.fn(async () => undefined),
  getGameState: vi.fn(() => ({ week: 3, season: 'Fall', currentYear: 2026 })),
  getCurrentPrestige: vi.fn(async () => 35),
  addSalePrestigeEvent: vi.fn(async () => undefined),
  addFeaturePrestigeEvent: vi.fn(async () => undefined),
  getAllFeatureConfigs: vi.fn(() => []),
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

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards
}));

vi.mock('@/lib/services/wine/winery/inventoryService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/wine/winery/inventoryService')>('@/lib/services/wine/winery/inventoryService');
  return {
    ...actual,
    getInventoryBatchById: mocks.getInventoryBatchById,
    saveInventoryBatch: mocks.saveInventoryBatch,
    getAllWineBatches: mocks.getAllWineBatches
  };
});

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
  addSalePrestigeEvent: mocks.addSalePrestigeEvent,
  addFeaturePrestigeEvent: mocks.addFeaturePrestigeEvent
}));

vi.mock('@/lib/constants/wineFeatures/commonFeaturesUtil', () => ({
  getAllFeatureConfigs: mocks.getAllFeatureConfigs
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
    mocks.getInventoryBatchById.mockResolvedValue(bottledWine());
    mocks.getAllWineBatches.mockResolvedValue([]);
    mocks.loadVineyards.mockResolvedValue([]);
    mocks.getAllFeatureConfigs.mockReturnValue([]);
  });

  it('fulfills a pending contract by validating wine, deducting inventory, booking revenue, and recording status', async () => {
    const { fulfillContract } = await import('@/lib/services/sales/contractService');

    const result = await fulfillContract('contract-1', [{ wineBatchId: 'batch-1', quantity: 5 }]);

    expect(result).toEqual({
      success: true,
      message: 'Contract fulfilled successfully',
      revenue: 110
    });
    expect(mocks.saveInventoryBatch).toHaveBeenCalledWith(expect.objectContaining({
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

  it('creates feature sale prestige events for contract fulfillment using actual fulfilled wine quantities', async () => {
    const feature = { id: 'terroir', isPresent: true, severity: 0.75, name: 'Terroir Expression', icon: 'T' };
    const featureConfig = {
      id: 'terroir',
      effects: {
        prestige: {
          onSale: {
            company: { calculation: 'dynamic', baseAmount: 0.05, decayRate: 0.95, maxImpact: 8 }
          }
        }
      }
    };

    mocks.getInventoryBatchById.mockResolvedValue(bottledWine({ features: [feature] as any }));
    (mocks.getAllFeatureConfigs as any).mockReturnValue([featureConfig as any]);
    (mocks.loadVineyards as any).mockResolvedValue([{ id: 'vineyard-1', name: 'Contract Vineyard', vineyardPrestige: 25 }]);

    const { fulfillContract } = await import('@/lib/services/sales/contractService');

    await expect(fulfillContract('contract-1', [{ wineBatchId: 'batch-1', quantity: 5 }])).resolves.toEqual({
      success: true,
      message: 'Contract fulfilled successfully',
      revenue: 110
    });

    expect(mocks.addFeaturePrestigeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'batch-1' }),
      featureConfig,
      'sale',
      expect.objectContaining({
        customerName: 'Nordic Importer',
        currentCompanyPrestige: 35,
        order: expect.objectContaining({
          requestedQuantity: 5,
          totalValue: 110,
          fulfillableQuantity: 5,
          fulfillableValue: 110
        })
      })
    );
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

  it('loads contract-eligible bottled inventory through the inventory service seam', async () => {
    const eligibleWine = bottledWine({ id: 'eligible-batch', quantity: 4 });
    const ineligibleWine = bottledWine({ id: 'empty-batch', quantity: 0 });
    mocks.getAllWineBatches.mockResolvedValue([eligibleWine, ineligibleWine]);

    const { getEligibleWinesForContract } = await import('@/lib/services/sales/contractService');

    await expect(getEligibleWinesForContract(contract())).resolves.toEqual([
      {
        wine: eligibleWine,
        validation: {
          isValid: true,
          failedRequirements: []
        }
      }
    ]);
    expect(mocks.getAllWineBatches).toHaveBeenCalledOnce();
  });

  it('accepts an offered bottle pre-sale contract, records accepted date, and books upfront revenue', async () => {
    mocks.getContractById.mockResolvedValue(contract({
      status: 'offered',
      contractMode: 'wine_presale',
      upfrontPercent: 0.25,
      upfrontPaidAmount: 27.5,
      finalPaymentAmount: 82.5,
      defaultPenaltyAmount: 5.5,
    }));

    const { acceptWinePresaleContract } = await import('@/lib/services/sales/contractService');

    await expect(acceptWinePresaleContract('contract-1')).resolves.toEqual({
      success: true,
      message: 'Pre-sale accepted'
    });

    expect(mocks.addTransaction).toHaveBeenCalledWith(
      27.5,
      'Pre-sale advance accepted: Nordic Importer (5 bottles)',
      'Contract Advance In',
      false
    );
    expect(mocks.updateContractStatus).toHaveBeenCalledWith('contract-1', 'pending', {
      acceptedWeek: 3,
      acceptedSeason: 'Fall',
      acceptedYear: 2026,
    });
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
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
