import { WorkCategory, LenderSearchOptions } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';

/**
 * Calculate work required for lender search activity
 * Work increases with:
 * - Number of offers requested
 * - Constraining lender types (requires more selective searching)
 */
export function calculateLenderSearchWork(options: LenderSearchOptions): {
  totalWork: number;
  factors: WorkFactor[];
} {
  const rate = TASK_RATES[WorkCategory.LENDER_SEARCH];
  const initialWork = INITIAL_WORK[WorkCategory.LENDER_SEARCH];
  
  // Number of offers modifier
  const numberOfOffers = Math.max(3, Math.min(10, options.numberOfOffers || 3));
  const offersMultiplier = 1 + ((numberOfOffers - 3) * 0.2); // 1.0-2.4 for 3-10 offers
  
  // Lender type constraint - constraining types increases work
  let lenderTypeMultiplier = 1;
  const totalLenderTypes = 3; // Bank, Investment Fund, Private Lender
  const selectedTypes = options.lenderTypes.length;
  
  if (selectedTypes > 0 && selectedTypes < totalLenderTypes) {
    // More selective search requires more work
    const restrictionRatio = (totalLenderTypes - selectedTypes) / totalLenderTypes;
    lenderTypeMultiplier = 1 + (restrictionRatio * 0.5); // 1.0-1.5 multiplier
  }
  
  // Multiply the constraints together
  const totalMultiplier = offersMultiplier * lenderTypeMultiplier;
  
  // Convert to work modifiers format
  const workModifiers = [totalMultiplier - 1];
  
  const totalWork = calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers
  });

  // Build work factors for UI display
  const factors: WorkFactor[] = [
    { label: 'Loan Offers', value: numberOfOffers, unit: 'offers', isPrimary: true },
    { label: 'Processing Rate', value: rate, unit: 'offers/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];

  // Add constraint factors
  if (offersMultiplier > 1) {
    factors.push({
      label: 'Number of Offers',
      value: `${numberOfOffers} offers`,
      modifier: offersMultiplier - 1,
      modifierLabel: 'multiple offers complexity'
    });
  }

  if (lenderTypeMultiplier > 1) {
    factors.push({
      label: 'Lender Type Filter',
      value: `${selectedTypes}/${totalLenderTypes} types selected`,
      modifier: lenderTypeMultiplier - 1,
      modifierLabel: 'selective filtering complexity'
    });
  }

  return { totalWork, factors };
}

/**
 * Calculate cost for lender search
 * Base cost + complexity multipliers
 */
export function calculateLenderSearchCost(options: LenderSearchOptions): number {
  const baseCost = 500; // Base search cost
  const numberOfOffers = Math.max(3, Math.min(10, options.numberOfOffers || 3));
  
  // Cost increases with number of offers
  const offersCostMultiplier = 1 + ((numberOfOffers - 3) * 0.3); // 1.0-3.1 for 3-10 offers
  
  // Cost increases slightly when filtering by lender type
  let lenderTypeMultiplier = 1;
  const totalLenderTypes = 3;
  const selectedTypes = options.lenderTypes.length;
  
  if (selectedTypes > 0 && selectedTypes < totalLenderTypes) {
    const restrictionRatio = (totalLenderTypes - selectedTypes) / totalLenderTypes;
    lenderTypeMultiplier = 1 + (restrictionRatio * 0.4); // 1.0-1.4
  }
  
  return Math.round(baseCost * offersCostMultiplier * lenderTypeMultiplier);
}

