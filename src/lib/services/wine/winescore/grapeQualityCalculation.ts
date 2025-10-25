import { Vineyard, WineBatch } from '../../../types/types';
import { getAspectRating, getAltitudeRating, normalizePrestige, calculateGrapeSuitabilityContribution } from '../../vineyard/vineyardValueCalc';
import { REGION_PRESTIGE_RANKINGS, REGION_PRICE_RANGES } from '../../../constants/vineyardConstants';
import { calculateAsymmetricalScaler01, squashNormalizeTail } from '../../../utils/calculator';
import { BoundedVineyardPrestigeFactor } from '../../prestige/prestigeService';
import { getFeatureImpacts } from '../features/featureService';
import { combineOvergrowthYears } from '../../activity/workcalculators/overgrowthUtils';

export function getMaxLandValue(): number {
  let maxValue = 0;
  
  for (const [countryName, country] of Object.entries(REGION_PRICE_RANGES)) {
    for (const [regionName, priceRange] of Object.entries(country)) {
      if (countryName === "France" && (regionName === "Bourgogne" || regionName === "Champagne")) {
        continue;
      }
      const [, maxPrice] = priceRange as [number, number];
      maxValue = Math.max(maxValue, maxPrice);
    }
  }
  
  return maxValue;
}

function normalizeLandValue(landValue: number): number {
  const maxValue = getMaxLandValue();
  if (!landValue || landValue <= 0 || !maxValue) return 0;
  const ratioRaw = landValue / maxValue;
  // Softly squash high-end ratios to avoid mapping exactly to 1.0
  let ratio = Math.max(0, Math.min(ratioRaw, 1));
  ratio = squashNormalizeTail(ratio);
  return calculateAsymmetricalScaler01(ratio);
}

/**
 * Calculate overgrowth quality penalty based on vineyard neglect
 * @param overgrowth - Overgrowth values from vineyard
 * @returns Quality multiplier (0-1, where 1 = no penalty, 0.5 = 50% penalty)
 */
function calculateOvergrowthQualityPenalty(overgrowth: Vineyard['overgrowth']): number {
  if (!overgrowth) return 1.0; // No overgrowth = no penalty
  
  // Calculate weighted average of overgrowth years
  // Different overgrowth types have different quality impacts
  const overgrowthYears = combineOvergrowthYears(overgrowth, undefined, {
    vegetation: 1.0,  // High impact - overgrown vines = poor grape quality
    debris: 0.8,      // Medium-high impact - poor drainage = stressed vines
    uproot: 1.2,      // Highest impact - neglected old vines = declining quality
    replant: 1.1      // High impact - over-mature vines = past peak
  });
  
  if (overgrowthYears <= 0) return 1.0; // No overgrowth = no penalty
  
  // Quality penalty formula: exponential decay with diminishing returns
  // Each year of overgrowth reduces quality by ~5-8%, with diminishing returns
  const basePenalty = 0.06; // 6% penalty per year
  const decayRate = 0.3;    // Diminishing returns factor
  const maxPenalty = 0.5;   // Maximum 50% quality reduction
  
  const penalty = basePenalty * (1 - Math.pow(1 - decayRate, overgrowthYears));
  const qualityMultiplier = Math.max(1 - penalty, maxPenalty);
  
  return qualityMultiplier;
}

export function calculateGrapeQuality(vineyard: Vineyard): number {
  const normalizedLandValue = normalizeLandValue(vineyard.landValue || 50000);
  const boundedVineyardPrestige = BoundedVineyardPrestigeFactor(vineyard).boundedFactor;
  const overgrowthPenalty = calculateOvergrowthQualityPenalty(vineyard.overgrowth);
  
  const wineQuality = ((normalizedLandValue * 0.6) + (boundedVineyardPrestige * 0.4)) * overgrowthPenalty;
  
  return Math.max(0, Math.min(1, wineQuality));
}

export function getVineyardGrapeQualityFactors(vineyard: Vineyard): {
  factors: {
    landValue: number;
    vineyardPrestige: number;
    regionalPrestige: number;
    altitudeRating: number;
    aspectRating: number;
    grapeSuitability: number;
    overgrowthPenalty: number;
  };
  rawValues: {
    landValue: number;
    vineyardPrestige: number;
    regionalPrestige: number;
    altitudeRating: string;
    aspectRating: string;
    grapeSuitability: string;
    overgrowthPenalty: string;
  };
  grapeQualityScore: number;
} {
  const normalizedLandValue = normalizeLandValue(vineyard.landValue );
  const vineyardPrestige = BoundedVineyardPrestigeFactor(vineyard).boundedFactor;

  const countryData = REGION_PRESTIGE_RANKINGS[vineyard.country as keyof typeof REGION_PRESTIGE_RANKINGS];
  const rawPrestige = countryData?.[vineyard.region as keyof typeof countryData] ?? 0.5;
  const regionalPrestige = normalizePrestige(rawPrestige);

  const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
  const aspectRating = getAspectRating(vineyard.country, vineyard.region, vineyard.aspect);
  const grapeSuitability = vineyard.grape ? 
    calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country) : 0;

  const overgrowthPenalty = calculateOvergrowthQualityPenalty(vineyard.overgrowth);
  const grapeQualityScore = calculateGrapeQuality(vineyard);

  // Format overgrowth penalty for display
  const overgrowthDisplay = vineyard.overgrowth ? 
    `Vegetation: ${vineyard.overgrowth.vegetation}y, Debris: ${vineyard.overgrowth.debris}y, Uproot: ${vineyard.overgrowth.uproot}y, Replant: ${vineyard.overgrowth.replant}y` :
    'No overgrowth';

  return {
    factors: {
      landValue: normalizedLandValue,
      vineyardPrestige,
      regionalPrestige,
      altitudeRating,
      aspectRating,
      grapeSuitability,
      overgrowthPenalty
    },
    rawValues: {
      landValue: vineyard.landValue || 0,
      vineyardPrestige,
      regionalPrestige: rawPrestige,
      altitudeRating: `${vineyard.altitude}m`,
      aspectRating: vineyard.aspect,
      grapeSuitability: vineyard.grape || '',
      overgrowthPenalty: overgrowthDisplay
    },
    grapeQualityScore
  };
}

// ===== QUALITY BREAKDOWN FOR UI =====

export interface GrapeQualityBreakdown {
  bornGrapeQuality: number; // Original quality at harvest
  currentGrapeQuality: number; // Current quality (with feature effects)
  featureImpacts: Array<{
    featureId: string;
    featureName: string;
    icon: string;
    impact: number;
    impactType: 'penalty' | 'bonus';
  }>;
  totalFeatureImpact: number;
}

/**
 * Get detailed grape quality breakdown for UI display
 * Used by GrapeQualityFactorsBreakdown and WineModal components
 * 
 * @param batch - Wine batch to analyze
 * @returns Comprehensive quality breakdown with feature impacts
 */
export function getGrapeQualityBreakdown(batch: WineBatch): GrapeQualityBreakdown {
  const bornGrapeQuality = batch.bornGrapeQuality; // Original quality at harvest
  const currentGrapeQuality = batch.grapeQuality; // Current quality (with feature effects applied)
  const featureImpacts = getFeatureImpacts(batch);
  
  const grapeQualityImpacts = featureImpacts.map((impact: any) => ({
    featureId: impact.featureId,
    featureName: impact.featureName,
    icon: impact.icon,
    impact: impact.grapeQualityImpact,
    impactType: impact.grapeQualityImpact >= 0 ? 'bonus' as const : 'penalty' as const
  }));
  
  const totalFeatureImpact = currentGrapeQuality - bornGrapeQuality;
  
  return {
    bornGrapeQuality,
    currentGrapeQuality,
    featureImpacts: grapeQualityImpacts,
    totalFeatureImpact
  };
}

