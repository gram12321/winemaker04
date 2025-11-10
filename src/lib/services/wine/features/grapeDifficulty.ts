import {
  GRAPE_CONST,
  BASE_BALANCED_RANGES,
  REGION_GRAPE_SUITABILITY,
  REGION_ALTITUDE_RANGES,
  REGION_ASPECT_RATINGS,
  GRAPE_ALTITUDE_SUITABILITY,
  GRAPE_SUN_PREFERENCES,
  REGION_HEAT_PROFILE,
  ASPECT_SUN_EXPOSURE_OFFSETS
} from '@/lib/constants';
import { GrapeVariety, WineCharacteristics, Aspect } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils';

type DifficultyComponentKey =
  | 'handling'
  | 'yield'
  | 'balance'
  | 'aging'
  | 'grapeSuitability';

export type DifficultyTier = 'low' | 'medium' | 'high';

export interface GrapeDifficultyComponents {
  handling: number;
  yield: number;
  balance: number;
  aging: number;
  grapeSuitability: number;
}

export interface RegionSuitabilityDetail {
  country: string;
  region: string;
  regionMatch: number;
  altitudeMatch: number | null;
  altitudeRange?: readonly [number, number];
  sunMatch: number | null;
  sunIndex?: number;
}

export interface GrapeSuitabilityDetails {
  regionAverage: number;
  altitudeAverage: number;
  altitudeCoverage: number;
  sunAverage: number;
  sunCoverage: number;
  combinedSuitability: number;
  regions: RegionSuitabilityDetail[];
}

export interface GrapeDifficultyDetails {
  grapeSuitability?: GrapeSuitabilityDetails;
}

export interface GrapeDifficultyBreakdown {
  grape: GrapeVariety;
  score: number;
  components: GrapeDifficultyComponents;
  tier: DifficultyTier;
  details: GrapeDifficultyDetails;
}

const COMPONENT_WEIGHTS: Record<DifficultyComponentKey, number> = {
  handling: 0.35,
  yield: 0.2,
  balance: 0.2,
  aging: 0.1,
  grapeSuitability: 0.15,
};

const AGE_SPANS = Object.values(GRAPE_CONST).map(grape => {
  const { earlyPeak, latePeak } = grape.agingProfile;
  return Math.max(0, latePeak - earlyPeak);
});

const AGING_SPAN_REFERENCE = AGE_SPANS.length > 0 ? Math.max(...AGE_SPANS) : 10;

const AGE_WORTHINESS_MAP = {
  low: 0.2,
  medium: 0.5,
  high: 0.8,
} as const;

const DIFFICULTY_TIERS: Array<{ max: number; tier: DifficultyTier }> = [
  { max: 0.4, tier: 'low' },
  { max: 0.7, tier: 'medium' },
  { max: 1, tier: 'high' },
];

const EPSILON = 1e-6;

const GLOBAL_ALTITUDE_RANGE = (() => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  Object.values(REGION_ALTITUDE_RANGES).forEach(country => {
    Object.values(country).forEach(range => {
      const [rangeMin, rangeMax] = range as [number, number];
      min = Math.min(min, rangeMin);
      max = Math.max(max, rangeMax);
    });
  });
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return { min: 0, max: 1000, span: 1000 };
  }
  return { min, max, span: Math.max(1, max - min) };
})();

type RegionContext = {
  country: string;
  region: string;
  suitability: number;
  altitudeRange?: readonly [number, number];
  aspectRatings?: Record<Aspect, number>;
  baseHeat?: number;
};

function forEachGrapeRegion(grape: GrapeVariety, callback: (context: RegionContext) => void): void {
  Object.entries(REGION_GRAPE_SUITABILITY).forEach(([countryName, regions]) => {
    const altitudeCountry = REGION_ALTITUDE_RANGES[countryName as keyof typeof REGION_ALTITUDE_RANGES] as
      | Record<string, readonly [number, number]>
      | undefined;
    const aspectCountry = REGION_ASPECT_RATINGS[countryName as keyof typeof REGION_ASPECT_RATINGS] as
      | Record<string, Record<Aspect, number>>
      | undefined;
    const heatCountry = REGION_HEAT_PROFILE[countryName as keyof typeof REGION_HEAT_PROFILE] as
      | Record<string, number>
      | undefined;

    Object.entries(regions).forEach(([regionName, grapeMap]) => {
      const suitability = grapeMap[grape as keyof typeof grapeMap];
      if (typeof suitability !== 'number') return;

      const altitudeRange = altitudeCountry?.[regionName];
      const aspectRatings = aspectCountry?.[regionName];
      const baseHeat = heatCountry?.[regionName];

      callback({
        country: countryName,
        region: regionName,
        suitability,
        altitudeRange,
        aspectRatings,
        baseHeat
      });
    });
  });
}

function rangeOverlapLength(aMin: number, aMax: number, bMin: number, bMax: number): number {
  const min = Math.min(aMin, aMax);
  const max = Math.max(aMin, aMax);
  const otherMin = Math.min(bMin, bMax);
  const otherMax = Math.max(bMin, bMax);
  return Math.max(0, Math.min(max, otherMax) - Math.max(min, otherMin));
}

function calculateHandlingComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  return clamp01((data.fragile + data.proneToOxidation) / 2);
}

function calculateYieldComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  return clamp01(1 - data.naturalYield);
}

function calculateBalanceComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  const characteristicKeys = Object.keys(BASE_BALANCED_RANGES) as Array<keyof WineCharacteristics>;

  const totalDeviation = characteristicKeys.reduce((sum, key) => {
    const [min, max] = BASE_BALANCED_RANGES[key];
    const midpoint = (min + max) / 2;
    const halfRange = (max - min) / 2 || 0.0001;
    const deviation = Math.abs(data.baseCharacteristics[key] - midpoint) / halfRange;
    return sum + clamp01(deviation);
  }, 0);

  return clamp01(totalDeviation / characteristicKeys.length);
}

function calculateAgingComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  const { earlyPeak, latePeak, ageWorthiness } = data.agingProfile;

  const span = clamp01((latePeak - earlyPeak) / AGING_SPAN_REFERENCE);
  const worthiness = AGE_WORTHINESS_MAP[ageWorthiness];

  return clamp01((span + worthiness) / 2);
}

function calculateSunMatchValue(
  effectiveHeat: number,
  lowerBound: number,
  upperBound: number
): number {
  if (effectiveHeat >= lowerBound && effectiveHeat <= upperBound) {
    return 1;
  }
  const span = Math.max(EPSILON, upperBound - lowerBound);
  const distance = effectiveHeat < lowerBound ? lowerBound - effectiveHeat : effectiveHeat - upperBound;
  return clamp01(1 - distance / span);
}

function calculateGrapeSuitabilityData(grape: GrapeVariety): { componentValue: number; details: GrapeSuitabilityDetails } {
  const altitudePreference = GRAPE_ALTITUDE_SUITABILITY[grape];
  const sunPreference = GRAPE_SUN_PREFERENCES[grape];

  const [altToleranceMin, altToleranceMax] = altitudePreference?.tolerance ?? [0, 0];
  const altitudeToleranceSpan = Math.max(0, altToleranceMax - altToleranceMin);
  const altitudeCoverage = altitudePreference ? clamp01(altitudeToleranceSpan / GLOBAL_ALTITUDE_RANGE.span) : 0;

  const sunLower = sunPreference ? clamp01(sunPreference.optimalHeatMin - sunPreference.tolerance) : 0;
  const sunUpper = sunPreference ? clamp01(sunPreference.optimalHeatMax + sunPreference.tolerance) : 0;
  const sunCoverage = sunPreference ? clamp01(Math.max(0, sunUpper - sunLower)) : 0;

  let regionSum = 0;
  let regionCount = 0;

  let altitudeSum = 0;
  let altitudeCount = 0;

  let sunSum = 0;
  let sunCount = 0;

  const regionDetails: RegionSuitabilityDetail[] = [];

  forEachGrapeRegion(grape, ({ country, region, suitability, altitudeRange, aspectRatings, baseHeat }) => {
    const regionMatch = clamp01(suitability);
    regionSum += regionMatch;
    regionCount += 1;

    let altitudeMatch: number | null = null;
    if (altitudePreference && altitudeRange) {
      const [regionMin, regionMax] = altitudeRange;
      const regionSpan = Math.max(EPSILON, regionMax - regionMin);
      const overlap = rangeOverlapLength(altToleranceMin, altToleranceMax, regionMin, regionMax);
      altitudeMatch = clamp01(overlap / regionSpan);
      altitudeSum += altitudeMatch;
      altitudeCount += 1;
    }

    let sunMatch: number | null = null;
    let sunIndex: number | undefined = undefined;
    if (sunPreference && aspectRatings && baseHeat !== undefined) {
      const aspectEntries = Object.entries(aspectRatings) as Array<[Aspect, number]>;
      let weightSum = 0;
      let weightedMatch = 0;
      let weightedHeat = 0;
      aspectEntries.forEach(([aspect, rating]) => {
        const weight = rating ?? 0;
        if (weight <= 0) return;
        const offset = ASPECT_SUN_EXPOSURE_OFFSETS[aspect] ?? 0;
        const effectiveHeat = clamp01(baseHeat + offset);
        const matchValue = calculateSunMatchValue(effectiveHeat, sunLower, sunUpper);
        weightedMatch += weight * matchValue;
        weightedHeat += weight * effectiveHeat;
        weightSum += weight;
      });
      if (weightSum > 0) {
        sunMatch = clamp01(weightedMatch / weightSum);
        sunIndex = clamp01(weightedHeat / weightSum);
        sunSum += sunMatch;
        sunCount += 1;
      }
    }

    regionDetails.push({
      country,
      region,
      regionMatch,
      altitudeMatch,
      altitudeRange,
      sunMatch,
      sunIndex
    });
  });

  const regionAverage = regionCount > 0 ? clamp01(regionSum / regionCount) : 0.5;
  const altitudeAverage = altitudeCount > 0 ? clamp01(altitudeSum / altitudeCount) : 0.5;
  const sunAverage = sunCount > 0 ? clamp01(sunSum / sunCount) : 0.5;

  const combinedAltitude = clamp01((altitudeAverage + altitudeCoverage) / 2);
  const combinedSun = clamp01((sunAverage + sunCoverage) / 2);

  const suitabilityWeights = {
    region: 0.5,
    altitude: 0.25,
    sun: 0.25
  } as const;

  const weightedSuitability =
    (regionAverage * suitabilityWeights.region +
      combinedAltitude * suitabilityWeights.altitude +
      combinedSun * suitabilityWeights.sun) /
    (suitabilityWeights.region + suitabilityWeights.altitude + suitabilityWeights.sun);

  const combinedSuitability = clamp01(weightedSuitability);

  return {
    componentValue: clamp01(1 - combinedSuitability),
    details: {
      regionAverage,
      altitudeAverage,
      altitudeCoverage,
      sunAverage,
      sunCoverage,
      combinedSuitability,
      regions: regionDetails.sort((a, b) => b.regionMatch - a.regionMatch),
    }
  };
}

function deriveTier(score: number): DifficultyTier {
  const tierEntry = DIFFICULTY_TIERS.find(entry => score <= entry.max);
  return tierEntry ? tierEntry.tier : 'high';
}

function calculateComponents(grape: GrapeVariety) {
  const handling = calculateHandlingComponent(grape);
  const yieldComponent = calculateYieldComponent(grape);
  const balance = calculateBalanceComponent(grape);
  const aging = calculateAgingComponent(grape);
  const grapeSuitabilityData = calculateGrapeSuitabilityData(grape);

  const components: GrapeDifficultyComponents = {
    handling,
    yield: yieldComponent,
    balance,
    aging,
    grapeSuitability: grapeSuitabilityData.componentValue,
  };

  return { components, grapeSuitabilityDetails: grapeSuitabilityData.details };
}

export function calculateGrapeDifficulty(grape: GrapeVariety): GrapeDifficultyBreakdown {
  const { components, grapeSuitabilityDetails } = calculateComponents(grape);

  const score = (Object.keys(COMPONENT_WEIGHTS) as DifficultyComponentKey[]).reduce((sum, key) => {
    return sum + COMPONENT_WEIGHTS[key] * components[key];
  }, 0);

  const normalizedScore = clamp01(score);

  return {
    grape,
    score: normalizedScore,
    components,
    tier: deriveTier(normalizedScore),
    details: {
      grapeSuitability: grapeSuitabilityDetails,
    },
  };
}

export function calculateAllGrapeDifficulties(): Record<GrapeVariety, GrapeDifficultyBreakdown> {
  return Object.keys(GRAPE_CONST).reduce((acc, grapeName) => {
    const grape = grapeName as GrapeVariety;
    acc[grape] = calculateGrapeDifficulty(grape);
    return acc;
  }, {} as Record<GrapeVariety, GrapeDifficultyBreakdown>);
}

