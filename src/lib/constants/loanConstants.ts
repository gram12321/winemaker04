import { LenderType } from '../types/types';
// Lender search base cost
export const LENDER_SEARCH_BASE_COST = 2000;

// Take loan base cost
export const TAKE_LOAN_BASE_COST = 1000;

// Lender type distribution (must sum to 1.0)
export const LENDER_TYPE_DISTRIBUTION = {
  'Bank': 0.25,
  'Investment Fund': 0.25,
  'Private Lender': 0.40,
  'QuickLoan': 0.10
} as const;

// Lender generation parameters by type
export const LENDER_PARAMS: Record<LenderType, {
  baseInterestRange: [number, number];
  loanAmountRange: [number, number];
  durationRange: [number, number];
  riskToleranceRange: [number, number];
  flexibilityRange: [number, number];
  originationFeeRange: {
    basePercentRange: [number, number]; // Base fee percentage range
    minFeeRange: [number, number]; // Minimum fee range
    maxFeeRange: [number, number]; // Maximum fee range
    creditRatingModifierRange: [number, number]; // Credit rating modifier range
    durationModifierRange: [number, number]; // Duration modifier range
  };
}> = {
  'Bank': {
    baseInterestRange: [0.04, 0.08], // 4-8%
    loanAmountRange: [50000, 500000],
    durationRange: [4, 120], // 1-30 years
    riskToleranceRange: [0.3, 0.6],
    flexibilityRange: [0.5, 0.8],
    originationFeeRange: {
      basePercentRange: [0.015, 0.025], // 1.5-2.5% base fee (more realistic for business loans)
      minFeeRange: [800, 1500], // €800-1500 minimum
      maxFeeRange: [12000, 20000], // €12k-20k maximum
      creditRatingModifierRange: [0.6, 0.8], // 20-40% discount for excellent credit
      durationModifierRange: [1.0, 1.2] // 0-20% premium for long-term
    }
  },
  'Investment Fund': {
    baseInterestRange: [0.05, 0.10], // 5-10%
    loanAmountRange: [50000, 1000000],
    durationRange: [4, 240], // 1-60 years
    riskToleranceRange: [0.4, 0.7],
    flexibilityRange: [0.6, 0.9],
    originationFeeRange: {
      basePercentRange: [0.025, 0.035], // 2.5-3.5% base fee (higher for investment funds)
      minFeeRange: [1500, 3000], // €1.5k-3k minimum
      maxFeeRange: [25000, 40000], // €25k-40k maximum
      creditRatingModifierRange: [0.7, 0.9], // 10-30% discount for excellent credit
      durationModifierRange: [1.0, 1.3] // 0-30% premium for long-term
    }
  },
  'Private Lender': {
    baseInterestRange: [0.08, 0.15], // 8-15%
    loanAmountRange: [5000, 50000], // Small loans
    durationRange: [4, 60], // 1-15 years
    riskToleranceRange: [0.5, 0.9],
    flexibilityRange: [0.3, 0.7],
    originationFeeRange: {
      basePercentRange: [0.045, 0.07], // 4.5-7% base fee (largest proportional hit among traditional lenders)
      minFeeRange: [400, 1000], // €400-1000 minimum
      maxFeeRange: [7000, 12000], // €7k-12k maximum
      creditRatingModifierRange: [0.85, 1.25], // 15% discount to 25% premium based on credit
      durationModifierRange: [0.95, 1.45] // Slightly higher premium for long-term adjustments
    }
  },
  'QuickLoan': {
    baseInterestRange: [0.12, 0.20], // 12-20%
    loanAmountRange: [5000, 75000], // Micro to small business loans
    durationRange: [4, 8], // 1-2 years (strictly short-term)
    riskToleranceRange: [0.15, 0.35], // Very easy credit requirement
    flexibilityRange: [0.5, 0.8], // Fast approvals, more flexible terms
    originationFeeRange: {
      basePercentRange: [0.06, 0.10], // 6-10% base fee (largest proportional cost)
      minFeeRange: [400, 1500], // Higher minimum keeps upfront hit noticeable
      maxFeeRange: [5000, 10000], // Higher ceiling while still below big-bank fees
      creditRatingModifierRange: [1.15, 1.45], // Slightly sharper penalty for weaker credit
      durationModifierRange: [0.9, 1.15] // Modest boost for stretching beyond a single season
    }
  }
};

// Loan amount ranges for constraints (derived from LENDER_PARAMS)
export const LOAN_AMOUNT_RANGES = {
  MIN: Math.min(...Object.values(LENDER_PARAMS).map(params => params.loanAmountRange[0])),
  MAX: Math.max(...Object.values(LENDER_PARAMS).map(params => params.loanAmountRange[1])),
  STEP: 5000
} as const;

// Loan duration ranges for constraints (derived from LENDER_PARAMS)
export const LOAN_DURATION_RANGES = {
  MIN: Math.min(...Object.values(LENDER_PARAMS).map(params => params.durationRange[0])),
  MAX: Math.max(...Object.values(LENDER_PARAMS).map(params => params.durationRange[1])),
  STEP: 4 // 1 year steps
} as const;

// Lender generation
export const LENDER_GENERATION = {
  MIN_LENDERS: 25,
  MAX_LENDERS: 65
} as const;

// Lender type interest rate multipliers
export const LENDER_TYPE_MULTIPLIERS: Record<LenderType, number> = {
  'Bank': 0.9,
  'Investment Fund': 1.1,
  'Private Lender': 1.4,
  'QuickLoan': 1.6
};

// Lender-specific processing complexity multipliers (used by take-loan activity)
export const LENDER_TYPE_COMPLEXITY: Record<LenderType, number> = {
  'Bank': 1.1, // Heavier compliance and documentation
  'Investment Fund': 1.2, // Most complex underwriting
  'Private Lender': 0.95, // Leaner processes
  'QuickLoan': 0.75 // Fast-track workflow
} as const;

// Credit rating configuration (0-1 scale)
export const CREDIT_RATING = {
  DEFAULT_RATING: 0.5, // 0.5 = 50% = BBB- rating
  MIN_RATING: 0,
  MAX_RATING: 1,
  
  // Credit rating effects on interest rate
  // Formula: 0.8 + (0.7 * (1 - creditRating))
  BEST_MULTIPLIER: 0.8,  // At 1.0 rating (AAA)
  WORST_MULTIPLIER: 3.5, // At 0.0 rating (C)

  
  // Blacklist duration
  BLACKLIST_DURATION_SEASONS: 40, // 10 years
} as const;

// New comprehensive credit rating penalties
export const CREDIT_RATING_PENALTIES = {
  // Missed payment penalties (more severe than before)
  FIRST_MISSED_PAYMENT: -0.10, // -10% for first missed payment (vs old -25% for default)
  ADDITIONAL_MISSED_PAYMENT: -0.05, // -5% for each additional missed payment
  DEFAULT_PENALTY: -0.30, // -30% for actual default (more severe than old -25%)
  
  // Payment rewards (same as before)
  ON_TIME_PAYMENT_BONUS: 0.005, // +0.5% per on-time payment
  LOAN_PAYOFF_BONUS: 0.05, // +5% when loan fully paid
} as const;

// Duration-based interest rate modifiers (longer loans get slightly lower rates)
export const DURATION_INTEREST_MODIFIERS = {
  SHORT_TERM: { maxSeasons: 16, modifier: 1.0 }, // 0-4 years: no modifier
  MEDIUM_TERM: { maxSeasons: 40, modifier: 0.95 }, // 4-10 years: 5% discount
  LONG_TERM: { maxSeasons: 80, modifier: 0.90 }, // 10-20 years: 10% discount
  VERY_LONG_TERM: { maxSeasons: 120, modifier: 0.85 } // 20-30 years: 15% discount
} as const;

// Loan default configuration
export const LOAN_DEFAULT = {
  PRESTIGE_PENALTY: -75, // Immediate prestige hit
  PRESTIGE_DECAY_RATE: 0.999334, // ~20-year half-life (very slow decay)
  INTEREST_PENALTY_SEASONS: 12, // Other lenders increase rates for 3 years
  INTEREST_PENALTY_MULTIPLIER: 1.3 // 30% rate increase from other lenders
} as const;

// Loan missed payment warning penalties (3-strike system before full default)
export const LOAN_MISSED_PAYMENT_PENALTIES = {
  // Warning #1 (missedPayments = 1)
  WARNING_1: {
    LATE_FEE_PERCENT: 0.02, // 2% of seasonal payment added to balance
    CREDIT_RATING_LOSS: -0.05, // -5% credit rating
    BOOKKEEPING_WORK: 20, // +20 work units to next bookkeeping
  },
  
  // Warning #2 (missedPayments = 2)
  WARNING_2: {
    INTEREST_RATE_INCREASE: 0.005, // +0.5% to effective interest rate
    BALANCE_PENALTY_PERCENT: 0.05, // +5% of outstanding balance
    CREDIT_RATING_LOSS: -0.05, // -5% credit rating (cumulative: -10% total)
    PRESTIGE_PENALTY: -25, // Negative prestige event
    PRESTIGE_DECAY_RATE: 0.998667, // ~10-year half-life (slow decay)
    BOOKKEEPING_WORK: 50, // +50 work units to next bookkeeping
  },
  
  // Warning #3 (missedPayments = 3)
  WARNING_3: {
    MAX_VINEYARD_SEIZURE_PERCENT: 0.50, // Max 50% of portfolio value can be seized
    CREDIT_RATING_LOSS: -0.10, // -10% credit rating (cumulative: -20% total)
    BOOKKEEPING_WORK: 100, // +100 work units to next bookkeeping
  },
  
  // Full Default (missedPayments >= 4)
  FULL_DEFAULT: {
    // All Warning #3 penalties apply
    // Plus lender blacklist
    // Plus full LOAN_DEFAULT penalties above
  }
} as const;

// Emergency quick loan enforcement settings
export const EMERGENCY_QUICK_LOAN = {
  NEGATIVE_BALANCE_BUFFER: 0.10, // 10% buffer on top of negative balance
  BASE_INTEREST_PENALTY_MULTIPLIER: 1.5, // Base interest penalty
  DISQUALIFIED_INTEREST_PENALTY_MULTIPLIER: 1.9, // Applied if borrower wouldn't normally qualify
  ORIGINATION_FEE_PENALTY_MULTIPLIER: 1.4, // Origination fee penalty
  MAX_ADJUSTMENT_ITERATIONS: 4, // Attempts to increase principal to cover deficit after fees
  PRESTIGE_PENALTY: -15,
  PRESTIGE_DECAY_RATE: 0.99735 // ~5-year half-life
} as const;

// Emergency loan restructuring settings (triggered at new year)
export const EMERGENCY_RESTRUCTURE = {
  CELLAR_STEP_PERCENT_OF_DEBT: 0.20, // Attempt to liquidate up to 20% of debt from cellar each pass
  MAX_SEIZURE_PERCENT_OF_DEBT: 0.50, // Never seize more than 50% of the combined forced loan balance
  SALE_PENALTY_RATE: 0.25, // Forced sales yield 25% less than book value
  CONSOLIDATED_DURATION_SEASONS: 48, // 12 years payoff horizon for restructured loan
  INTEREST_PENALTY_MULTIPLIER: 1.25, // Consolidated loan has higher base interest than lender default
  ORIGINATION_PENALTY_MULTIPLIER: 1.35, // Origination fee is harsher during restructure
  OVERRIDE_INTEREST_MULTIPLIER: 1.55, // Additional multiplier when lender normally declines
  OVERRIDE_ORIGINATION_MULTIPLIER: 1.6, // Additional origination penalty under forced override
  OVERRIDE_DURATION_SEASONS: 60, // 15 years if override required
  PRESTIGE_PENALTY: -35, // Prestige hit when restructure fires
  PRESTIGE_DECAY_RATE: 0.998667 // ~10-year half-life
} as const;

// Extra payment configuration
export const LOAN_EXTRA_PAYMENT = {
  ADMIN_FEE_RATE: 0.08, // 8% of seasonal payment as administration fee
  MIN_ADMIN_FEE: 250 // Minimum fee to keep the penalty noticeable
} as const;

// Prepayment penalty configuration (modeled after EU indemnity rules)
export const LOAN_PREPAYMENT = {
  REMAINING_INTEREST_FACTOR: 0.25, // Pay 25% of the remaining scheduled interest (~one season)
  MIN_PENALTY: 1000
} as const;

// Administrative penalty work units applied to next season's bookkeeping task after loan operations
export const ADMINISTRATION_LOAN_PENALTIES = {
  LOAN_TAKEN: 12,
  LOAN_EXTRA_PAYMENT: 6,
  LOAN_FULL_REPAYMENT: 10,
  LOAN_FORCED: 16,
  LOAN_RESTRUCTURE: 22
} as const;
