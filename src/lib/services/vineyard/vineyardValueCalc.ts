import {
  REGION_ASPECT_RATINGS,
  REGION_ALTITUDE_RANGES,
  REGION_PRICE_RANGES,
  REGION_HEAT_PROFILE,
  REGION_SOIL_TYPES,
  ASPECT_SUN_EXPOSURE_OFFSETS,
  ALTITUDE_HEAT_COOLING_FACTOR,
  ALL_SOIL_TYPES,
  type SoilType
} from '../../constants/vineyardConstants';
import {
  GRAPE_ALTITUDE_SUITABILITY,
  REGION_GRAPE_SUITABILITY,
  GRAPE_SUN_PREFERENCES,
  GRAPE_SOIL_PREFERENCES
} from '../../constants/grapeConstants';
import { Aspect, GrapeVariety, Vineyard } from '../../types/types';
import { NormalizeScrewed1000To01WithTail, vineyardAgePrestigeModifier } from '@/lib/utils/calculator';
import { clamp01 } from '@/lib/utils';


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


const GRAPE_SUITABILITY_WEIGHTS = {
  region: 0.4,
  altitude: 0.2,
  sunExposure: 0.2,
  soil: 0.2
} as const;

export interface GrapeSuitabilityMetrics {
  region: number;
  altitude: number;
  sunExposure: number;
  soil: number;
  overall: number;
}

function calculateAltitudeSuitability(grape: GrapeVariety, altitude: number): number {
  const info = GRAPE_ALTITUDE_SUITABILITY[grape];
  if (!info) {
    throw new Error(`No altitude suitability data for grape: ${grape}`);
  }

  if (!Number.isFinite(altitude)) {
    throw new Error(`Invalid altitude value received for grape suitability: ${altitude}`);
  }

  const { preferred, tolerance } = info;
  const [preferredMin, preferredMax] = preferred;
  const [toleranceMin, toleranceMax] = tolerance;

  if (altitude <= toleranceMin || altitude >= toleranceMax) {
    return 0;
  }

  if (altitude >= preferredMin && altitude <= preferredMax) {
    return 1;
  }

  if (altitude < preferredMin) {
    const span = preferredMin - toleranceMin;
    if (span <= 0) {
      return 0;
    }
    return clamp01((altitude - toleranceMin) / span);
  }

  const span = toleranceMax - preferredMax;
  if (span <= 0) {
    return 0;
  }
  return clamp01((toleranceMax - altitude) / span);
}

function getRegionalHeat(country: string, region: string): number {
  const countryHeat = REGION_HEAT_PROFILE[country as keyof typeof REGION_HEAT_PROFILE] as
    | Record<string, number>
    | undefined;
  if (!countryHeat) {
    return 0.5;
  }
  const regionHeat = countryHeat[region];
  return regionHeat ?? 0.5;
}

function getAspectSunOffset(aspect: Aspect): number {
  return ASPECT_SUN_EXPOSURE_OFFSETS[aspect] ?? 0;
}

function calculateSunExposureIndex(
  country: string,
  region: string,
  altitude: number,
  aspect: Aspect
): number {
  const baseHeat = getRegionalHeat(country, region);
  const aspectOffset = getAspectSunOffset(aspect);

  const countryAltitudes = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange = (countryAltitudes as any)?.[region] as [number, number] ?? [0, 100];
  const normalizedAltitude = normalizeAltitude(altitude, altitudeRange);
  const altitudeCooling = normalizedAltitude * ALTITUDE_HEAT_COOLING_FACTOR;

  return clamp01(baseHeat + aspectOffset - altitudeCooling);
}

function calculateSunExposureSuitability(grape: GrapeVariety, sunExposureIndex: number): number {
  const preference = GRAPE_SUN_PREFERENCES[grape];
  if (!preference) {
    throw new Error(`No sun preference data for grape: ${grape}`);
  }

  const { optimalHeatMin, optimalHeatMax, tolerance } = preference;
  const lowerBound = clamp01(optimalHeatMin - tolerance);
  const upperBound = clamp01(optimalHeatMax + tolerance);

  if (sunExposureIndex < lowerBound || sunExposureIndex > upperBound) {
    return 0;
  }

  if (sunExposureIndex >= optimalHeatMin && sunExposureIndex <= optimalHeatMax) {
    return 1;
  }

  if (sunExposureIndex < optimalHeatMin) {
    const span = optimalHeatMin - lowerBound;
    if (span <= 0) return 0;
    return clamp01((sunExposureIndex - lowerBound) / span);
  }

  const span = upperBound - optimalHeatMax;
  if (span <= 0) return 0;
  return clamp01((upperBound - sunExposureIndex) / span);
}

function resolveSoils(
  country: string,
  region: string,
  soilTypes?: readonly string[] | null
): readonly SoilType[] {
  const candidateSoils =
    soilTypes && soilTypes.length > 0
      ? soilTypes
      : ((): readonly string[] => {
          const countrySoils = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES] as
            | Record<string, readonly string[]>
            | undefined;
          return countrySoils?.[region] ?? [];
        })();

  const allowed = new Set<string>(ALL_SOIL_TYPES as readonly string[]);
  const unique = new Set<SoilType>();
  candidateSoils.forEach(soil => {
    if (allowed.has(soil)) {
      unique.add(soil as SoilType);
    }
  });

  if (unique.size > 0) {
    return Array.from(unique.values());
  }

  const countrySoils = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES] as
    | Record<string, readonly string[]>
    | undefined;
  const fallback = countrySoils?.[region] ?? [];
  return fallback.filter(soil => allowed.has(soil)) as SoilType[];
}

function calculateSoilSuitability(
  grape: GrapeVariety,
  soils: readonly SoilType[]
): number {
  const preferences = GRAPE_SOIL_PREFERENCES[grape];
  if (!preferences) {
    return 0.5;
  }

  const uniqueSoils = Array.from(new Set(soils));
  if (uniqueSoils.length === 0) {
    return 0.5;
  }

  const preferred = new Set<SoilType>(preferences.preferred);
  const tolerated = new Set<SoilType>(preferences.tolerated ?? []);

  if (uniqueSoils.every(soil => preferred.has(soil))) {
    return 1;
  }

  const score = uniqueSoils.reduce((total, soil) => {
    if (preferred.has(soil)) {
      return total + 1;
    }
    if (tolerated.has(soil)) {
      return total + 0.5;
    }
    return total;
  }, 0);

  return clamp01(score / uniqueSoils.length);
}

export function calculateGrapeSuitabilityMetrics(
  grape: GrapeVariety,
  region: string,
  country: string,
  altitude: number,
  aspect: Aspect,
  soilTypes?: readonly string[]
): GrapeSuitabilityMetrics {
  if (!country || !region) {
    throw new Error(`Missing params: ${grape}/${country}/${region}`);
  }

  const countrySuitability = REGION_GRAPE_SUITABILITY[country as keyof typeof REGION_GRAPE_SUITABILITY];
  if (!countrySuitability) {
    throw new Error(`No data for country: ${country}`);
  }

  const regionSuitability = countrySuitability[region as keyof typeof countrySuitability];
  if (!regionSuitability) {
    throw new Error(`No data for ${region}/${country}`);
  }

  const regionalValue = regionSuitability[grape as keyof typeof regionSuitability];
  if (regionalValue === undefined) {
    throw new Error(`No data for ${grape}/${region}/${country}`);
  }

  const altitudeValue = calculateAltitudeSuitability(grape, altitude);
  const sunExposureIndex = calculateSunExposureIndex(country, region, altitude, aspect);
  const sunExposureValue = calculateSunExposureSuitability(grape, sunExposureIndex);
  const soilList = resolveSoils(country, region, soilTypes);
  const soilValue = calculateSoilSuitability(grape, soilList);

  const totalWeight =
    GRAPE_SUITABILITY_WEIGHTS.region +
    GRAPE_SUITABILITY_WEIGHTS.altitude +
    GRAPE_SUITABILITY_WEIGHTS.sunExposure +
    GRAPE_SUITABILITY_WEIGHTS.soil;
  const weighted =
    (regionalValue * GRAPE_SUITABILITY_WEIGHTS.region +
      altitudeValue * GRAPE_SUITABILITY_WEIGHTS.altitude +
      sunExposureValue * GRAPE_SUITABILITY_WEIGHTS.sunExposure +
      soilValue * GRAPE_SUITABILITY_WEIGHTS.soil) /
    totalWeight;

  return {
    region: clamp01(regionalValue),
    altitude: clamp01(altitudeValue),
    sunExposure: clamp01(sunExposureValue),
    soil: clamp01(soilValue),
    overall: clamp01(weighted)
  };
}

/**
 * Calculate grape suitability contribution for vineyard prestige
 * @param grape - Grape variety (can be null if not planted)
 * @param region - Region name
 * @param country - Country name
 * @param altitude - Vineyard altitude in meters
 * @returns Grape suitability contribution (0-1 scale)
 */
export function calculateGrapeSuitabilityContribution(
  grape: GrapeVariety | null,
  region: string,
  country: string,
  altitude: number,
  aspect: Aspect,
  soilTypes?: readonly string[]
): number {
  // Return neutral suitability (1) if grape is not planted yet (1)=No pendalty for unsuitable grapes (no grapes) (For prestige calculation on notplanted vineyards)
  if (!grape) return 1;
  return calculateGrapeSuitabilityMetrics(grape, region, country, altitude, aspect, soilTypes).overall;
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
  context?: {
    grape?: GrapeVariety | null;
    vineAge?: number | null;
    vineyardPrestige?: number;
    soil?: readonly SoilType[] | readonly string[];
  }
): number {
  const base = calculateLandValue(country, region, altitude, aspect);

  const plantedBonus = context?.grape
    ? 0.05 *
      calculateGrapeSuitabilityContribution(
        context.grape,
        region,
        country,
        altitude,
        aspect,
        context.soil
      )
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
    {
      grape: vineyard.grape,
      vineAge: vineyard.vineAge ?? 0,
      vineyardPrestige: vineyard.vineyardPrestige ?? 0,
      soil: vineyard.soil
    }
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
  grapeSuitabilityComponents: GrapeSuitabilityMetrics | null;
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
    ? 0.05 *
      calculateGrapeSuitabilityContribution(
        vineyard.grape,
        vineyard.region,
        vineyard.country,
        vineyard.altitude,
        vineyard.aspect,
        vineyard.soil
      )
    : 0;
  const grapeSuitabilityComponents = vineyard.grape
    ? calculateGrapeSuitabilityMetrics(
        vineyard.grape,
        vineyard.region,
        vineyard.country,
        vineyard.altitude,
        vineyard.aspect,
        vineyard.soil
      )
    : null;

  const age = Math.max(0, vineyard.vineAge ?? 0);
  const ageScale = Math.min(1, age / 200);
  const ageMod = vineyardAgePrestigeModifier(age);
  const ageBonusPct = 0.03 * ageScale * ageMod;

  const prestigeNorm = NormalizeScrewed1000To01WithTail(Math.max(0, vineyard.vineyardPrestige ?? 0));
  const prestigeBonusPct = 0.02 * prestigeNorm;

  const totalMultiplier = 1 + plantedBonusPct + ageBonusPct + prestigeBonusPct;
  const adjustedPerHa = Math.round(basePerHa * totalMultiplier);
  const adjustedTotal = Math.round(adjustedPerHa * vineyard.hectares);

  return {
    basePerHa,
    plantedBonusPct,
    ageBonusPct,
    prestigeBonusPct,
    totalMultiplier,
    adjustedPerHa,
    adjustedTotal,
    grapeSuitabilityComponents
  };
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


