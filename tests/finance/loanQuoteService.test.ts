import { describe, expect, it } from 'vitest';
import type { Lender, Loan, LoanOffer, LenderType } from '@/lib/types/types';
import { buildLoanApplicationPayload, buildLoanOffer, buildLoanPaymentSummary } from '@/lib/features/loanLender/services/finance/loanQuoteService';
import { calculateLenderSearchCost, calculateLenderSearchWork } from '@/lib/features/activities/services/workcalculators/lenderSearchWorkCalculator';
import { LENDER_TYPE_DISTRIBUTION, LOAN_AMOUNT_RANGES, LOAN_DURATION_RANGES } from '@/lib/constants/loanConstants';

const lender: Lender = {
  id: 'lender-1', name: 'Test Bank', type: 'Bank', riskTolerance: 0.5,
  flexibility: 0.5, marketPresence: 0.5, baseInterestRate: 0.05,
  minLoanAmount: 1_000, maxLoanAmount: 1_000_000,
  minDurationSeasons: 4, maxDurationSeasons: 120,
  originationFee: { basePercent: 0.02, minFee: 500, maxFee: 10_000, creditRatingModifier: 0.7, durationModifier: 1.2 },
};

const offer: LoanOffer = {
  id: 'offer-1', lender, principalAmount: 20_000, durationSeasons: 12,
  effectiveInterestRate: 0.05, seasonalPayment: 2_000, originationFee: 500,
  totalInterest: 4_000, totalExpenses: 4_500, isAvailable: true,
};

const loan: Loan = {
  id: 'loan-1', lenderId: lender.id, lenderName: lender.name, lenderType: lender.type,
  principalAmount: 20_000, baseInterestRate: 0.05, economyPhaseAtCreation: 'Stable',
  effectiveInterestRate: 0.05, originationFee: 500, remainingBalance: 10_000,
  seasonalPayment: 2_000, seasonsRemaining: 4, totalSeasons: 12,
  startDate: { week: 1, season: 'Spring', year: 2026 },
  nextPaymentDue: { week: 1, season: 'Summer', year: 2026 }, missedPayments: 0, status: 'active',
};

describe('loan quote service', () => {
  it('rebuilds terms for the selected amount and duration', () => {
    const quote = buildLoanOffer(offer, lender, 30_000, 24, 0.7, 'Stable');
    expect(quote.principalAmount).toBe(30_000);
    expect(quote.durationSeasons).toBe(24);
    expect(quote.totalExpenses).toBeCloseTo(quote.originationFee + quote.totalInterest, 10);
  });

  it('persists adjusted application values and work together', () => {
    const application = buildLoanApplicationPayload(offer, 30_000, 24, 0.7, 'Stable');
    expect(application.offer.principalAmount).toBe(30_000);
    expect(application.offer.durationSeasons).toBe(24);
    expect(application.adjustedAmount).toBe(30_000);
    expect(application.adjustedDurationSeasons).toBe(24);
    expect(application.totalWork).toBeGreaterThan(0);
  });

  it('uses one payment summary for full and extra repayment previews', () => {
    const summary = buildLoanPaymentSummary(loan);
    expect(summary.fullRepaymentAmount).toBe(loan.remainingBalance + summary.prepaymentPenalty);
    expect(summary.extraPaymentTotal).toBe(Math.round(loan.seasonalPayment) + summary.extraPaymentAdminFee);
  });

  it('uses the same restricted-range multipliers for search cost and work', () => {
    const baseOptions = {
      numberOfOffers: 3,
      lenderTypes: Object.keys(LENDER_TYPE_DISTRIBUTION) as LenderType[],
      loanAmountRange: [LOAN_AMOUNT_RANGES.MIN, LOAN_AMOUNT_RANGES.MAX] as [number, number],
      durationRange: [LOAN_DURATION_RANGES.MIN, LOAN_DURATION_RANGES.MAX] as [number, number],
      searchCost: 0,
      searchWork: 0,
    };
    const restrictedOptions = {
      ...baseOptions,
      loanAmountRange: [LOAN_AMOUNT_RANGES.MIN, LOAN_AMOUNT_RANGES.MIN + 5_000] as [number, number],
      durationRange: [LOAN_DURATION_RANGES.MIN, LOAN_DURATION_RANGES.MIN + 4] as [number, number],
    };

    expect(calculateLenderSearchCost(restrictedOptions)).toBeGreaterThan(calculateLenderSearchCost(baseOptions));
    expect(calculateLenderSearchWork(restrictedOptions).totalWork).toBeGreaterThan(calculateLenderSearchWork(baseOptions).totalWork);
  });
});
