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

function getSiteSummary(input: VineyardWeekProjectionInput): string {
  const soil = input.vineyard.soil?.length ? input.vineyard.soil.join(', ') : 'unspecified soil';
  return `${input.vineyard.aspect}-facing • ${input.vineyard.altitude}m elevation • ${soil}`;
}

function getWeatherSiteDetails(input: VineyardWeekProjectionInput): string[] {
  const { vineyard, weather } = input;
  const details: string[] = [];
  const coldWeather = weather.state === 'Frost' || weather.state === 'Snow';
  const heatWeather = weather.state === 'Heat';
  const warmAspects = ['South', 'Southeast', 'Southwest'];
  const coolAspects = ['North', 'Northeast', 'Northwest'];

  if (heatWeather && warmAspects.includes(vineyard.aspect)) {
    details.push(`${vineyard.aspect}-facing exposure increases heat impact.`);
  } else if (heatWeather && coolAspects.includes(vineyard.aspect)) {
    details.push(`${vineyard.aspect}-facing exposure helps reduce heat impact.`);
  } else if (coldWeather && coolAspects.includes(vineyard.aspect)) {
    details.push(`${vineyard.aspect}-facing exposure increases cold impact.`);
  } else if (coldWeather && warmAspects.includes(vineyard.aspect)) {
    details.push(`${vineyard.aspect}-facing exposure helps reduce cold impact.`);
  }

  if (heatWeather || coldWeather) {
    if (vineyard.altitude >= WEATHER_ALTITUDE_EXPOSURE.reference + WEATHER_ALTITUDE_EXPOSURE.range * 0.35) {
      details.push(heatWeather ? 'Higher elevation provides some cooling.' : 'Higher elevation increases cold exposure.');
    } else if (vineyard.altitude <= WEATHER_ALTITUDE_EXPOSURE.reference - WEATHER_ALTITUDE_EXPOSURE.range * 0.35) {
      details.push(heatWeather ? 'Lower elevation increases heat exposure.' : 'Lower elevation provides some cold protection.');
    }
  }

  const soils = vineyard.soil?.map((soil) => soil.toLowerCase()) ?? [];
  const hasHighRetention = soils.some((soil) => WEATHER_SOIL_RESPONSE_KEYWORDS.highRetention.some((keyword) => soil.includes(keyword)));
  const hasFastDrain = soils.some((soil) => WEATHER_SOIL_RESPONSE_KEYWORDS.fastDrain.some((keyword) => soil.includes(keyword)));
  const hasHighInertia = soils.some((soil) => WEATHER_SOIL_RESPONSE_KEYWORDS.highInertia.some((keyword) => soil.includes(keyword)));
  const hasLowInertia = soils.some((soil) => WEATHER_SOIL_RESPONSE_KEYWORDS.lowInertia.some((keyword) => soil.includes(keyword)));

  if (weather.state === 'Rain' || weather.state === 'Snow') {
    if (hasHighRetention) details.push('Water-retentive soil increases wet-weather exposure.');
    else if (hasFastDrain) details.push('Free-draining soil helps reduce wet-weather exposure.');
  } else if (heatWeather || weather.state === 'Frost') {
    if (hasHighInertia) details.push('Dense soil helps moderate temperature swings.');
    else if (hasLowInertia) details.push('Fast-warming soil increases temperature swings.');
  }

  return details;
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
    siteSummary: getSiteSummary(input),
    siteNote: [getSiteNote(siteExposure), ...getWeatherSiteDetails(input)].join(' '),
  };
}
