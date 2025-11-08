import { WorkCategory, LoanOffer } from '@/lib/types/types';
import { WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { TAKE_LOAN_BASE_COST, LOAN_AMOUNT_RANGES, LOAN_DURATION_RANGES, LENDER_TYPE_COMPLEXITY } from '@/lib/constants/loanConstants';
import { clamp01 } from '@/lib/utils';

/**
 * Calculate work required for taking a loan with adjustments
 * Work increases with:
 * - How much the loan amount differs from the original offer
 * - How much the duration differs from the original offer
 * - Base work for loan processing
 */
export function calculateTakeLoanWork(
  originalOffer: LoanOffer,
  adjustedAmount: number,
  adjustedDurationSeasons: number
): {
  totalWork: number;
  factors: WorkFactor[];
} {
  const rate = TASK_RATES[WorkCategory.TAKE_LOAN];
  const initialWork = INITIAL_WORK[WorkCategory.TAKE_LOAN];
  
  // Normalize loan profile to gauge baseline complexity
  const normalizedAmount = clamp01(
    (adjustedAmount - LOAN_AMOUNT_RANGES.MIN) / (LOAN_AMOUNT_RANGES.MAX - LOAN_AMOUNT_RANGES.MIN)
  );
  const normalizedDuration = clamp01(
    (adjustedDurationSeasons - LOAN_DURATION_RANGES.MIN) / (LOAN_DURATION_RANGES.MAX - LOAN_DURATION_RANGES.MIN)
  );

  const amountComplexity = 0.7 + (normalizedAmount * 0.8); // 0.7 - 1.5 scaling
  const durationComplexity = 0.75 + (normalizedDuration * 0.55); // 0.75 - 1.3 scaling
  const lenderTypeComplexity = LENDER_TYPE_COMPLEXITY[originalOffer.lender.type] ?? 1;

  // Calculate deltas from original offer to capture manual adjustments
  const amountDelta = Math.abs(adjustedAmount - originalOffer.principalAmount) / originalOffer.principalAmount;
  const durationDelta = Math.abs(adjustedDurationSeasons - originalOffer.durationSeasons) / originalOffer.durationSeasons;
  
  // Base work for loan processing
  const baseWork = 1 / rate * BASE_WORK_UNITS;
  
  // Calculate adjustment multipliers
  let amountMultiplier = 1;
  let durationMultiplier = 1;
  
  // Amount adjustment scaling (similar to numberOfOffers in lender search)
  if (amountDelta > 0) {
    if (amountDelta <= 0.1) {
      // Small adjustments (0-10%): 1.0x to 1.3x
      amountMultiplier = 1 + (amountDelta * 3); // 1.0-1.3 for 0-10%
    } else if (amountDelta <= 0.5) {
      // Medium adjustments (10-50%): 1.3x to 2.1x
      const baseMultiplier = 1 + (0.1 * 3); // 1.3 for 10%
      amountMultiplier = baseMultiplier + ((amountDelta - 0.1) * 2); // 1.3-2.1 for 10-50%
    } else {
      // Large adjustments (50%+): exponential scaling
      const baseMultiplier = 1 + (0.1 * 3) + (0.4 * 2); // 2.1 for 50%
      const exponentialFactor = Math.pow(1.2, (amountDelta - 0.5) * 2); // 20% increase per 10% above 50%
      amountMultiplier = baseMultiplier * exponentialFactor;
    }
  }
  
  // Duration adjustment scaling (similar to amount scaling)
  if (durationDelta > 0) {
    if (durationDelta <= 0.1) {
      // Small adjustments (0-10%): 1.0x to 1.3x
      durationMultiplier = 1 + (durationDelta * 3); // 1.0-1.3 for 0-10%
    } else if (durationDelta <= 0.5) {
      // Medium adjustments (10-50%): 1.3x to 2.1x
      const baseMultiplier = 1 + (0.1 * 3); // 1.3 for 10%
      durationMultiplier = baseMultiplier + ((durationDelta - 0.1) * 2); // 1.3-2.1 for 10-50%
    } else {
      // Large adjustments (50%+): exponential scaling
      const baseMultiplier = 1 + (0.1 * 3) + (0.4 * 2); // 2.1 for 50%
      const exponentialFactor = Math.pow(1.2, (durationDelta - 0.5) * 2); // 20% increase per 10% above 50%
      durationMultiplier = baseMultiplier * exponentialFactor;
    }
  }
  
  // Combine adjustments (multiply deltas as requested)
  const adjustmentMultiplier = amountMultiplier * durationMultiplier;
  const complexityMultiplier = amountComplexity * durationComplexity * lenderTypeComplexity;
  const totalMultiplier = adjustmentMultiplier * complexityMultiplier;
  
  // Apply modifiers to base work
  const modifiedBaseWork = baseWork * totalMultiplier;
  
  // Final work = initial work + modified base work
  const totalWork = initialWork + modifiedBaseWork;

  // Build work factors for UI display
  const factors: WorkFactor[] = [
    { label: 'Loan Processing', value: 1, unit: 'loan', isPrimary: true },
    { label: 'Processing Rate', value: rate, unit: 'loans/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];

  // Add adjustment factors
  if (amountMultiplier > 1) {
    factors.push({
      label: 'Amount Adjustment',
      value: `${Math.round(amountDelta * 100)}% change`,
      modifier: amountMultiplier - 1,
      modifierLabel: amountDelta > 0.5 ? 'major amount change complexity' : 'amount adjustment complexity'
    });
  }

  if (durationMultiplier > 1) {
    factors.push({
      label: 'Duration Adjustment',
      value: `${Math.round(durationDelta * 100)}% change`,
      modifier: durationMultiplier - 1,
      modifierLabel: durationDelta > 0.5 ? 'major duration change complexity' : 'duration adjustment complexity'
    });
  }

  return { totalWork, factors };
}

/**
 * Calculate cost for taking a loan with adjustments
 * Base cost + adjustment multipliers
 */
export function calculateTakeLoanCost(
  originalOffer: LoanOffer,
  adjustedAmount: number,
  adjustedDurationSeasons: number
): number {
  const baseCost = TAKE_LOAN_BASE_COST;
  
  // Calculate deltas (same as work calculation)
  const amountDelta = Math.abs(adjustedAmount - originalOffer.principalAmount) / originalOffer.principalAmount;
  const durationDelta = Math.abs(adjustedDurationSeasons - originalOffer.durationSeasons) / originalOffer.durationSeasons;
  
  // Cost multipliers (similar to work but slightly different scaling)
  let amountCostMultiplier = 1;
  let durationCostMultiplier = 1;
  
  if (amountDelta > 0) {
    if (amountDelta <= 0.1) {
      amountCostMultiplier = 1 + (amountDelta * 2.5); // 1.0-1.25 for 0-10%
    } else if (amountDelta <= 0.5) {
      const baseMultiplier = 1 + (0.1 * 2.5); // 1.25 for 10%
      amountCostMultiplier = baseMultiplier + ((amountDelta - 0.1) * 1.5); // 1.25-1.85 for 10-50%
    } else {
      const baseMultiplier = 1 + (0.1 * 2.5) + (0.4 * 1.5); // 1.85 for 50%
      const exponentialFactor = Math.pow(1.15, (amountDelta - 0.5) * 2); // 15% increase per 10% above 50%
      amountCostMultiplier = baseMultiplier * exponentialFactor;
    }
  }
  
  if (durationDelta > 0) {
    if (durationDelta <= 0.1) {
      durationCostMultiplier = 1 + (durationDelta * 2.5); // 1.0-1.25 for 0-10%
    } else if (durationDelta <= 0.5) {
      const baseMultiplier = 1 + (0.1 * 2.5); // 1.25 for 10%
      durationCostMultiplier = baseMultiplier + ((durationDelta - 0.1) * 1.5); // 1.25-1.85 for 10-50%
    } else {
      const baseMultiplier = 1 + (0.1 * 2.5) + (0.4 * 1.5); // 1.85 for 50%
      const exponentialFactor = Math.pow(1.15, (durationDelta - 0.5) * 2); // 15% increase per 10% above 50%
      durationCostMultiplier = baseMultiplier * exponentialFactor;
    }
  }
  
  // Multiply the constraints together
  return Math.round(baseCost * amountCostMultiplier * durationCostMultiplier);
}