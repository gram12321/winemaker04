import { WorkCategory, LenderSearchOptions } from '@/lib/types/types';
import { WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { LENDER_SEARCH_BASE_COST, LENDER_TYPE_DISTRIBUTION } from '@/lib/constants/loanConstants';

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
  const allLenderTypes = Object.keys(LENDER_TYPE_DISTRIBUTION) as Array<keyof typeof LENDER_TYPE_DISTRIBUTION>;
  const selectedTypes = options.lenderTypes && options.lenderTypes.length > 0 ? options.lenderTypes : allLenderTypes;
  const selectedNonQuickTypes = selectedTypes.filter(type => type !== 'QuickLoan');
  const quickLoanCount = selectedTypes.filter(type => type === 'QuickLoan').length;
  const quickLoanSelected = quickLoanCount > 0;
  const totalNonQuickTypes = allLenderTypes.filter(type => type !== 'QuickLoan').length || 1;
  
  // Number of offers modifier - no upper limit, scales exponentially for high numbers
  const numberOfOffers = Math.max(1, options.numberOfOffers || 3);
  let offersMultiplier = 1;
  
  if (numberOfOffers <= 5) {
    // Linear scaling for 1-5 offers: 1.0x to 2.2x
    offersMultiplier = 1 + ((numberOfOffers - 1) * 0.3); // 1.0-2.2 for 1-5 offers
  } else if (numberOfOffers <= 10) {
    // Linear scaling for 6-10 offers: 2.2x to 3.7x
    const baseMultiplier = 1 + (4 * 0.3); // 2.2 for 5 offers
    offersMultiplier = baseMultiplier + ((numberOfOffers - 5) * 0.3); // 2.2-3.7 for 6-10 offers
  } else {
    // Exponential scaling for 10+ offers
    const baseMultiplier = 1 + (4 * 0.3) + (5 * 0.3); // 3.7 for 10 offers
    const exponentialFactor = Math.pow(1.15, numberOfOffers - 10); // 15% increase per offer above 10
    offersMultiplier = baseMultiplier * exponentialFactor;
  }
  
  // Lender type constraint - constraining types increases work
  let lenderTypeMultiplier = 1;
  const selectedNonQuickCount = selectedNonQuickTypes.length;
  
  if (selectedNonQuickCount > 0 && selectedNonQuickCount < totalNonQuickTypes) {
    // More selective search requires more work
    const restrictionRatio = (totalNonQuickTypes - selectedNonQuickCount) / totalNonQuickTypes;
    lenderTypeMultiplier = 1 + (restrictionRatio * 0.5); // 1.0-1.5 multiplier
  }

  // QuickLoan discount: including quick loans makes searches easier
  if (quickLoanSelected && selectedNonQuickCount < totalNonQuickTypes) {
    const totalSelectedCount = selectedTypes.length || 1;
    const quickProportion = quickLoanCount / totalSelectedCount;
    const pivotMultiplier = 1 / allLenderTypes.length;
    const quickDiscount = quickProportion * pivotMultiplier;
    lenderTypeMultiplier *= 1 - quickDiscount;
  }
  
  // Multiply the constraints together
  const totalMultiplier = offersMultiplier * lenderTypeMultiplier;
  
  // Calculate base work (without initial work)
  const baseWork = 1 / rate * BASE_WORK_UNITS; // 1 offer / rate * BASE_WORK_UNITS
  
  // Apply modifiers to base work
  const modifiedBaseWork = baseWork * totalMultiplier;
  
  // Final work = initial work + modified base work
  const totalWork = initialWork + modifiedBaseWork;

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
      modifierLabel: numberOfOffers > 10 ? 'exponential scaling complexity' : 'multiple offers complexity'
    });
  }

  if (lenderTypeMultiplier > 1) {
    const selectionSummary = `${selectedNonQuickCount}/${totalNonQuickTypes} core types${quickLoanSelected ? ' (+QuickLoan)' : ''}`;
    factors.push({
      label: 'Lender Type Filter',
      value: selectionSummary,
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
  const baseCost = LENDER_SEARCH_BASE_COST;
  const numberOfOffers = Math.max(1, options.numberOfOffers || 3);
  const allLenderTypes = Object.keys(LENDER_TYPE_DISTRIBUTION) as Array<keyof typeof LENDER_TYPE_DISTRIBUTION>;
  const selectedTypes = options.lenderTypes && options.lenderTypes.length > 0 ? options.lenderTypes : allLenderTypes;
  const selectedNonQuickTypes = selectedTypes.filter(type => type !== 'QuickLoan');
  const quickLoanCount = selectedTypes.filter(type => type === 'QuickLoan').length;
  const quickLoanSelected = quickLoanCount > 0;
  const totalNonQuickTypes = allLenderTypes.filter(type => type !== 'QuickLoan').length || 1;

  // QuickLoan fast-track: searching exclusively for QuickLoan offers is free
  if (
    selectedTypes.length > 0 &&
    selectedTypes.every((type) => type === 'QuickLoan')
  ) {
    return 0;
  }
  
  // Cost increases with number of offers - same scaling as work
  let offersCostMultiplier = 1;
  
  if (numberOfOffers <= 5) {
    // Linear scaling for 1-5 offers: 1.0x to 2.6x
    offersCostMultiplier = 1 + ((numberOfOffers - 1) * 0.4); // 1.0-2.6 for 1-5 offers
  } else if (numberOfOffers <= 10) {
    // Linear scaling for 6-10 offers: 2.6x to 4.6x
    const baseMultiplier = 1 + (4 * 0.4); // 2.6 for 5 offers
    offersCostMultiplier = baseMultiplier + ((numberOfOffers - 5) * 0.4); // 2.6-4.6 for 6-10 offers
  } else {
    // Exponential scaling for 10+ offers
    const baseMultiplier = 1 + (4 * 0.4) + (5 * 0.4); // 4.6 for 10 offers
    const exponentialFactor = Math.pow(1.2, numberOfOffers - 10); // 20% increase per offer above 10
    offersCostMultiplier = baseMultiplier * exponentialFactor;
  }
  
  // Cost increases when filtering by lender type
  let lenderTypeMultiplier = 1;
  const selectedNonQuickCount = selectedNonQuickTypes.length;
  
  if (selectedNonQuickCount > 0 && selectedNonQuickCount < totalNonQuickTypes) {
    const restrictionRatio = (totalNonQuickTypes - selectedNonQuickCount) / totalNonQuickTypes;
    lenderTypeMultiplier = 1 + (restrictionRatio * 0.4); // 1.0-1.4
  }

  if (quickLoanSelected && selectedNonQuickCount < totalNonQuickTypes) {
    const totalSelectedCount = selectedTypes.length || 1;
    const quickProportion = quickLoanCount / totalSelectedCount;
    const pivotMultiplier = 1 / allLenderTypes.length;
    const quickDiscount = quickProportion * pivotMultiplier;
    lenderTypeMultiplier *= 1 - quickDiscount;
  }
  
  // Multiply the constraints together (same as work calculation)
  return Math.round(baseCost * offersCostMultiplier * lenderTypeMultiplier);
}

