// Wine value calculation service - handles all vineyard and regional factors that contribute to wine value
import { Vineyard } from '../../types/types';
import { getAspectRating, getAltitudeRating, normalizePrestige, calculateGrapeSuitabilityContribution } from '../vineyard/vineyardValueCalc';
import { REGION_PRESTIGE_RANKINGS, REGION_PRICE_RANGES } from '../../constants/vineyardConstants';
import { calculateAsymmetricalScaler01 } from '../../utils';

/**
 * Get the maximum land value across all regions for normalization
 * Excludes the top 2 premium regions (Bourgogne and Champagne) to allow them to "break" the 0-1 scale
 * This makes expensive land (€100K+) get proper quality scores instead of being compressed to low values
 * @returns Maximum land value in euros per hectare (excluding Bourgogne and Champagne)
 */
export function getMaxLandValue(): number {
  let maxValue = 0;
  
  // Iterate through all countries and regions to find the highest max price
  // Skip Bourgogne and Champagne to allow them to break the scale
  for (const [countryName, country] of Object.entries(REGION_PRICE_RANGES)) {
    for (const [regionName, priceRange] of Object.entries(country)) {
      // Skip Bourgogne and Champagne to allow them to break the scale
      if (countryName === "France" && (regionName === "Bourgogne" || regionName === "Champagne")) {
        continue;
      }
      const [, maxPrice] = priceRange as [number, number];
      maxValue = Math.max(maxValue, maxPrice);
    }
  }
  
  return maxValue;
}

/**
 * Normalize land value from euros per hectare to 0-1 scale
 * Uses an asymmetrical 0-1 scaler for better mid-range distribution and early saturation
 * @param landValue - Land value in euros per hectare
 * @returns Normalized land value (0-1 scale)
 */
function normalizeLandValue(landValue: number): number {
  const maxValue = getMaxLandValue();
  if (!landValue || landValue <= 0 || !maxValue) return 0;
  const ratio = Math.min(landValue / maxValue, 1);
  return calculateAsymmetricalScaler01(ratio);
}

/**
 * Calculate the wine value index for a vineyard
 * This combines land value, field prestige, and regional factors into a single 0-1 score
 * 
 * Now enhanced with:
 * - Real land value calculations based on region, prestige, altitude, and aspect
 * - Proper normalization of land values from euros to 0-1 scale
 * - Vineyard prestige integration
 * 
 * @param vineyard - The vineyard to calculate wine value for
 * @returns Wine value index (0-1 scale)
 */
export function calculateWineValueIndex(vineyard: Vineyard): number {
  // Normalize land value from euros per hectare to 0-1 scale
  const normalizedLandValue = normalizeLandValue(vineyard.landValue || 50000);
  
  // Vineyard prestige is already on 0-1 scale
  const vineyardPrestige = vineyard.vineyardPrestige || 0.1;
  
  // Combine factors (weighted average)
  // Land value gets 60% weight, prestige gets 40% weight
  const wineValueIndex = (normalizedLandValue * 0.6) + (vineyardPrestige * 0.4);
  
  // Ensure result is within 0-1 range
  return Math.max(0, Math.min(1, wineValueIndex));
}

/**
 * Get all quality factors for a vineyard (centralized calculation)
 * This provides all the individual factors that contribute to wine quality
 * 
 * @param vineyard - The vineyard to calculate factors for
 * @returns Object containing all quality factors and raw values
 */
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

  // Land Value (normalized) - using the same function as wineValueIndexCalculationService
  const normalizedLandValue = normalizeLandValue(vineyard.landValue || 50000);

  // Vineyard Prestige
  const vineyardPrestige = vineyard.vineyardPrestige || 0.1;

  // Regional Prestige
  const countryData = REGION_PRESTIGE_RANKINGS[vineyard.country as keyof typeof REGION_PRESTIGE_RANKINGS];
  const rawPrestige = countryData ? (countryData[vineyard.region as keyof typeof countryData] ?? 0.5) : 0.5;
  const regionalPrestige = normalizePrestige(rawPrestige);

  // Altitude Rating
  const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);

  // Aspect Rating
  const aspectRating = getAspectRating(vineyard.country, vineyard.region, vineyard.aspect);

  // Grape Suitability
  const grapeSuitability = vineyard.grape ? 
    calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country) : 0;

  // Calculate wine value index (quality score)
  const qualityScore = calculateWineValueIndex(vineyard);

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

