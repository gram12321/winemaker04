/**
 * Credit Rating Constants
 * Defines weights, thresholds, and configuration for credit rating calculation
 */

/**
 * Credit Rating Component Weights
 * All components are normalized to 0-1, then weighted and combined
 */
export const CREDIT_RATING_WEIGHTS = {
  // Final rating components (weights sum to 1.0)
  assetHealth: 0.20,      // 20% of final rating
  paymentHistory: 0.15,   // 15% of final rating
  companyStability: 0.10, // 10% of final rating
  // Base rating is 50%, negative balance is penalty (0 to -30%)
  
  // Asset Health component weights (sum to 1.0)
  assetHealth_debtToAsset: 0.40,    // 40% of asset health
  assetHealth_assetCoverage: 0.30,  // 30% of asset health
  assetHealth_liquidity: 0.25,      // 25% of asset health
  assetHealth_fixedAssets: 0.05,    // 5% of asset health
  
  // Payment History component weights (sum to 1.0)
  paymentHistory_onTime: 0.50,      // 50% of payment history
  paymentHistory_payoffs: 0.30,     // 30% of payment history
  paymentHistory_missed: 0.20,       // 20% of payment history (inverse)
  
  // Company Stability component weights (sum to 1.0)
  stability_age: 0.50,               // 50% of company stability
  stability_profitConsistency: 0.30, // 30% of company stability
  stability_expenseEfficiency: 0.20, // 20% of company stability
} as const;

/**
 * Credit Rating Calculation Constants
 */
export const CREDIT_RATING_CONSTANTS = {
  BASE_RATING: 0.50,
  MAX_RATING: 1.00,
  MIN_RATING: 0.00,
  
  // Negative balance penalties
  NEGATIVE_BALANCE_MAX_WEEKS: 15, // 15 weeks = max penalty
  NEGATIVE_BALANCE_MAX_PENALTY: -0.30, // Max -30% penalty (as percentage of final rating)
  
  // Normalization thresholds
  ASSET_COVERAGE_EXCELLENT: 5.0, // 5x+ coverage = 1.0
  ASSET_COVERAGE_GOOD: 3.0,      // 3x+ coverage
  ASSET_COVERAGE_FAIR: 2.0,      // 2x+ coverage
  LIQUIDITY_EXCELLENT: 2.0,      // 2x+ liquidity = 1.0
  LIQUIDITY_GOOD: 1.0,           // 1x+ liquidity
  LIQUIDITY_FAIR: 0.5,           // 0.5x+ liquidity
  COMPANY_AGE_MAX: 200.0,       // 200+ years = 1.0 (using vineyard age pattern)
  // Note: Debt-to-asset ratio now uses smooth continuous function (no thresholds)
  
  // Payment history normalization
  PAYMENT_HISTORY_REFERENCE_PAYMENTS: 20, // 20 payments = good score
  PAYMENT_HISTORY_REFERENCE_PAYOFFS: 5,   // 5 payoffs = good score
} as const;

