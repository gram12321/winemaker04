import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { clamp01, calculateConsistencyScore } from '@/lib/utils';
import { companyService, getGameState, calculateFinancialData, calculateCreditRating, calculateTotalOutstandingLoans, getShareMetrics, getShareholderBreakdown, getImprovementMultipliers, calculateExpectedImprovementRates, calculateProfitabilityImprovements, calculateTrendBasedImprovements, calculateMetricDeltas, calculateGracePeriods, getCurrentMetricValues, getPreviousMetricValues48WeeksAgo } from '@/lib/services';
import { getCompanyMetricsSnapshotNWeeksAgo, insertBoardSatisfactionSnapshot, getBoardSatisfactionHistory } from '@/lib/database';
import { BOARD_SATISFACTION_WEIGHTS, BOARD_SATISFACTION_DEFAULTS } from '@/lib/constants';

// Credit rating constants for normalization
const CREDIT_RATING_ASSET_HEALTH_MAX = 0.20; // Max score from credit rating asset health
const CREDIT_RATING_STABILITY_MAX = 0.10; // Max score from credit rating company stability

/**
 * Board Satisfaction Breakdown
 */
export interface BoardSatisfactionBreakdown {
  satisfaction: number; // 0-1
  performanceScore: number; // 0-1
  stabilityScore: number; // 0-1
  consistencyScore: number; // 0-1
  ownershipPressure: number; // 0-1 (higher = more outside ownership)
  playerOwnershipPct: number; // 0-100
  details: {
    performanceMetrics: {
      earningsPerShare: number;
      revenuePerShare: number;
      profitMargin: number;
      revenueGrowth: number;
    };
    stabilityMetrics: {
      cashRatio: number;
      debtRatio: number;
      fixedAssetRatio: number;
    };
    consistencyVolatility: number; // Lower is better
  };
}

/**
 * Calculate performance score from metric deltas
 * Normalizes deltas to 0-1 scale where 0 = worst, 1 = best
 */
function calculatePerformanceScore(metricDeltas: Record<string, number>): number {
  // Get all deltas
  const deltas = [
    metricDeltas.earningsPerShare || 0,
    metricDeltas.revenuePerShare || 0,
    metricDeltas.profitMargin || 0,
    metricDeltas.revenueGrowth || 0,
    metricDeltas.dividendPerShare || 0,
    metricDeltas.creditRating || 0,
    metricDeltas.fixedAssetRatio || 0,
    metricDeltas.prestige || 0
  ];

  // Normalize deltas: assume deltas range from -50% to +50%
  // Map to 0-1 scale: delta of +50% = 1.0, delta of -50% = 0.0, delta of 0% = 0.5
  const normalized = deltas.map(delta => {
    // Clamp delta to reasonable range (-100% to +100%)
    const clamped = Math.max(-100, Math.min(100, delta));
    // Normalize: -100% -> 0.0, 0% -> 0.5, +100% -> 1.0
    return (clamped + 100) / 200;
  });

  // Average of normalized scores
  const avg = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
  return clamp01(avg);
}

/**
 * Calculate stability score from credit rating components
 * Returns 0-1 scale where 1 = most stable
 * Combines asset health (60%) and company stability (40%) from credit rating
 * Asset health covers debt ratios, liquidity, fixed assets
 * Company stability covers age, profit consistency, expense efficiency
 */
function calculateStabilityScoreFromCreditRating(
  assetHealthScore: number,
  companyStabilityScore: number
): number {
  // Normalize credit rating components to 0-1 scale
  const normalizedAssetHealth = clamp01(assetHealthScore / CREDIT_RATING_ASSET_HEALTH_MAX);
  const normalizedCompanyStability = clamp01(companyStabilityScore / CREDIT_RATING_STABILITY_MAX);
  
  // Weighted combination: 60% asset health, 40% company stability
  // Asset health is more important for immediate stability
  // Company stability reflects long-term operational stability
  return (normalizedAssetHealth * 0.6) + (normalizedCompanyStability * 0.4);
}

/**
 * Calculate consistency score from historical board satisfaction volatility
 * Returns 0-1 scale where 1 = most consistent (low volatility)
 * Uses shared consistency utility
 */
async function calculateBoardSatisfactionConsistency(
  companyId: string,
  currentSatisfaction: number
): Promise<number> {
  try {
    // Get historical satisfaction snapshots (last 12 weeks for consistency calculation)
    const history = await getBoardSatisfactionHistory(companyId, 12);
    
    if (history.length < 4) {
      // Not enough data - return moderate consistency
      return 0.7;
    }

    // Extract satisfaction scores from history
    const historicalScores = history.map((s) => s.satisfactionScore);
    
    // Use shared consistency utility
    return calculateConsistencyScore(historicalScores, currentSatisfaction, 4, 0.7, 0.3);
  } catch (error) {
    console.error('Error calculating board satisfaction consistency:', error);
    return 0.7; // Neutral fallback
  }
}

/**
 * Calculate board satisfaction for the current company
 */
export async function calculateBoardSatisfaction(): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      return 1.0; // No company = assume full ownership (no constraints)
    }

    const breakdown = await getBoardSatisfactionBreakdown();
    return breakdown.satisfaction;
  } catch (error) {
    console.error('Error calculating board satisfaction:', error);
    return BOARD_SATISFACTION_DEFAULTS.newCompany;
  }
}

/**
 * Get detailed board satisfaction breakdown for the current company
 */
export async function getBoardSatisfactionBreakdown(): Promise<BoardSatisfactionBreakdown> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      // No company = return full ownership defaults
      return {
        satisfaction: 1.0,
        performanceScore: 1.0,
        stabilityScore: 1.0,
        consistencyScore: 1.0,
        ownershipPressure: 0.0,
        playerOwnershipPct: 100,
        details: {
          performanceMetrics: {
            earningsPerShare: 0,
            revenuePerShare: 0,
            profitMargin: 0,
            revenueGrowth: 0
          },
          stabilityMetrics: {
            cashRatio: 0,
            debtRatio: 0,
            fixedAssetRatio: 0
          },
          consistencyVolatility: 0
        }
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Check player ownership - if 100%, return max satisfaction (no board constraints)
    const shareholderBreakdown = await getShareholderBreakdown(companyId);
    const playerOwnershipPct = shareholderBreakdown.playerPct;
    
    if (playerOwnershipPct >= 100) {
      return {
        satisfaction: 1.0,
        performanceScore: 1.0,
        stabilityScore: 1.0,
        consistencyScore: 1.0,
        ownershipPressure: 0.0,
        playerOwnershipPct: 100,
        details: {
          performanceMetrics: {
            earningsPerShare: 0,
            revenuePerShare: 0,
            profitMargin: 0,
            revenueGrowth: 0
          },
          stabilityMetrics: {
            cashRatio: 0,
            debtRatio: 0,
            fixedAssetRatio: 0
          },
          consistencyVolatility: 0
        }
      };
    }

    // Get game state and financial data
    const gameState = getGameState();
    const [financialData, shareMetrics, totalDebt] = await Promise.all([
      calculateFinancialData('year'),
      getShareMetrics(companyId),
      calculateTotalOutstandingLoans()
    ]);

    // Calculate ownership pressure (inverted player ownership)
    const ownershipPressure = 1 - (playerOwnershipPct / 100);

    // Calculate performance score (reuse share price metric calculations)
    const gracePeriods = calculateGracePeriods(company, gameState);
    const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);

    // Get current and previous values
    const currentValues = {
      eps: shareMetrics.earningsPerShare48Weeks ?? 0,
      revenuePerShare: shareMetrics.revenuePerShare48Weeks ?? 0,
      dividendPerShare: shareMetrics.dividendPerShare48Weeks ?? 0,
      revenueGrowth: shareMetrics.revenueGrowth48Weeks ?? 0,
      profitMargin: shareMetrics.profitMargin48Weeks ?? 0
    };

    const previousValues = {
      eps: snapshot48WeeksAgo?.earningsPerShare48W ?? currentValues.eps,
      revenuePerShare: snapshot48WeeksAgo?.revenuePerShare48W ?? currentValues.revenuePerShare,
      dividendPerShare: snapshot48WeeksAgo?.dividendPerShare48W ?? currentValues.dividendPerShare,
      revenueGrowth: snapshot48WeeksAgo?.revenueGrowth48W ?? currentValues.revenueGrowth,
      profitMargin: snapshot48WeeksAgo?.profitMargin48W ?? currentValues.profitMargin
    };

    // Calculate improvements
    const profitabilityImprovements = calculateProfitabilityImprovements(
      currentValues,
      previousValues
    );

    const currentMetricValues = await getCurrentMetricValues();
    const previousMetricValues = await getPreviousMetricValues48WeeksAgo(companyId);

    const trendImprovements = calculateTrendBasedImprovements(
      {
        creditRating: currentMetricValues.creditRating,
        fixedAssetRatio: currentMetricValues.fixedAssetRatio,
        prestige: currentMetricValues.prestige
      },
      {
        creditRating: previousMetricValues.creditRating ?? currentMetricValues.creditRating,
        fixedAssetRatio: previousMetricValues.fixedAssetRatio ?? currentMetricValues.fixedAssetRatio,
        prestige: previousMetricValues.prestige ?? currentMetricValues.prestige
      },
      gracePeriods.has48WeekHistory
    );

    // Get expected rates
    const multipliers = await getImprovementMultipliers(companyId);
    const expectedRates = calculateExpectedImprovementRates(
      multipliers.improvementMultiplier,
      multipliers.marketCapRequirement
    );

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

    const performanceScore = calculatePerformanceScore(metricDeltas);

    // Calculate stability score from credit rating (combines asset health + company stability)
    const creditRating = await calculateCreditRating();
    const stabilityScore = calculateStabilityScoreFromCreditRating(
      creditRating.assetHealth.score,
      creditRating.companyStability.score
    );
    
    // Calculate stability metrics for details (use values from credit rating where available)
    const cashRatio = financialData.totalAssets > 0 
      ? financialData.cashMoney / financialData.totalAssets 
      : 0;
    const debtRatio = financialData.totalAssets > 0 
      ? totalDebt / financialData.totalAssets 
      : 0;
    // Use fixed asset ratio from credit rating (now included in asset health)
    const fixedAssetRatioValue = creditRating.assetHealth.fixedAssetRatio;

    // Calculate consistency score (use placeholder satisfaction, will update after calculating final satisfaction)
    let consistencyScore = await calculateBoardSatisfactionConsistency(companyId, 0);

    // Calculate final satisfaction
    const satisfaction = 
      (performanceScore * BOARD_SATISFACTION_WEIGHTS.performanceScore) +
      (stabilityScore * BOARD_SATISFACTION_WEIGHTS.stabilityScore) +
      (consistencyScore * BOARD_SATISFACTION_WEIGHTS.consistencyScore) +
      ((1 - ownershipPressure) * BOARD_SATISFACTION_WEIGHTS.ownershipPressure); // Lower ownership pressure = higher satisfaction

    // Clamp to 0-1
    const clampedSatisfaction = clamp01(satisfaction);
    
    // Recalculate consistency score with final satisfaction for better accuracy
    const finalConsistencyScore = await calculateBoardSatisfactionConsistency(companyId, clampedSatisfaction);
    
    // Recalculate final satisfaction with updated consistency score
    const finalSatisfaction = 
      (performanceScore * BOARD_SATISFACTION_WEIGHTS.performanceScore) +
      (stabilityScore * BOARD_SATISFACTION_WEIGHTS.stabilityScore) +
      (finalConsistencyScore * BOARD_SATISFACTION_WEIGHTS.consistencyScore) +
      ((1 - ownershipPressure) * BOARD_SATISFACTION_WEIGHTS.ownershipPressure);
    
    const finalClampedSatisfaction = clamp01(finalSatisfaction);

    const breakdown: BoardSatisfactionBreakdown = {
      satisfaction: finalClampedSatisfaction,
      performanceScore,
      stabilityScore,
      consistencyScore: finalConsistencyScore,
      ownershipPressure,
      playerOwnershipPct,
      details: {
        performanceMetrics: {
          earningsPerShare: metricDeltas.earningsPerShare || 0,
          revenuePerShare: metricDeltas.revenuePerShare || 0,
          profitMargin: metricDeltas.profitMargin || 0,
          revenueGrowth: metricDeltas.revenueGrowth || 0
        },
        stabilityMetrics: {
          cashRatio,
          debtRatio,
          fixedAssetRatio: fixedAssetRatioValue
        },
        consistencyVolatility: 1 - finalConsistencyScore // Convert to volatility (higher = less consistent)
      }
    };
    
    // Store snapshot (non-blocking, fail silently if error)
    // Reuse gameState already fetched earlier in function
    insertBoardSatisfactionSnapshot({
      companyId,
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024,
      satisfactionScore: finalClampedSatisfaction,
      performanceScore,
      stabilityScore,
      consistencyScore: finalConsistencyScore,
      ownershipPressure,
      playerOwnershipPct
    }).catch((error: any) => {
      console.error('Error storing board satisfaction snapshot:', error);
      // Non-blocking - don't throw
    });

    return breakdown;
  } catch (error) {
    console.error('Error calculating board satisfaction breakdown:', error);
    // Return default breakdown on error
    return {
      satisfaction: BOARD_SATISFACTION_DEFAULTS.newCompany,
      performanceScore: 0.5,
      stabilityScore: 0.5,
      consistencyScore: 0.5,
      ownershipPressure: 0.5,
      playerOwnershipPct: 50,
      details: {
        performanceMetrics: {
          earningsPerShare: 0,
          revenuePerShare: 0,
          profitMargin: 0,
          revenueGrowth: 0
        },
        stabilityMetrics: {
          cashRatio: 0,
          debtRatio: 0,
          fixedAssetRatio: 0
        },
        consistencyVolatility: 0.5
      }
    };
  }
}
