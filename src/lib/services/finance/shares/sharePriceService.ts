
import { getCurrentCompanyId } from '../../../utils/companyUtils';
import { companyService } from '../../user/companyService';
import { getGameState } from '../../core/gameState';
import { getShareMetrics } from '../../index';
import { calculateFinancialData } from '../financeService';
import { calculateCreditRating } from '../creditRatingService';
import { updateCompanyShares, getCompanyShares } from '../../../database/core/companySharesDB';
import { INCREMENTAL_ANCHOR_CONFIG, INCREMENTAL_METRIC_CONFIG, SHARE_STRUCTURE_ADJUSTMENT_CONFIG } from '../../../constants';
import type { EconomyPhase, SharePriceAdjustmentResult, ShareMarketValue, ShareMarketValueUpdateResult } from '../../../types';
import type { Company } from '../../../database';
import { calculateFixedAssetRatio, getImprovementMultipliers, calculateExpectedImprovementRates, calcMarketCap } from '../../index';
import { calculateGracePeriods, calculateProfitabilityImprovements, calculateTrendBasedImprovements, calculateMetricDeltas, getCurrentMetricValues, getPreviousMetricValues48WeeksAgo, getCurrent48WeekValues, calculateAnchorFactorDetails, formatMultiplierBreakdownForDisplay } from '../../index';
import { getCompanyMetricsSnapshotNWeeksAgo, insertCompanyMetricsSnapshot } from '../../../database/core/companyMetricsHistoryDB';

type MetricKey = keyof typeof INCREMENTAL_METRIC_CONFIG;

function calculateAnchorFactor(currentPrice: number, basePrice: number): number {
  if (basePrice <= 0 || currentPrice <= 0) {
    return 0;
  }
  const deviation = Math.abs(currentPrice - basePrice) / basePrice;
  const { strength, exponent } = INCREMENTAL_ANCHOR_CONFIG;
  return 1 / (1 + strength * Math.pow(deviation, exponent));
}

async function calculateIncrementalAdjustment(
  currentPrice: number,
  basePrice: number, // bookValuePerShare (anchor)
  companyId: string,
  company: Company
): Promise<SharePriceAdjustmentResult> {
  // Get current metrics
  const shareMetrics = await getShareMetrics(companyId);
  const gameState = getGameState();
  const financialData = await calculateFinancialData('year');
  
  // Calculate grace periods
  const gracePeriods = calculateGracePeriods(company, gameState);
  
  // Get snapshot from 48 weeks ago for trend-based comparisons
    const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);
  
  // Get improvement multipliers and market cap requirement (using shared calculation)
  const multipliers = await getImprovementMultipliers(companyId);
  const improvementMultiplier = multipliers.improvementMultiplier;
  const marketCapRequirement = multipliers.marketCapRequirement;
  
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
  const previousValues = {
    eps: snapshot48WeeksAgo?.earningsPerShare48W ?? currentEPS48W,
    revenuePerShare: snapshot48WeeksAgo?.revenuePerShare48W ?? currentRevenuePerShare48W,
    dividendPerShare: snapshot48WeeksAgo?.dividendPerShare48W ?? currentDividendPerShare48W,
    revenueGrowth: snapshot48WeeksAgo?.revenueGrowth48W ?? currentRevenueGrowth48W,
    profitMargin: snapshot48WeeksAgo?.profitMargin48W ?? currentProfitMargin48W,
    creditRating: snapshot48WeeksAgo?.creditRating ?? currentCreditRating,
    fixedAssetRatio: snapshot48WeeksAgo?.fixedAssetRatio ?? currentFixedAssetRatio,
    prestige: snapshot48WeeksAgo?.prestige ?? currentPrestige
  };
  
  const currentValues = {
    eps: currentEPS48W,
    revenuePerShare: currentRevenuePerShare48W,
    dividendPerShare: currentDividendPerShare48W,
    revenueGrowth: currentRevenueGrowth48W,
    profitMargin: currentProfitMargin48W,
    creditRating: currentCreditRating,
    fixedAssetRatio: currentFixedAssetRatio,
    prestige: currentPrestige
  };
  
  // Calculate actual improvements
  const profitabilityImprovements = calculateProfitabilityImprovements(
    {
      eps: currentValues.eps,
      revenuePerShare: currentValues.revenuePerShare,
      dividendPerShare: currentValues.dividendPerShare,
      revenueGrowth: currentValues.revenueGrowth,
      profitMargin: currentValues.profitMargin
    },
    {
      eps: previousValues.eps,
      revenuePerShare: previousValues.revenuePerShare,
      dividendPerShare: previousValues.dividendPerShare,
      revenueGrowth: previousValues.revenueGrowth,
      profitMargin: previousValues.profitMargin
    }
  );
  
  const trendImprovements = calculateTrendBasedImprovements(
    {
      creditRating: currentValues.creditRating,
      fixedAssetRatio: currentValues.fixedAssetRatio,
      prestige: currentValues.prestige
    },
    {
      creditRating: previousValues.creditRating,
      fixedAssetRatio: previousValues.fixedAssetRatio,
      prestige: previousValues.prestige
    },
    gracePeriods.has48WeekHistory
  );
  
  // Calculate expected improvement rates
  const expectedRates = calculateExpectedImprovementRates(improvementMultiplier, marketCapRequirement);
  
  // Calculate metric deltas
  const metricDeltas = calculateMetricDeltas(
    {
      eps: profitabilityImprovements.epsImprovement,
      revenuePerShare: profitabilityImprovements.revenuePerShareImprovement,
      dividendPerShare: profitabilityImprovements.dividendPerShareImprovement,
      revenueGrowth: profitabilityImprovements.revenueGrowthImprovement,
      profitMargin: profitabilityImprovements.profitMarginImprovement,
      creditRating: trendImprovements.creditRatingImprovement,
      fixedAssetRatio: trendImprovements.fixedAssetRatioImprovement,
      prestige: trendImprovements.prestigeImprovement
    },
    expectedRates,
    gracePeriods
  );
  
  const metricContributions: Record<string, any> = {};
  let totalContribution = 0;
  
  (Object.keys(metricDeltas) as MetricKey[]).forEach((key) => {
    const config = INCREMENTAL_METRIC_CONFIG[key];
    const deltaPercent = metricDeltas[key];
    const deltaRatio = Math.max(-config.maxRatio, Math.min(config.maxRatio, deltaPercent / 100));
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

async function initializeSharePrice(companyId: string): Promise<number> {
  const shareMetrics = await getShareMetrics(companyId);
  return shareMetrics.bookValuePerShare;
}

async function initializeSharePriceWithTimestamp(companyId: string): Promise<number> {
  const initialPrice = await initializeSharePrice(companyId);
  const gameState = getGameState();
  
  // Get share data for total shares
  const sharesDataForInit = await getCompanyShares(companyId);
  const totalShares = sharesDataForInit?.totalShares || 1000000;
  
  await updateCompanyShares(companyId, {
    share_price: initialPrice,
    last_share_price_update_week: gameState.week,
    last_share_price_update_season: gameState.season,
    last_share_price_update_year: gameState.currentYear,
    market_cap: calcMarketCap(initialPrice, totalShares)
  });
  
  return initialPrice;
}

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
    
    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }
    
    // Initialize if needed
    const currentPrice = sharesData.sharePrice;
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
    
    // Get share data for total shares (already fetched above, reuse it)
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }
    
    // Update company shares with new price
    const totalShares = sharesData.totalShares;
    await updateCompanyShares(companyId, {
      share_price: adjustment.newPrice,
      last_share_price_update_week: gameState.week,
      last_share_price_update_season: gameState.season,
      last_share_price_update_year: gameState.currentYear,
      market_cap: calcMarketCap(adjustment.newPrice, totalShares)
    });
    
    return { success: true, newPrice: adjustment.newPrice };
  } catch (error) {
    console.error('Error adjusting share price incrementally:', error);
    return { success: false, error: 'Failed to adjust share price' };
  }
}

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

export async function applyImmediateShareStructureAdjustment(
  companyId: string,
  oldTotalShares: number,
  newTotalShares: number,
  adjustmentType: 'issuance' | 'buyback'
): Promise<{ success: boolean; newPrice?: number; error?: string }> {
  try {
    // Get current price
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }
    
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData || !sharesData.sharePrice || sharesData.sharePrice <= 0) {
      return { success: false, error: 'Share price not initialized' };
    }
    
    const currentPrice = sharesData.sharePrice;
    
    // Calculate base adjustment (pure math: maintain per-share value)
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
    
    // Update company shares with new price
    const gameState = getGameState();
    await updateCompanyShares(companyId, {
      share_price: finalPrice,
      market_cap: calcMarketCap(finalPrice, newTotalShares),
      last_share_price_update_week: gameState.week,
      last_share_price_update_season: gameState.season,
      last_share_price_update_year: gameState.currentYear
    });
    
    return { success: true, newPrice: finalPrice };
  } catch (error) {
    console.error('Error applying immediate share structure adjustment:', error);
    return { success: false, error: 'Failed to apply immediate adjustment' };
  }
}

export async function getCurrentSharePrice(companyId?: string): Promise<number> {
  if (!companyId) {
    companyId = getCurrentCompanyId();
  }
  
  if (!companyId) {
    return 0;
  }
  
  const company = await companyService.getCompany(companyId);
  if (!company) {
    return 0;
  }
  
  const sharesData = await getCompanyShares(companyId);
  if (sharesData?.sharePrice && sharesData.sharePrice > 0) {
    return sharesData.sharePrice;
  }
  
  // If not set, initialize deterministically
  const result = await initializeSharePriceDeterministically(companyId);
  return result.sharePrice || 0;
}

/**
 * Calculate initial share price - simply uses book value per share
 */
export async function calculateSharePrice(companyId?: string): Promise<number> {
  if (!companyId) {
    companyId = getCurrentCompanyId();
  }
  
  if (!companyId) {
    return 0;
  }
  
  const shareMetrics = await getShareMetrics(companyId);
  return shareMetrics.bookValuePerShare;
}

export async function calculateMarketCap(companyId?: string): Promise<number> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      console.error('No company ID available for market cap calculation');
      return 0;
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      console.error('Company not found for market cap calculation');
      return 0;
    }

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      console.error('Share data not found for market cap calculation');
      return 0;
    }

    const totalShares = sharesData.totalShares;
    
    // Use current share price from database (incremental system)
    const sharePrice = await getCurrentSharePrice(companyId);
    
    // Use shared calculation function
    return calcMarketCap(sharePrice, totalShares);
  } catch (error) {
    console.error('Error calculating market cap:', error);
    return 0;
  }
}

export async function updateMarketValue(companyId?: string): Promise<ShareMarketValueUpdateResult> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    const marketCap = await calculateMarketCap(companyId);
    const sharePrice = await getCurrentSharePrice(companyId);
    
    // Only update market cap (share price is managed incrementally)
    const updateResult = await updateCompanyShares(companyId, {
      market_cap: marketCap
    });
    
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update market value' };
    }
    
    return {
      success: true,
      marketCap,
      sharePrice
    };
  } catch (error) {
    console.error('Error updating market value:', error);
    return { success: false, error: 'Failed to update market value' };
  }
}

export async function getMarketValue(companyId?: string): Promise<ShareMarketValue> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { marketCap: 0, sharePrice: 0 };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { marketCap: 0, sharePrice: 0 };
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { marketCap: 0, sharePrice: 0 };
    }

    // Use current share price from database (incremental system)
    // If not initialized, initialize it first
    let sharePrice = sharesData.sharePrice;
    if (!sharePrice || sharePrice <= 0) {
      // Initialize share price deterministically
      const initResult = await initializeSharePriceDeterministically(companyId);
      sharePrice = initResult.sharePrice || 0;
    }

    // Calculate market cap from current share price
    const totalShares = sharesData.totalShares;
    const marketCap = calcMarketCap(sharePrice, totalShares);
    
    return { marketCap, sharePrice };
  } catch (error) {
    console.error('Error getting market value:', error);
    return { marketCap: 0, sharePrice: 0 };
  }
}

export async function getSharePriceBreakdown(companyId?: string): Promise<{
  success: boolean;
  data?: {
    currentPrice: number;
    basePrice: number;
    adjustment: SharePriceAdjustmentResult;
    shareMetrics: Awaited<ReturnType<typeof getShareMetrics>>;
    company: Awaited<ReturnType<typeof companyService.getCompany>>;
    expectedImprovementRates: {
      earningsPerShare: number;
      revenuePerShare: number;
      dividendPerShare: number;
      revenueGrowth: number;
      profitMargin: number;
      creditRating: number;
      fixedAssetRatio: number;
      prestige: number;
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
      hasHistory?: boolean;
    };
    anchorFactorDetails: {
      deviation: number;
      strength: number;
      exponent: number;
      denominator: number;
      anchorFactor: number;
    };
    expectedValuesCalc: {
      economyPhase: EconomyPhase;
      economyMultiplier: number;
      prestige: number;
      normalizedPrestige: number;
      prestigeMultiplier: number;
      growthTrendMultiplier: number;
      expectedDividendPayments: number;
      improvementMultiplier: number;
      marketCapRequirement: number;
      marketCap: number;
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
    
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }
    
    const currentPrice = sharesData.sharePrice;
    if (!currentPrice || currentPrice <= 0) {
      return { success: false, error: 'Share price not initialized' };
    }
    
    const shareMetrics = await getShareMetrics(companyId);
    const basePrice = shareMetrics.bookValuePerShare;
    
    // Get improvement multipliers and calculate expected rates
    const multipliers = await getImprovementMultipliers(companyId);
    const expectedImprovementRates = calculateExpectedImprovementRates(
      multipliers.improvementMultiplier,
      multipliers.marketCapRequirement
    );
    
    // Get metric values in parallel
    const [
      currentValues,
      previousValues48WeeksAgo,
      currentValues48Weeks,
      adjustment
    ] = await Promise.all([
      getCurrentMetricValues(),
      getPreviousMetricValues48WeeksAgo(companyId),
      Promise.resolve(getCurrent48WeekValues(shareMetrics)),
      calculateIncrementalAdjustment(currentPrice, basePrice, companyId, company)
    ]);
    
    // Calculate display details
    const anchorFactorDetails = calculateAnchorFactorDetails(
      currentPrice,
      basePrice,
      adjustment.anchorFactor
    );
    
    const expectedValuesCalc = formatMultiplierBreakdownForDisplay(company, {
      ...multipliers,
      economyPhase: multipliers.economyPhase as EconomyPhase
    });
    
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
        currentValues,
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

