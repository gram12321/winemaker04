import { companyService } from '../user/companyService';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { getGameState } from '../core/gameState';
import { calculateExpectedValues } from './shareValuationService';
import { getShareMetrics } from './shareManagementService';
import { GROWTH_TREND_CONFIG } from '../../constants/shareValuationConstants';
import type { GameDate } from '../../types/types';

/**
 * Growth Trend Service
 * Tracks historical performance and adjusts expected value benchmarks accordingly
 * 
 * If a company consistently meets/exceeds expectations, future expectations increase.
 * This creates a dynamic challenge that scales with success.
 */

/**
 * Update growth trend multiplier based on performance vs expectations
 * Should be called at period boundaries (end of year or season)
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Success status and new growth trend multiplier
 */
export async function updateGrowthTrend(companyId?: string): Promise<{
  success: boolean;
  growthTrendMultiplier?: number;
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
    
    const gameState = getGameState();
    const currentDate: GameDate = {
      week: gameState.week || 1,
      season: (gameState.season || 'Spring') as any,
      year: gameState.currentYear || 2024
    };
    
    // Check if we've already updated for this period
    const lastUpdate = company.lastGrowthTrendUpdate;
    if (lastUpdate && 
        lastUpdate.year === currentDate.year &&
        lastUpdate.season === currentDate.season &&
        lastUpdate.week === currentDate.week) {
      // Already updated for this period
      return { 
        success: true, 
        growthTrendMultiplier: company.growthTrendMultiplier ?? 1.0 
      };
    }
    
    // Get current metrics
    const shareMetrics = await getShareMetrics(companyId);
    const bookValuePerShare = shareMetrics.bookValuePerShare;
    
    // Calculate expected values
    const expectedValues = await calculateExpectedValues(bookValuePerShare, companyId);
    
    // Compare actual vs expected performance using 48-week rolling metrics
    // Use 48-week metrics for consistency with incremental share price system
    const actualRevenueGrowth = shareMetrics.revenueGrowth48Weeks ?? 0;
    const actualProfitMargin = shareMetrics.profitMargin48Weeks ?? 0;
    const actualEPS = shareMetrics.earningsPerShare48Weeks ?? 0;
    
    // Calculate performance scores (1.0 = meets expectations, >1.0 = exceeds, <1.0 = underperforms)
    // For 48-week metrics, compare to annual expected values
    // EPS: expected annual EPS is already for 48 weeks (game year = 48 weeks)
    const expectedEPS48Weeks = expectedValues.earningsPerShare;
    const revenueGrowthScore = expectedValues.revenueGrowth > 0 
      ? Math.max(0, actualRevenueGrowth / expectedValues.revenueGrowth) 
      : (actualRevenueGrowth > 0 ? 2.0 : 1.0);
    
    const profitMarginScore = expectedValues.profitMargin > 0
      ? Math.max(0, actualProfitMargin / expectedValues.profitMargin)
      : (actualProfitMargin > 0 ? 2.0 : 1.0);
    
    const epsScore = expectedEPS48Weeks > 0
      ? actualEPS / expectedEPS48Weeks
      : (actualEPS > 0 ? 2.0 : 1.0);
    
    // Average performance score (weighted average could be used here)
    const avgPerformanceScore = (revenueGrowthScore + profitMarginScore + epsScore) / 3;
    
    // Update growth trend multiplier
    let currentMultiplier = company.growthTrendMultiplier ?? 1.0;
    
    if (avgPerformanceScore >= 1.0) {
      // Exceeded expectations: increase multiplier
      const adjustment = GROWTH_TREND_CONFIG.adjustmentIncrement;
      currentMultiplier = Math.min(
        GROWTH_TREND_CONFIG.maxAdjustment + 1.0, // maxAdjustment is relative to 1.0
        currentMultiplier + adjustment
      );
    } else if (avgPerformanceScore < 0.8) {
      // Significantly underperformed: decrease multiplier
      const adjustment = GROWTH_TREND_CONFIG.adjustmentIncrement;
      currentMultiplier = Math.max(
        1.0 - GROWTH_TREND_CONFIG.minAdjustment, // minAdjustment is relative to 1.0
        currentMultiplier - adjustment
      );
    }
    // Performance between 0.8-1.0: no change (close enough to expectations)
    
    // Update company in database
    const updateResult = await companyService.updateCompany(companyId, {
      growthTrendMultiplier: currentMultiplier,
      lastGrowthTrendUpdateWeek: currentDate.week,
      lastGrowthTrendUpdateSeason: currentDate.season,
      lastGrowthTrendUpdateYear: currentDate.year
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

