// Vineyard land value calculation service
// Adapted from old iteration with improved normalization (0-1 scale)

import { 
  REGION_PRESTIGE_RANKINGS, 
  REGION_ASPECT_RATINGS, 
  REGION_ALTITUDE_RANGES,
  REGION_PRICE_RANGES
} from '../../constants/vineyardConstants';
import { Aspect } from '../../types';

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
  const prestigeKey = `${region}, ${country}`;
  const rawPrestige = REGION_PRESTIGE_RANKINGS[prestigeKey as keyof typeof REGION_PRESTIGE_RANKINGS] || 0.5;
  const prestigeNormalized = normalizePrestige(rawPrestige);
  
  // Get altitude range and normalize altitude
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  let altitudeRange: [number, number];
  if (countryData && countryData[region as keyof typeof countryData]) {
    altitudeRange = countryData[region as keyof typeof countryData] as [number, number];
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
  const realPriceRange = REGION_PRICE_RANGES[prestigeKey as keyof typeof REGION_PRICE_RANGES] || [5000, 30000] as [number, number];
  const basePricePerHectare = realPriceRange[0];

  // Apply the combined factor to the base price (add 1 to factor to ensure positive scaling)
  const finalValue = (rawPriceFactor + 1) * basePricePerHectare;

  return Math.round(finalValue);
}

