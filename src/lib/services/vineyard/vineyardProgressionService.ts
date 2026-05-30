import { ASPECT_RIPENESS_MODIFIERS, RIPENESS_INCREASE, SEASONAL_RIPENESS_RANDOMNESS } from '@/lib/constants/vineyardConstants';
import type { Season, Vineyard } from '@/lib/types/types';
import { clamp, clamp01, deterministicSeasonalVariation } from '@/lib/utils';
import { calculateVineyardWeatherImpact, type VineyardWeatherContext, type VineyardWeatherImpactBreakdown } from './weatherImpactService';

const MIN_VINEYARD_HEALTH = 0.1;
const MAX_VINEYARD_HEALTH = 1.0;
const MIN_WEEKLY_HEALTH_DELTA = -0.02;
const MAX_WEEKLY_HEALTH_DELTA = 0.01;
const DEFAULT_WEATHER_PRESSURE_SCALE = 0.01;
const MIN_RIPENESS_WEATHER_MULTIPLIER = 0.4;
const MAX_RIPENESS_WEATHER_MULTIPLIER = 1.6;
const MIN_HEALTH_WEATHER_MULTIPLIER = 0.5;
const MAX_HEALTH_WEATHER_MULTIPLIER = 1.5;

export interface VineyardMetricProjection {
  current: number;
  normalDelta: number;
  weatherDelta: number;
  totalDelta: number;
  projected: number;
}

export interface VineyardWeeklyProjection {
  ripeness: VineyardMetricProjection;
  health: VineyardMetricProjection;
  siteResponse: number;
  reason: string;
  breakdown: VineyardWeatherImpactBreakdown;
}

export interface VineyardWeeklyProjectionOptions {
  plantingProgressRatio?: number;
  healthDecayMultiplier?: number;
  ripenessGrowthActive?: boolean;
}

function calculateWeatherScaledDelta(
  normalDelta: number,
  weatherPressure: number,
  minMultiplier: number,
  maxMultiplier: number
): { totalDelta: number; weatherContribution: number } {
  if (normalDelta === 0 || weatherPressure === 0) {
    return {
      totalDelta: normalDelta,
      weatherContribution: 0,
    };
  }

  const direction = Math.sign(normalDelta);
  const rawMultiplier = 1 + (direction * weatherPressure);
  const weatherMultiplier = clamp(rawMultiplier, minMultiplier, maxMultiplier);
  const totalDelta = normalDelta * weatherMultiplier;

  return {
    totalDelta,
    weatherContribution: totalDelta - normalDelta,
  };
}

/**
 * Calculate dynamic ripeness increase for a vineyard based on season, aspect, and randomness.
 */
export function calculateDynamicRipenessIncrease(
  vineyard: Vineyard,
  season: string,
  deterministicMultiplier?: number
): number {
  const baseIncrease = RIPENESS_INCREASE[season as keyof typeof RIPENESS_INCREASE] || 0;

  if (baseIncrease <= 0) {
    return 0;
  }

  const randomnessRange = SEASONAL_RIPENESS_RANDOMNESS[season as keyof typeof SEASONAL_RIPENESS_RANDOMNESS];
  if (!randomnessRange || randomnessRange.min === randomnessRange.max) {
    return baseIncrease;
  }

  const resolvedMultiplier = deterministicMultiplier
    ?? deterministicSeasonalVariation(
      `${vineyard.id}:${season}:ripeness-randomness:default`,
      randomnessRange.min,
      randomnessRange.max
    );

  const aspectModifier = ASPECT_RIPENESS_MODIFIERS[vineyard.aspect as keyof typeof ASPECT_RIPENESS_MODIFIERS] || 0;
  const aspectMultiplier = 1 + aspectModifier;
  const finalIncrease = baseIncrease * resolvedMultiplier * aspectMultiplier;

  return Math.max(0, finalIncrease);
}

export function calculateWinterRipenessDegradation(week: number): number {
  const safeWeek = Math.max(1, Number.isFinite(week) ? week : 1);
  const baseDegradation = 0.03;
  const accelerationFactor = 0.01;
  return baseDegradation + (accelerationFactor * (safeWeek - 1));
}

export function calculateWeeklyBaselineRipenessDelta(
  vineyard: Vineyard,
  season: string,
  week: number,
  companyId: string,
  year: number,
  plantingProgressRatio: number = 1
): number {
  const currentRipeness = vineyard.ripeness || 0;
  const safePlantingProgressRatio = Math.max(0, Math.min(1, plantingProgressRatio));

  if (season === 'Winter') {
    if (currentRipeness <= 0) return 0;
    const weeklyDegradation = calculateWinterRipenessDegradation(week);
    const ripenessLoss = Math.min(currentRipeness, weeklyDegradation);
    return -ripenessLoss;
  }

  const randomnessRange = SEASONAL_RIPENESS_RANDOMNESS[season as keyof typeof SEASONAL_RIPENESS_RANDOMNESS] || { min: 1, max: 1 };
  const ripenessMultiplier = deterministicSeasonalVariation(
    `${companyId}:${year}:${season}:${week}:${vineyard.id}:ripeness-randomness`,
    randomnessRange.min,
    randomnessRange.max
  );
  const ripenessIncrease = calculateDynamicRipenessIncrease(vineyard, season, ripenessMultiplier);
  if (ripenessIncrease <= 0) {
    return 0;
  }

  const scaledRipenessIncrease = ripenessIncrease * safePlantingProgressRatio;
  return Math.min(1 - currentRipeness, scaledRipenessIncrease);
}

export function getSeasonalWeeklyHealthDegradation(season: string): number {
  switch (season) {
    case 'Spring':
      return 0.002;
    case 'Summer':
      return 0.006;
    case 'Fall':
      return 0.01;
    case 'Winter':
      return 0.001;
    default:
      return 0.005;
  }
}

export function calculateWeeklyBaselineHealthDelta(
  vineyard: Vineyard,
  season: string,
  week: number,
  companyId: string,
  year: number,
  healthDecayMultiplier: number = 1
): number {
  if (vineyard.vineyardHealth <= 0.1) return 0;

  let weeklyDegradation = getSeasonalWeeklyHealthDegradation(season);
  const variationSeed = `${companyId}:${year}:${season}:${week}:${vineyard.id}:health-variation`;
  const variation = deterministicSeasonalVariation(variationSeed, -0.2, 0.2);
  weeklyDegradation *= (1 + variation);
  weeklyDegradation *= Math.max(0.1, healthDecayMultiplier);

  return -weeklyDegradation;
}

export function isRipenessGrowthActiveForWeek(
  status: Vineyard['status'],
  season: Season,
  week: number
): boolean {
  if (status === 'Growing' || status === 'Planting') {
    return true;
  }

  if (
    season === 'Spring' &&
    week === 1 &&
    (status === 'Dormant' || status === 'Planted' || status === 'Harvested')
  ) {
    return true;
  }

  return false;
}

export function calculateVineyardWeeklyProjection(
  vineyard: Vineyard,
  weatherContext: VineyardWeatherContext,
  options: VineyardWeeklyProjectionOptions = {}
): VineyardWeeklyProjection {
  const impact = calculateVineyardWeatherImpact(vineyard, weatherContext);
  const ripenessCurrent = vineyard.ripeness || 0;
  const healthCurrent = vineyard.vineyardHealth || 0;
  const plantingProgressRatio = options.plantingProgressRatio ?? 1;
  const healthDecayMultiplier = options.healthDecayMultiplier ?? 1;
  const ripenessGrowthActive = options.ripenessGrowthActive
    ?? isRipenessGrowthActiveForWeek(vineyard.status, weatherContext.season, weatherContext.week);

  let ripenessNormalDelta = 0;
  let ripenessWeatherDelta = 0;

  if (weatherContext.season === 'Winter' && ripenessCurrent > 0) {
    ripenessNormalDelta = calculateWeeklyBaselineRipenessDelta(
      vineyard,
      weatherContext.season,
      weatherContext.week,
      weatherContext.companyId,
      weatherContext.year,
      plantingProgressRatio
    );
  } else if (ripenessGrowthActive) {
    ripenessNormalDelta = calculateWeeklyBaselineRipenessDelta(
      vineyard,
      weatherContext.season,
      weatherContext.week,
      weatherContext.companyId,
      weatherContext.year,
      plantingProgressRatio
    );

    if (ripenessNormalDelta > 0) {
      ripenessWeatherDelta = impact.ripenessDelta;
    }
  }

  let ripenessTotalDelta = ripenessNormalDelta;
  if (ripenessNormalDelta > 0 && ripenessWeatherDelta !== 0) {
    const fallbackRipenessPressure = ripenessWeatherDelta / DEFAULT_WEATHER_PRESSURE_SCALE;
    const ripenessWeatherPressure = impact.ripenessWeatherPressure ?? fallbackRipenessPressure;
    const ripenessWeatherScaling = calculateWeatherScaledDelta(
      ripenessNormalDelta,
      ripenessWeatherPressure,
      MIN_RIPENESS_WEATHER_MULTIPLIER,
      MAX_RIPENESS_WEATHER_MULTIPLIER
    );
    ripenessTotalDelta = ripenessWeatherScaling.totalDelta;
    ripenessWeatherDelta = ripenessWeatherScaling.weatherContribution;
  }

  const healthNormalDelta = calculateWeeklyBaselineHealthDelta(
    vineyard,
    weatherContext.season,
    weatherContext.week,
    weatherContext.companyId,
    weatherContext.year,
    healthDecayMultiplier
  );
  const healthWeatherBaseDelta = impact.healthDelta;
  const fallbackHealthPressure = healthWeatherBaseDelta / DEFAULT_WEATHER_PRESSURE_SCALE;
  const healthWeatherPressure = impact.healthWeatherPressure ?? fallbackHealthPressure;
  const healthWeatherScaling = calculateWeatherScaledDelta(
    healthNormalDelta,
    healthWeatherPressure,
    MIN_HEALTH_WEATHER_MULTIPLIER,
    MAX_HEALTH_WEATHER_MULTIPLIER
  );
  const healthWeatherDelta = healthWeatherScaling.weatherContribution;
  const healthUnclampedTotalDelta = healthWeatherScaling.totalDelta;
  const healthTotalDelta = clamp(
    healthUnclampedTotalDelta,
    MIN_WEEKLY_HEALTH_DELTA,
    MAX_WEEKLY_HEALTH_DELTA
  );

  return {
    ripeness: {
      current: ripenessCurrent,
      normalDelta: ripenessNormalDelta,
      weatherDelta: ripenessWeatherDelta,
      totalDelta: ripenessTotalDelta,
      projected: clamp01(ripenessCurrent + ripenessTotalDelta),
    },
    health: {
      current: healthCurrent,
      normalDelta: healthNormalDelta,
      weatherDelta: healthWeatherDelta,
      totalDelta: healthTotalDelta,
      projected: clamp(healthCurrent + healthTotalDelta, MIN_VINEYARD_HEALTH, MAX_VINEYARD_HEALTH),
    },
    siteResponse: impact.siteResponse,
    reason: impact.reason,
    breakdown: impact.breakdown,
  };
}
