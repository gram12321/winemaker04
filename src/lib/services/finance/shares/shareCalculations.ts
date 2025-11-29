import { getGameState } from '../../core/gameState';
import { NormalizeScrewed1000To01WithTail } from '../../../utils/calculator';
import { EXPECTED_IMPROVEMENT_RATES, PRESTIGE_SCALING, MARKET_CAP_MODIFIER_CONFIG, ECONOMY_EXPECTATION_MULTIPLIERS } from '../../../constants';
import type { EconomyPhase, ShareExpectedImprovementRates } from '../../../types';
import { getCompanyShares } from '../../../database/core/companySharesDB';

export function calculateMarketCap(sharePrice: number, totalShares: number): number {
  if (totalShares === 0 || sharePrice <= 0) {
    return 0;
  }
  return Math.max(0, sharePrice * totalShares);
}

export function calculateImprovementMultiplier(
  economyPhase: EconomyPhase,
  prestige: number,
  growthTrendMultiplier: number
): number {
  const economyMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS[economyPhase];
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
  const prestigeMultiplier = PRESTIGE_SCALING.base + 
    (normalizedPrestige * (PRESTIGE_SCALING.maxMultiplier - PRESTIGE_SCALING.base));
  
  return economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
}

export function calculateMarketCapRequirement(marketCap: number): number {
  if (!MARKET_CAP_MODIFIER_CONFIG.enabled) {
    return 0;
  }
  
  if (marketCap <= MARKET_CAP_MODIFIER_CONFIG.baseMarketCap) {
    return 0;
  }
  
  const logRatio = Math.log10(marketCap / MARKET_CAP_MODIFIER_CONFIG.baseMarketCap);
  return Math.min(
    MARKET_CAP_MODIFIER_CONFIG.baseRate * logRatio,
    MARKET_CAP_MODIFIER_CONFIG.maxRate
  );
}

export function calculateExpectedImprovementRates(
  improvementMultiplier: number,
  marketCapRequirement: number
): ShareExpectedImprovementRates {
  return {
    earningsPerShare: (EXPECTED_IMPROVEMENT_RATES.earningsPerShare * improvementMultiplier + marketCapRequirement) * 100,
    revenuePerShare: (EXPECTED_IMPROVEMENT_RATES.revenuePerShare * improvementMultiplier + marketCapRequirement) * 100,
    dividendPerShare: (EXPECTED_IMPROVEMENT_RATES.dividendPerShare * improvementMultiplier + marketCapRequirement) * 100,
    revenueGrowth: (EXPECTED_IMPROVEMENT_RATES.revenueGrowth * improvementMultiplier + marketCapRequirement) * 100,
    profitMargin: (EXPECTED_IMPROVEMENT_RATES.profitMargin * improvementMultiplier + marketCapRequirement) * 100,
    creditRating: (EXPECTED_IMPROVEMENT_RATES.creditRating * improvementMultiplier + marketCapRequirement) * 100,
    fixedAssetRatio: (EXPECTED_IMPROVEMENT_RATES.fixedAssetRatio * improvementMultiplier + marketCapRequirement) * 100,
    prestige: (EXPECTED_IMPROVEMENT_RATES.prestige * improvementMultiplier + marketCapRequirement) * 100
  };
}

export async function getImprovementMultipliers(
  companyId: string
): Promise<{
  improvementMultiplier: number;
  marketCapRequirement: number;
  marketCap: number;
  economyPhase: EconomyPhase;
  prestige: number;
  normalizedPrestige: number;
  prestigeMultiplier: number;
  growthTrendMultiplier: number;
  economyMultiplier: number;
}> {
  const gameState = getGameState();
  
  const economyPhase: EconomyPhase = (gameState.economyPhase as EconomyPhase) || 'Stable';
  const prestige = gameState.prestige || 0;
  
  const sharesData = await getCompanyShares(companyId);
  const growthTrendMultiplier = sharesData?.growthTrendMultiplier ?? 1.0;
  
  const economyMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS[economyPhase];
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
  const prestigeMultiplier = PRESTIGE_SCALING.base + 
    (normalizedPrestige * (PRESTIGE_SCALING.maxMultiplier - PRESTIGE_SCALING.base));
  
  const improvementMultiplier = economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
  
  // Calculate market cap
  const sharePrice = sharesData?.sharePrice ?? 0;
  const totalShares = sharesData?.totalShares ?? 1000000;
  const marketCap = calculateMarketCap(sharePrice, totalShares);
  
  const marketCapRequirement = calculateMarketCapRequirement(marketCap);
  
  return {
    improvementMultiplier,
    marketCapRequirement,
    marketCap,
    economyPhase,
    prestige,
    normalizedPrestige,
    prestigeMultiplier,
    growthTrendMultiplier,
    economyMultiplier
  };
}

export function calculateFixedAssetRatio(fixedAssets: number, totalAssets: number): number {
  if (totalAssets <= 0) {
    return 0;
  }
  return fixedAssets / totalAssets;
}

export function calculateTrendDelta(
  current: number,
  previous: number,
  fallbackForPositive: number = 0
): number {
  if (previous > 0) {
    return ((current - previous) / previous) * 100;
  }
  return current > 0 ? fallbackForPositive : 0;
}

