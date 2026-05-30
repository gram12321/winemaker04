import { type Season, type Vineyard, type WeatherIntensity, type WeatherState } from '@/lib/types/types';
import { clamp } from '@/lib/utils';
import { calculateGrapeSuitabilityContribution } from './vineyardValueCalc';

export interface VineyardWeatherContext {
  companyId: string;
  year: number;
  season: Season;
  week: number;
  weatherState?: WeatherState;
  weatherIntensity?: WeatherIntensity;
}

export interface VineyardWeatherImpact {
  ripenessDelta: number;
  healthDelta: number;
  ripenessWeatherPressure: number;
  healthWeatherPressure: number;
  siteResponse: number;
  reason: string;
  breakdown: VineyardWeatherImpactBreakdown;
}

export interface VineyardWeatherImpactBreakdown {
  weatherState: WeatherState;
  weatherIntensity: WeatherIntensity;
  weatherStateFactorRipeness: number;
  weatherStateFactorHealth: number;
  weatherIntensityFactor: number;
  ripenessWeatherPressureRaw: number;
  healthWeatherPressureRaw: number;
  ripenessWeatherPressure: number;
  healthWeatherPressure: number;
  baseRipenessDeviation: number;
  baseHealthDeviation: number;
  adjustedBaseHealthDeviation: number;
  seasonAdjustmentMultiplier: number;
  aspectResponse: number;
  altitudeResponse: number;
  terroirResponse: number;
  soilResponse: number;
  soilResponseSource: 'waterRetention' | 'thermalSwing' | 'neutral';
  siteResponseRaw: number;
  siteResponseClamped: boolean;
  ripenessRawDelta: number;
  ripenessClamped: boolean;
  healthRawDelta: number;
  healthClamped: boolean;
}
export const WEATHER_STATE_FACTOR_BY_STATE: Record<WeatherState, { ripeness: number; health: number }> = {
  Clear: { ripeness: 0.16, health: 0.2 },
  Rain: { ripeness: 0.06, health: 0.16 },
  Heat: { ripeness: 0.44, health: -0.32 },
  Frost: { ripeness: -0.64, health: -0.44 },
  Storm: { ripeness: -0.48, health: -0.56 },
  Snow: { ripeness: -0.36, health: -0.36 },
};

export const WEATHER_INTENSITY_FACTOR: Record<WeatherIntensity, number> = {
  VeryMild: 0.6,
  Mild: 0.8,
  Moderate: 1.0,
  Severe: 1.8,
  Extreme: 2.4,
};

const WEATHER_DEVIATION_REFERENCE_SCALE = 0.01;

function buildWeatherDeviationTables(
  metric: 'ripeness' | 'health'
): Record<WeatherState, Record<WeatherIntensity, number>> {
  const table: Record<WeatherState, Record<WeatherIntensity, number>> = {
    Clear: { VeryMild: 0, Mild: 0, Moderate: 0, Severe: 0, Extreme: 0 },
    Rain: { VeryMild: 0, Mild: 0, Moderate: 0, Severe: 0, Extreme: 0 },
    Heat: { VeryMild: 0, Mild: 0, Moderate: 0, Severe: 0, Extreme: 0 },
    Frost: { VeryMild: 0, Mild: 0, Moderate: 0, Severe: 0, Extreme: 0 },
    Storm: { VeryMild: 0, Mild: 0, Moderate: 0, Severe: 0, Extreme: 0 },
    Snow: { VeryMild: 0, Mild: 0, Moderate: 0, Severe: 0, Extreme: 0 },
  };

  for (const state of Object.keys(WEATHER_STATE_FACTOR_BY_STATE) as WeatherState[]) {
    for (const intensity of Object.keys(WEATHER_INTENSITY_FACTOR) as WeatherIntensity[]) {
      const stateFactor = WEATHER_STATE_FACTOR_BY_STATE[state][metric];
      const intensityFactor = WEATHER_INTENSITY_FACTOR[intensity];
      table[state][intensity] = stateFactor * intensityFactor * WEATHER_DEVIATION_REFERENCE_SCALE;
    }
  }

  return table;
}

export const WEATHER_RIPENESS_DEVIATION_BY_STATE_INTENSITY = buildWeatherDeviationTables('ripeness');
export const WEATHER_HEALTH_DEVIATION_BY_STATE_INTENSITY = buildWeatherDeviationTables('health');

const ASPECT_WEATHER_RESPONSE: Record<string, { heat: number; cold: number }> = {
  North: { heat: -0.08, cold: 0.1 },
  Northeast: { heat: -0.05, cold: 0.08 },
  East: { heat: -0.02, cold: 0.02 },
  Southeast: { heat: 0.05, cold: -0.05 },
  South: { heat: 0.08, cold: -0.08 },
  Southwest: { heat: 0.05, cold: -0.05 },
  West: { heat: -0.02, cold: 0.02 },
  Northwest: { heat: -0.05, cold: 0.08 },
};

const SOIL_CLASS_BY_KEYWORD = {
  highRetention: ['clay', 'marl', 'barros'],
  fastDrain: ['sand', 'gravel', 'arenas', 'schist', 'slate'],
  highInertia: ['clay', 'limestone', 'chalk', 'marl'],
  lowInertia: ['sand', 'gravel', 'slate', 'schist'],
} as const;

function classifySoilResponse(soilTypes: readonly string[] | undefined): { waterRetention: number; thermalSwing: number } {
  if (!soilTypes || soilTypes.length === 0) {
    return { waterRetention: 1, thermalSwing: 1 };
  }

  const normalized = soilTypes.map((soil) => soil.toLowerCase());

  const countMatches = (keywords: readonly string[]) => normalized.reduce((count, soil) => {
    return keywords.some((keyword) => soil.includes(keyword)) ? count + 1 : count;
  }, 0);

  const retentionScore = countMatches(SOIL_CLASS_BY_KEYWORD.highRetention) - countMatches(SOIL_CLASS_BY_KEYWORD.fastDrain);
  const inertiaScore = countMatches(SOIL_CLASS_BY_KEYWORD.highInertia) - countMatches(SOIL_CLASS_BY_KEYWORD.lowInertia);

  const waterRetention = clamp(1 + retentionScore * 0.03, 0.85, 1.15);
  const thermalSwing = clamp(1 - inertiaScore * 0.03, 0.85, 1.15);

  return { waterRetention, thermalSwing };
}

function getAltitudeWeatherResponse(altitude: number, weatherState: WeatherState): number {
  const normalized = clamp((altitude - 300) / 700, -1, 1);
  if (weatherState === 'Frost' || weatherState === 'Snow') {
    return clamp(1 + normalized * 0.08, 0.9, 1.1);
  }
  if (weatherState === 'Heat') {
    return clamp(1 - normalized * 0.08, 0.9, 1.1);
  }
  return 1;
}

function getAspectWeatherResponse(vineyard: Vineyard, weatherState: WeatherState): number {
  const profile = ASPECT_WEATHER_RESPONSE[vineyard.aspect] || { heat: 0, cold: 0 };
  if (weatherState === 'Heat') {
    return clamp(1 + profile.heat, 0.85, 1.15);
  }
  if (weatherState === 'Frost' || weatherState === 'Snow') {
    return clamp(1 + profile.cold, 0.85, 1.15);
  }
  return 1;
}

function getTerroirResponse(vineyard: Vineyard): number {
  if (!vineyard.grape) {
    return 1;
  }

  const suitability = calculateGrapeSuitabilityContribution(
    vineyard.grape,
    vineyard.region,
    vineyard.country,
    vineyard.altitude,
    vineyard.aspect,
    vineyard.soil,
  );

  return clamp(1 + (0.5 - suitability) * 0.2, 0.9, 1.1);
}

function getWeatherState(context: VineyardWeatherContext): WeatherState {
  return context.weatherState || 'Clear';
}

function getWeatherIntensity(context: VineyardWeatherContext): WeatherIntensity {
  return context.weatherIntensity || 'Moderate';
}

function getWeatherReason(weatherState: WeatherState, weatherIntensity: WeatherIntensity, siteResponse: number): string {
  const pressure = siteResponse > 1.03
    ? 'site amplified impact'
    : siteResponse < 0.97
      ? 'site buffered impact'
      : 'site-neutral impact';

  return `${weatherState} (${weatherIntensity}) with ${pressure}`;
}

export function calculateVineyardWeatherImpact(vineyard: Vineyard, context: VineyardWeatherContext): VineyardWeatherImpact {
  const weatherState = getWeatherState(context);
  const weatherIntensity = getWeatherIntensity(context);

  const weatherStateFactor = WEATHER_STATE_FACTOR_BY_STATE[weatherState];
  const weatherIntensityFactor = WEATHER_INTENSITY_FACTOR[weatherIntensity];

  const baseRipenessDeviation = weatherStateFactor.ripeness * weatherIntensityFactor * WEATHER_DEVIATION_REFERENCE_SCALE;
  const baseHealthDeviation = weatherStateFactor.health * weatherIntensityFactor * WEATHER_DEVIATION_REFERENCE_SCALE;
  const seasonAdjustmentMultiplier = weatherState === 'Snow' && context.season === 'Winter' ? 0.6 : 1;
  const adjustedBaseHealthDeviation = baseHealthDeviation * seasonAdjustmentMultiplier;

  // Snow is less punishing in winter dormancy windows.
  const aspectResponse = getAspectWeatherResponse(vineyard, weatherState);
  const altitudeResponse = getAltitudeWeatherResponse(vineyard.altitude, weatherState);
  const terroirResponse = getTerroirResponse(vineyard);
  const soilResponse = classifySoilResponse(vineyard.soil);

  let soilWeatherResponse = 1;
  let soilResponseSource: VineyardWeatherImpactBreakdown['soilResponseSource'] = 'neutral';
  if (weatherState === 'Rain' || weatherState === 'Snow') {
    soilWeatherResponse = soilResponse.waterRetention;
    soilResponseSource = 'waterRetention';
  } else if (weatherState === 'Heat' || weatherState === 'Frost') {
    soilWeatherResponse = soilResponse.thermalSwing;
    soilResponseSource = 'thermalSwing';
  }

  const siteResponseRaw = aspectResponse * altitudeResponse * terroirResponse * soilWeatherResponse;
  const siteResponse = clamp(siteResponseRaw, 0.7, 1.3);
  const siteResponseClamped = siteResponse !== siteResponseRaw;

  const ripenessWeatherPressureRaw = weatherStateFactor.ripeness * weatherIntensityFactor * siteResponse;
  const healthWeatherPressureRaw = weatherStateFactor.health * weatherIntensityFactor * seasonAdjustmentMultiplier * siteResponse;
  const ripenessWeatherPressure = ripenessWeatherPressureRaw;
  const healthWeatherPressure = healthWeatherPressureRaw;

  const ripenessRawDelta = baseRipenessDeviation * siteResponse;
  const healthRawDelta = adjustedBaseHealthDeviation * siteResponse;
  const ripenessDelta = clamp(ripenessRawDelta, -0.01, 0.01);
  const healthDelta = clamp(healthRawDelta, -0.012, 0.004);
  const ripenessClamped = ripenessDelta !== ripenessRawDelta;
  const healthClamped = healthDelta !== healthRawDelta;

  return {
    ripenessDelta,
    healthDelta,
    ripenessWeatherPressure,
    healthWeatherPressure,
    siteResponse,
    reason: getWeatherReason(weatherState, weatherIntensity, siteResponse),
    breakdown: {
      weatherState,
      weatherIntensity,
      weatherStateFactorRipeness: weatherStateFactor.ripeness,
      weatherStateFactorHealth: weatherStateFactor.health,
      weatherIntensityFactor,
      ripenessWeatherPressureRaw,
      healthWeatherPressureRaw,
      ripenessWeatherPressure,
      healthWeatherPressure,
      baseRipenessDeviation,
      baseHealthDeviation,
      adjustedBaseHealthDeviation,
      seasonAdjustmentMultiplier,
      aspectResponse,
      altitudeResponse,
      terroirResponse,
      soilResponse: soilWeatherResponse,
      soilResponseSource,
      siteResponseRaw,
      siteResponseClamped,
      ripenessRawDelta,
      ripenessClamped,
      healthRawDelta,
      healthClamped,
    },
  };
}
