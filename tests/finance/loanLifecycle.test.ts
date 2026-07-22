import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lender, Loan } from '@/lib/types/types';

const mocks = vi.hoisted(() => {
  let state: any = {};

  return {
    uuid: vi.fn(() => 'loan-1'),
    setState: (nextState: any) => {
      state = nextState;
    },
    getGameState: vi.fn(() => state),
    getCurrentPrestige: vi.fn(async () => state.prestige ?? 0),
    updateGameState: vi.fn(async updates => {
      state = { ...state, ...updates };
    }),
    addTransaction: vi.fn(async () => undefined),
    calculateTotalAssets: vi.fn(async () => 500000),
    insertLoan: vi.fn(async () => undefined),
    loadActiveLoans: vi.fn(async (): Promise<Loan[]> => []),
    updateLoan: vi.fn(async () => true),
    clearLoanWarning: vi.fn(async () => undefined),
    setLoanWarning: vi.fn(async () => undefined),
    loadLenders: vi.fn(async () => []),
    updateLenderBlacklist: vi.fn(async () => true),
    notificationAddMessage: vi.fn(async () => undefined),
    triggerGameUpdate: vi.fn(() => undefined),
    calculateCreditRating: vi.fn(async () => ({ finalRating: 0.8 })),
    calculateLenderAvailability: vi.fn(() => ({ isAvailable: true })),
    initializeLenders: vi.fn(async () => undefined),
    getAllLenders: vi.fn(async () => []),
    insertPrestigeEvent: vi.fn(async () => undefined),
    loadVineyards: vi.fn(async () => []),
    deleteVineyards: vi.fn(async () => true),
    loadWineBatches: vi.fn(async () => []),
    bulkUpdateWineBatches: vi.fn(async () => true)
  };
});

vi.mock('uuid', () => ({
  v4: mocks.uuid
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
  getCurrentPrestige: mocks.getCurrentPrestige,
  updateGameState: mocks.updateGameState
}));

vi.mock('@/lib/services/finance/financeService', () => ({
  addTransaction: mocks.addTransaction,
  calculateTotalAssets: mocks.calculateTotalAssets
}));

vi.mock('@/lib/database/core/loansDB', () => ({
  insertLoan: mocks.insertLoan,
  loadActiveLoans: mocks.loadActiveLoans,
  updateLoan: mocks.updateLoan,
  clearLoanWarning: mocks.clearLoanWarning,
  setLoanWarning: mocks.setLoanWarning
}));

vi.mock('@/lib/database/core/lendersDB', () => ({
  loadLenders: mocks.loadLenders,
  updateLenderBlacklist: mocks.updateLenderBlacklist
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.notificationAddMessage }
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate
}));

vi.mock('@/lib/features/loanLender/services/finance/creditRatingService', () => ({
  calculateCreditRating: mocks.calculateCreditRating
}));

vi.mock('@/lib/features/loanLender/services/finance/lenderService', () => ({
  calculateLenderAvailability: mocks.calculateLenderAvailability,
  initializeLenders: mocks.initializeLenders,
  getAllLenders: mocks.getAllLenders
}));

vi.mock('@/lib/features/prestige/database/prestigeEventsDB', () => ({
  insertPrestigeEvent: mocks.insertPrestigeEvent
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: mocks.loadVineyards,
  deleteVineyards: mocks.deleteVineyards
}));

vi.mock('@/lib/database/activities/inventoryDB', () => ({
  loadWineBatches: mocks.loadWineBatches,
  bulkUpdateWineBatches: mocks.bulkUpdateWineBatches
}));

function lender(overrides: Partial<Lender> = {}): Lender {
  return {
    id: 'lender-1',
    name: 'Reliable Bank',
    type: 'Bank',
    riskTolerance: 0.4,
    flexibility: 0.5,
    marketPresence: 0.5,
    baseInterestRate: 0.05,
    minLoanAmount: 1000,
    maxLoanAmount: 100000,
    minDurationSeasons: 4,
    maxDurationSeasons: 20,
    originationFee: {
      basePercent: 0.02,
      minFee: 100,
      maxFee: 5000,
      creditRatingModifier: 0.8,
      durationModifier: 1.1
    },
    blacklisted: false,
    ...overrides
  };
}

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1',
    lenderId: 'lender-1',
    lenderName: 'Reliable Bank',
    lenderType: 'Bank',
    principalAmount: 10000,
    baseInterestRate: 0.05,
    economyPhaseAtCreation: 'Stable',
    effectiveInterestRate: 0.05,
    originationFee: 100,
    remainingBalance: 10000,
    seasonalPayment: 1000,
    seasonsRemaining: 4,
    totalSeasons: 4,
    startDate: { week: 1, season: 'Spring', year: 2026 },
    nextPaymentDue: { week: 1, season: 'Summer', year: 2026 },
    missedPayments: 0,
    status: 'active',
    isForced: false,
    loanCategory: 'standard',
    ...overrides
  };
}

describe('loan lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setState({
      week: 1,
      season: 'Spring',
      currentYear: 2026,
      economyPhase: 'Stable',
      money: 50000,
      prestige: 0,
      loanPenaltyWork: 0
    });
    mocks.calculateCreditRating.mockResolvedValue({ finalRating: 0.8 });
    mocks.calculateTotalAssets.mockResolvedValue(500000);
  });

  it('applies for a loan by inserting terms, booking principal and fee transactions, and adding administration burden', async () => {
    const { applyForLoan } = await import('@/lib/features/loanLender/services/finance/loanService');

    await expect(applyForLoan('lender-1', 20000, 4, lender())).resolves.toBe('loan-1');

    expect(mocks.insertLoan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'loan-1',
      lenderId: 'lender-1',
      lenderName: 'Reliable Bank',
      principalAmount: 20000,
      remainingBalance: 20000,
      status: 'active',
      nextPaymentDue: { week: 1, season: 'Summer', year: 2026 },
      loanCategory: 'standard',
      effectiveInterestRate: expect.any(Number),
      seasonalPayment: expect.any(Number),
      originationFee: expect.any(Number)
    }));
    expect(mocks.addTransaction).toHaveBeenNthCalledWith(
      1,
      20000,
      'Loan received from Reliable Bank',
      expect.any(String),
      false
    );
    expect(mocks.addTransaction).toHaveBeenNthCalledWith(
      2,
      expect.any(Number),
      'Origination fee for loan from Reliable Bank',
      expect.any(String),
      false
    );
    expect(mocks.updateGameState).toHaveBeenCalledWith(expect.objectContaining({
      loanPenaltyWork: expect.any(Number)
    }));
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
  }, 15000);

  it('scales loan prestige penalties harder for already famous companies while respecting the cap', async () => {
    const { calculatePrestigePenaltyWithFame } = await import('@/lib/features/loanLender/services/finance/loanService');

    expect(calculatePrestigePenaltyWithFame(-25, 0, { rate: 0.02, cap: 25 })).toBe(-25);
    expect(calculatePrestigePenaltyWithFame(-25, 100, { rate: 0.02, cap: 25 })).toBe(-27);
    expect(calculatePrestigePenaltyWithFame(-25, 2000, { rate: 0.02, cap: 25 })).toBe(-50);
    expect(calculatePrestigePenaltyWithFame(-25, -100, { rate: 0.02, cap: 25 })).toBe(-25);
  });

  it('processes a due seasonal payment and schedules the next payment date', async () => {
    mocks.setState({
      week: 1,
      season: 'Summer',
      currentYear: 2026,
      economyPhase: 'Stable',
      money: 20000,
      loanPenaltyWork: 0
    });
    mocks.loadActiveLoans.mockResolvedValue([loan()]);
    const { processSeasonalLoanPayments } = await import('@/lib/features/loanLender/services/finance/loanService');

    await processSeasonalLoanPayments();

    expect(mocks.addTransaction).toHaveBeenCalledWith(
      -1000,
      'Loan payment to Reliable Bank',
      expect.any(String),
      false
    );
    expect(mocks.updateLoan).toHaveBeenCalledWith('loan-1', {
      remainingBalance: 9000,
      seasonsRemaining: 3,
      nextPaymentDue: { week: 1, season: 'Fall', year: 2026 },
      missedPayments: 0
    });
    expect(mocks.calculateCreditRating).toHaveBeenCalled();
    expect(mocks.triggerGameUpdate).toHaveBeenCalledOnce();
  }, 15000);
});
