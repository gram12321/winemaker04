import { EconomyPhase, LenderType } from '../types/types';

// Economy phase transition probabilities
export const ECONOMY_TRANSITION = {
  MIDDLE_PHASES: { // Recovery, Expansion
    SHIFT_PROBABILITY: 0.25,
    STAY_PROBABILITY: 0.5
  },
  EDGE_PHASES: { // Crash, Boom
    SHIFT_PROBABILITY: 0.33,
    STAY_PROBABILITY: 0.67
  }
} as const;

// Economy phase order for navigation
export const ECONOMY_PHASES: readonly EconomyPhase[] = [
  'Crash',
  'Recession', 
  'Recovery',
  'Expansion',
  'Boom'
] as const;

// Economy phase interest rate multipliers
export const ECONOMY_INTEREST_MULTIPLIERS: Record<EconomyPhase, number> = {
  'Crash': 1.8,
  'Recession': 1.3,
  'Recovery': 1.0,
  'Expansion': 0.85,
  'Boom': 0.7
};

// Lender type interest rate multipliers
export const LENDER_TYPE_MULTIPLIERS: Record<LenderType, number> = {
  'Bank': 0.9,
  'Investment Fund': 1.1,
  'Private Lender': 1.4
};

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

// Credit rating configuration (0-1 scale)
export const CREDIT_RATING = {
  DEFAULT_RATING: 0.5, // 0.5 = 50% = BBB- rating
  MIN_RATING: 0,
  MAX_RATING: 1,
  
  // Credit rating effects on interest rate
  // Formula: 0.8 + (0.7 * (1 - creditRating))
  BEST_MULTIPLIER: 0.8,  // At 1.0 rating (AAA)
  WORST_MULTIPLIER: 1.5, // At 0.0 rating (C)
  
  // Legacy payment rewards (now handled by comprehensive credit rating system)
  ON_TIME_PAYMENT_BONUS: 0.005, // +0.005 per on-time payment
  LOAN_PAYOFF_BONUS: 0.05, // +0.05 when loan fully paid
  
  // Blacklist duration
  BLACKLIST_DURATION_SEASONS: 16, // 4 years
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


// Lender generation
export const LENDER_GENERATION = {
  MIN_LENDERS: 15,
  MAX_LENDERS: 25
} as const;
