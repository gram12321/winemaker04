import { WEEKS_PER_YEAR, WEEKS_PER_SEASON } from '../../../constants';
import { calculateCompanyWeeks } from '../../../utils/utils';
import { calculateTrendDelta } from '../../index';
import type { Company } from '../../../database';

export function calculateGracePeriods(
  company: Company,
  gameState: any
): {
  has48WeekHistory: boolean;
  isFirstYear: boolean;
  isDividendGracePeriod: boolean;
} {
  const companyWeeks = calculateCompanyWeeks(
    company.foundedYear || gameState.currentYear || 2024,
    gameState.week || 1,
    gameState.season || 'Spring',
    gameState.currentYear || 2024
  );
  
  return {
    has48WeekHistory: companyWeeks >= 48,
    isFirstYear: companyWeeks < WEEKS_PER_YEAR,
    isDividendGracePeriod: companyWeeks < (WEEKS_PER_SEASON * 3)
  };
}

export function calculateProfitabilityImprovements(
  current: { eps: number; revenuePerShare: number; dividendPerShare: number; revenueGrowth: number; profitMargin: number },
  previous: { eps: number; revenuePerShare: number; dividendPerShare: number; revenueGrowth: number; profitMargin: number }
): {
  epsImprovement: number;
  revenuePerShareImprovement: number;
  dividendPerShareImprovement: number;
  revenueGrowthImprovement: number;
  profitMarginImprovement: number;
} {
  const epsImprovement = previous.eps > 0 
    ? ((current.eps - previous.eps) / previous.eps) * 100 
    : (current.eps > 0 ? 100 : 0);
    
  const revenuePerShareImprovement = previous.revenuePerShare > 0
    ? ((current.revenuePerShare - previous.revenuePerShare) / previous.revenuePerShare) * 100
    : (current.revenuePerShare > 0 ? 100 : 0);
    
  const dividendPerShareImprovement = previous.dividendPerShare > 0
    ? ((current.dividendPerShare - previous.dividendPerShare) / previous.dividendPerShare) * 100
    : (current.dividendPerShare > 0 ? 100 : 0);
    
  const revenueGrowthImprovement = previous.revenueGrowth > -1
    ? ((current.revenueGrowth - previous.revenueGrowth) / (Math.abs(previous.revenueGrowth) + 0.01)) * 100
    : (current.revenueGrowth > -1 ? 100 : 0);
    
  const profitMarginImprovement = previous.profitMargin > 0
    ? ((current.profitMargin - previous.profitMargin) / previous.profitMargin) * 100
    : (current.profitMargin > 0 ? 100 : 0);
    
  return {
    epsImprovement,
    revenuePerShareImprovement,
    dividendPerShareImprovement,
    revenueGrowthImprovement,
    profitMarginImprovement
  };
}

export function calculateTrendBasedImprovements(
  current: { creditRating: number; fixedAssetRatio: number; prestige: number },
  previous: { creditRating: number; fixedAssetRatio: number; prestige: number },
  has48WeekHistory: boolean
): {
  creditRatingImprovement: number;
  fixedAssetRatioImprovement: number;
  prestigeImprovement: number;
} {
  return {
    creditRatingImprovement: has48WeekHistory
      ? calculateTrendDelta(current.creditRating, previous.creditRating)
      : 0,
    fixedAssetRatioImprovement: has48WeekHistory
      ? calculateTrendDelta(current.fixedAssetRatio, previous.fixedAssetRatio)
      : 0,
    prestigeImprovement: has48WeekHistory
      ? calculateTrendDelta(current.prestige, previous.prestige, current.prestige > 0 ? 100 : 0)
      : 0
  };
}

export function calculateMetricDeltas(
  actualImprovements: {
    eps: number;
    revenuePerShare: number;
    dividendPerShare: number;
    revenueGrowth: number;
    profitMargin: number;
    creditRating: number;
    fixedAssetRatio: number;
    prestige: number;
  },
  expectedRates: {
    earningsPerShare: number;
    revenuePerShare: number;
    dividendPerShare: number;
    revenueGrowth: number;
    profitMargin: number;
    creditRating: number;
    fixedAssetRatio: number;
    prestige: number;
  },
  gracePeriods: {
    isFirstYear: boolean;
    isDividendGracePeriod: boolean;
    has48WeekHistory: boolean;
  }
): Record<string, number> {
  return {
    earningsPerShare: gracePeriods.isFirstYear ? 0 : (actualImprovements.eps - expectedRates.earningsPerShare),
    revenuePerShare: gracePeriods.isFirstYear ? 0 : (actualImprovements.revenuePerShare - expectedRates.revenuePerShare),
    dividendPerShare: gracePeriods.isDividendGracePeriod ? 0 : (actualImprovements.dividendPerShare - expectedRates.dividendPerShare),
    revenueGrowth: gracePeriods.isFirstYear ? 0 : (actualImprovements.revenueGrowth - expectedRates.revenueGrowth),
    profitMargin: gracePeriods.isFirstYear ? 0 : (actualImprovements.profitMargin - expectedRates.profitMargin),
    creditRating: gracePeriods.has48WeekHistory ? (actualImprovements.creditRating - expectedRates.creditRating) : 0,
    fixedAssetRatio: gracePeriods.has48WeekHistory ? (actualImprovements.fixedAssetRatio - expectedRates.fixedAssetRatio) : 0,
    prestige: gracePeriods.has48WeekHistory ? (actualImprovements.prestige - expectedRates.prestige) : 0
  };
}

