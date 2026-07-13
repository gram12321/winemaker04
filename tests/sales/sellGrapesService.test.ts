import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WineBatch } from '@/lib/types/types';

const mocks = vi.hoisted(() => ({
  getInventoryBatchById: vi.fn(),
  consumeInventoryBatchQuantity: vi.fn(async () => true),
  getGameState: vi.fn(() => ({ prestige: 0, currentYear: 2026, season: 'Spring' })),
  addTransaction: vi.fn(async () => undefined),
  recordMarketBuyerSale: vi.fn(async () => undefined),
  recordBuyerSale: vi.fn(async () => undefined),
  addMessage: vi.fn(async () => undefined),
  triggerTopicUpdate: vi.fn(),
}));

vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  getInventoryBatchById: mocks.getInventoryBatchById,
  consumeInventoryBatchQuantity: mocks.consumeInventoryBatchQuantity,
}));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState }));
vi.mock('@/lib/services/finance/financeService', () => ({ addTransaction: mocks.addTransaction }));
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
    expect(mocks.consumeInventoryBatchQuantity).toHaveBeenCalledWith(batch.id, 100);
    expect(mocks.addTransaction).toHaveBeenCalledOnce();
    expect(mocks.recordBuyerSale).toHaveBeenCalledWith('bulk_buyer', 100, 2026);
  });

  it('uses the storage-aware inventory command for a partial sale', async () => {
    const { sellGrapes } = await import('@/lib/services/sales/sellGrapesService');
    const result = await sellGrapes(batch.id, buyer, 40);
    expect(result.success).toBe(true);
    expect(mocks.consumeInventoryBatchQuantity).toHaveBeenCalledWith(batch.id, 40);
  });
});
