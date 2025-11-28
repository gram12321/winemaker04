export { ECONOMY_EXPECTATION_MULTIPLIERS } from './economyConstants';

/**
 * Share Valuation Constants
 * Defines expected value baselines and scaling factors for share price valuation
 */

/**
 * Expected value baselines for performance metrics
 * @deprecated Replaced by EXPECTED_IMPROVEMENT_RATES for unified trend-based system
 */
export const EXPECTED_VALUE_BASELINES = {
  revenueGrowth: 0.10,
  profitMargin: 0.15,
} as const;

/**
 * Expected improvement rates (per 48-week period) for trend-based metrics
 * These represent the baseline expected improvement when comparing current 48-week rolling
 * to previous 48-week rolling values. Multiplied by economy × prestige × growth factors.
 * 
 * All metrics now use trend-based comparisons (current 48w vs previous 48w).
 * The baseline represents "normal" expected improvement in stable economy with average prestige.
 */
export const EXPECTED_IMPROVEMENT_RATES = {
  earningsPerShare: 0.10,      // 10% improvement expected per 48 weeks (baseline)
  revenuePerShare: 0.10,       // 10% improvement expected per 48 weeks (baseline)
  dividendPerShare: 0.0,        // No expected improvement (dividends are player-controlled)
  revenueGrowth: 0.10,          // 10% improvement in growth rate expected per 48 weeks (baseline)
  profitMargin: 0.05,           // 5% improvement in margin expected per 48 weeks (baseline)
  creditRating: 0.02,            // 2% improvement expected per 48 weeks (slow improvement)
  fixedAssetRatio: 0.0,         // No expected improvement (maintains current level - strategic choice)
  prestige: 0.03                  // 3% improvement expected per 48 weeks (gradual prestige growth)
} as const;

/**
 * Prestige scaling configuration
 */
export const PRESTIGE_SCALING = {
  base: 1.0,
  maxMultiplier: 2.0,
} as const;

/**
 * Growth trend tracking configuration
 */
export const GROWTH_TREND_CONFIG = {
  adjustmentIncrement: 0.02,
  maxAdjustment: 0.5,
  minAdjustment: 0.5,
  periodsToTrack: 4
} as const;


/**
 * Incremental share price metric configuration.
 * baseAdjustment is expressed in euros (absolute share price movement contribution)
 * maxRatio caps the absolute ratio (e.g. 3 => ±300%) a single metric can contribute.
 */
export const INCREMENTAL_METRIC_CONFIG = {
  earningsPerShare: { baseAdjustment: 0.04, maxRatio: 3 },
  revenuePerShare: { baseAdjustment: 0.03, maxRatio: 3 },
  dividendPerShare: { baseAdjustment: 0.03, maxRatio: 3 },
  revenueGrowth: { baseAdjustment: 0.03, maxRatio: 2 },
  profitMargin: { baseAdjustment: 0.03, maxRatio: 2 },
  creditRating: { baseAdjustment: 0.03, maxRatio: 2 },
  fixedAssetRatio: { baseAdjustment: 0.02, maxRatio: 2 },
  prestige: { baseAdjustment: 0.02, maxRatio: 2 }
} as const;

/**
 * Anchor configuration for incremental adjustments.
 * The higher the strength/exponent, the harder it becomes to move far from book value.
 * minPriceRatioToAnchor defines the soft floor as a percentage of book value.
 */
export const INCREMENTAL_ANCHOR_CONFIG = {
  strength: 2.0,
  exponent: 1.25,
  minPriceRatioToAnchor: 0.1
} as const;

/**
 * Immediate share structure adjustment configuration.
 * When shares are issued or bought back, these multipliers represent market reaction
 * beyond pure mathematical dilution/concentration.
 */
export const SHARE_STRUCTURE_ADJUSTMENT_CONFIG = {
  dilutionPenalty: 0.97,      // 3% immediate drop for share issuance (market reaction to dilution)
  concentrationBonus: 1.03    // 3% immediate boost for share buyback (market reaction to concentration)
} as const;

/**
 * Dividend change prestige impact configuration.
 * Asymmetric impact: cuts are more negative than increases are positive.
 */
export const DIVIDEND_CHANGE_PRESTIGE_CONFIG = {
  cutMultiplier: 0.5,         // Prestige impact multiplier for dividend cuts
  increaseMultiplier: 0.3,     // Prestige impact multiplier for dividend increases (smaller)
  decayRate: 0.98              // Prestige event decay rate (market forgets over time)
} as const;

