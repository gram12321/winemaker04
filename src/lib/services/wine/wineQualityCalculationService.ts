// Wine quality calculation service - handles all vineyard and regional factors that contribute to wine quality
import { Vineyard } from '../../types/types';
import { getAspectRating, getAltitudeRating, normalizePrestige, calculateGrapeSuitabilityContribution } from '../vineyard/vineyardValueCalc';
import { REGION_PRESTIGE_RANKINGS, REGION_PRICE_RANGES } from '../../constants/vineyardConstants';
import { calculateAsymmetricalScaler01, squashNormalizeTail } from '../../utils/calculator';
import { BoundedVineyardPrestigeFactor } from '../prestige/prestigeService';

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

export function calculateWineQuality(vineyard: Vineyard): number {
  const normalizedLandValue = normalizeLandValue(vineyard.landValue || 50000);
  const boundedVineyardPrestige = BoundedVineyardPrestigeFactor(vineyard).boundedFactor;
  const wineQuality = (normalizedLandValue * 0.6) + (boundedVineyardPrestige * 0.4);
  return Math.max(0, Math.min(1, wineQuality));
}

export function getVineyardQualityFactors(vineyard: Vineyard): {
  factors: {
    landValue: number;
    vineyardPrestige: number;
    regionalPrestige: number;
    altitudeRating: number;
    aspectRating: number;
    grapeSuitability: number;
  };
  rawValues: {
    landValue: number;
    vineyardPrestige: number;
    regionalPrestige: number;
    altitudeRating: string;
    aspectRating: string;
    grapeSuitability: string;
  };
  qualityScore: number;
} {
  const normalizedLandValue = normalizeLandValue(vineyard.landValue || 50000);
  const vineyardPrestige = BoundedVineyardPrestigeFactor(vineyard).boundedFactor;

  const countryData = REGION_PRESTIGE_RANKINGS[vineyard.country as keyof typeof REGION_PRESTIGE_RANKINGS];
  const rawPrestige = countryData?.[vineyard.region as keyof typeof countryData] ?? 0.5;
  const regionalPrestige = normalizePrestige(rawPrestige);

  const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
  const aspectRating = getAspectRating(vineyard.country, vineyard.region, vineyard.aspect);
  const grapeSuitability = vineyard.grape ? 
    calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country) : 0;

  const qualityScore = calculateWineQuality(vineyard);

  return {
    factors: {
      landValue: normalizedLandValue,
      vineyardPrestige,
      regionalPrestige,
      altitudeRating,
      aspectRating,
      grapeSuitability
    },
    rawValues: {
      landValue: vineyard.landValue || 0,
      vineyardPrestige,
      regionalPrestige: rawPrestige,
      altitudeRating: `${vineyard.altitude}m`,
      aspectRating: vineyard.aspect,
      grapeSuitability: vineyard.grape || ''
    },
    qualityScore
  };
}

