import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch } from '@/lib/types/types';

const mocks = vi.hoisted(() => ({
  getInventoryBatchById: vi.fn(),
  sellStorageBackedWineBatch: vi.fn(async () => ({ data: { id: 'tx-1', week: 1, season: 'Spring', year: 2026, amount: 100, description: 'sale', category: 'Grape Sales', recurring: false, money: 1100 } as Record<string, unknown> | null, error: null as Error | null })),
  syncPersistedTransaction: vi.fn(async () => 'tx-1'),
  getCurrentCompanyId: vi.fn(() => 'company-1'),
  getGameState: vi.fn(() => ({ prestige: 0, currentYear: 2026, season: 'Spring' })),
  recordMarketBuyerSale: vi.fn(async () => undefined),
  recordBuyerSale: vi.fn(async () => undefined),
  addMessage: vi.fn(async () => undefined),
  triggerTopicUpdate: vi.fn(),
  listGrapeBatchOnGlobalMarket: vi.fn(async () => ({ data: { transaction: { id: 'tx-global', week: 1, season: 'Spring', year: 2026, amount: 100, description: 'global listing', category: 'Grape Sales', recurring: false, money: 1100 } }, error: null })),
  getCompany: vi.fn(async () => ({ name: 'Test Winery' })),
}));

vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  getInventoryBatchById: mocks.getInventoryBatchById,
}));
vi.mock('@/lib/database/activities/inventoryDB', () => ({ sellStorageBackedWineBatch: mocks.sellStorageBackedWineBatch }));
vi.mock('@/lib/database/market/globalGrapeMarketListingsDB', () => ({ listGrapeBatchOnGlobalMarket: mocks.listGrapeBatchOnGlobalMarket }));
vi.mock('@/lib/features/company', () => ({ companyFeature: { records: { get: mocks.getCompany } } }));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState }));
vi.mock('@/lib/services/finance/financeService', () => ({ syncPersistedTransaction: mocks.syncPersistedTransaction }));
vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: mocks.getCurrentCompanyId }));
vi.mock('@/lib/services/sales/grapeBuyerMarketService', () => ({ recordMarketBuyerSale: mocks.recordMarketBuyerSale }));
vi.mock('@/lib/services', () => ({ recordBuyerSale: mocks.recordBuyerSale }));
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: mocks.addMessage } }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerTopicUpdate: mocks.triggerTopicUpdate }));
vi.mock('@/lib/services/wine/winescore/wineScoreCalculation', () => ({ calculateWineScore: () => 0.6 }));

const batch = {
  id: 'batch-1', quantity: 100, state: 'grapes', grape: 'Chardonnay', structureIndex: 0.6, tasteQualityIndex: 0.6,
} as unknown as WineBatch;

const buyer = {
  id: 'seasonal_buyer', name: 'Seasonal Merchant', description: '', priceMultiplier: 1,
  floorPricePerKg: 0, buyerCategory: 'seasonal' as const,
};

describe('sellGrapes inventory seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInventoryBatchById.mockResolvedValue(batch);
  });

  it('consumes a fully sold batch through the storage-aware inventory command and records the sale', async () => {
    const { sellGrapes } = await import('@/lib/services/sales/sellGrapesService');
    const result = await sellGrapes(batch.id, buyer, 100);
    expect(result.success).toBe(true);
    expect(mocks.sellStorageBackedWineBatch).toHaveBeenCalledWith(expect.objectContaining({ batchId: batch.id, quantity: 100 }));
    expect(mocks.syncPersistedTransaction).toHaveBeenCalledOnce();
    expect(mocks.recordBuyerSale).toHaveBeenCalledWith('seasonal_buyer', 100, 2026);
  });

  it('uses the storage-aware inventory command for a partial sale', async () => {
    const { sellGrapes } = await import('@/lib/services/sales/sellGrapesService');
    const result = await sellGrapes(batch.id, buyer, 40);
    expect(result.success).toBe(true);
    expect(mocks.sellStorageBackedWineBatch).toHaveBeenCalledWith(expect.objectContaining({ batchId: batch.id, quantity: 40 }));
  });

  it('does not record follow-up progression when the atomic sale fails', async () => {
    mocks.sellStorageBackedWineBatch.mockResolvedValueOnce({ data: null, error: new Error('sale failed') });
    const { sellGrapes } = await import('@/lib/services/sales/sellGrapesService');
    const result = await sellGrapes(batch.id, buyer, 40);
    expect(result.success).toBe(false);
    expect(mocks.syncPersistedTransaction).not.toHaveBeenCalled();
    expect(mocks.recordBuyerSale).not.toHaveBeenCalled();
  });

  it('routes the Bulk Grape Merchant through the global listing settlement instead of a direct buyer sale', async () => {
    const { sellGrapes } = await import('@/lib/services/sales/sellGrapesService');
    const result = await sellGrapes(batch.id, {
      ...buyer,
      id: 'bulk_buyer',
      name: 'Bulk Grape Merchant',
      buyerCategory: 'bulk',
    }, 40);

    expect(result.success).toBe(true);
    expect(mocks.listGrapeBatchOnGlobalMarket).toHaveBeenCalledWith(expect.objectContaining({
      batchId: batch.id,
      quantityKg: 40,
    }));
    expect(mocks.sellStorageBackedWineBatch).not.toHaveBeenCalled();
    expect(mocks.recordBuyerSale).not.toHaveBeenCalled();
  });
});
