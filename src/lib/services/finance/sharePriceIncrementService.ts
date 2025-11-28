import { getCurrentCompanyId } from '../../utils/companyUtils';
import { companyService } from '../user/companyService';
import { getGameState } from '../core/gameState';
import { calculateExpectedValues } from './shareValuationService';
import { getShareMetrics } from './shareManagementService';
import { calculateFinancialData } from './financeService';
import { calculateCreditRating } from './creditRatingService';
import {
  INCREMENTAL_ANCHOR_CONFIG,
  INCREMENTAL_METRIC_CONFIG,
  EXPECTED_VALUE_BASELINES,
  PRESTIGE_SCALING
} from '../../constants/shareValuationConstants';
import { ECONOMY_EXPECTATION_MULTIPLIERS } from '../../constants/economyConstants';
import { NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { calculateCompanyWeeks } from '../../utils/utils';
import { WEEKS_PER_YEAR, WEEKS_PER_SEASON } from '../../constants';
import type { EconomyPhase } from '../../types/types';

// Helper function to calculate fixed asset ratio
function calculateFixedAssetRatio(fixedAssets: number, totalAssets: number): number {
  if (totalAssets <= 0) {
    return 0;
  }
  return fixedAssets / totalAssets;
}

/**
 * Incremental Share Price Service
 * 
 * Manages incremental share price adjustments with bookValuePerShare as an anchor.
 * Price moves incrementally each week based on performance, with the anchor
 * pulling it back toward bookValuePerShare.
 */

// Helper function to calculate percentage delta
function calculatePercentageDelta(actual: number, expected: number, fallbackForPositive = 0): number {
  if (expected > 0) {
    return ((actual - expected) / expected) * 100;
  }
  return fallbackForPositive;
}

// Helper function to calculate trend delta (percentage change from previous)
function calculateTrendDelta(current: number, previous: number, fallbackForPositive = 0): number {
  if (previous > 0) {
    return ((current - previous) / previous) * 100;
  }
  return current > 0 ? fallbackForPositive : 0;
}

type MetricKey = keyof typeof INCREMENTAL_METRIC_CONFIG;

interface MetricDelta {
  deltaPercent: number;
  deltaRatio: number;
  contribution: number;
}

interface SharePriceAdjustmentResult {
  newPrice: number;
  adjustment: number;
  totalContribution: number;
  anchorFactor: number;
  deltas: Record<MetricKey, number>;
  contributions: Record<MetricKey, MetricDelta>;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function calculateAnchorFactor(currentPrice: number, basePrice: number): number {
  if (basePrice <= 0 || currentPrice <= 0) {
    return 0;
  }
  const deviation = Math.abs(currentPrice - basePrice) / basePrice;
  const { strength, exponent } = INCREMENTAL_ANCHOR_CONFIG;
  return 1 / (1 + strength * Math.pow(deviation, exponent));
}

/**
 * Calculate incremental share price adjustment using delta-based system
 * Each metric contributes a percentage delta, summed equally, then scaled by anchor factor
 */
async function calculateIncrementalAdjustment(
  currentPrice: number,
  basePrice: number, // bookValuePerShare (anchor)
  companyId: string,
  company: any // Company record with previous values
): Promise<SharePriceAdjustmentResult> {
  // Get current metrics
  const shareMetrics = await getShareMetrics(companyId);
  const gameState = getGameState();
  const financialData = await calculateFinancialData('year');
  
  // Check if company is in first year (grace period for metrics that can't be achieved before first harvest)
  const companyWeeks = calculateCompanyWeeks(
    company.foundedYear || gameState.currentYear || 2024,
    gameState.week || 1,
    gameState.season || 'Spring',
    gameState.currentYear || 2024
  );
  const isFirstYear = companyWeeks < WEEKS_PER_YEAR; // First 48 weeks
  
  // Calculate expected values
  const expectedValues = await calculateExpectedValues(basePrice, companyId);
  
  // Calculate percentage deltas for each metric
  // Delta = (Actual - Expected) / Expected * 100 (as percentage)
  
  // Use rolling 48-week metrics for comparisons
  // All metrics now use rolling 48-week windows for smoother, more consistent comparisons
  
  // 1. Earnings Per Share delta (rolling 48-week comparison)
  // Compare actual EPS over last 48 weeks to expected annual EPS
  // Expected EPS is annual (for a game year = 48 weeks), so we compare directly
  // GRACE PERIOD: Skip delta in first year as players can't earn money before first harvest
  const expectedEPS48Weeks = expectedValues.earningsPerShare; // Annual expectation = 48 weeks expectation
  const actualEPS48Weeks = shareMetrics.earningsPerShare48Weeks ?? 0;
  const deltaEarningsPerShare = isFirstYear ? 0 : calculatePercentageDelta(
    actualEPS48Weeks,
    expectedEPS48Weeks,
    actualEPS48Weeks > 0 ? 100 : 0
  );
  
  // 2. Revenue Per Share delta (rolling 48-week comparison)
  // Compare actual revenue per share over last 48 weeks to expected annual revenue per share
  // Expected revenue per share is annual (for a game year = 48 weeks), so we compare directly
  // GRACE PERIOD: Skip delta in first year as players can't have revenue before first harvest
  const expectedRevenuePerShare48Weeks = expectedValues.revenuePerShare; // Annual expectation = 48 weeks expectation
  const actualRevenuePerShare48Weeks = shareMetrics.revenuePerShare48Weeks ?? 0;
  const deltaRevenuePerShare = isFirstYear ? 0 : calculatePercentageDelta(
    actualRevenuePerShare48Weeks,
    expectedRevenuePerShare48Weeks,
    actualRevenuePerShare48Weeks > 0 ? 100 : 0
  );
  
  // 3. Dividend Per Share delta (rolling 48-week comparison)
  // Dividends are paid on week 1 of each season (4 times per year)
  // Calculate how many dividend payments should have occurred in the last 48 weeks
  // For a full 48-week period, we expect 4 payments (one per season)
  // For companies less than 48 weeks old, we expect only the payments for seasons that have occurred
  let expectedDividendPayments = 4; // Default: full year (48 weeks = 4 seasons)
  
  if (companyWeeks < WEEKS_PER_YEAR) {
    // Company is less than 48 weeks old - calculate based on seasons that have occurred
    // Count how many season starts (week 1 of each season) have occurred
    // If we're in season 1 (weeks 1-12), expect 1 payment; season 2 (weeks 13-24), expect 2, etc.
    expectedDividendPayments = Math.min(4, Math.ceil(companyWeeks / WEEKS_PER_SEASON));
    
    // However, if we're looking at a 48-week rolling window, we need to account for
    // the fact that the window might extend before company founding
    // Since we're using companyWeeks, we can't look back further than company founding
    // So the expected payments = number of seasons since founding (up to 4)
  }
  
  const expectedDividendPerShare48Weeks = (company.dividendRate || 0) * expectedDividendPayments;
  const actualDividendPerShare48Weeks = shareMetrics.dividendPerShare48Weeks ?? 0;
  const deltaDividendPerShare = calculatePercentageDelta(
    actualDividendPerShare48Weeks,
    expectedDividendPerShare48Weeks,
    actualDividendPerShare48Weeks > 0 ? 100 : 0
  );
  
  // 4. Revenue Growth delta (rolling 48-week comparison)
  // Compare revenue growth: (last 48 weeks vs previous 48 weeks) vs expected growth rate
  // GRACE PERIOD: Skip delta in first year - can't have meaningful revenue growth before first harvest
  const actualRevenueGrowth48Weeks = shareMetrics.revenueGrowth48Weeks ?? 0;
  const deltaRevenueGrowth = isFirstYear ? 0 : calculatePercentageDelta(
    actualRevenueGrowth48Weeks,
    expectedValues.revenueGrowth,
    actualRevenueGrowth48Weeks > -1 ? 100 : 0 // Allow negative growth rates
  );
  
  // 5. Profit Margin delta (rolling 48-week comparison)
  // Compare actual profit margin over last 48 weeks to expected annual profit margin
  // GRACE PERIOD: Skip delta in first year as players can't have profit before first harvest
  const actualProfitMargin48Weeks = shareMetrics.profitMargin48Weeks ?? 0;
  const deltaProfitMargin = isFirstYear ? 0 : calculatePercentageDelta(
    actualProfitMargin48Weeks,
    expectedValues.profitMargin,
    actualProfitMargin48Weeks > 0 ? 100 : 0
  );
  
  // 6. Credit Rating delta (48-week rolling comparison)
  // Compare current credit rating to credit rating from 48 weeks ago
  const currentCreditRating = await calculateCreditRating();
  const { getCompanyMetricsSnapshotNWeeksAgo } = await import('../../database/core/companyMetricsHistoryDB');
  const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);
  const previousCreditRating = snapshot48WeeksAgo?.creditRating ?? currentCreditRating.finalRating;
  const deltaCreditRating = companyWeeks >= 48 
    ? calculateTrendDelta(currentCreditRating.finalRating, previousCreditRating)
    : 0; // Grace period: skip if less than 48 weeks of history
  
  // 7. Fixed Asset Ratio delta (48-week rolling comparison)
  // Compare current fixed asset ratio to fixed asset ratio from 48 weeks ago
  const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
  const previousFixedAssetRatio = snapshot48WeeksAgo?.fixedAssetRatio ?? currentFixedAssetRatio;
  const deltaFixedAssetRatio = companyWeeks >= 48
    ? calculateTrendDelta(currentFixedAssetRatio, previousFixedAssetRatio)
    : 0; // Grace period: skip if less than 48 weeks of history
  
  // 8. Prestige delta (48-week rolling comparison)
  // Compare current prestige to prestige from 48 weeks ago
  const currentPrestige = gameState.prestige || 0;
  const previousPrestige = snapshot48WeeksAgo?.prestige ?? currentPrestige;
  const deltaPrestige = companyWeeks >= 48
    ? calculateTrendDelta(currentPrestige, previousPrestige, currentPrestige > 0 ? 100 : 0)
    : 0; // Grace period: skip if less than 48 weeks of history
  
  const metricDeltas: Record<MetricKey, number> = {
    earningsPerShare: deltaEarningsPerShare,
    revenuePerShare: deltaRevenuePerShare,
    dividendPerShare: deltaDividendPerShare,
    revenueGrowth: deltaRevenueGrowth,
    profitMargin: deltaProfitMargin,
    creditRating: deltaCreditRating,
    fixedAssetRatio: deltaFixedAssetRatio,
    prestige: deltaPrestige
  };
  
  const metricContributions: Record<MetricKey, MetricDelta> = {} as Record<MetricKey, MetricDelta>;
  let totalContribution = 0;
  
  (Object.keys(metricDeltas) as MetricKey[]).forEach((key) => {
    const config = INCREMENTAL_METRIC_CONFIG[key];
    const deltaPercent = metricDeltas[key];
    const deltaRatio = clamp(deltaPercent / 100, -config.maxRatio, config.maxRatio);
    const contribution = deltaRatio * config.baseAdjustment;
    metricContributions[key] = {
      deltaPercent,
      deltaRatio,
      contribution
    };
    totalContribution += contribution;
  });
  
  const anchorFactor = calculateAnchorFactor(currentPrice, basePrice);
  const adjustment = totalContribution * anchorFactor;
  
  const minPrice = Math.max(
    0.01,
    basePrice * INCREMENTAL_ANCHOR_CONFIG.minPriceRatioToAnchor
  );
  
  let newPrice = currentPrice + adjustment;
  newPrice = Math.max(minPrice, newPrice);
  
  return {
    newPrice,
    adjustment,
    totalContribution,
    anchorFactor,
    deltas: metricDeltas,
    contributions: metricContributions
  };
}

/**
 * Initialize share price - simply uses book value per share as the starting point
 */
async function initializeSharePrice(companyId: string): Promise<number> {
  const shareMetrics = await getShareMetrics(companyId);
  return shareMetrics.bookValuePerShare;
}

/**
 * Initialize share price and update company record with timestamp
 */
async function initializeSharePriceWithTimestamp(companyId: string): Promise<number> {
  const initialPrice = await initializeSharePrice(companyId);
  const gameState = getGameState();
  
  await companyService.updateCompany(companyId, {
    sharePrice: initialPrice,
    lastSharePriceUpdateWeek: gameState.week,
    lastSharePriceUpdateSeason: gameState.season,
    lastSharePriceUpdateYear: gameState.currentYear,
    marketCap: initialPrice * ((await companyService.getCompany(companyId))?.totalShares || 1000000)
  });
  
  return initialPrice;
}

/**
 * Adjust share price incrementally (weekly update)
 */
export async function adjustSharePriceIncrementally(companyId?: string): Promise<{
  success: boolean;
  newPrice?: number;
  error?: string;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }
    
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }
    
    // Initialize if needed
    const currentPrice = company.sharePrice || 0;
    if (!currentPrice || currentPrice <= 0) {
      const initialPrice = await initializeSharePriceWithTimestamp(companyId);
      return { success: true, newPrice: initialPrice };
    }
    
    // Get base price (anchor) - bookValuePerShare
    const shareMetrics = await getShareMetrics(companyId);
    const basePrice = shareMetrics.bookValuePerShare;
    
    // Get current values for trend calculations
    const gameState = getGameState();
    const financialData = await calculateFinancialData('year');
    const creditRating = await calculateCreditRating();
    const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
    const currentPrestige = gameState.prestige || 0;
    
    // Calculate incremental adjustment
    const adjustment = await calculateIncrementalAdjustment(
      currentPrice,
      basePrice,
      companyId,
      company
    );
    
    // Insert snapshot of current metrics for future 48-week comparisons and historical diagrams
    const { insertCompanyMetricsSnapshot } = await import('../../database/core/companyMetricsHistoryDB');
    await insertCompanyMetricsSnapshot({
      companyId,
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024,
      creditRating: creditRating.finalRating,
      prestige: currentPrestige,
      fixedAssetRatio: currentFixedAssetRatio,
      sharePrice: adjustment.newPrice,
      bookValuePerShare: basePrice,
      earningsPerShare48W: shareMetrics.earningsPerShare48Weeks ?? 0,
      revenuePerShare48W: shareMetrics.revenuePerShare48Weeks ?? 0,
      dividendPerShare48W: shareMetrics.dividendPerShare48Weeks ?? 0
    });
    
    // Update company with new price
    await companyService.updateCompany(companyId, {
      sharePrice: adjustment.newPrice,
      lastSharePriceUpdateWeek: gameState.week,
      lastSharePriceUpdateSeason: gameState.season,
      lastSharePriceUpdateYear: gameState.currentYear,
      marketCap: adjustment.newPrice * (company.totalShares || 1000000)
    });
    
    return { success: true, newPrice: adjustment.newPrice };
  } catch (error) {
    console.error('Error adjusting share price incrementally:', error);
    return { success: false, error: 'Failed to adjust share price' };
  }
}

/**
 * Initialize or re-initialize share price deterministically
 * Used when share price should be set to a specific value
 */
export async function initializeSharePriceDeterministically(companyId?: string): Promise<{
  success: boolean;
  sharePrice?: number;
  error?: string;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }
    
    const initialPrice = await initializeSharePriceWithTimestamp(companyId);
    
    return { success: true, sharePrice: initialPrice };
  } catch (error) {
    console.error('Error initializing share price:', error);
    return { success: false, error: 'Failed to initialize share price' };
  }
}

/**
 * Debug function: Calculate and return incremental adjustment data without applying it
 * Used for debugging and admin dashboard display
 */
export async function calculateIncrementalAdjustmentDebug(companyId?: string): Promise<{
  success: boolean;
  data?: {
    currentPrice: number;
    basePrice: number;
    adjustment: SharePriceAdjustmentResult;
    shareMetrics: Awaited<ReturnType<typeof getShareMetrics>>;
    company: Awaited<ReturnType<typeof companyService.getCompany>>;
    expectedValues: {
      earningsPerShare: number;  // Annual expected (game year = 48 weeks)
      revenuePerShare: number;  // Annual expected (game year = 48 weeks)
      dividendPerShare: number;  // Single payment rate
      dividendPerShare48Weeks: number;  // Expected total for 48 weeks (rate × expected payments)
      revenueGrowth: number;     // Annual expected growth rate
      profitMargin: number;      // Annual expected profit margin
    };
    actualValues48Weeks: {
      earningsPerShare: number;
      revenuePerShare: number;
      dividendPerShare: number;
      revenueGrowth: number;
      profitMargin: number;
    };
    actualValues: {
      creditRating: number;
      fixedAssetRatio: number;
      prestige: number;
    };
    previousValues48WeeksAgo: {
      creditRating: number | null;
      fixedAssetRatio: number | null;
      prestige: number | null;
    };
    anchorFactorDetails: {
      deviation: number;
      strength: number;
      exponent: number;
      denominator: number;
      anchorFactor: number;
    };
    expectedValuesCalc: {
      baseRevenueGrowth: number;
      baseProfitMargin: number;
      expectedReturnOnBookValue: number;
      economyPhase: EconomyPhase;
      economyMultiplier: number;
      prestige: number;
      normalizedPrestige: number;
      prestigeMultiplier: number;
      growthTrendMultiplier: number;
      expectedDividendPayments: number;
    };
  };
  error?: string;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }
    
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }
    
    const currentPrice = company.sharePrice || 0;
    if (!currentPrice || currentPrice <= 0) {
      return { success: false, error: 'Share price not initialized' };
    }
    
    const shareMetrics = await getShareMetrics(companyId);
    const basePrice = shareMetrics.bookValuePerShare;
    
    // Calculate expected values for display
    const expectedValues = await calculateExpectedValues(basePrice, companyId);
    
    // Get actual values for trend metrics
    const gameState = getGameState();
    const financialData = await calculateFinancialData('year');
    const currentCreditRating = await calculateCreditRating();
    const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
    
    const adjustment = await calculateIncrementalAdjustment(
      currentPrice,
      basePrice,
      companyId,
      company
    );
    
    // Calculate anchor factor details for display
    const deviation = Math.abs(currentPrice - basePrice) / basePrice;
    const { strength, exponent } = INCREMENTAL_ANCHOR_CONFIG;
    const anchorFactorDetails = {
      deviation,
      strength,
      exponent,
      denominator: 1 + strength * Math.pow(deviation, exponent),
      anchorFactor: adjustment.anchorFactor
    };
    
    // Get expected values calculation details
    const economyPhase: EconomyPhase = (gameState.economyPhase as EconomyPhase) || 'Stable';
    const prestige = gameState.prestige || 0;
    const growthTrendMultiplier = company?.growthTrendMultiplier ?? 1.0;
    const economyMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS[economyPhase];
    
    // Calculate prestige multiplier (matching the calculation in calculateExpectedValues)
    const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
    const prestigeMultiplier = PRESTIGE_SCALING.base + (normalizedPrestige * (PRESTIGE_SCALING.maxMultiplier - PRESTIGE_SCALING.base));
    
    // Base expectations - use company-stored values if available, otherwise use constants
    const baseRevenueGrowth = company?.baseRevenueGrowth ?? EXPECTED_VALUE_BASELINES.revenueGrowth;
    const baseProfitMargin = company?.baseProfitMargin ?? EXPECTED_VALUE_BASELINES.profitMargin;
    const expectedReturnOnBookValue = company?.baseExpectedReturnOnBookValue ?? 0.10;
    
    // Calculate expected dividend payments for 48-week window (same logic as in calculateIncrementalAdjustment)
    const companyWeeks = calculateCompanyWeeks(
      company.foundedYear || gameState.currentYear || 2024,
      gameState.week || 1,
      gameState.season || 'Spring',
      gameState.currentYear || 2024
    );
    let expectedDividendPayments = 4; // Default: full year (48 weeks = 4 seasons)
    
    if (companyWeeks < WEEKS_PER_YEAR) {
      // Company is less than 48 weeks old - calculate based on seasons that have occurred
      expectedDividendPayments = Math.min(4, Math.ceil(companyWeeks / WEEKS_PER_SEASON));
    }
    
    const expectedDividendPerShare48Weeks = (company.dividendRate || 0) * expectedDividendPayments;
    
    const expectedValuesCalc = {
      baseRevenueGrowth,
      baseProfitMargin,
      expectedReturnOnBookValue,
      economyPhase,
      economyMultiplier,
      prestige,
      normalizedPrestige,
      prestigeMultiplier,
      growthTrendMultiplier,
      expectedDividendPayments // Add for UI display
    };
    
    return {
      success: true,
      data: {
        currentPrice,
        basePrice,
        adjustment,
        shareMetrics,
        company,
        previousValues48WeeksAgo: {
          creditRating: (await (await import('../../database/core/companyMetricsHistoryDB')).getCompanyMetricsSnapshotNWeeksAgo(48, companyId))?.creditRating ?? null,
          fixedAssetRatio: (await (await import('../../database/core/companyMetricsHistoryDB')).getCompanyMetricsSnapshotNWeeksAgo(48, companyId))?.fixedAssetRatio ?? null,
          prestige: (await (await import('../../database/core/companyMetricsHistoryDB')).getCompanyMetricsSnapshotNWeeksAgo(48, companyId))?.prestige ?? null
        },
        expectedValues: {
          earningsPerShare: expectedValues.earningsPerShare,
          revenuePerShare: expectedValues.revenuePerShare,
          dividendPerShare: company.dividendRate || 0,
          dividendPerShare48Weeks: expectedDividendPerShare48Weeks,
          revenueGrowth: expectedValues.revenueGrowth,
          profitMargin: expectedValues.profitMargin
        },
        actualValues48Weeks: {
          earningsPerShare: shareMetrics.earningsPerShare48Weeks ?? 0,
          revenuePerShare: shareMetrics.revenuePerShare48Weeks ?? 0,
          dividendPerShare: shareMetrics.dividendPerShare48Weeks ?? 0,
          revenueGrowth: shareMetrics.revenueGrowth48Weeks ?? 0,
          profitMargin: shareMetrics.profitMargin48Weeks ?? 0
        },
        actualValues: {
          creditRating: currentCreditRating.finalRating,
          fixedAssetRatio: currentFixedAssetRatio,
          prestige: gameState.prestige || 0
        },
        anchorFactorDetails,
        expectedValuesCalc
      }
    };
  } catch (error) {
    console.error('Error calculating incremental adjustment debug:', error);
    return { success: false, error: 'Failed to calculate incremental adjustment' };
  }
}

