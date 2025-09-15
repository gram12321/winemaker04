// Vineyard land value calculation service
// Adapted from old iteration with improved normalization (0-1 scale)

import { 
  REGION_PRESTIGE_RANKINGS, 
  REGION_ASPECT_RATINGS, 
  REGION_ALTITUDE_RANGES,
  REGION_PRICE_RANGES,
  REGION_GRAPE_SUITABILITY
} from '../../constants/vineyardConstants';
import { Aspect, Vineyard, GrapeVariety } from '../../types';
import { vineyardAgePrestigeModifier } from '../../utils/calculator';
import { VINEYARD_PRESTIGE_CONSTANTS } from '../../constants';

/**
 * Normalize altitude to 0-1 scale based on regional altitude ranges
 * @param altitude - Altitude in meters
 * @param range - [min, max] altitude range for the region
 * @returns Normalized altitude value between 0 and 1
 */
export function normalizeAltitude(altitude: number, range: [number, number]): number {
  const [minAltitude, maxAltitude] = range;
  
  // Avoid division by zero, return midpoint
  if (maxAltitude <= minAltitude) return 0.5;
  
  // Normalize to 0-1 scale (full range, not 0.3-0.7 like old version)
  const normalized = (altitude - minAltitude) / (maxAltitude - minAltitude);
  
  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Normalize prestige from its actual range (0.35-1.00) to 0-1 scale
 * @param prestige - Raw prestige value from REGION_PRESTIGE_RANKINGS
 * @returns Normalized prestige value between 0 and 1
 */
export function normalizePrestige(prestige: number): number {
  // Prestige ranges from 0.35 (lowest) to 1.00 (highest) in our data
  const minPrestige = 0.35;
  const maxPrestige = 1.00;
  
  const normalized = (prestige - minPrestige) / (maxPrestige - minPrestige);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Normalize aspect from its actual range (0.10-1.00) to 0-1 scale
 * @param aspect - Raw aspect value from REGION_ASPECT_RATINGS
 * @returns Normalized aspect value between 0 and 1
 */
export function normalizeAspect(aspect: number): number {
  // Aspect ranges from 0.10 (worst) to 1.00 (best) in our data
  const minAspect = 0.10;
  const maxAspect = 1.00;
  
  const normalized = (aspect - minAspect) / (maxAspect - minAspect);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Calculate land value based on country, region, altitude, and aspect
 * Incorporates real price ranges and improved normalization
 * @param country - Country name
 * @param region - Region name
 * @param altitude - Altitude in meters
 * @param aspect - Aspect direction
 * @returns Land value in euros per hectare
 */
export function calculateLandValue(
  country: string, 
  region: string, 
  altitude: number, 
  aspect: Aspect
): number {
  // Get prestige factor
  const prestigeCountryData = REGION_PRESTIGE_RANKINGS[country as keyof typeof REGION_PRESTIGE_RANKINGS];
  const rawPrestige = prestigeCountryData ? (prestigeCountryData[region as keyof typeof prestigeCountryData] ?? 0.5) : 0.5;
  const prestigeNormalized = normalizePrestige(rawPrestige);
  
  // Get altitude range and normalize altitude
  const altitudeCountryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  let altitudeRange: [number, number];
  if (altitudeCountryData && altitudeCountryData[region as keyof typeof altitudeCountryData]) {
    altitudeRange = altitudeCountryData[region as keyof typeof altitudeCountryData] as [number, number];
  } else {
    altitudeRange = [0, 100]; // Default range
  }
  const altitudeNormalized = normalizeAltitude(altitude, altitudeRange);

  // Get aspect factor and normalize
  const countryAspects = REGION_ASPECT_RATINGS[country as keyof typeof REGION_ASPECT_RATINGS];
  const regionAspects = countryAspects ? countryAspects[region as keyof typeof countryAspects] : null;
  const rawAspect = regionAspects ? (regionAspects[aspect as keyof typeof regionAspects] ?? 0.5) : 0.5;
  const aspectNormalized = normalizeAspect(rawAspect);

  // Calculate raw price factor by averaging normalized values
  const rawPriceFactor = (prestigeNormalized + aspectNormalized + altitudeNormalized) / 3;

  // Get real price range (use lower bound as base price per hectare)
  const priceCountryData = REGION_PRICE_RANGES[country as keyof typeof REGION_PRICE_RANGES];
  const realPriceRange = priceCountryData ? (priceCountryData[region as keyof typeof priceCountryData] ?? [5000, 30000]) : [5000, 30000] as [number, number];
  const basePricePerHectare = realPriceRange[0];

  // Apply the combined factor to the base price (add 1 to factor to ensure positive scaling)
  const finalValue = (rawPriceFactor + 1) * basePricePerHectare;

  return Math.round(finalValue);
}

/**
 * Calculate land value contribution for vineyard prestige
 * Based on the old logic that normalizes land value by dividing by 190000
 * @param landValue - Land value in euros per hectare
 * @returns Land value contribution (0-1+ scale)
 */
function calculateLandValueContribution(landValue: number): number {
  // Normalize land value by dividing by the constant (set to match Bordeaux, France max price)
  const normalizedValue = landValue / VINEYARD_PRESTIGE_CONSTANTS.LAND_VALUE_NORMALIZATION;
  // Return the normalized value, allowing values potentially > 1 as per old comment
  return Math.max(0, normalizedValue); // Ensure non-negative
}

/**
 * Calculate region prestige contribution for vineyard prestige
 * @param region - Region name
 * @param country - Country name
 * @returns Region prestige contribution (0-1 scale)
 */
function calculateRegionPrestigeContribution(region: string, country: string): number {
  // Use the nested REGION_PRESTIGE_RANKINGS structure
  const countryData = REGION_PRESTIGE_RANKINGS[country as keyof typeof REGION_PRESTIGE_RANKINGS];
  return countryData ? (countryData[region as keyof typeof countryData] ?? 0.5) : 0.5; // Default if not found
}

/**
 * Calculate grape suitability contribution for vineyard prestige
 * @param grape - Grape variety (can be null if not planted)
 * @param region - Region name
 * @param country - Country name
 * @returns Grape suitability contribution (0-1 scale)
 */
function calculateGrapeSuitabilityContribution(grape: GrapeVariety | null, region: string, country: string): number {
  if (!grape || !country || !region) return 0;

  const countrySuitability = REGION_GRAPE_SUITABILITY[country as keyof typeof REGION_GRAPE_SUITABILITY];
  if (!countrySuitability) return 0.5; // Default if country not found

  const regionSuitability = countrySuitability[region as keyof typeof countrySuitability];
  if (!regionSuitability) return 0.5; // Default if region not found

  // Return the suitability for the specific grape, or default 0.5
  return regionSuitability[grape as keyof typeof regionSuitability] ?? 0.5;
}

/**
 * Calculate vineyard prestige based on multiple factors
 * Adapted from the old iteration with the same weighting system:
 * - Age contribution (30%)
 * - Land value contribution (25%) 
 * - Region prestige contribution (25%)
 * - Grape variety suitability (20%)
 * 
 * @param vineyard - The vineyard to calculate prestige for
 * @returns Vineyard prestige value (0-1 scale, minimum 0.01)
 */
export function calculateVineyardPrestige(vineyard: Vineyard): number {
  // Age contribution (30%) - Uses existing vineyardAgePrestigeModifier function
  const ageContribution = vineyardAgePrestigeModifier(vineyard.vineAge || 0);

  // Land value contribution (25%) - Refined to use new landValue
  const landValueContribution = calculateLandValueContribution(vineyard.landValue || 50000);

  // Region prestige contribution (25%) - Refined
  const prestigeRankingContribution = calculateRegionPrestigeContribution(vineyard.region, vineyard.country);

  // Grape variety suitability (20%) - Based on REGION_GRAPE_SUITABILITY
  const grapeContribution = calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country);

  const finalPrestige = (
    (ageContribution * 0.30) +
    (landValueContribution * 0.25) +
    (prestigeRankingContribution * 0.25) +
    (grapeContribution * 0.20)
  ) || 0.01; // Ensure weights sum to 1.0

  return Math.max(0.01, Math.min(1, finalPrestige));
}

