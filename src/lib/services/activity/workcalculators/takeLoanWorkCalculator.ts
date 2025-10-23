import { WorkCategory } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';

/**
 * Calculate work required for taking a loan
 * Base work for accepting as-is, penalty for adjustments
 */
export function calculateTakeLoanWork(isAdjusted: boolean = false): {
  totalWork: number;
  factors: WorkFactor[];
} {
  const rate = TASK_RATES[WorkCategory.TAKE_LOAN];
  const initialWork = INITIAL_WORK[WorkCategory.TAKE_LOAN];
  
  // Adjustment penalty: 50% more work if user adjusts the offer
  const adjustmentModifier = isAdjusted ? 0.5 : 0;
  
  const totalWork = calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers: [adjustmentModifier]
  });

  // Build work factors for UI display
  const factors: WorkFactor[] = [
    { label: 'Loan Processing', value: 1, unit: 'loan', isPrimary: true },
    { label: 'Processing Rate', value: rate, unit: 'loans/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];

  // Add adjustment penalty if applicable
  if (isAdjusted) {
    factors.push({
      label: 'Offer Adjustment',
      value: 'Custom terms negotiated',
      modifier: adjustmentModifier,
      modifierLabel: 'negotiation complexity'
    });
  }

  return { totalWork, factors };
}

