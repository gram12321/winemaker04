import type { EconomyPhase, Lender, Loan, LoanOffer } from '@/lib/types/types';
import { LOAN_EXTRA_PAYMENT } from '@/lib/constants/loanConstants';
import { LOAN_AMOUNT_RANGES } from '@/lib/constants/loanConstants';
import { calculateTotalAssets } from '@/lib/services/finance/financeService';
import { getAllLenders } from './lenderService';
import { getCurrentCreditRating, getScaledLoanAmountLimit } from './loanService';
import { calculateLenderSearchCost, calculateLenderSearchWork } from '@/lib/services/activity/workcalculators/lenderSearchWorkCalculator';
import { calculateTakeLoanWork } from '@/lib/services/activity/workcalculators/takeLoanWorkCalculator';
import type { LenderSearchOptions } from '@/lib/types/types';
import type { WorkFactor } from '@/lib/services/activity/workcalculators/workCalculator';
import {
  calculateLoanTerms,
  calculateRemainingInterest,
  calculateTotalExpenses,
  calculateTotalInterest,
  estimatePrepaymentPenalty,
} from './loanCalculations';

export interface LoanPaymentSummary {
  totalInterest: number;
  totalExpenses: number;
  remainingInterest: number;
  prepaymentPenalty: number;
  fullRepaymentAmount: number;
  extraPaymentAdminFee: number;
  extraPaymentTotal: number;
}

export interface BorrowerLoanCapacity {
  creditRating: number;
  totalAssets: number;
  maxAllowedLoanAmount: number;
}

export interface LenderSearchQuote {
  totalCost: number;
  totalWork: number;
  factors: WorkFactor[];
}

export function buildLenderSearchQuote(options: LenderSearchOptions): LenderSearchQuote {
  const work = calculateLenderSearchWork(options);
  return {
    totalCost: calculateLenderSearchCost(options),
    totalWork: work.totalWork,
    factors: work.factors,
  };
}

export function buildTakeLoanQuote(offer: LoanOffer, amount: number, durationSeasons: number) {
  return calculateTakeLoanWork(offer, amount, durationSeasons);
}

export async function loadBorrowerLoanCapacity(selectedLender?: Lender): Promise<BorrowerLoanCapacity> {
  const [creditRating, totalAssets] = await Promise.all([
    getCurrentCreditRating(),
    calculateTotalAssets(),
  ]);

  if (selectedLender) {
    const limit = await getScaledLoanAmountLimit(selectedLender, creditRating, { totalAssets });
    return {
      creditRating,
      totalAssets,
      maxAllowedLoanAmount: Math.max(
        LOAN_AMOUNT_RANGES.MIN,
        Math.min(limit.maxAllowed, selectedLender.maxLoanAmount, LOAN_AMOUNT_RANGES.MAX),
      ),
    };
  }

  const lenders = (await getAllLenders()).filter((lender) => !lender.blacklisted);
  const limits = await Promise.all(
    lenders.map((lender) => getScaledLoanAmountLimit(lender, creditRating, { totalAssets })),
  );
  const maxAllowedLoanAmount = limits.length > 0
    ? Math.max(...limits.map((limit) => limit.maxAllowed))
    : LOAN_AMOUNT_RANGES.MAX;

  return {
    creditRating,
    totalAssets,
    maxAllowedLoanAmount: Math.max(
      LOAN_AMOUNT_RANGES.MIN,
      Math.min(maxAllowedLoanAmount, LOAN_AMOUNT_RANGES.MAX),
    ),
  };
}

export function buildLoanOffer(
  offer: LoanOffer,
  lender: Lender,
  principalAmount: number,
  durationSeasons: number,
  creditRating: number,
  economyPhase: EconomyPhase,
): LoanOffer {
  return {
    ...offer,
    lender,
    principalAmount,
    durationSeasons,
    ...calculateLoanTerms(lender, principalAmount, durationSeasons, creditRating, economyPhase),
  };
}

export function buildLoanApplicationPayload(
  offer: LoanOffer,
  principalAmount: number,
  durationSeasons: number,
  creditRating: number,
  economyPhase: EconomyPhase,
) {
  const finalizedOffer = buildLoanOffer(
    offer,
    offer.lender,
    principalAmount,
    durationSeasons,
    creditRating,
    economyPhase,
  );

  return {
    offer: finalizedOffer,
    originalOffer: offer,
    adjustedAmount: principalAmount,
    adjustedDurationSeasons: durationSeasons,
    totalWork: buildTakeLoanQuote(offer, principalAmount, durationSeasons).totalWork,
  };
}

export function buildLoanPaymentSummary(loan: Loan): LoanPaymentSummary {
  const totalInterest = calculateTotalInterest(loan);
  const totalExpenses = calculateTotalExpenses(loan);
  const remainingInterest = calculateRemainingInterest(loan);
  const prepaymentPenalty = estimatePrepaymentPenalty(loan);
  const seasonalPaymentBase = Math.max(0, Math.round(loan.seasonalPayment));
  const extraPaymentAdminFee = Math.max(
    Math.round(seasonalPaymentBase * LOAN_EXTRA_PAYMENT.ADMIN_FEE_RATE),
    LOAN_EXTRA_PAYMENT.MIN_ADMIN_FEE,
  );

  return {
    totalInterest,
    totalExpenses,
    remainingInterest,
    prepaymentPenalty,
    fullRepaymentAmount: loan.remainingBalance + prepaymentPenalty,
    extraPaymentAdminFee,
    extraPaymentTotal: seasonalPaymentBase + extraPaymentAdminFee,
  };
}
