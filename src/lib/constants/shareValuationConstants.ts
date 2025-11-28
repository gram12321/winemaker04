export { ECONOMY_EXPECTATION_MULTIPLIERS } from './economyConstants';

/**
 * Share Valuation Constants
 * Defines expected value baselines and scaling factors for share price valuation
 */

/**
 * Expected value baselines for performance metrics
 */
export const EXPECTED_VALUE_BASELINES = {
  revenueGrowth: 0.10,
  profitMargin: 0.15,
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


