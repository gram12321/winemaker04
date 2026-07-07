import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch, WineOrder } from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';

const mocks = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  getInventoryBatchById: vi.fn(),
  saveInventoryBatch: vi.fn(async () => true),
  loadWineOrders: vi.fn(async (): Promise<WineOrder[]> => []),
  updateWineOrderStatus: vi.fn(async () => true),
  saveWineOrder: vi.fn(async () => true),
  addTransaction: vi.fn(async () => undefined),
  createRelationshipBoost: vi.fn(async () => undefined),
  addSalePrestigeEvent: vi.fn(async () => undefined),
  addVineyardSalePrestigeEvent: vi.fn(async () => undefined),
  getBaseVineyardPrestige: vi.fn(async () => 1),
  addFeaturePrestigeEvent: vi.fn(async () => undefined),
  getCurrentPrestige: vi.fn(async () => 42),
  triggerGameUpdate: vi.fn(() => undefined),
  loadVineyards: vi.fn(async () => []),
  getAllFeatureConfigs: vi.fn(() => [])
}));

vi.mock('@/lib/database/customers/salesDB', () => ({
  loadWineOrders: mocks.loadWineOrders,
  updateWineOrderStatus: mocks.updateWineOrderStatus,
  saveWineOrder: mocks.saveWineOrder,
  getOrderById: mocks.getOrderById
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards
}));

vi.mock('@/lib/services/wine/winery/inventoryService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/wine/winery/inventoryService')>('@/lib/services/wine/winery/inventoryService');
  return {
    ...actual,
    getInventoryBatchById: mocks.getInventoryBatchById,
    saveInventoryBatch: mocks.saveInventoryBatch
  };
});

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate
}));

vi.mock('@/lib/services/finance/financeService', () => ({
  addTransaction: mocks.addTransaction
}));

vi.mock('@/lib/services/sales/relationshipService', () => ({
  createRelationshipBoost: mocks.createRelationshipBoost
}));

vi.mock('@/lib/services/prestige/prestigeService', () => ({
  addSalePrestigeEvent: mocks.addSalePrestigeEvent,
  addVineyardSalePrestigeEvent: mocks.addVineyardSalePrestigeEvent,
  getBaseVineyardPrestige: mocks.getBaseVineyardPrestige,
  addFeaturePrestigeEvent: mocks.addFeaturePrestigeEvent
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getCurrentPrestige: mocks.getCurrentPrestige
}));

vi.mock('@/lib/constants/wineFeatures/commonFeaturesUtil', () => ({
  getAllFeatureConfigs: mocks.getAllFeatureConfigs
}));

function wineBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'Order Vineyard',
    grape: 'Pinot Noir',
    quantity: 6,
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
    features: [],
    wineAnchors: { ...NEUTRAL_WINE_ANCHORS },
    harvestStartDate: { week: 1, season: 'Fall', year: 2026 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2026 },
    bottledDate: { week: 1, season: 'Winter', year: 2027 },
    ...overrides
  };
}

function wineOrder(overrides: Partial<WineOrder> = {}): WineOrder {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    customerName: 'North Cellars',
    wineBatchId: 'batch-1',
    wineName: 'Pinot Noir, Order Vineyard, 2026',
    requestedQuantity: 10,
    offeredPrice: 20,
    status: 'pending',
    createdAt: 100,
    expiresAt: 200,
    ...overrides
  } as WineOrder;
}

describe('sales order lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrderById.mockResolvedValue(wineOrder());
    mocks.getInventoryBatchById.mockResolvedValue(wineBatch());
    mocks.loadWineOrders.mockResolvedValue([
      wineOrder(),
      wineOrder({ id: 'order-2', customerId: 'customer-2', requestedQuantity: 3 })
    ]);
    mocks.getBaseVineyardPrestige.mockResolvedValue(2);
  });

  it('fulfills as much inventory as possible, records money/relationship/prestige, and rejects competing sold-out orders', async () => {
    const { fulfillWineOrder } = await import('@/lib/services/sales/salesService');

    await expect(fulfillWineOrder('order-1')).resolves.toBe(true);

    expect(mocks.saveInventoryBatch).toHaveBeenCalledWith(expect.objectContaining({
      id: 'batch-1',
      quantity: 0
    }));
    expect(mocks.updateWineOrderStatus).toHaveBeenCalledWith('order-2', 'rejected');
    expect(mocks.addTransaction).toHaveBeenCalledWith(
      120,
      'Wine Sale: Pinot Noir, Order Vineyard, 2026 (6/10 bottles)',
      'Wine Sales',
      false
    );
    expect(mocks.createRelationshipBoost).toHaveBeenCalledWith(
      'customer-1',
      120,
      42,
      'Order fulfilled: Pinot Noir, Order Vineyard, 2026 (6 bottles)'
    );
    expect(mocks.addVineyardSalePrestigeEvent).toHaveBeenCalledWith(
      120,
      'North Cellars',
      'Pinot Noir, Order Vineyard, 2026',
      'vineyard-1',
      2,
      6
    );
    expect(mocks.saveWineOrder).toHaveBeenCalledWith(expect.objectContaining({
      id: 'order-1',
      fulfillableQuantity: 6,
      fulfillableValue: 120,
      status: 'partially_fulfilled'
    }));
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
  });

  it('passes fulfilled order size to feature sale prestige events for partial orders', async () => {
    const feature = { id: 'terroir', isPresent: true, severity: 0.6, name: 'Terroir Expression', icon: 'T' };
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

    mocks.getInventoryBatchById.mockResolvedValue(wineBatch({ features: [feature] as any }));
    (mocks.getAllFeatureConfigs as any).mockReturnValue([featureConfig as any]);
    (mocks.loadVineyards as any).mockResolvedValue([{ id: 'vineyard-1', name: 'Order Vineyard', vineyardPrestige: 20 }]);

    const { fulfillWineOrder } = await import('@/lib/services/sales/salesService');

    await expect(fulfillWineOrder('order-1')).resolves.toBe(true);

    expect(mocks.addFeaturePrestigeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'batch-1' }),
      featureConfig,
      'sale',
      expect.objectContaining({
        customerName: 'North Cellars',
        order: expect.objectContaining({
          requestedQuantity: 6,
          totalValue: 120,
          fulfillableQuantity: 6,
          fulfillableValue: 120
        })
      })
    );
  });

  it('rejects an order by status update and refreshes the game view', async () => {
    const { rejectWineOrder } = await import('@/lib/services/sales/salesService');

    await expect(rejectWineOrder('order-1')).resolves.toBe(true);

    expect(mocks.updateWineOrderStatus).toHaveBeenCalledWith('order-1', 'rejected');
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
  });
});
