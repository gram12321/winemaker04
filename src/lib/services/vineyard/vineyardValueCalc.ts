import { REGION_ASPECT_RATINGS, REGION_ALTITUDE_RANGES, REGION_PRICE_RANGES, REGION_GRAPE_SUITABILITY } from '../../constants/vineyardConstants';
import { Aspect, GrapeVariety, Vineyard } from '../../types/types';
import { NormalizeScrewed1000To01WithTail, vineyardAgePrestigeModifier } from '@/lib/utils/calculator';


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

  const altitudeRange = getRegionData(REGION_ALTITUDE_RANGES, [0, 100]) as [number, number];
  const altitudeNormalized = normalizeAltitude(altitude, altitudeRange);

  const regionAspects = getRegionData(REGION_ASPECT_RATINGS, {}) as any;
  const rawAspect = regionAspects[aspect] ?? 0.5;
  const aspectNormalized = normalizeAspect(rawAspect);
  // Use only altitude and aspect to span the region's full price band.
  const altitudeAspectRate = (aspectNormalized + altitudeNormalized) / 2;

  const [basePrice, maxPrice] = getRegionalPriceRange(country, region);

  return Math.round(basePrice + altitudeAspectRate * (maxPrice - basePrice));
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
 * Calculate adjusted per-hectare land value with gameplay modifiers.
 * - +5% × grape suitability when planted (0–5%)
 * - +3% × (vineAge/200) × vineyardAgePrestigeModifier (0–3%)
 * - +2% × NormalizeScrewed1000To01WithTail(vineyardPrestige) (0–2%)
 * Target: typical combined uplift ~5–10% at strong conditions.
 */
export function calculateAdjustedLandValue(
  country: string,
  region: string,
  altitude: number,
  aspect: Aspect,
  context?: { grape?: GrapeVariety | null; vineAge?: number | null; vineyardPrestige?: number }
): number {
  const base = calculateLandValue(country, region, altitude, aspect);

  const plantedBonus = context?.grape
    ? 0.05 * calculateGrapeSuitabilityContribution(context.grape, region, country)
    : 0;

  const age = Math.max(0, context?.vineAge ?? 0);
  const ageScale = Math.min(1, age / 200);
  const ageMod = vineyardAgePrestigeModifier(age); // 0–1
  const ageBonus = 0.03 * ageScale * ageMod;

  const prestigeNorm = NormalizeScrewed1000To01WithTail(Math.max(0, context?.vineyardPrestige ?? 0)); // 0–1
  const prestigeBonus = 0.02 * prestigeNorm;

  const totalMultiplier = 1 + plantedBonus + ageBonus + prestigeBonus;
  return Math.round(base * totalMultiplier);
}

/**
 * Convenience: Compute current total vineyard value using adjusted per-hectare value.
 */
export function calculateAdjustedVineyardTotalValue(vineyard: Vineyard): number {
  const perHa = calculateAdjustedLandValue(
    vineyard.country,
    vineyard.region,
    vineyard.altitude,
    vineyard.aspect,
    { grape: vineyard.grape, vineAge: vineyard.vineAge ?? 0, vineyardPrestige: vineyard.vineyardPrestige ?? 0 }
  );
  return Math.round(perHa * vineyard.hectares);
}

export interface LandValueAdjustmentBreakdown {
  basePerHa: number;
  plantedBonusPct: number; // 0-1
  ageBonusPct: number; // 0-1
  prestigeBonusPct: number; // 0-1
  totalMultiplier: number; // 1 + sum
  adjustedPerHa: number;
  adjustedTotal: number;
}

/**
 * Return detailed breakdown of adjusted land value for a given vineyard
 */
export function calculateAdjustedLandValueBreakdown(vineyard: Vineyard): LandValueAdjustmentBreakdown {
  const basePerHa = calculateLandValue(
    vineyard.country,
    vineyard.region,
    vineyard.altitude,
    vineyard.aspect
  );

  const plantedBonusPct = vineyard.grape
    ? 0.05 * calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country)
    : 0;

  const age = Math.max(0, vineyard.vineAge ?? 0);
  const ageScale = Math.min(1, age / 200);
  const ageMod = vineyardAgePrestigeModifier(age);
  const ageBonusPct = 0.03 * ageScale * ageMod;

  const prestigeNorm = NormalizeScrewed1000To01WithTail(Math.max(0, vineyard.vineyardPrestige ?? 0));
  const prestigeBonusPct = 0.02 * prestigeNorm;

  const totalMultiplier = 1 + plantedBonusPct + ageBonusPct + prestigeBonusPct;
  const adjustedPerHa = Math.round(basePerHa * totalMultiplier);
  const adjustedTotal = Math.round(adjustedPerHa * vineyard.hectares);

  return { basePerHa, plantedBonusPct, ageBonusPct, prestigeBonusPct, totalMultiplier, adjustedPerHa, adjustedTotal };
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


