import { AchievementConfig } from '../types/types';
import { createTieredAchievements } from '../services/user/achievementService';

/**
 * Achievement Definitions
 * 
 * Pure constants for achievement system
 * Business logic moved to achievementService.ts
 */

// ===== ACHIEVEMENT LEVEL SYSTEM =====

export const achievementLevels = {
  1: { name: 'Fresh Off the Vine', prestige: 0.1, decayYears: 1 },
  2: { name: 'Cork Puller', prestige: 5, decayYears: 5 },
  3: { name: 'Cellar Hand', prestige: 50, decayYears: 25 },
  4: { name: 'Wine Wizard', prestige: 350, decayYears: 75 },
  5: { name: 'Living Legend', prestige: 1000, decayYears: 100 },
} as const;

// ===== FINANCIAL ACHIEVEMENTS =====

// Money Accumulation Series (fixed thresholds starting above €100k)
export const MONEY_ACCUMULATION_ACHIEVEMENTS = createTieredAchievements(
  'money_accumulation',
  'Wealth Builder',
  'Accumulate €{threshold} in cash reserves',
  '💰',
  'financial',
  'money_threshold',
  [200000, 500000, 1000000, 5000000, 25000000], // Start above €100k starting money
  []
);

// Revenue Generation Series (money earned through sales)
export const REVENUE_GENERATION_ACHIEVEMENTS = createTieredAchievements(
  'revenue_generation',
  'Revenue Master',
  'Generate €{threshold} in total sales revenue',
  '💸',
  'financial',
  'sales_value',
  [100000, 500000, 2000000, 10000000, 50000000],
  []
);

// ===== TIME-BASED ACHIEVEMENTS =====

export const TIME_ACHIEVEMENTS = createTieredAchievements(
  'time_survival',
  'Vintage Veteran',
  'Operate your winery for {threshold} years',
  '📅',
  'time',
  'time_threshold',
  [1, 5, 10, 20, 50],
  []
);

// ===== PRODUCTION ACHIEVEMENTS =====

// Wine Variety Production Series
export const WINE_VARIETY_ACHIEVEMENTS = createTieredAchievements(
  'wine_variety',
  'Wine Creator',
  'Produce {threshold} different wine varieties',
  '🍾',
  'production',
  'production_count',
  [1, 10, 25, 50, 100],
  []
);

// Bottle Production Series
export const BOTTLE_PRODUCTION_ACHIEVEMENTS = createTieredAchievements(
  'bottle_production',
  'Bottle Master',
  'Produce {threshold} bottles of wine',
  '📦',
  'production',
  'bottles_produced',
  [100, 1000, 10000, 100000, 1000000],
  []
);

// ===== SALES ACHIEVEMENTS =====

// Sales Count Series
export const SALES_COUNT_ACHIEVEMENTS = createTieredAchievements(
  'sales_count',
  'Sales Professional',
  'Complete {threshold} wine sales',
  '🤝',
  'sales',
  'sales_count',
  [1, 10, 50, 200, 1000],
  []
);

// ===== PRESTIGE ACHIEVEMENTS =====

export const PRESTIGE_ACHIEVEMENTS = createTieredAchievements(
  'prestige_master',
  'Prestige Master',
  'Accumulate {threshold} prestige points',
  '⭐',
  'prestige',
  'prestige_threshold',
  [50, 200, 500, 1500, 5000],
  []
);

// ===== VINEYARD ACHIEVEMENTS =====

export const VINEYARD_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_empire',
  'Vineyard Empire',
  'Own {threshold} vineyards',
  '🌿',
  'vineyard',
  'vineyard_count',
  [1, 3, 7, 15, 30],
  []
);

// ===== ADDITIONAL FINANCIAL ACHIEVEMENTS =====

// Single Contract Bottle Sales
export const SINGLE_CONTRACT_BOTTLES_ACHIEVEMENTS = createTieredAchievements(
  'single_contract_bottles',
  'Big Deal',
  'Sell {threshold} bottles in a single contract',
  '📦',
  'financial',
  'single_contract_bottles',
  [100, 500, 1000, 2500, 5000], // Bottles in one contract
  []
);

// Single Contract Value
export const SINGLE_CONTRACT_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'single_contract_value',
  'Mega Sale',
  'Sell {threshold} worth of wine in a single contract',
  '💰',
  'financial',
  'single_contract_value',
  [10000, 50000, 100000, 250000, 500000], // Euros in one contract
  []
);

// Cellar Wine Value
export const CELLAR_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'cellar_value',
  'Cellar Master',
  'Have {threshold} worth of wine in cellar',
  '🏰',
  'financial',
  'cellar_value',
  [50000, 100000, 250000, 500000, 1000000], // Cellar value in euros
  []
);

// Total Assets
export const TOTAL_ASSETS_ACHIEVEMENTS = createTieredAchievements(
  'total_assets',
  'Asset Accumulator',
  'Accumulate {threshold} in total assets',
  '🏦',
  'financial',
  'total_assets',
  [200000, 500000, 1000000, 2500000, 5000000], // Total assets in euros
  []
);

// Vineyard Value
export const VINEYARD_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_value',
  'Land Baron',
  'Own {threshold} worth of vineyard land',
  '🌾',
  'financial',
  'vineyard_value',
  [100000, 250000, 500000, 1000000, 2500000], // Vineyard value in euros
  []
);

// ===== META ACHIEVEMENTS =====

// Meta Achievement: Achievement Completion Percentage
// Excludes itself from completion calculation to avoid chicken-and-egg problem
export const ACHIEVEMENT_COMPLETION_ACHIEVEMENTS = createTieredAchievements(
  'achievement_completion',
  'Achievement Hunter',
  'Complete {threshold}% of all achievements',
  '🏆',
  'prestige',
  'achievement_completion',
  [10, 25, 50, 75, 100],
  []
);

// ===== WINE PRODUCTION ACHIEVEMENTS =====

// Different Grape Varieties
export const DIFFERENT_GRAPES_ACHIEVEMENTS = createTieredAchievements(
  'different_grapes',
  'Grape Explorer',
  'Produce wines from {threshold} different grape varieties',
  '🍇',
  'production',
  'different_grapes',
  [3, 5, 8, 12, 15], // Different grape varieties
  []
);

// Wine Quality Threshold
export const WINE_QUALITY_ACHIEVEMENTS = createTieredAchievements(
  'wine_quality',
  'Quality Master',
  'Produce a wine with quality rating of {threshold}',
  '⭐',
  'production',
  'wine_quality_threshold',
  [80, 85, 90, 95, 98], // Quality rating
  []
);

// Wine Balance Threshold
export const WINE_BALANCE_ACHIEVEMENTS = createTieredAchievements(
  'wine_balance',
  'Balance Virtuoso',
  'Produce a wine with balance rating of {threshold}',
  '⚖️',
  'production',
  'wine_balance_threshold',
  [80, 85, 90, 95, 98], // Balance rating
  []
);

// Wine Score Threshold
export const WINE_SCORE_ACHIEVEMENTS = createTieredAchievements(
  'wine_score',
  'Score Champion',
  'Produce a wine with wine score of {threshold}',
  '🎯',
  'production',
  'wine_score_threshold',
  [85, 90, 95, 98, 100], // Wine score
  []
);

// Wine Price Threshold
export const WINE_PRICE_ACHIEVEMENTS = createTieredAchievements(
  'wine_price',
  'Premium Producer',
  'Produce a wine with estimated price of {threshold} per bottle',
  '💎',
  'production',
  'wine_price_threshold',
  [50, 100, 200, 500, 1000], // Price per bottle in euros
  []
);

// ===== SALES ACHIEVEMENTS =====

// Sales Price Percentage (Over Estimated)
export const SALES_PRICE_OVER_ACHIEVEMENTS = createTieredAchievements(
  'sales_price_over',
  'Price Maximizer',
  'Sell wine for {threshold}% over estimated price',
  '📈',
  'sales',
  'sales_price_percentage',
  [10, 25, 50, 100, 200], // Percentage over estimated price
  []
);

// Sales Price Percentage (Under Estimated) - for volume sales
export const SALES_PRICE_UNDER_ACHIEVEMENTS = createTieredAchievements(
  'sales_price_under',
  'Volume Seller',
  'Sell wine for {threshold}% under estimated price',
  '📉',
  'sales',
  'sales_price_percentage',
  [10, 25, 50, 75, 90], // Percentage under estimated price (still profitable)
  []
);

// ===== TIME-BASED ACHIEVEMENTS =====

// Prestige by Year
export const PRESTIGE_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'prestige_by_year',
  'Early Prestige',
  'Achieve {threshold} prestige before year 5',
  '⏰',
  'time',
  'prestige_by_year',
  [100, 500, 1000, 2500, 5000], // Prestige by year 5
  []
);

// Revenue by Year
export const REVENUE_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'revenue_by_year',
  'Yearly Revenue',
  'Generate {threshold} revenue in a single year',
  '📊',
  'time',
  'revenue_by_year',
  [100000, 250000, 500000, 1000000, 2500000], // Revenue in one year
  []
);

// Assets by Year
export const ASSETS_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'assets_by_year',
  'Rapid Growth',
  'Accumulate {threshold} assets before year 10',
  '🚀',
  'time',
  'assets_by_year',
  [500000, 1000000, 2500000, 5000000, 10000000], // Assets by year 10
  []
);

// Hectares by Year
export const HECTARES_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'hectares_by_year',
  'Land Rush',
  'Own {threshold} hectares before year 15',
  '🏞️',
  'time',
  'hectares_by_year',
  [10, 25, 50, 100, 200], // Hectares by year 15
  []
);

// ===== LAND ACHIEVEMENTS =====

// Total Hectares
export const TOTAL_HECTARES_ACHIEVEMENTS = createTieredAchievements(
  'total_hectares',
  'Land Baron',
  'Own {threshold} hectares of vineyard land',
  '🌍',
  'vineyard',
  'total_hectares',
  [5, 15, 30, 60, 100], // Total hectares
  []
);

// Average Hectare Value
export const AVERAGE_HECTARE_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'average_hectare_value',
  'Prime Real Estate',
  'Own vineyards with average value above {threshold} per hectare',
  '💎',
  'vineyard',
  'average_hectare_value',
  [10000, 25000, 50000, 100000, 250000], // Average value per hectare
  []
);

// ===== VINEYARD-SPECIFIC ACHIEVEMENTS =====

// Vineyard Time Achievements (same grape type, resets if grape changes)
export const VINEYARD_TIME_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_time',
  'Vineyard Veteran',
  'Maintain the same grape variety in a vineyard for {threshold} years',
  '📅',
  'vineyard',
  'vineyard_time_same_grape',
  [1, 3, 5, 10, 20], // Years with same grape
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.3 } // Vineyard events decay much faster
);

// Vineyard Wine Variety Achievements (different grapes from same vineyard)
export const VINEYARD_WINE_VARIETY_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_wine_variety',
  'Vineyard Explorer',
  'Produce {threshold} different grape varieties from the same vineyard',
  '🍇',
  'vineyard',
  'vineyard_wine_variety_count',
  [2, 5, 10, 15, 20], // Different grape varieties
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.4 }
);

// Vineyard Bottle Production Achievements (per vineyard)
export const VINEYARD_BOTTLE_PRODUCTION_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_bottle_production',
  'Vineyard Producer',
  'Produce {threshold} bottles from a single vineyard',
  '🍷',
  'vineyard',
  'vineyard_bottles_produced',
  [100, 1000, 10000, 50000, 100000], // Bottles per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.4 }
);

// Vineyard Sales Count Achievements (per vineyard)
export const VINEYARD_SALES_COUNT_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_sales_count',
  'Vineyard Sales Master',
  'Make {threshold} sales from wines produced in a single vineyard',
  '💰',
  'vineyard',
  'vineyard_sales_count',
  [10, 50, 200, 500, 1000], // Sales per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.4 }
);

// Vineyard Prestige Achievements (vineyard-specific prestige)
export const VINEYARD_PRESTIGE_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_prestige',
  'Vineyard Legend',
  'Achieve {threshold} prestige from a single vineyard',
  '⭐',
  'vineyard',
  'vineyard_prestige_threshold',
  [10, 50, 200, 500, 1000], // Prestige per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.3 }
);

// ===== EXPORT ALL ACHIEVEMENTS =====

/**
 * All achievement configurations
 * Centralized array for easy iteration
 */
export const ALL_ACHIEVEMENTS: AchievementConfig[] = [
  // Financial
  ...MONEY_ACCUMULATION_ACHIEVEMENTS,
  ...REVENUE_GENERATION_ACHIEVEMENTS,
  ...SINGLE_CONTRACT_BOTTLES_ACHIEVEMENTS,
  ...SINGLE_CONTRACT_VALUE_ACHIEVEMENTS,
  ...CELLAR_VALUE_ACHIEVEMENTS,
  ...TOTAL_ASSETS_ACHIEVEMENTS,
  ...VINEYARD_VALUE_ACHIEVEMENTS,
  
  // Time
  ...TIME_ACHIEVEMENTS,
  ...PRESTIGE_BY_YEAR_ACHIEVEMENTS,
  ...REVENUE_BY_YEAR_ACHIEVEMENTS,
  ...ASSETS_BY_YEAR_ACHIEVEMENTS,
  ...HECTARES_BY_YEAR_ACHIEVEMENTS,
  
  // Production
  ...WINE_VARIETY_ACHIEVEMENTS,
  ...BOTTLE_PRODUCTION_ACHIEVEMENTS,
  ...DIFFERENT_GRAPES_ACHIEVEMENTS,
  ...WINE_QUALITY_ACHIEVEMENTS,
  ...WINE_BALANCE_ACHIEVEMENTS,
  ...WINE_SCORE_ACHIEVEMENTS,
  ...WINE_PRICE_ACHIEVEMENTS,
  
  // Sales
  ...SALES_COUNT_ACHIEVEMENTS,
  ...SALES_PRICE_OVER_ACHIEVEMENTS,
  ...SALES_PRICE_UNDER_ACHIEVEMENTS,
  
  // Prestige
  ...PRESTIGE_ACHIEVEMENTS,
  ...ACHIEVEMENT_COMPLETION_ACHIEVEMENTS,
  
  // Vineyards
  ...VINEYARD_ACHIEVEMENTS,
  ...TOTAL_HECTARES_ACHIEVEMENTS,
  ...AVERAGE_HECTARE_VALUE_ACHIEVEMENTS,
  
  // Vineyard-Specific
  ...VINEYARD_TIME_ACHIEVEMENTS,
  ...VINEYARD_WINE_VARIETY_ACHIEVEMENTS,
  ...VINEYARD_BOTTLE_PRODUCTION_ACHIEVEMENTS,
  ...VINEYARD_SALES_COUNT_ACHIEVEMENTS,
  ...VINEYARD_PRESTIGE_ACHIEVEMENTS,
];


