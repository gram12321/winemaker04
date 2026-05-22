import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch, WineOrder } from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';

const mocks = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  getWineBatchById: vi.fn(),
  saveWineBatch: vi.fn(async () => true),
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

vi.mock('@/lib/database/activities/inventoryDB', () => ({
  saveWineBatch: mocks.saveWineBatch,
  getWineBatchById: mocks.getWineBatchById
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards
}));

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
    mocks.getWineBatchById.mockResolvedValue(wineBatch());
    mocks.loadWineOrders.mockResolvedValue([
      wineOrder(),
      wineOrder({ id: 'order-2', customerId: 'customer-2', requestedQuantity: 3 })
    ]);
    mocks.getBaseVineyardPrestige.mockResolvedValue(2);
  });

  it('fulfills as much inventory as possible, records money/relationship/prestige, and rejects competing sold-out orders', async () => {
    const { fulfillWineOrder } = await import('@/lib/services/sales/salesService');

    await expect(fulfillWineOrder('order-1')).resolves.toBe(true);

    expect(mocks.saveWineBatch).toHaveBeenCalledWith(expect.objectContaining({
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
      2
    );
    expect(mocks.saveWineOrder).toHaveBeenCalledWith(expect.objectContaining({
      id: 'order-1',
      fulfillableQuantity: 6,
      fulfillableValue: 120,
      status: 'partially_fulfilled'
    }));
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
  });

  it('rejects an order by status update and refreshes the game view', async () => {
    const { rejectWineOrder } = await import('@/lib/services/sales/salesService');

    await expect(rejectWineOrder('order-1')).resolves.toBe(true);

    expect(mocks.updateWineOrderStatus).toHaveBeenCalledWith('order-1', 'rejected');
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
  });
});
