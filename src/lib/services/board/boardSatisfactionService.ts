import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { clamp01, calculateConsistencyScore } from '@/lib/utils';
import { companyService, getGameState, calculateFinancialData, calculateCreditRating, calculateTotalOutstandingLoans, getShareMetrics, getShareholderBreakdown, getImprovementMultipliers, calculateExpectedImprovementRates, calculateProfitabilityImprovements, calculateTrendBasedImprovements, calculateMetricDeltas, calculateGracePeriods, getCurrentMetricValues, getPreviousMetricValues48WeeksAgo } from '@/lib/services';
import { getCompanyMetricsSnapshotNWeeksAgo, insertBoardSatisfactionSnapshot, getBoardSatisfactionHistory } from '@/lib/database';
import { BOARD_SATISFACTION_WEIGHTS, BOARD_SATISFACTION_DEFAULTS } from '@/lib/constants';

// Cache for board satisfaction breakdown (reduces repeated expensive calculations)
interface CacheEntry {
  breakdown: BoardSatisfactionBreakdown;
  timestamp: number;
  companyId: string;
  gameWeek: number;
  gameSeason: string;
  gameYear: number;
}

let satisfactionCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5000;

/**
 * Board Satisfaction Breakdown
 */
export interface BoardSatisfactionBreakdown {
  satisfaction: number; // 0-1
  performanceScore: number; // 0-1
  stabilityScore: number; // 0-1
  consistencyScore: number; // 0-1
  ownershipPressure: number; // 0-1 (higher = more non-player ownership)
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
  isGracePeriodActive?: boolean; // Whether satisfaction is boosted by new company grace period
}

/**
 * Calculate performance score from metric deltas
 * Normalizes deltas to 0-1 scale where 0 = worst, 1 = best
 */
function calculatePerformanceScore(metricDeltas: Record<string, number>): number {
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

  const normalized = deltas.map(delta => {
    const clamped = Math.max(-100, Math.min(100, delta));
    return (clamped + 100) / 200;
  });

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
  assetHealthScore: number, // Already 0-1 normalized
  companyStabilityScore: number
): number {
  return (assetHealthScore * 0.6) + (companyStabilityScore * 0.4);
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
    const history = await getBoardSatisfactionHistory(companyId, 12);

    if (history.length < 4) {
      return 0.7;
    }

    const historicalScores = history.map((s) => s.satisfactionScore);
    return calculateConsistencyScore(historicalScores, currentSatisfaction, 4, 0.7, 0.3);
  } catch (error) {
    console.error('Error calculating board satisfaction consistency:', error);
    return 0.7;
  }
}

/**
 * Calculate board satisfaction for the current company
 */
export async function calculateBoardSatisfaction(): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      return 1.0;
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
 * OPTIMIZATION: Uses caching to avoid repeated expensive calculations
 * @param storeSnapshot - If true, stores a snapshot after calculation (default: false)
 */
export async function getBoardSatisfactionBreakdown(storeSnapshot: boolean = false): Promise<BoardSatisfactionBreakdown> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
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

    const gameState = getGameState();
    const now = Date.now();
    if (satisfactionCache &&
      satisfactionCache.companyId === companyId &&
      satisfactionCache.gameWeek === gameState.week &&
      satisfactionCache.gameSeason === gameState.season &&
      satisfactionCache.gameYear === gameState.currentYear &&
      (now - satisfactionCache.timestamp) < CACHE_TTL_MS) {
      return satisfactionCache.breakdown;
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const shareholderBreakdown = await getShareholderBreakdown();
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

    const [financialData, shareMetrics, totalDebt] = await Promise.all([
      calculateFinancialData('year'),
      getShareMetrics(),
      calculateTotalOutstandingLoans()
    ]);

    const ownershipPressure = 1 - (playerOwnershipPct / 100);

    const gracePeriods = calculateGracePeriods(company, gameState);
    const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);

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

    const profitabilityImprovements = calculateProfitabilityImprovements(
      currentValues,
      previousValues
    );

    const currentMetricValues = await getCurrentMetricValues();
    const previousMetricValues = await getPreviousMetricValues48WeeksAgo();

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

    const multipliers = await getImprovementMultipliers();
    const expectedRates = calculateExpectedImprovementRates(
      multipliers.improvementMultiplier,
      multipliers.marketCapRequirement
    );

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

    const creditRating = await calculateCreditRating();
    const stabilityScore = calculateStabilityScoreFromCreditRating(
      creditRating.assetHealth.score,
      creditRating.companyStability.score
    );

    const cashRatio = financialData.totalAssets > 0
      ? financialData.cashMoney / financialData.totalAssets
      : 0;
    const debtRatio = financialData.totalAssets > 0
      ? totalDebt / financialData.totalAssets
      : 0;
    const fixedAssetRatioValue = creditRating.assetHealth.fixedAssetRatio;

    let consistencyScore = await calculateBoardSatisfactionConsistency(companyId, 0);

    let satisfaction =
      (performanceScore * BOARD_SATISFACTION_WEIGHTS.performanceScore) +
      (stabilityScore * BOARD_SATISFACTION_WEIGHTS.stabilityScore) +
      (consistencyScore * BOARD_SATISFACTION_WEIGHTS.consistencyScore);

    // Apply grace period: if first year, ensure satisfaction is at least the default (generous) value
    if (gracePeriods.isFirstYear) {
      satisfaction = Math.max(satisfaction, BOARD_SATISFACTION_DEFAULTS.newCompany);
    }

    const clampedSatisfaction = clamp01(satisfaction);
    const finalConsistencyScore = await calculateBoardSatisfactionConsistency(companyId, clampedSatisfaction);

    // Recalculate based on possibly boosted satisfaction for consistency tracking
    let finalSatisfaction =
      (performanceScore * BOARD_SATISFACTION_WEIGHTS.performanceScore) +
      (stabilityScore * BOARD_SATISFACTION_WEIGHTS.stabilityScore) +
      (finalConsistencyScore * BOARD_SATISFACTION_WEIGHTS.consistencyScore);

    // Apply grace period again to final calculation to be safe
    if (gracePeriods.isFirstYear) {
      finalSatisfaction = Math.max(finalSatisfaction, BOARD_SATISFACTION_DEFAULTS.newCompany);
    }

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
      },
      isGracePeriodActive: gracePeriods.isFirstYear
    };

    // OPTIMIZATION: Update cache
    satisfactionCache = {
      breakdown,
      timestamp: Date.now(),
      companyId,
      gameWeek: gameState.week || 1,
      gameSeason: gameState.season || 'Spring',
      gameYear: gameState.currentYear || 2024
    };

    if (storeSnapshot) {
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
      });
    }

    return breakdown;
  } catch (error) {
    console.error('Error calculating board satisfaction breakdown:', error);
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
