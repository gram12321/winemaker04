import { WineBatch, Vineyard } from '../../../types/types';
import { SALES_CONSTANTS } from '../../../constants/constants';
import { getAllFeatureConfigs } from '../../../constants/wineFeatures/commonFeaturesUtil';
import { calculateAsymmetricalMultiplier, NormalizeScrewed1000To01WithTail } from '../../../utils/calculator';
import { clamp01 } from '../../../utils/utils';

export interface EstimatedPriceBreakdown {
  tasteIndex: number;
  balance: number;
  wineScore: number;
  baseRate: number;
  basePrice: number;
  wineScoreMultiplier: number;
  landValueModifier: number;
  landValuePriceMultiplier: number;
  featurePriceMultiplier: number;
  prePrestigePrice: number;
  companyPrestigeMultiplier: number;
  vineyardPrestigeMultiplier: number;
  finalPrice: number;
}

export function getTasteIndex(wineBatch: WineBatch): number {
  return clamp01(wineBatch.tasteIndex);
}

function getLandValueModifier(wineBatch: WineBatch): number {
  return clamp01(wineBatch.landValueModifier);
}

/**
 * Convert 0-1 land-value modifier to a configurable price multiplier.
 */
export function calculateLandValuePriceMultiplier(wineBatch: WineBatch): number {
  const landValueModifier = getLandValueModifier(wineBatch);
  return SALES_CONSTANTS.PRICE_MULTIPLIERS.LAND_VALUE_MIN_MULTIPLIER
    + ((SALES_CONSTANTS.PRICE_MULTIPLIERS.LAND_VALUE_MAX_MULTIPLIER - SALES_CONSTANTS.PRICE_MULTIPLIERS.LAND_VALUE_MIN_MULTIPLIER) * landValueModifier);
}

/**
 * Feature-driven intrinsic market multiplier for estimated price.
 * This is distinct from customer-specific bid multipliers used in order generation.
 */
function calculateFeatureMarketPriceMultiplier(wineBatch: WineBatch): number {
  const configs = getAllFeatureConfigs();
  const presentFeatures = (wineBatch.features || []).filter((feature) => feature.isPresent);

  let multiplier = 1;

  for (const feature of presentFeatures) {
    const config = configs.find((candidate) => candidate.id === feature.id);
    if (!config || !config.effects?.price) continue;

    const severity = clamp01(feature.severity || 0);
    const severityWeight = severity > 0 ? severity : 1;
    const priceEffect = config.effects.price;

    if (priceEffect.type === 'customer_sensitivity') {
      // Use conservative sensitivity (most quality-demanding customer segment)
      // so severe faults like oxidation create a meaningful estimated-price impact.
      const sensitivityValues = Object.values(config.customerSensitivity);
      const marketSensitivity = sensitivityValues.length > 0 ? Math.min(...sensitivityValues) : 1;
      const adjusted = 1 + ((marketSensitivity - 1) * severityWeight);
      multiplier *= Math.max(0, adjusted);
      continue;
    }

    if (priceEffect.type === 'premium') {
      const premiumRaw = typeof priceEffect.premiumPercentage === 'function'
        ? priceEffect.premiumPercentage(severity)
        : (priceEffect.premiumPercentage ?? 0) * severityWeight;
      multiplier *= Math.max(0, 1 + premiumRaw);
      continue;
    }

    if (priceEffect.type === 'direct_multiplier') {
      const direct = priceEffect.multiplier ?? 1;
      const adjusted = 1 + ((direct - 1) * severityWeight);
      multiplier *= Math.max(0, adjusted);
    }
  }

  return multiplier;
}

export function calculateWineScore(wineBatch: WineBatch): number {
  const tasteIndex = getTasteIndex(wineBatch);
  const balance = clamp01(wineBatch.balance);
  return (tasteIndex + balance) / 2;
}

function resolvePrestigeMultiplier(prestige?: number): number {
  if (prestige === undefined) return 1;
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
  return 1 + (normalizedPrestige * SALES_CONSTANTS.PRICE_MULTIPLIERS.PRESTIGE_MAX_BONUS);
}

export function calculateEstimatedPriceBreakdown(
  wineBatch: WineBatch,
  _vineyard?: Vineyard,
  companyPrestige?: number,
  vineyardPrestige?: number
): EstimatedPriceBreakdown {
  const tasteIndex = getTasteIndex(wineBatch);
  const balance = clamp01(wineBatch.balance);
  const wineScore = (tasteIndex + balance) / 2;
  const baseRate = SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  const basePrice = wineScore * baseRate;
  const wineScoreMultiplier = calculateAsymmetricalMultiplier(wineScore);
  const landValueModifier = getLandValueModifier(wineBatch);
  const landValuePriceMultiplier = calculateLandValuePriceMultiplier(wineBatch);
  const featurePriceMultiplier = calculateFeatureMarketPriceMultiplier(wineBatch);

  const prePrestigePrice = basePrice * wineScoreMultiplier * landValuePriceMultiplier * featurePriceMultiplier;
  const companyPrestigeMultiplier = resolvePrestigeMultiplier(companyPrestige);
  const vineyardPrestigeMultiplier = resolvePrestigeMultiplier(vineyardPrestige);

  let finalPrice = prePrestigePrice * companyPrestigeMultiplier * vineyardPrestigeMultiplier;
  finalPrice = Math.min(finalPrice, SALES_CONSTANTS.MAX_PRICE);
  finalPrice = Math.round(finalPrice * 100) / 100;

  return {
    tasteIndex,
    balance,
    wineScore,
    baseRate,
    basePrice,
    wineScoreMultiplier,
    landValueModifier,
    landValuePriceMultiplier,
    featurePriceMultiplier,
    prePrestigePrice,
    companyPrestigeMultiplier,
    vineyardPrestigeMultiplier,
    finalPrice
  };
}

/**
 * Calculate the estimated price for a wine batch.
 * Formula: (WineScore x Base Rate) x ScoreCurveMultiplier x LandValueMultiplier x FeatureMultiplier x PrestigeMultipliers
 */
export function calculateEstimatedPrice(
  wineBatch: WineBatch,
  vineyard?: Vineyard,
  companyPrestige?: number,
  vineyardPrestige?: number
): number {
  return calculateEstimatedPriceBreakdown(
    wineBatch,
    vineyard,
    companyPrestige,
    vineyardPrestige
  ).finalPrice;
}

// TODO: Future implementations for when the game expands
// - getTasteIndexPotential(): Different grape varieties with specific ranges
// - calculateVintageEffects(): Weather/year effects on taste index
