import { LenderType, EconomyPhase } from '../types/types';

// Lender search base cost
export const LENDER_SEARCH_BASE_COST = 2000;

// Take loan base cost
export const TAKE_LOAN_BASE_COST = 1000;

// Lender type distribution (must sum to 1.0)
export const LENDER_TYPE_DISTRIBUTION = {
  'Bank': 0.25,
  'Investment Fund': 0.25,
  'Private Lender': 0.50
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
    loanAmountRange: [100000, 1000000],
    durationRange: [4, 120], // 1-30 years
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
    durationRange: [4, 120], // 1-30 years
    riskToleranceRange: [0.5, 0.9],
    flexibilityRange: [0.3, 0.7],
    originationFeeRange: {
      basePercentRange: [0.04, 0.06], // 4-6% base fee (highest for private lenders)
      minFeeRange: [300, 800], // €300-800 minimum
      maxFeeRange: [6000, 10000], // €6k-10k maximum
      creditRatingModifierRange: [0.8, 1.2], // 20% discount to 20% premium based on credit
      durationModifierRange: [0.9, 1.4] // 10% discount to 40% premium based on duration
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
  MIN_LENDERS: 15,
  MAX_LENDERS: 45
} as const;

// Economy phase interest rate multipliers
export const ECONOMY_INTEREST_MULTIPLIERS: Record<EconomyPhase, number> = {
  'Crash': 1.7,
  'Recession': 1.5,
  'Recovery': 1.0,
  'Expansion': 0.5,
  'Boom': 0.3
};

// Lender type interest rate multipliers
export const LENDER_TYPE_MULTIPLIERS: Record<LenderType, number> = {
  'Bank': 0.9,
  'Investment Fund': 1.1,
  'Private Lender': 1.4
};

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
  PRESTIGE_DECAY_RATE: 0.95, // Slow decay (permanent impact)
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
    PRESTIGE_DECAY_RATE: 0.95, // Slow decay
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
