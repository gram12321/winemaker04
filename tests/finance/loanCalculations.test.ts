import { describe, it, expect } from 'vitest';
import type { Lender, Loan } from '@/lib/types/types';
import {
  calculateEffectiveInterestRate,
  calculateSeasonalPayment,
  calculateCreditRatingModifier,
  calculateLoanTerms,
  calculateOriginationFee,
  estimatePrepaymentPenalty,
} from '@/lib/features/loanLender/services/finance/loanCalculations';

const lender: Lender = {
  id: 'lender-1',
  name: 'Test Bank',
  type: 'Bank',
  riskTolerance: 0.5,
  flexibility: 0.5,
  marketPresence: 0.5,
  baseInterestRate: 0.05,
  minLoanAmount: 1_000,
  maxLoanAmount: 1_000_000,
  minDurationSeasons: 4,
  maxDurationSeasons: 120,
  originationFee: {
    basePercent: 0.02,
    minFee: 500,
    maxFee: 10_000,
    creditRatingModifier: 0.7,
    durationModifier: 1.2,
  },
};

const loan: Loan = {
  id: 'loan-1',
  lenderId: lender.id,
  lenderName: lender.name,
  lenderType: lender.type,
  principalAmount: 10_000,
  baseInterestRate: lender.baseInterestRate,
  economyPhaseAtCreation: 'Stable',
  effectiveInterestRate: 0.05,
  originationFee: 500,
  remainingBalance: 1_000,
  seasonalPayment: 2_750,
  seasonsRemaining: 4,
  totalSeasons: 4,
  startDate: { week: 1, season: 'Spring', year: 2026 },
  nextPaymentDue: { week: 1, season: 'Summer', year: 2026 },
  missedPayments: 0,
  status: 'active',
};

describe('calculateEffectiveInterestRate', () => {
  const baseRate = 0.05; // 5% base rate

  it('applies economy phase multipliers correctly', () => {
    const rates = {
      expansion: calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4),
      recession: calculateEffectiveInterestRate(baseRate, 'Recession', 'Bank', 0.7, 4),
      stable: calculateEffectiveInterestRate(baseRate, 'Stable', 'Bank', 0.7, 4)
    };

    // Recession should have higher rates, expansion should have lower rates
    expect(rates.recession).toBeGreaterThan(rates.expansion);
    expect(rates.stable).not.toBe(baseRate); // Should be modified
  });

  it('applies lender type multipliers correctly', () => {
    const rates = {
      bank: calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4),
      quickLoan: calculateEffectiveInterestRate(baseRate, 'Expansion', 'QuickLoan', 0.7, 4),
      privateLender: calculateEffectiveInterestRate(baseRate, 'Expansion', 'Private Lender', 0.7, 4)
    };

    // QuickLoan should have highest rates, Bank should have lowest
    expect(rates.quickLoan).toBeGreaterThan(rates.bank);
    expect(rates.privateLender).toBeGreaterThan(rates.bank);
  });

  it('applies credit rating modifier correctly', () => {
    const excellentCredit = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.9, 4);
    const goodCredit = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.7, 4);
    const poorCredit = calculateEffectiveInterestRate(baseRate, 'Expansion', 'Bank', 0.3, 4);

    // Better credit should result in lower rates
    expect(excellentCredit).toBeLessThan(goodCredit);
    expect(goodCredit).toBeLessThan(poorCredit);
  });

  it('scales proportionally with base rate', () => {
    const lowBase = calculateEffectiveInterestRate(0.03, 'Expansion', 'Bank', 0.7, 4);
    const highBase = calculateEffectiveInterestRate(0.08, 'Expansion', 'Bank', 0.7, 4);

    expect(highBase).toBeGreaterThan(lowBase);
    // Should scale roughly proportionally (allowing for modifiers)
    expect(highBase / lowBase).toBeCloseTo(0.08 / 0.03, 1);
  });
});

describe('calculateCreditRatingModifier', () => {
  it('returns lower modifier for higher credit ratings', () => {
    const excellent = calculateCreditRatingModifier(0.9);
    const good = calculateCreditRatingModifier(0.7);
    const poor = calculateCreditRatingModifier(0.3);

    // Better credit = lower modifier (less penalty)
    expect(excellent).toBeLessThan(good);
    expect(good).toBeLessThan(poor);
  });

  it('matches the documented credit modifier formula at a representative rating', () => {
    expect(calculateCreditRatingModifier(0.7)).toBeCloseTo(1.01, 10);
  });
});

describe('calculateSeasonalPayment', () => {
  it('calculates payment for a simple loan', () => {
    const principal = 10000;
    const rate = 0.05; // 5% per season
    const seasons = 4; // 1 year

    const payment = calculateSeasonalPayment(principal, rate, seasons);

    // Payment should be positive and less than principal (for amortizing loan)
    expect(payment).toBeGreaterThan(0);
    expect(payment).toBeGreaterThan(principal / seasons); // Should include interest
  });

  it('returns higher payments for higher interest rates', () => {
    const principal = 10000;
    const seasons = 4;

    const lowRate = calculateSeasonalPayment(principal, 0.03, seasons);
    const highRate = calculateSeasonalPayment(principal, 0.08, seasons);

    expect(highRate).toBeGreaterThan(lowRate);
  });

  it('returns lower payments for longer loan terms', () => {
    const principal = 10000;
    const rate = 0.05;

    const shortTerm = calculateSeasonalPayment(principal, rate, 4);
    const longTerm = calculateSeasonalPayment(principal, rate, 12);

    // Longer terms = lower payments (more payments spread out)
    expect(longTerm).toBeLessThan(shortTerm);
  });

  it('handles zero principal gracefully', () => {
    const payment = calculateSeasonalPayment(0, 0.05, 4);

    expect(payment).toBe(0);
  });
});

describe('loan terms and fees', () => {
  it('keeps the loan term totals internally consistent', () => {
    const terms = calculateLoanTerms(lender, 20_000, 12, 0.7, 'Stable');

    expect(terms.totalRepayment).toBeCloseTo(terms.seasonalPayment * 12, 10);
    expect(terms.totalInterest).toBeCloseTo(terms.totalRepayment - 20_000, 10);
    expect(terms.totalExpenses).toBeCloseTo(terms.originationFee + terms.totalInterest, 10);
  });

  it('keeps origination fees within the lender limits', () => {
    expect(calculateOriginationFee(1_000, lender, 0.9, 4)).toBe(500);
    expect(calculateOriginationFee(1_000_000, lender, 0.1, 120)).toBe(10_000);
  });

  it('bounds the prepayment penalty by the remaining scheduled interest', () => {
    expect(estimatePrepaymentPenalty(loan)).toBe(2_500);
    expect(estimatePrepaymentPenalty({ ...loan, remainingBalance: 11_000 })).toBe(0);
  });
});
