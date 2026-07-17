import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '@/lib/types/types';
import { addTransaction, clearTransactionsCache, loadTransactions, onCompanyActivated } from '@/lib/services/finance/financeService';

const mocks = vi.hoisted(() => {
  const persistedTransaction = { id: 'new-transaction', company_id: 'company-a', week: 2, season: 'Spring', year: 2026, amount: 100, description: 'New sale', category: 'Sales', recurring: false, money: 1_100 };
  const historicalTransaction: Transaction = { id: 'historical-transaction', date: { week: 1, season: 'Spring', year: 2026 }, amount: 500, description: 'Earlier sale', category: 'Sales', recurring: false, money: 1_000 };
  const newTransaction: Transaction = { id: persistedTransaction.id, date: { week: 2, season: 'Spring', year: 2026 }, amount: persistedTransaction.amount, description: persistedTransaction.description, category: persistedTransaction.category, recurring: persistedTransaction.recurring, money: persistedTransaction.money };
  return {
    persistedTransaction, historicalTransaction, newTransaction,
    getGameState: vi.fn(() => ({ week: 2, season: 'Spring', currentYear: 2026, money: 1_000 })),
    getCurrentCompany: vi.fn(() => ({ id: 'company-a' })),
    syncPersistedMoney: vi.fn(async () => undefined),
    insertTransaction: vi.fn(async () => ({ success: true, data: persistedTransaction })),
    loadTransactions: vi.fn(async () => [newTransaction, historicalTransaction]),
    triggerGameUpdate: vi.fn(),
  };
});

vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState, getCurrentCompany: mocks.getCurrentCompany, syncPersistedMoney: mocks.syncPersistedMoney }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerGameUpdate: mocks.triggerGameUpdate }));
vi.mock('@/lib/database', () => ({ insertTransaction: mocks.insertTransaction, loadTransactions: mocks.loadTransactions }));
vi.mock('@/lib/database/activities/vineyardDB', () => ({ loadVineyards: vi.fn(async () => []) }));
vi.mock('@/lib/database/activities/inventoryDB', () => ({ loadWineBatches: vi.fn(async () => []) }));
vi.mock('@/lib/features/loanLender', () => ({ loanLenderFeature: { metrics: { calculateTotalOutstandingLoans: vi.fn(async () => 0) } } }));
vi.mock('@/lib/services/wine/winescore/wineScoreCalculation', () => ({ calculateLandValuePriceMultiplier: vi.fn(() => 1) }));

describe('finance transaction cache', () => {
  beforeEach(() => { vi.clearAllMocks(); clearTransactionsCache(); });

  it('loads the complete ledger when a transaction is added before the company cache exists', async () => {
    await addTransaction(100, 'New sale', 'Sales', false, 'company-a');
    const transactions = await loadTransactions('company-a');
    expect(mocks.loadTransactions).toHaveBeenCalledWith('company-a');
    expect(transactions.map((transaction) => transaction.id)).toEqual(['new-transaction', 'historical-transaction']);
  });

  it('drops the newly activated company cache before it is used again', async () => {
    await loadTransactions('company-a');
    expect(mocks.loadTransactions).toHaveBeenCalledTimes(1);

    onCompanyActivated('company-a');
    await loadTransactions('company-a');

    expect(mocks.loadTransactions).toHaveBeenCalledTimes(2);
  });
});
