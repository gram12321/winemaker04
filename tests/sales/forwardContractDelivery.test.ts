import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrapeForwardContract, WineBatch } from '@/lib/types/types';

const mocks = vi.hoisted(() => ({
  getForwardContractById: vi.fn(),
  loadWineBatches: vi.fn(),
  deliverForwardContractInventory: vi.fn(),
  syncPersistedTransaction: vi.fn(async () => 'tx-1'),
  recordBuyerSale: vi.fn(async () => undefined),
  addContractOutcomePrestigeEvent: vi.fn(async () => undefined),
  addMessage: vi.fn(async () => undefined),
}));

vi.mock('@/lib/database/activities/inventoryDB', () => ({ loadWineBatches: mocks.loadWineBatches }));
vi.mock('@/lib/database/sales/forwardContractDB', () => ({
  getForwardContractById: mocks.getForwardContractById,
  deliverForwardContractInventory: mocks.deliverForwardContractInventory,
}));
vi.mock('@/lib/services/finance/financeService', () => ({
  addTransaction: vi.fn(), calculateCompanyValue: vi.fn(async () => 0), syncPersistedTransaction: mocks.syncPersistedTransaction,
}));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: () => ({ week: 4, season: 'Fall', currentYear: 2026 }), getCurrentPrestige: () => 0 }));
vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: () => 'company-1' }));
vi.mock('@/lib/services/sales/sellGrapesService', () => ({ getAvailableBuyers: vi.fn(async () => []) }));
vi.mock('@/lib/services/prestige/prestigeService', () => ({ addContractOutcomePrestigeEvent: mocks.addContractOutcomePrestigeEvent }));
vi.mock('@/lib/services/sales/grapeBuyerLoyaltyService', () => ({ recordBuyerSale: mocks.recordBuyerSale }));
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: mocks.addMessage } }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerGameUpdate: vi.fn(), triggerTopicUpdate: vi.fn() }));

const contract = {
  id: '11111111-1111-1111-1111-111111111111', companyId: 'company-1', buyerId: 'buyer-1', buyerName: 'Buyer',
  targetState: 'grapes', quantityKg: 150, deliveredKg: 0, unitPricePerKg: 4, totalValue: 600,
  upfrontPercent: 0.2, upfrontPaidAmount: 120, finalPaymentAmount: 480, defaultPenaltyAmount: 60,
  status: 'accepted', createdWeek: 1, createdSeason: 'Spring', createdYear: 2026,
  dueWeek: 8, dueSeason: 'Fall', dueYear: 2026,
} as GrapeForwardContract;

describe('forward contract delivery transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getForwardContractById.mockResolvedValue(contract);
    mocks.loadWineBatches.mockResolvedValue([
      { id: 'batch-1', state: 'grapes', grape: 'Chardonnay', quantity: 100 } as WineBatch,
      { id: 'batch-2', state: 'grapes', grape: 'Pinot Noir', quantity: 80 } as WineBatch,
    ]);
    mocks.deliverForwardContractInventory.mockResolvedValue({
      data: { transaction: { id: 'tx-1', week: 4, season: 'Fall', year: 2026, amount: 480, description: 'settlement', category: 'Forward Final Settlement In', recurring: false, money: 1480 } },
      error: null,
    });
  });

  it('consumes all delivery batches and settles the contract in one database command', async () => {
    const { autoDeliverForwardContract } = await import('@/lib/services/sales/forwardContractService');
    const result = await autoDeliverForwardContract(contract.id);

    expect(result.success).toBe(true);
    expect(mocks.deliverForwardContractInventory).toHaveBeenCalledWith(expect.objectContaining({
      contractId: contract.id,
      fulfilled: true,
      newDelivered: 150,
      consumptions: [{ batchId: 'batch-1', quantity: 100 }, { batchId: 'batch-2', quantity: 50 }],
    }));
    expect(mocks.syncPersistedTransaction).toHaveBeenCalledOnce();
  });
});
