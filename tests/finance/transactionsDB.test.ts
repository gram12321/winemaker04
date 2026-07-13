import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/database/core/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(),
    },
  },
}));

import { insertTransaction, insertTransactionWithFundsCheck } from '@/lib/database/core/transactionsDB';

const transaction = {
  company_id: 'company-1',
  amount: -500,
  description: 'Purchase',
  category: 'Supplies',
  recurring: false,
  week: 2,
  season: 'Summer' as const,
  year: 2026,
};

describe('transaction persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: { id: 'tx-1', money: 500 }, error: null });
  });

  it('records ordinary transactions through the atomic company balance command', async () => {
    await expect(insertTransaction(transaction)).resolves.toMatchObject({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith('record_company_transaction', expect.objectContaining({
      p_company_id: 'company-1',
      p_require_funds: false,
    }));
  });

  it('enables the funds guard only for guarded purchases', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(insertTransactionWithFundsCheck(transaction)).resolves.toEqual({ success: false, error: 'Insufficient funds.' });
    expect(mocks.rpc).toHaveBeenCalledWith('record_company_transaction', expect.objectContaining({ p_require_funds: true }));
  });
});
