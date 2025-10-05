import { REGION_PRESTIGE_RANKINGS, REGION_ASPECT_RATINGS, REGION_ALTITUDE_RANGES, REGION_PRICE_RANGES, REGION_GRAPE_SUITABILITY } from '../../constants/vineyardConstants';
import { Aspect, GrapeVariety } from '../../types/types';


function normalizeTo01(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}

export function normalizeAltitude(altitude: number, range: [number, number]): number {
  return normalizeTo01(altitude, range[0], range[1]);
}

export function normalizePrestige(prestige: number): number {
  return normalizeTo01(prestige, 0.35, 1.00);
}

export function normalizeAspect(aspect: number): number {
  return normalizeTo01(aspect, 0.10, 1.00);
}

/**
 * Get regional price range for a specific country and region
 * @param country - Country name
 * @param region - Region name
 * @returns Price range as [basePrice, maxPrice] in euros per hectare
 */
export function getRegionalPriceRange(country: string, region: string): [number, number] {
  const countryData = REGION_PRICE_RANGES[country as keyof typeof REGION_PRICE_RANGES];
  return countryData?.[region as keyof typeof countryData] || [5000, 30000];
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
  const getRegionData = <T>(data: any, fallback: T): T => {
    const countryData = data[country];
    return countryData?.[region] ?? fallback;
  };

  const rawPrestige = getRegionData(REGION_PRESTIGE_RANKINGS, 0.5);
  const prestigeNormalized = normalizePrestige(rawPrestige);
  
  const altitudeRange = getRegionData(REGION_ALTITUDE_RANGES, [0, 100]) as [number, number];
  const altitudeNormalized = normalizeAltitude(altitude, altitudeRange);

  const regionAspects = getRegionData(REGION_ASPECT_RATINGS, {}) as any;
  const rawAspect = regionAspects[aspect] ?? 0.5;
  const aspectNormalized = normalizeAspect(rawAspect);

  const rawPriceFactor = (prestigeNormalized + aspectNormalized + altitudeNormalized) / 3;

  const [basePrice, maxPrice] = getRegionalPriceRange(country, region);

  return Math.round(basePrice + rawPriceFactor * (maxPrice - basePrice));
}


/**
 * Calculate grape suitability contribution for vineyard prestige
 * @param grape - Grape variety (can be null if not planted)
 * @param region - Region name
 * @param country - Country name
 * @returns Grape suitability contribution (0-1 scale)
 */
export function calculateGrapeSuitabilityContribution(grape: GrapeVariety | null, region: string, country: string): number {
  // Return neutral suitability (1) if grape is not planted yet (1)=No pendalty for unsuitable grapes (no grapes) (For prestige calculation on notplanted vineyards)
  if (!grape) return 1;
  
  if (!country || !region) throw new Error(`Missing params: ${grape}/${country}/${region}`);
  
  const countrySuitability = REGION_GRAPE_SUITABILITY[country as keyof typeof REGION_GRAPE_SUITABILITY];
  if (!countrySuitability) throw new Error(`No data for country: ${country}`);
  
  const regionSuitability = countrySuitability[region as keyof typeof countrySuitability];
  if (!regionSuitability) throw new Error(`No data for ${region}/${country}`);
  
  const suitability = regionSuitability[grape as keyof typeof regionSuitability];
  if (suitability === undefined) throw new Error(`No data for ${grape}/${region}/${country}`);
  
  return suitability;
}

/**
 * Get aspect rating for a specific vineyard
 * @param country - Country name
 * @param region - Region name
 * @param aspect - Aspect direction
 * @returns Aspect rating (0-1 scale)
 */
export function getAspectRating(country: string, region: string, aspect: string): number {
  const countryAspects = REGION_ASPECT_RATINGS[country as keyof typeof REGION_ASPECT_RATINGS];
  const regionAspects = (countryAspects as any)?.[region] as any;
  return (regionAspects as any)?.[aspect] ?? 0.5;
}

/**
 * Get altitude rating for a specific vineyard
 * @param country - Country name
 * @param region - Region name
 * @param altitude - Altitude in meters
 * @returns Altitude rating (0-1 scale)
 */
export function getAltitudeRating(country: string, region: string, altitude: number): number {
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange = (countryData as any)?.[region] as [number, number] || [0, 100];
  return normalizeAltitude(altitude, altitudeRange);
}


