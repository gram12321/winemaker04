import { getCurrentCompanyId } from '../../utils/companyUtils';
import { companyService } from '../user/companyService';
import { getGameState } from '../core/gameState';
import { getShareMetrics } from './shareManagementService';
import { calculateFinancialData } from './financeService';
import { calculateCreditRating } from './creditRatingService';
import {
  INCREMENTAL_ANCHOR_CONFIG,
  INCREMENTAL_METRIC_CONFIG,
  EXPECTED_IMPROVEMENT_RATES,
  PRESTIGE_SCALING,
  SHARE_STRUCTURE_ADJUSTMENT_CONFIG,
  MARKET_CAP_MODIFIER_CONFIG
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
  
  // Check if company has enough history for trend comparisons
  const companyWeeks = calculateCompanyWeeks(
    company.foundedYear || gameState.currentYear || 2024,
    gameState.week || 1,
    gameState.season || 'Spring',
    gameState.currentYear || 2024
  );
  const has48WeekHistory = companyWeeks >= 48;
  const isFirstYear = companyWeeks < WEEKS_PER_YEAR; // First 48 weeks (grace period for profitability metrics)
  
  // Get snapshot from 48 weeks ago for trend-based comparisons
  const { getCompanyMetricsSnapshotNWeeksAgo } = await import('../../database/core/companyMetricsHistoryDB');
  const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);
  
  // Calculate expected improvement rate multipliers (economy × prestige × growth)
  const economyPhase: EconomyPhase = (gameState.economyPhase as EconomyPhase) || 'Stable';
  const prestige = gameState.prestige || 0;
  const growthTrendMultiplier = company?.growthTrendMultiplier ?? 1.0;
  const economyMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS[economyPhase];
  
  // Calculate prestige multiplier (logarithmic scaling)
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
  const prestigeMultiplier = PRESTIGE_SCALING.base + (normalizedPrestige * (PRESTIGE_SCALING.maxMultiplier - PRESTIGE_SCALING.base));
  
  // Combined multiplier for expected improvement rates
  const improvementMultiplier = economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
  
  // Calculate market cap modifier (additional expected improvement based on market cap)
  let marketCapRequirement = 0;
  if (MARKET_CAP_MODIFIER_CONFIG.enabled) {
    const marketCap = company.marketCap ?? (company.sharePrice ?? 0) * (company.totalShares ?? 1000000);
    if (marketCap > MARKET_CAP_MODIFIER_CONFIG.baseMarketCap) {
      // Logarithmic scaling: larger companies face higher absolute expectations
      const logRatio = Math.log10(marketCap / MARKET_CAP_MODIFIER_CONFIG.baseMarketCap);
      marketCapRequirement = Math.min(
        MARKET_CAP_MODIFIER_CONFIG.baseRate * logRatio,
        MARKET_CAP_MODIFIER_CONFIG.maxRate
      );
    }
  }
  
  // Get current 48-week rolling values
  const currentEPS48W = shareMetrics.earningsPerShare48Weeks ?? 0;
  const currentRevenuePerShare48W = shareMetrics.revenuePerShare48Weeks ?? 0;
  const currentDividendPerShare48W = shareMetrics.dividendPerShare48Weeks ?? 0;
  const currentRevenueGrowth48W = shareMetrics.revenueGrowth48Weeks ?? 0;
  const currentProfitMargin48W = shareMetrics.profitMargin48Weeks ?? 0;
  const currentCreditRating = (await calculateCreditRating()).finalRating;
  const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
  const currentPrestige = gameState.prestige || 0;
  
  // Get previous 48-week rolling values from snapshot (or use current as fallback)
  const previousEPS48W = snapshot48WeeksAgo?.earningsPerShare48W ?? currentEPS48W;
  const previousRevenuePerShare48W = snapshot48WeeksAgo?.revenuePerShare48W ?? currentRevenuePerShare48W;
  const previousDividendPerShare48W = snapshot48WeeksAgo?.dividendPerShare48W ?? currentDividendPerShare48W;
  const previousRevenueGrowth48W = snapshot48WeeksAgo?.revenueGrowth48W ?? currentRevenueGrowth48W;
  const previousProfitMargin48W = snapshot48WeeksAgo?.profitMargin48W ?? currentProfitMargin48W;
  const previousCreditRating = snapshot48WeeksAgo?.creditRating ?? currentCreditRating;
  const previousFixedAssetRatio = snapshot48WeeksAgo?.fixedAssetRatio ?? currentFixedAssetRatio;
  const previousPrestige = snapshot48WeeksAgo?.prestige ?? currentPrestige;
  
  // Calculate actual improvement (percentage change from previous to current)
  const actualEPSImprovement = previousEPS48W > 0 
    ? ((currentEPS48W - previousEPS48W) / previousEPS48W) * 100 
    : (currentEPS48W > 0 ? 100 : 0);
  const actualRevenuePerShareImprovement = previousRevenuePerShare48W > 0
    ? ((currentRevenuePerShare48W - previousRevenuePerShare48W) / previousRevenuePerShare48W) * 100
    : (currentRevenuePerShare48W > 0 ? 100 : 0);
  const actualDividendPerShareImprovement = previousDividendPerShare48W > 0
    ? ((currentDividendPerShare48W - previousDividendPerShare48W) / previousDividendPerShare48W) * 100
    : (currentDividendPerShare48W > 0 ? 100 : 0);
  const actualRevenueGrowthImprovement = previousRevenueGrowth48W > -1
    ? ((currentRevenueGrowth48W - previousRevenueGrowth48W) / (Math.abs(previousRevenueGrowth48W) + 0.01)) * 100
    : (currentRevenueGrowth48W > -1 ? 100 : 0);
  const actualProfitMarginImprovement = previousProfitMargin48W > 0
    ? ((currentProfitMargin48W - previousProfitMargin48W) / previousProfitMargin48W) * 100
    : (currentProfitMargin48W > 0 ? 100 : 0);
  
  // Calculate expected improvement rates (baseline × multipliers + market cap requirement)
  // Market cap requirement is added on top of trend-based expectations
  const expectedEPSImprovement = (EXPECTED_IMPROVEMENT_RATES.earningsPerShare * improvementMultiplier + marketCapRequirement) * 100;
  const expectedRevenuePerShareImprovement = (EXPECTED_IMPROVEMENT_RATES.revenuePerShare * improvementMultiplier + marketCapRequirement) * 100;
  const expectedDividendPerShareImprovement = (EXPECTED_IMPROVEMENT_RATES.dividendPerShare * improvementMultiplier + marketCapRequirement) * 100;
  const expectedRevenueGrowthImprovement = (EXPECTED_IMPROVEMENT_RATES.revenueGrowth * improvementMultiplier + marketCapRequirement) * 100;
  const expectedProfitMarginImprovement = (EXPECTED_IMPROVEMENT_RATES.profitMargin * improvementMultiplier + marketCapRequirement) * 100;
  const expectedCreditRatingImprovement = (EXPECTED_IMPROVEMENT_RATES.creditRating * improvementMultiplier + marketCapRequirement) * 100;
  const expectedFixedAssetRatioImprovement = (EXPECTED_IMPROVEMENT_RATES.fixedAssetRatio * improvementMultiplier + marketCapRequirement) * 100;
  const expectedPrestigeImprovement = (EXPECTED_IMPROVEMENT_RATES.prestige * improvementMultiplier + marketCapRequirement) * 100;
  
  // Calculate deltas: (Actual Improvement - Expected Improvement)
  // For profitability metrics, skip in first year (grace period)
  const deltaEarningsPerShare = isFirstYear ? 0 : (actualEPSImprovement - expectedEPSImprovement);
  const deltaRevenuePerShare = isFirstYear ? 0 : (actualRevenuePerShareImprovement - expectedRevenuePerShareImprovement);
  const deltaDividendPerShare = (actualDividendPerShareImprovement - expectedDividendPerShareImprovement);
  const deltaRevenueGrowth = isFirstYear ? 0 : (actualRevenueGrowthImprovement - expectedRevenueGrowthImprovement);
  const deltaProfitMargin = isFirstYear ? 0 : (actualProfitMarginImprovement - expectedProfitMarginImprovement);
  
  // For trend-based metrics (credit rating, fixed asset ratio, prestige), use trend delta
  // Compare current to previous, then compare actual improvement to expected improvement
  const actualCreditRatingImprovement = has48WeekHistory
    ? calculateTrendDelta(currentCreditRating, previousCreditRating)
    : 0;
  const actualFixedAssetRatioImprovement = has48WeekHistory
    ? calculateTrendDelta(currentFixedAssetRatio, previousFixedAssetRatio)
    : 0;
  const actualPrestigeImprovement = has48WeekHistory
    ? calculateTrendDelta(currentPrestige, previousPrestige, currentPrestige > 0 ? 100 : 0)
    : 0;
  
  const deltaCreditRating = has48WeekHistory
    ? (actualCreditRatingImprovement - expectedCreditRatingImprovement)
    : 0;
  const deltaFixedAssetRatio = has48WeekHistory
    ? (actualFixedAssetRatioImprovement - expectedFixedAssetRatioImprovement)
    : 0;
  const deltaPrestige = has48WeekHistory
    ? (actualPrestigeImprovement - expectedPrestigeImprovement)
    : 0;
  
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
      dividendPerShare48W: shareMetrics.dividendPerShare48Weeks ?? 0,
      profitMargin48W: shareMetrics.profitMargin48Weeks ?? 0,
      revenueGrowth48W: shareMetrics.revenueGrowth48Weeks ?? 0
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
 * Apply immediate price adjustment for share structure changes (issuance/buyback)
 * This captures market reaction to dilution/concentration effects beyond pure math
 * 
 * @param companyId - Company ID
 * @param oldTotalShares - Total shares before the change
 * @param newTotalShares - Total shares after the change
 * @param adjustmentType - 'issuance' (dilution) or 'buyback' (concentration)
 * @returns Success status and new price
 */
export async function applyImmediateShareStructureAdjustment(
  companyId: string,
  oldTotalShares: number,
  newTotalShares: number,
  adjustmentType: 'issuance' | 'buyback'
): Promise<{ success: boolean; newPrice?: number; error?: string }> {
  try {
    // Get current price
    const company = await companyService.getCompany(companyId);
    if (!company || !company.sharePrice || company.sharePrice <= 0) {
      return { success: false, error: 'Share price not initialized' };
    }
    
    const currentPrice = company.sharePrice;
    
    // Calculate base adjustment (pure math: maintain per-share value)
    // If we issue shares, price should drop proportionally to maintain market cap
    // If we buy back shares, price should rise proportionally
    const shareRatio = oldTotalShares / newTotalShares;
    
    // Apply market reaction multiplier
    const marketReaction = adjustmentType === 'issuance' 
      ? SHARE_STRUCTURE_ADJUSTMENT_CONFIG.dilutionPenalty 
      : SHARE_STRUCTURE_ADJUSTMENT_CONFIG.concentrationBonus;
    
    const newPrice = currentPrice * shareRatio * marketReaction;
    
    // Ensure price doesn't go below soft floor
    const shareMetrics = await getShareMetrics(companyId);
    const basePrice = shareMetrics.bookValuePerShare;
    const minPrice = Math.max(
      0.01,
      basePrice * INCREMENTAL_ANCHOR_CONFIG.minPriceRatioToAnchor
    );
    const finalPrice = Math.max(minPrice, newPrice);
    
    // Update company with new price
    const gameState = getGameState();
    await companyService.updateCompany(companyId, {
      sharePrice: finalPrice,
      marketCap: finalPrice * newTotalShares,
      lastSharePriceUpdateWeek: gameState.week,
      lastSharePriceUpdateSeason: gameState.season,
      lastSharePriceUpdateYear: gameState.currentYear
    });
    
    return { success: true, newPrice: finalPrice };
  } catch (error) {
    console.error('Error applying immediate share structure adjustment:', error);
    return { success: false, error: 'Failed to apply immediate adjustment' };
  }
}

/**
 * Get share price breakdown: Calculate and return incremental adjustment data without applying it
 * Used for Share Price Breakdown UI display
 */
export async function getSharePriceBreakdown(companyId?: string): Promise<{
  success: boolean;
  data?: {
    currentPrice: number;
    basePrice: number;
    adjustment: SharePriceAdjustmentResult;
    shareMetrics: Awaited<ReturnType<typeof getShareMetrics>>;
    company: Awaited<ReturnType<typeof companyService.getCompany>>;
    expectedImprovementRates: {
      earningsPerShare: number;  // Expected improvement rate (% per 48 weeks)
      revenuePerShare: number;   // Expected improvement rate (% per 48 weeks)
      dividendPerShare: number;  // Expected improvement rate (% per 48 weeks)
      revenueGrowth: number;     // Expected improvement rate (% per 48 weeks)
      profitMargin: number;      // Expected improvement rate (% per 48 weeks)
      creditRating: number;      // Expected improvement rate (% per 48 weeks)
      fixedAssetRatio: number;   // Expected improvement rate (% per 48 weeks)
      prestige: number;          // Expected improvement rate (% per 48 weeks)
    };
    currentValues48Weeks: {
      earningsPerShare: number;
      revenuePerShare: number;
      dividendPerShare: number;
      revenueGrowth: number;
      profitMargin: number;
    };
    currentValues: {
      creditRating: number;
      fixedAssetRatio: number;
      prestige: number;
    };
    previousValues48WeeksAgo: {
      earningsPerShare: number | null;
      revenuePerShare: number | null;
      dividendPerShare: number | null;
      revenueGrowth: number | null;
      profitMargin: number | null;
      creditRating: number | null;
      fixedAssetRatio: number | null;
      prestige: number | null;
      hasHistory?: boolean; // True if company has 48+ weeks of history
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
      improvementMultiplier: number; // Combined multiplier (economy × prestige × growth)
      marketCapRequirement: number; // Additional expected improvement from market cap (% per 48 weeks)
      marketCap: number; // Market cap for display
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
    
    // Get current values
    const gameState = getGameState();
    const financialData = await calculateFinancialData('year');
    const currentCreditRating = await calculateCreditRating();
    const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
    const currentPrestige = gameState.prestige || 0;
    
    // Get snapshot from 48 weeks ago
    const { getCompanyMetricsSnapshotNWeeksAgo } = await import('../../database/core/companyMetricsHistoryDB');
    const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);
    
    // Calculate expected improvement rate multipliers
    const economyPhase: EconomyPhase = (gameState.economyPhase as EconomyPhase) || 'Stable';
    const prestige = gameState.prestige || 0;
    const growthTrendMultiplier = company?.growthTrendMultiplier ?? 1.0;
    const economyMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS[economyPhase];
    const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
    const prestigeMultiplier = PRESTIGE_SCALING.base + (normalizedPrestige * (PRESTIGE_SCALING.maxMultiplier - PRESTIGE_SCALING.base));
    const improvementMultiplier = economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
    
    // Calculate market cap modifier (additional expected improvement based on market cap)
    let marketCapRequirement = 0;
    let marketCap = 0;
    if (MARKET_CAP_MODIFIER_CONFIG.enabled) {
      marketCap = company.marketCap ?? (company.sharePrice ?? 0) * (company.totalShares ?? 1000000);
      if (marketCap > MARKET_CAP_MODIFIER_CONFIG.baseMarketCap) {
        const logRatio = Math.log10(marketCap / MARKET_CAP_MODIFIER_CONFIG.baseMarketCap);
        marketCapRequirement = Math.min(
          MARKET_CAP_MODIFIER_CONFIG.baseRate * logRatio,
          MARKET_CAP_MODIFIER_CONFIG.maxRate
        );
      }
    }
    
    // Calculate expected improvement rates (baseline × multipliers + market cap requirement)
    const expectedImprovementRates = {
      earningsPerShare: (EXPECTED_IMPROVEMENT_RATES.earningsPerShare * improvementMultiplier + marketCapRequirement) * 100,
      revenuePerShare: (EXPECTED_IMPROVEMENT_RATES.revenuePerShare * improvementMultiplier + marketCapRequirement) * 100,
      dividendPerShare: (EXPECTED_IMPROVEMENT_RATES.dividendPerShare * improvementMultiplier + marketCapRequirement) * 100,
      revenueGrowth: (EXPECTED_IMPROVEMENT_RATES.revenueGrowth * improvementMultiplier + marketCapRequirement) * 100,
      profitMargin: (EXPECTED_IMPROVEMENT_RATES.profitMargin * improvementMultiplier + marketCapRequirement) * 100,
      creditRating: (EXPECTED_IMPROVEMENT_RATES.creditRating * improvementMultiplier + marketCapRequirement) * 100,
      fixedAssetRatio: (EXPECTED_IMPROVEMENT_RATES.fixedAssetRatio * improvementMultiplier + marketCapRequirement) * 100,
      prestige: (EXPECTED_IMPROVEMENT_RATES.prestige * improvementMultiplier + marketCapRequirement) * 100
    };
    
    // Get current 48-week rolling values
    const currentValues48Weeks = {
      earningsPerShare: shareMetrics.earningsPerShare48Weeks ?? 0,
      revenuePerShare: shareMetrics.revenuePerShare48Weeks ?? 0,
      dividendPerShare: shareMetrics.dividendPerShare48Weeks ?? 0,
      revenueGrowth: shareMetrics.revenueGrowth48Weeks ?? 0,
      profitMargin: shareMetrics.profitMargin48Weeks ?? 0
    };
    
    // Get previous 48-week rolling values (or use current as fallback)
    const previousValues48WeeksAgo = {
      earningsPerShare: snapshot48WeeksAgo?.earningsPerShare48W ?? null,
      revenuePerShare: snapshot48WeeksAgo?.revenuePerShare48W ?? null,
      dividendPerShare: snapshot48WeeksAgo?.dividendPerShare48W ?? null,
      revenueGrowth: snapshot48WeeksAgo?.revenueGrowth48W ?? null,
      profitMargin: snapshot48WeeksAgo?.profitMargin48W ?? null,
      creditRating: snapshot48WeeksAgo?.creditRating ?? null,
      fixedAssetRatio: snapshot48WeeksAgo?.fixedAssetRatio ?? null,
      prestige: snapshot48WeeksAgo?.prestige ?? null,
      hasHistory: (snapshot48WeeksAgo !== null)
    };
    
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
    
    // Get expected values calculation details (for backward compatibility with UI)
    const baseRevenueGrowth = company?.baseRevenueGrowth ?? 0.10; // 10% default
    const baseProfitMargin = company?.baseProfitMargin ?? 0.15; // 15% default
    const expectedReturnOnBookValue = company?.baseExpectedReturnOnBookValue ?? 0.10;
    
    const companyWeeks = calculateCompanyWeeks(
      company.foundedYear || gameState.currentYear || 2024,
      gameState.week || 1,
      gameState.season || 'Spring',
      gameState.currentYear || 2024
    );
    let expectedDividendPayments = 4;
    if (companyWeeks < WEEKS_PER_YEAR) {
      expectedDividendPayments = Math.min(4, Math.ceil(companyWeeks / WEEKS_PER_SEASON));
    }
    
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
      expectedDividendPayments,
      improvementMultiplier, // Combined multiplier (economy × prestige × growth)
      marketCapRequirement: marketCapRequirement * 100, // Market cap requirement (% per 48 weeks)
      marketCap // Market cap for display
    };
    
    return {
      success: true,
      data: {
        currentPrice,
        basePrice,
        adjustment,
        shareMetrics,
        company,
        expectedImprovementRates,
        currentValues48Weeks,
        currentValues: {
          creditRating: currentCreditRating.finalRating,
          fixedAssetRatio: currentFixedAssetRatio,
          prestige: currentPrestige
        },
        previousValues48WeeksAgo,
        anchorFactorDetails,
        expectedValuesCalc
      }
    };
  } catch (error) {
    console.error('Error getting share price breakdown:', error);
    return { success: false, error: 'Failed to get share price breakdown' };
  }
}

