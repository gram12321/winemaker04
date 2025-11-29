export { ECONOMY_EXPECTATION_MULTIPLIERS } from './economyConstants';

/**
 * Expected improvement rates (per 48-week period) for trend-based metrics
 * These represent the baseline expected improvement when comparing current 48-week rolling
 * to previous 48-week rolling values. Multiplied by economy × prestige × growth factors.
 * 
 * All metrics now use trend-based comparisons (current 48w vs previous 48w).
 * The baseline represents "normal" expected improvement in stable economy with average prestige.
 * 
 * Note: These rates target 15-30x growth over 200 years, accounting for ups and downs.
 * Since comparisons are to previous 48 weeks (not linear), actual growth will fluctuate.
 * 
 * Math: (1.01)^200 = 7.3x, (1.015)^200 = 19.7x, (1.02)^200 = 52.4x
 * Using 1.0-1.5% gives 7-20x theoretical, but with ups/downs averages to 15-30x range.
 */
export const EXPECTED_IMPROVEMENT_RATES = {
  earningsPerShare: 0.012,      // 1.2% improvement expected per 48 weeks (baseline)
  revenuePerShare: 0.012,       // 1.2% improvement expected per 48 weeks (baseline)
  dividendPerShare: 0.003,      // 0.3% improvement expected per 48 weeks (small, player-controlled)
  revenueGrowth: 0.012,          // 1.2% improvement in growth rate expected per 48 weeks (baseline)
  profitMargin: 0.008,           // 0.8% improvement in margin expected per 48 weeks (margins improve slowly)
  creditRating: 0.004,           // 0.4% improvement expected per 48 weeks (slow improvement)
  fixedAssetRatio: 0.002,       // 0.2% improvement expected per 48 weeks (very slow, strategic)
  prestige: 0.005                // 0.5% improvement expected per 48 weeks (gradual prestige growth)
} as const;

/**
 * Prestige scaling configuration
 */
export const PRESTIGE_SCALING = {
  base: 1.0,
  maxMultiplier: 3.0,
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

/**
 * Market cap modifier configuration.
 * As market cap increases, additional expected improvement is required.
 * This is independent of the 48-week trend comparison and makes it progressively harder
 * for larger companies to meet expectations.
 * 
 * Formula: marketCapRequirement = baseRate × log10(marketCap / baseMarketCap)
 * This creates a logarithmic scaling where larger companies face higher absolute expectations.
 */
export const MARKET_CAP_MODIFIER_CONFIG = {
  baseMarketCap: 1000000,     // Base market cap (€1M) - no additional requirement below this
  baseRate: 0.002,            // Base additional expected improvement rate per 48 weeks (0.2%)
  maxRate: 0.01,              // Maximum additional expected improvement rate (1.0%)
  enabled: true                // Toggle to enable/disable company value modifier
} as const;


