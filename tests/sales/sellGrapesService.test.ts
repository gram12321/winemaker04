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
}));

vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  getInventoryBatchById: mocks.getInventoryBatchById,
}));
vi.mock('@/lib/database/activities/inventoryDB', () => ({ sellStorageBackedWineBatch: mocks.sellStorageBackedWineBatch }));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState }));
vi.mock('@/lib/services/finance/financeService', () => ({ syncPersistedTransaction: mocks.syncPersistedTransaction }));
vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: mocks.getCurrentCompanyId }));
vi.mock('@/lib/services/sales/grapeBuyerMarketService', () => ({ recordMarketBuyerSale: mocks.recordMarketBuyerSale }));
vi.mock('@/lib/services', () => ({ recordBuyerSale: mocks.recordBuyerSale }));
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: mocks.addMessage } }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerTopicUpdate: mocks.triggerTopicUpdate }));
vi.mock('@/lib/services/wine/winescore/wineScoreCalculation', () => ({ calculateWineScore: () => 0.6 }));

const batch = {
  id: 'batch-1', quantity: 100, state: 'grapes', grape: 'Chardonnay',
} as unknown as WineBatch;

const buyer = {
  id: 'bulk_buyer', name: 'Bulk Grape Merchant', description: '', priceMultiplier: 1,
  floorPricePerKg: 0, buyerCategory: 'bulk' as const,
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
    expect(mocks.recordBuyerSale).toHaveBeenCalledWith('bulk_buyer', 100, 2026);
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
});
