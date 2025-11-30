import { companyService } from '../../user/companyService';
import { getCurrentCompanyId } from '../../../utils/companyUtils';
import { getGameState } from '../../core/gameState';
import { getShareMetrics, calculateFinancialData, calculateCreditRating, getImprovementMultipliers, calculateExpectedImprovementRates, calculateFixedAssetRatio, calculateProfitabilityImprovements, calculateTrendBasedImprovements, calculateGracePeriods } from '../../index';
import { GROWTH_TREND_CONFIG } from '../../../constants';
import { updateCompanyShares, getCompanyShares } from '../../../database/core/companySharesDB';
import { getCompanyMetricsSnapshotNWeeksAgo } from '../../../database/core/companyMetricsHistoryDB';
import type { GameDate } from '../../../types';

export async function updateGrowthTrend(): Promise<{
  success: boolean;
  growthTrendMultiplier?: number;
  error?: string;
}> {
  try {
    const companyId = getCurrentCompanyId();
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }
    
    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }
    
    const gameState = getGameState();
    const currentDate: GameDate = {
      week: gameState.week || 1,
      season: (gameState.season || 'Spring') as any,
      year: gameState.currentYear || 2024
    };
    
    // Check if we've already updated for this period
    const lastUpdate = sharesData.lastGrowthTrendUpdate;
    if (lastUpdate && 
        lastUpdate.year === currentDate.year &&
        lastUpdate.season === currentDate.season &&
        lastUpdate.week === currentDate.week) {
      // Already updated for this period
      return { 
        success: true, 
        growthTrendMultiplier: sharesData.growthTrendMultiplier
      };
    }
    
    // Calculate grace periods (same as share price system)
    const gracePeriods = calculateGracePeriods(company, gameState);
    
    // Need at least 48 weeks of history to evaluate improvement rates
    if (!gracePeriods.has48WeekHistory) {
      // Too early to evaluate - keep current multiplier
      return {
        success: true,
        growthTrendMultiplier: sharesData.growthTrendMultiplier
      };
    }
    
    // Get current metrics (same as share price system)
    const shareMetrics = await getShareMetrics();
    const financialData = await calculateFinancialData('year');
    const currentCreditRating = (await calculateCreditRating()).finalRating;
    const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
    const currentPrestige = gameState.prestige || 0;
    
    // Get snapshot from 48 weeks ago for trend-based comparisons
    const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);
    
    // Get current 48-week rolling values
    const currentValues = {
      eps: shareMetrics.earningsPerShare48Weeks ?? 0,
      revenuePerShare: shareMetrics.revenuePerShare48Weeks ?? 0,
      dividendPerShare: shareMetrics.dividendPerShare48Weeks ?? 0,
      revenueGrowth: shareMetrics.revenueGrowth48Weeks ?? 0,
      profitMargin: shareMetrics.profitMargin48Weeks ?? 0,
      creditRating: currentCreditRating,
      fixedAssetRatio: currentFixedAssetRatio,
      prestige: currentPrestige
    };
    
    // Get previous 48-week rolling values from snapshot (or use current as fallback)
    const previousValues = {
      eps: snapshot48WeeksAgo?.earningsPerShare48W ?? currentValues.eps,
      revenuePerShare: snapshot48WeeksAgo?.revenuePerShare48W ?? currentValues.revenuePerShare,
      dividendPerShare: snapshot48WeeksAgo?.dividendPerShare48W ?? currentValues.dividendPerShare,
      revenueGrowth: snapshot48WeeksAgo?.revenueGrowth48W ?? currentValues.revenueGrowth,
      profitMargin: snapshot48WeeksAgo?.profitMargin48W ?? currentValues.profitMargin,
      creditRating: snapshot48WeeksAgo?.creditRating ?? currentValues.creditRating,
      fixedAssetRatio: snapshot48WeeksAgo?.fixedAssetRatio ?? currentValues.fixedAssetRatio,
      prestige: snapshot48WeeksAgo?.prestige ?? currentValues.prestige
    };
    
    // Calculate actual improvements (same as share price system)
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
    
    // Get expected improvement rates (same as share price system)
    // Note: We use the CURRENT growth trend multiplier to calculate expected rates
    // This creates a feedback loop: if you exceed expectations, expectations increase
    const multipliers = await getImprovementMultipliers();
    const expectedRates = calculateExpectedImprovementRates(
      multipliers.improvementMultiplier,
      multipliers.marketCapRequirement
    );
    
    // Compare actual improvements to expected improvement rates
    // Calculate performance scores (1.0 = meets expectations, >1.0 = exceeds, <1.0 = underperforms)
    // Only evaluate metrics that are not in grace period
    const scores: number[] = [];
    
    if (!gracePeriods.isFirstYear) {
      // Profitability metrics
      if (expectedRates.earningsPerShare > 0) {
        scores.push(profitabilityImprovements.epsImprovement / expectedRates.earningsPerShare);
      }
      if (expectedRates.revenuePerShare > 0) {
        scores.push(profitabilityImprovements.revenuePerShareImprovement / expectedRates.revenuePerShare);
      }
      if (expectedRates.revenueGrowth > 0) {
        scores.push(profitabilityImprovements.revenueGrowthImprovement / expectedRates.revenueGrowth);
      }
      if (expectedRates.profitMargin > 0) {
        scores.push(profitabilityImprovements.profitMarginImprovement / expectedRates.profitMargin);
      }
    }
    
    if (!gracePeriods.isDividendGracePeriod && expectedRates.dividendPerShare > 0) {
      scores.push(profitabilityImprovements.dividendPerShareImprovement / expectedRates.dividendPerShare);
    }
    
    if (gracePeriods.has48WeekHistory) {
      // Trend-based metrics
      if (expectedRates.creditRating > 0) {
        scores.push(trendImprovements.creditRatingImprovement / expectedRates.creditRating);
      }
      if (expectedRates.fixedAssetRatio > 0) {
        scores.push(trendImprovements.fixedAssetRatioImprovement / expectedRates.fixedAssetRatio);
      }
      if (expectedRates.prestige > 0) {
        scores.push(trendImprovements.prestigeImprovement / expectedRates.prestige);
      }
    }
    
    // If no scores available (all metrics in grace period), keep current multiplier
    if (scores.length === 0) {
      return {
        success: true,
        growthTrendMultiplier: sharesData.growthTrendMultiplier
      };
    }
    
    // Average performance score across all evaluated metrics
    const avgPerformanceScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Update growth trend multiplier
    let currentMultiplier = sharesData.growthTrendMultiplier;
    
    if (avgPerformanceScore >= 1.0) {
      // Exceeded improvement rate expectations: increase multiplier
      const adjustment = GROWTH_TREND_CONFIG.adjustmentIncrement;
      currentMultiplier = Math.min(
        GROWTH_TREND_CONFIG.maxAdjustment + 1.0, // maxAdjustment is relative to 1.0
        currentMultiplier + adjustment
      );
    } else if (avgPerformanceScore < 0.8) {
      // Significantly underperformed improvement rate expectations: decrease multiplier
      const adjustment = GROWTH_TREND_CONFIG.adjustmentIncrement;
      currentMultiplier = Math.max(
        1.0 - GROWTH_TREND_CONFIG.minAdjustment, // minAdjustment is relative to 1.0
        currentMultiplier - adjustment
      );
    }
    // Performance between 0.8-1.0: no change (close enough to improvement rate expectations)
    
    // Update company shares in database
    const updateResult = await updateCompanyShares(companyId, {
      growth_trend_multiplier: currentMultiplier,
      last_growth_trend_update_week: currentDate.week,
      last_growth_trend_update_season: currentDate.season,
      last_growth_trend_update_year: currentDate.year
    });
    
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update growth trend' };
    }
    
    return {
      success: true,
      growthTrendMultiplier: currentMultiplier
    };
  } catch (error) {
    console.error('Error updating growth trend:', error);
    return { success: false, error: 'Failed to update growth trend' };
  }
}

