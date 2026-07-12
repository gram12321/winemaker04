import { clamp } from '@/lib/utils';
import {
  WEATHER_ASPECT_EXPOSURE,
  WEATHER_ALTITUDE_EXPOSURE,
  WEATHER_SITE_EXPOSURE_BOUNDS,
  WEATHER_SITE_NOTE_THRESHOLDS,
  WEATHER_SOIL_RESPONSE_BOUNDS,
  WEATHER_SOIL_RESPONSE_KEYWORDS,
  WEATHER_SUITABILITY_EXPOSURE,
  WEATHER_VINEYARD_MULTIPLIERS,
} from '@/lib/constants/weatherConstants';
import {
  calculateWeeklyBaselineHealthDelta,
  calculateWeeklyBaselineRipenessDelta,
  isRipenessGrowthActiveForWeek,
} from '@/lib/services/vineyard/vineyardProgressionService';
import { calculateGrapeSuitabilityContribution } from '@/lib/services/vineyard/vineyardValueCalc';
import type {
  VineyardMetricProjection,
  VineyardWeekProjectionInput,
  VineyardWeeklyProjection,
} from './weatherTypes';

const MIN_VINEYARD_HEALTH = 0.1;
const MAX_VINEYARD_HEALTH = 1;

function calculateSoilResponse(soilTypes: readonly string[] | undefined): { waterRetention: number; thermalSwing: number } {
  if (!soilTypes?.length) return { waterRetention: 1, thermalSwing: 1 };

  const normalizedSoils = soilTypes.map((soil) => soil.toLowerCase());
  const countMatches = (keywords: readonly string[]) => normalizedSoils.reduce(
    (count, soil) => count + Number(keywords.some((keyword) => soil.includes(keyword))),
    0,
  );

  return {
    waterRetention: clamp(
      1 + (countMatches(WEATHER_SOIL_RESPONSE_KEYWORDS.highRetention) - countMatches(WEATHER_SOIL_RESPONSE_KEYWORDS.fastDrain)) * WEATHER_SOIL_RESPONSE_BOUNDS.step,
      WEATHER_SOIL_RESPONSE_BOUNDS.min,
      WEATHER_SOIL_RESPONSE_BOUNDS.max,
    ),
    thermalSwing: clamp(
      1 - (countMatches(WEATHER_SOIL_RESPONSE_KEYWORDS.highInertia) - countMatches(WEATHER_SOIL_RESPONSE_KEYWORDS.lowInertia)) * WEATHER_SOIL_RESPONSE_BOUNDS.step,
      WEATHER_SOIL_RESPONSE_BOUNDS.min,
      WEATHER_SOIL_RESPONSE_BOUNDS.max,
    ),
  };
}

function calculateSiteExposure(input: VineyardWeekProjectionInput): number {
  const { vineyard, weather } = input;
  const weatherState = weather.state;
  const aspectProfile = WEATHER_ASPECT_EXPOSURE[vineyard.aspect] ?? { heat: 0, cold: 0 };
  const coldWeather = weatherState === 'Frost' || weatherState === 'Snow';
  const heatWeather = weatherState === 'Heat';
  const aspectExposure = heatWeather
    ? 1 + aspectProfile.heat
    : coldWeather
      ? 1 + aspectProfile.cold
      : 1;
  const altitudeNormalized = clamp(
    (vineyard.altitude - WEATHER_ALTITUDE_EXPOSURE.reference) / WEATHER_ALTITUDE_EXPOSURE.range,
    -1,
    1,
  );
  const altitudeExposure = coldWeather
    ? 1 + altitudeNormalized * WEATHER_ALTITUDE_EXPOSURE.adjustment
    : heatWeather
      ? 1 - altitudeNormalized * WEATHER_ALTITUDE_EXPOSURE.adjustment
      : 1;
  const suitabilityExposure = vineyard.grape
    ? clamp(1 + (WEATHER_SUITABILITY_EXPOSURE.neutral - calculateGrapeSuitabilityContribution(
      vineyard.grape,
      vineyard.region,
      vineyard.country,
      vineyard.altitude,
      vineyard.aspect,
      vineyard.soil,
    )) * WEATHER_SUITABILITY_EXPOSURE.adjustment, WEATHER_SUITABILITY_EXPOSURE.min, WEATHER_SUITABILITY_EXPOSURE.max)
    : 1;
  const soilResponse = calculateSoilResponse(vineyard.soil);
  const soilExposure = weatherState === 'Rain' || weatherState === 'Snow'
    ? soilResponse.waterRetention
    : coldWeather || heatWeather
      ? soilResponse.thermalSwing
      : 1;

  return clamp(aspectExposure * altitudeExposure * suitabilityExposure * soilExposure, WEATHER_SITE_EXPOSURE_BOUNDS.min, WEATHER_SITE_EXPOSURE_BOUNDS.max);
}

function buildMetricProjection(current: number, normalDelta: number, baseMultiplier: number, siteExposure: number, min: number, max: number): VineyardMetricProjection {
  if (normalDelta === 0) {
    return { current, normalDelta, weatherContribution: 0, finalDelta: 0, projected: clamp(current, min, max) };
  }

  const effectiveMultiplier = 1 + (baseMultiplier - 1) * siteExposure;
  const finalDelta = normalDelta * effectiveMultiplier;
  return {
    current,
    normalDelta,
    weatherContribution: finalDelta - normalDelta,
    finalDelta,
    projected: clamp(current + finalDelta, min, max),
  };
}

function getSiteNote(siteExposure: number): string {
  if (siteExposure > WEATHER_SITE_NOTE_THRESHOLDS.amplified) return 'Site amplifies this weather.';
  if (siteExposure < WEATHER_SITE_NOTE_THRESHOLDS.buffered) return 'Site buffers this weather.';
  return 'Site exposure is neutral.';
}

export function projectVineyardWeek(input: VineyardWeekProjectionInput): VineyardWeeklyProjection {
  const { vineyard, weather } = input;
  const plantingProgressRatio = input.plantingProgressRatio ?? 1;
  const healthDecayMultiplier = input.healthDecayMultiplier ?? 1;
  const ripenessCurrent = vineyard.ripeness ?? 0;
  const healthCurrent = vineyard.vineyardHealth ?? 0;
  const ripenessGrowthActive = input.ripenessGrowthActive
    ?? isRipenessGrowthActiveForWeek(vineyard.status, weather.date.season, weather.date.week);
  const ripenessNormalDelta = weather.date.season === 'Winter' || ripenessGrowthActive
    ? calculateWeeklyBaselineRipenessDelta(
      vineyard,
      weather.date.season,
      weather.date.week,
      input.companyId,
      weather.date.year,
      plantingProgressRatio,
    )
    : 0;
  const healthNormalDelta = calculateWeeklyBaselineHealthDelta(
    vineyard,
    weather.date.season,
    weather.date.week,
    input.companyId,
    weather.date.year,
    healthDecayMultiplier,
  );
  const siteExposure = calculateSiteExposure(input);

  return {
    ripeness: buildMetricProjection(
      ripenessCurrent,
      ripenessNormalDelta,
      WEATHER_VINEYARD_MULTIPLIERS.ripeness[weather.state][weather.intensity],
      siteExposure,
      0,
      1,
    ),
    health: buildMetricProjection(
      healthCurrent,
      healthNormalDelta,
      WEATHER_VINEYARD_MULTIPLIERS.health[weather.state][weather.intensity],
      siteExposure,
      MIN_VINEYARD_HEALTH,
      MAX_VINEYARD_HEALTH,
    ),
    siteExposure,
    siteNote: getSiteNote(siteExposure),
  };
}
