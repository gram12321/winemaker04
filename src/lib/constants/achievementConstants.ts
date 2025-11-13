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

// Money Accumulation Series (billions max)
export const MONEY_ACCUMULATION_ACHIEVEMENTS = createTieredAchievements(
  'money_accumulation',
  'Wealth Builder',
  'Accumulate €{threshold} in cash reserves',
  '💰',
  'financial',
  'money_threshold',
  [100000, 500000, 2000000, 10000000, 1000000000], // Aggressive log: 100k, 500k, 2M, 10M, 1B euros
  []
);

// Revenue Generation Series (billions max)
export const REVENUE_GENERATION_ACHIEVEMENTS = createTieredAchievements(
  'revenue_generation',
  'Revenue Master',
  'Generate €{threshold} in total sales revenue',
  '💸',
  'financial',
  'sales_value',
  [100000, 500000, 2000000, 10000000, 1000000000], // Aggressive log: 100k, 500k, 2M, 10M, 1B euros
  []
);

// Total Assets (10x higher than money/revenue)
export const TOTAL_ASSETS_ACHIEVEMENTS = createTieredAchievements(
  'total_assets',
  'Asset Accumulator',
  'Accumulate {threshold} in total assets',
  '🏦',
  'financial',
  'total_assets',
  [1000000, 5000000, 20000000, 100000000, 10000000000], // 10x higher: 1M, 5M, 20M, 100M, 10B euros
  []
);

// Cellar Wine Value (same as money/revenue)
export const CELLAR_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'cellar_value',
  'Cellar Master',
  'Have {threshold} worth of wine in cellar',
  '🏰',
  'financial',
  'cellar_value',
  [100000, 500000, 2000000, 10000000, 1000000000], // Same as money/revenue: 100k, 500k, 2M, 10M, 1B euros
  []
);

// Vineyard Value (smaller than company-wide achievements)
export const VINEYARD_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_value',
  'Land Baron',
  'Own a single vineyard worth {threshold}',
  '🌾',
  'financial',
  'vineyard_value',
  [50000, 250000, 1000000, 5000000, 50000000], // Single property milestones: 50k, 250k, 1M, 5M, 50M euros
  []
);

// Combined Vineyard Value (sum across all holdings)
export const TOTAL_VINEYARD_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'total_vineyard_value',
  'Estate Mogul',
  'Own vineyards totaling {threshold} in value',
  '🏡',
  'financial',
  'total_vineyard_value',
  [100000, 500000, 2000000, 10000000, 50000000], // Aggregate holdings: 100k, 500k, 2M, 10M, 50M euros
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
  [5, 25, 50, 100, 200], // ×5 progression: 5, 25, 50, 100, 200 years (max 200)
  []
);

// ===== PRODUCTION ACHIEVEMENTS =====

// Wine Variety Production Series (much harder since vineyard counts as variety)
export const WINE_VARIETY_ACHIEVEMENTS = createTieredAchievements(
  'wine_variety',
  'Wine Creator',
  'Produce {threshold} different wine varieties',
  '🍾',
  'production',
  'production_count',
  [5, 25, 125, 500, 1000], // Realistic progression: 5, 25, 125, 500, 1000 varieties (vineyard+grape+vintage)
  []
);

// Bottle Production Series (×10 exponential with higher max)
export const BOTTLE_PRODUCTION_ACHIEVEMENTS = createTieredAchievements(
  'bottle_production',
  'Bottle Master',
  'Produce {threshold} bottles of wine',
  '📦',
  'production',
  'bottles_produced',
  [1000, 10000, 100000, 1000000, 100000000], // ×10 exponential: 1k, 10k, 100k, 1M, 10M bottles
  []
);

// ===== SALES ACHIEVEMENTS =====

// Sales Count Series (×10 exponential for realistic sales frequency)
export const SALES_COUNT_ACHIEVEMENTS = createTieredAchievements(
  'sales_count',
  'Sales Professional',
  'Complete {threshold} wine sales',
  '🤝',
  'sales',
  'sales_count',
  [1, 10, 100, 1000, 10000], // ×10 exponential: 1, 10, 100, 1000, 10000 sales
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
  [50, 200, 500, 1500, 5000], // Realistic progression: 50, 200, 500, 1500, 5000 prestige (max ~5-10k)
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
  [1, 5, 25, 125, 625], // ×5 exponential: 1, 5, 25, 125, 625 vineyards
  []
);

// ===== CONTRACT ACHIEVEMENTS =====

// Single Contract Bottle Sales (×5 exponential for realistic contract sizes)
export const SINGLE_CONTRACT_BOTTLES_ACHIEVEMENTS = createTieredAchievements(
  'single_contract_bottles',
  'Big Deal',
  'Sell {threshold} bottles in a single contract',
  '📦',
  'financial',
  'single_contract_bottles',
  [6, 30, 150, 750, 3750], // ×5 exponential: 6, 30, 150, 750, 3750 bottles per order
  []
);

// Single Contract Value (×10 exponential for financial values)
export const SINGLE_CONTRACT_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'single_contract_value',
  'Mega Sale',
  'Sell {threshold} worth of wine in a single contract',
  '💰',
  'financial',
  'single_contract_value',
  [1000, 5000, 25000, 125000, 30000000], // ×5 exponential capped at realistic max: 1k, 5k, 25k, 125k, 30M euros
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

// Different Grape Varieties (realistic for 5-6 grape varieties)
export const DIFFERENT_GRAPES_ACHIEVEMENTS = createTieredAchievements(
  'different_grapes',
  'Grape Explorer',
  'Produce wines from {threshold} different grape varieties',
  '🍇',
  'production',
  'different_grapes',
  [1, 2, 3, 4, 5], // Realistic progression: 1, 2, 3, 4, 5 grape varieties (max 5-6 available)
  []
);

// Wine Grape Quality Threshold (realistic for 99.999 max)
export const WINE_GRAPE_QUALITY_ACHIEVEMENTS = createTieredAchievements(
  'wine_grape_quality',
  'Grape Quality Master',
  'Produce a wine with grape quality rating of {threshold}',
  '⭐',
  'production',
  'wine_grape_quality_threshold',
  [80, 85, 90, 95, 99], // Grape quality rating: 80, 85, 90, 95, 99 (max ~99.999)
  []
);

// Wine Balance Threshold (realistic for 99.999 max)
export const WINE_BALANCE_ACHIEVEMENTS = createTieredAchievements(
  'wine_balance',
  'Balance Virtuoso',
  'Produce a wine with balance rating of {threshold}',
  '⚖️',
  'production',
  'wine_balance_threshold',
  [80, 85, 90, 95, 99], // Balance rating: 80, 85, 90, 95, 99 (max ~99.999)
  []
);

// Wine Score Threshold (realistic for 99.999 max)
export const WINE_SCORE_ACHIEVEMENTS = createTieredAchievements(
  'wine_score',
  'Score Champion',
  'Produce a wine with wine score of {threshold}',
  '🎯',
  'production',
  'wine_score_threshold',
  [85, 90, 95, 98, 99], // Wine score: 85, 90, 95, 98, 99 (max ~99.999)
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

// Prestige by Year (realistic early game goals)
export const PRESTIGE_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'prestige_by_year',
  'Early Prestige',
  'Achieve {threshold} prestige before year 5',
  '⏰',
  'time',
  'prestige_by_year',
  [100, 300, 800, 2000, 5000], // Realistic progression: 100, 300, 800, 2000, 5000 prestige by year 5
  []
);

// Revenue by Year (smaller than general revenue achievements)
export const REVENUE_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'revenue_by_year',
  'Yearly Revenue',
  'Generate {threshold} revenue in a single year',
  '📊',
  'time',
  'revenue_by_year',
  [50000, 500000, 5000000, 50000000, 500000000], // Smaller than general: 50k, 500k, 5M, 50M, 500M euros
  []
);

// Assets by Year (smaller than general assets achievements)
export const ASSETS_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'assets_by_year',
  'Rapid Growth',
  'Accumulate {threshold} assets before year 10',
  '🚀',
  'time',
  'assets_by_year',
  [200000, 2000000, 20000000, 200000000, 2000000000], // Smaller than general: 200k, 2M, 20M, 200M, 2B euros
  []
);

// Hectares by Year (smaller than general hectares achievements)
export const HECTARES_BY_YEAR_ACHIEVEMENTS = createTieredAchievements(
  'hectares_by_year',
  'Land Rush',
  'Own {threshold} hectares before year 15',
  '🏞️',
  'time',
  'hectares_by_year',
  [5, 25, 125, 625, 3125], // Smaller than general: 5, 25, 125, 625, 3125 hectares
  []
);

// ===== LAND ACHIEVEMENTS =====

// Total Hectares (×5 exponential for realistic land ownership)
export const TOTAL_HECTARES_ACHIEVEMENTS = createTieredAchievements(
  'total_hectares',
  'Land Baron',
  'Own {threshold} hectares of vineyard land',
  '🌍',
  'vineyard',
  'total_hectares',
  [5, 25, 125, 625, 3125], // ×5 exponential: 5, 25, 125, 625, 3125 hectares
  []
);

// Average Hectare Value (×10 exponential for financial values)
export const AVERAGE_HECTARE_VALUE_ACHIEVEMENTS = createTieredAchievements(
  'average_hectare_value',
  'Prime Real Estate',
  'Own vineyards with average value above {threshold} per hectare',
  '💎',
  'vineyard',
  'average_hectare_value',
  [10000, 100000, 1000000, 10000000, 100000000], // ×10 exponential: 10k, 100k, 1M, 10M, 100M per hectare
  []
);

// ===== VINEYARD-SPECIFIC ACHIEVEMENTS =====

// Vineyard Time Achievements (realistic for 200 year max)
export const VINEYARD_TIME_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_time',
  'Vineyard Veteran',
  'Maintain the same grape variety in a vineyard for {threshold} years',
  '📅',
  'vineyard',
  'vineyard_time_same_grape',
  [5, 25, 50, 100, 200], // Realistic progression: 5, 25, 50, 100, 200 years (max 200)
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.3 } // Vineyard events decay much faster
);

// Vineyard Wine Variety Achievements (realistic for 5-6 grape varieties)
export const VINEYARD_WINE_VARIETY_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_wine_variety',
  'Vineyard Explorer',
  'Produce {threshold} different grape varieties from the same vineyard',
  '🍇',
  'vineyard',
  'vineyard_wine_variety_count',
  [1, 2, 3, 4, 5], // Realistic progression: 1, 2, 3, 4, 5 grape varieties per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.4 }
);

// Vineyard Bottle Production Achievements (lower than company production)
export const VINEYARD_BOTTLE_PRODUCTION_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_bottle_production',
  'Vineyard Producer',
  'Produce {threshold} bottles from a single vineyard',
  '🍷',
  'vineyard',
  'vineyard_bottles_produced',
  [50, 500, 5000, 50000, 500000], // Lower than company: 50, 500, 5k, 50k, 500k bottles per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.4 }
);

// Vineyard Sales Count Achievements (lower than company sales)
export const VINEYARD_SALES_COUNT_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_sales_count',
  'Vineyard Sales Master',
  'Make {threshold} sales from wines produced in a single vineyard',
  '💰',
  'vineyard',
  'vineyard_sales_count',
  [5, 25, 125, 625, 3125], // Lower than company: 5, 25, 125, 625, 3125 sales per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.4 }
);

// Vineyard Prestige Achievements (realistic for 5-10k practical max)
export const VINEYARD_PRESTIGE_ACHIEVEMENTS = createTieredAchievements(
  'vineyard_prestige',
  'Vineyard Legend',
  'Achieve {threshold} prestige from a single vineyard',
  '⭐',
  'vineyard',
  'vineyard_prestige_threshold',
  [10, 50, 200, 800, 3000], // Realistic progression: 10, 50, 200, 800, 3000 prestige per vineyard
  [],
  { includeVineyard: true, vineyardDecayMultiplier: 0.3 }
);

// ===== EXPORT ALL ACHIEVEMENTS =====

/**
 * All achievement configurations
 * Centralized array for easy iteration
 */
export const ALL_ACHIEVEMENTS: AchievementConfig[] = [
  // ===== FINANCIAL ACHIEVEMENTS =====
  ...MONEY_ACCUMULATION_ACHIEVEMENTS,
  ...REVENUE_GENERATION_ACHIEVEMENTS,
  ...TOTAL_ASSETS_ACHIEVEMENTS,
  ...CELLAR_VALUE_ACHIEVEMENTS,
  ...VINEYARD_VALUE_ACHIEVEMENTS,
  ...TOTAL_VINEYARD_VALUE_ACHIEVEMENTS,
  
  // ===== CONTRACT ACHIEVEMENTS =====
  ...SINGLE_CONTRACT_BOTTLES_ACHIEVEMENTS,
  ...SINGLE_CONTRACT_VALUE_ACHIEVEMENTS,
  
  // ===== TIME-BASED ACHIEVEMENTS =====
  ...TIME_ACHIEVEMENTS,
  ...PRESTIGE_BY_YEAR_ACHIEVEMENTS,
  ...REVENUE_BY_YEAR_ACHIEVEMENTS,
  ...ASSETS_BY_YEAR_ACHIEVEMENTS,
  ...HECTARES_BY_YEAR_ACHIEVEMENTS,
  
  // ===== PRODUCTION ACHIEVEMENTS =====
  ...WINE_VARIETY_ACHIEVEMENTS,
  ...BOTTLE_PRODUCTION_ACHIEVEMENTS,
  ...DIFFERENT_GRAPES_ACHIEVEMENTS,
  ...WINE_GRAPE_QUALITY_ACHIEVEMENTS,
  ...WINE_BALANCE_ACHIEVEMENTS,
  ...WINE_SCORE_ACHIEVEMENTS,
  ...WINE_PRICE_ACHIEVEMENTS,
  
  // ===== SALES ACHIEVEMENTS =====
  ...SALES_COUNT_ACHIEVEMENTS,
  ...SALES_PRICE_OVER_ACHIEVEMENTS,
  ...SALES_PRICE_UNDER_ACHIEVEMENTS,
  
  // ===== PRESTIGE ACHIEVEMENTS =====
  ...PRESTIGE_ACHIEVEMENTS,
  ...ACHIEVEMENT_COMPLETION_ACHIEVEMENTS,
  
  // ===== VINEYARD ACHIEVEMENTS =====
  ...VINEYARD_ACHIEVEMENTS,
  ...TOTAL_HECTARES_ACHIEVEMENTS,
  ...AVERAGE_HECTARE_VALUE_ACHIEVEMENTS,
  
  // ===== VINEYARD-SPECIFIC ACHIEVEMENTS =====
  ...VINEYARD_TIME_ACHIEVEMENTS,
  ...VINEYARD_WINE_VARIETY_ACHIEVEMENTS,
  ...VINEYARD_BOTTLE_PRODUCTION_ACHIEVEMENTS,
  ...VINEYARD_SALES_COUNT_ACHIEVEMENTS,
  ...VINEYARD_PRESTIGE_ACHIEVEMENTS,
];


