import type { EconomyPhase, Lender, LenderType, Loan } from "@/lib/types/types";
import {
  DURATION_INTEREST_MODIFIERS,
  LENDER_TYPE_MULTIPLIERS,
  LOAN_PREPAYMENT,
} from "@/lib/constants/loanConstants";
import { ECONOMY_INTEREST_MULTIPLIERS } from "@/lib/constants/economyConstants";

export function calculateCreditRatingModifier(creditRating: number): number {
  return 0.8 + 0.7 * (1 - creditRating);
}

export function calculateEffectiveInterestRate(
  baseRate: number,
  economyPhase: EconomyPhase,
  lenderType: LenderType,
  creditRating: number,
  durationSeasons?: number,
): number {
  const durationMultiplier = !durationSeasons
    ? 1
    : durationSeasons <= DURATION_INTEREST_MODIFIERS.SHORT_TERM.maxSeasons
      ? DURATION_INTEREST_MODIFIERS.SHORT_TERM.modifier
      : durationSeasons <= DURATION_INTEREST_MODIFIERS.MEDIUM_TERM.maxSeasons
        ? DURATION_INTEREST_MODIFIERS.MEDIUM_TERM.modifier
        : durationSeasons <= DURATION_INTEREST_MODIFIERS.LONG_TERM.maxSeasons
          ? DURATION_INTEREST_MODIFIERS.LONG_TERM.modifier
          : DURATION_INTEREST_MODIFIERS.VERY_LONG_TERM.modifier;

  return (
    baseRate *
    ECONOMY_INTEREST_MULTIPLIERS[economyPhase] *
    LENDER_TYPE_MULTIPLIERS[lenderType] *
    calculateCreditRatingModifier(creditRating) *
    durationMultiplier
  );
}

export function calculateSeasonalPayment(
  principal: number,
  rate: number,
  seasons: number,
): number {
  if (rate === 0) {
    return principal / seasons;
  }

  return (
    (principal * (rate * (1 + rate) ** seasons)) / ((1 + rate) ** seasons - 1)
  );
}

export function calculateOriginationFee(
  principalAmount: number,
  lender: Lender,
  creditRating: number,
  durationSeasons: number,
): number {
  const feeConfig = lender.originationFee;
  const creditModifier =
    creditRating >= 0.8
      ? feeConfig.creditRatingModifier
      : creditRating >= 0.6
        ? 0.9 + (feeConfig.creditRatingModifier - 0.9) * 0.5
        : creditRating >= 0.4
          ? 1
          : creditRating >= 0.2
            ? 1 + (1.5 - feeConfig.creditRatingModifier) * 0.3
            : 1 + (1.5 - feeConfig.creditRatingModifier) * 0.6;
  const durationModifier =
    durationSeasons <= 16
      ? 0.9 + (feeConfig.durationModifier - 1) * 0.1
      : durationSeasons <= 40
        ? 1
        : durationSeasons <= 80
          ? 1 + (feeConfig.durationModifier - 1) * 0.5
          : feeConfig.durationModifier;

  return Math.round(
    Math.max(
      feeConfig.minFee,
      Math.min(
        feeConfig.maxFee,
        principalAmount *
          feeConfig.basePercent *
          creditModifier *
          durationModifier,
      ),
    ),
  );
}

export function calculateLoanTerms(
  lender: Lender,
  principalAmount: number,
  durationSeasons: number,
  creditRating: number,
  economyPhase: EconomyPhase,
) {
  const effectiveInterestRate = calculateEffectiveInterestRate(
    lender.baseInterestRate,
    economyPhase,
    lender.type,
    creditRating,
    durationSeasons,
  );
  const seasonalPayment = calculateSeasonalPayment(
    principalAmount,
    effectiveInterestRate,
    durationSeasons,
  );
  const totalInterest = seasonalPayment * durationSeasons - principalAmount;
  const originationFee = calculateOriginationFee(
    principalAmount,
    lender,
    creditRating,
    durationSeasons,
  );

  return {
    effectiveInterestRate,
    seasonalPayment,
    totalRepayment: seasonalPayment * durationSeasons,
    totalInterest,
    originationFee,
    totalExpenses: originationFee + totalInterest,
  };
}

export function calculateTotalInterest(loan: Loan): number {
  return loan.seasonalPayment * loan.totalSeasons - loan.principalAmount;
}

export function calculateTotalExpenses(loan: Loan): number {
  return loan.originationFee + calculateTotalInterest(loan);
}

export function calculateRemainingInterest(loan: Loan): number {
  return loan.seasonalPayment * loan.seasonsRemaining - loan.remainingBalance;
}

export function estimatePrepaymentPenalty(loan: Loan): number {
  const remainingInterest = Math.max(0, calculateRemainingInterest(loan));
  if (remainingInterest <= 0) {
    return 0;
  }

  return Math.round(
    Math.min(
      remainingInterest,
      Math.max(
        LOAN_PREPAYMENT.MIN_PENALTY,
        remainingInterest * LOAN_PREPAYMENT.REMAINING_INTEREST_FACTOR,
      ),
    ),
  );
}
