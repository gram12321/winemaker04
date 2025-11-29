import { getGameState } from '../../core/gameState';
import { calculateFinancialData } from '../financeService';
import { calculateCreditRating } from '../creditRatingService';
import { calculateFixedAssetRatio } from '../../index';
import { calculateCompanyWeeks } from '../../../utils/utils';
import { WEEKS_PER_YEAR, WEEKS_PER_SEASON } from '../../../constants';
import { INCREMENTAL_ANCHOR_CONFIG } from '../../../constants';
import { getCompanyMetricsSnapshotNWeeksAgo } from '../../../database/core/companyMetricsHistoryDB';
import type { Company } from '../../../database';
import type { ShareMetrics } from '../../../types';
import type { EconomyPhase } from '../../../types';

export async function getCurrentMetricValues(): Promise<{
  creditRating: number;
  fixedAssetRatio: number;
  prestige: number;
}> {
  const gameState = getGameState();
  const financialData = await calculateFinancialData('year');
  const currentCreditRating = await calculateCreditRating();
  const currentFixedAssetRatio = calculateFixedAssetRatio(financialData.fixedAssets, financialData.totalAssets);
  const currentPrestige = gameState.prestige || 0;

  return {
    creditRating: currentCreditRating.finalRating,
    fixedAssetRatio: currentFixedAssetRatio,
    prestige: currentPrestige
  };
}

export async function getPreviousMetricValues48WeeksAgo(
  companyId: string
): Promise<{
  earningsPerShare: number | null;
  revenuePerShare: number | null;
  dividendPerShare: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  creditRating: number | null;
  fixedAssetRatio: number | null;
  prestige: number | null;
  hasHistory?: boolean;
}> {
  const snapshot48WeeksAgo = await getCompanyMetricsSnapshotNWeeksAgo(48, companyId);

  return {
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
}

export function getCurrent48WeekValues(shareMetrics: ShareMetrics): {
  earningsPerShare: number;
  revenuePerShare: number;
  dividendPerShare: number;
  revenueGrowth: number;
  profitMargin: number;
} {
  return {
    earningsPerShare: shareMetrics.earningsPerShare48Weeks ?? 0,
    revenuePerShare: shareMetrics.revenuePerShare48Weeks ?? 0,
    dividendPerShare: shareMetrics.dividendPerShare48Weeks ?? 0,
    revenueGrowth: shareMetrics.revenueGrowth48Weeks ?? 0,
    profitMargin: shareMetrics.profitMargin48Weeks ?? 0
  };
}

export function calculateAnchorFactorDetails(
  currentPrice: number,
  basePrice: number,
  anchorFactor: number
): {
  deviation: number;
  strength: number;
  exponent: number;
  denominator: number;
  anchorFactor: number;
} {
  const deviation = Math.abs(currentPrice - basePrice) / basePrice;
  const { strength, exponent } = INCREMENTAL_ANCHOR_CONFIG;
  
  return {
    deviation,
    strength,
    exponent,
    denominator: 1 + strength * Math.pow(deviation, exponent),
    anchorFactor
  };
}

export function formatMultiplierBreakdownForDisplay(
  company: Company | null,
  multipliers: {
    economyPhase: EconomyPhase;
    economyMultiplier: number;
    prestige: number;
    normalizedPrestige: number;
    prestigeMultiplier: number;
    growthTrendMultiplier: number;
    improvementMultiplier: number;
    marketCapRequirement: number;
    marketCap: number;
  }
): {
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
} {
  const gameState = getGameState();
  const companyWeeks = calculateCompanyWeeks(
    company?.foundedYear || gameState.currentYear || 2024,
    gameState.week || 1,
    gameState.season || 'Spring',
    gameState.currentYear || 2024
  );
  
  let expectedDividendPayments = 4;
  if (companyWeeks < WEEKS_PER_YEAR) {
    expectedDividendPayments = Math.min(4, Math.ceil(companyWeeks / WEEKS_PER_SEASON));
  }

  return {
    economyPhase: multipliers.economyPhase,
    economyMultiplier: multipliers.economyMultiplier,
    prestige: multipliers.prestige,
    normalizedPrestige: multipliers.normalizedPrestige,
    prestigeMultiplier: multipliers.prestigeMultiplier,
    growthTrendMultiplier: multipliers.growthTrendMultiplier,
    expectedDividendPayments,
    improvementMultiplier: multipliers.improvementMultiplier,
    marketCapRequirement: multipliers.marketCapRequirement * 100,
    marketCap: multipliers.marketCap
  };
}

