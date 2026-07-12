import { WEATHER_OPERATION_LIMITS } from '@/lib/constants/weatherConstants';
import type {
  ResolveWeatherOperationImpactInput,
  WeatherOperationImpact,
} from './weatherTypes';

export function resolveWeatherOperationImpact({
  weather,
  operation,
  season,
}: ResolveWeatherOperationImpactInput): WeatherOperationImpact {
  if (operation === 'planting' && WEATHER_OPERATION_LIMITS.plantingUnavailableSeasons.includes(season)) {
    return {
      allowed: false,
      workMultiplier: 0,
      paused: false,
      severity: 'blocked',
      reason: 'Planting is unavailable in Winter.',
    };
  }

  if (weather.intensity === 'Extreme' && WEATHER_OPERATION_LIMITS.forcedPauseStates.includes(weather.state)) {
    return {
      allowed: true,
      workMultiplier: 0,
      paused: true,
      severity: 'paused',
      reason: `Extreme ${weather.state} pauses outdoor work this week.`,
    };
  }

  if (weather.intensity === 'Severe' || weather.intensity === 'Extreme') {
    const workMultiplier = weather.intensity === 'Severe'
      ? WEATHER_OPERATION_LIMITS.severeWorkMultiplier
      : WEATHER_OPERATION_LIMITS.extremeWorkMultiplier;

    return {
      allowed: true,
      workMultiplier,
      paused: false,
      severity: 'slowed',
      reason: `${weather.intensity} ${weather.state} slows outdoor work.`,
    };
  }

  return {
    allowed: true,
    workMultiplier: WEATHER_OPERATION_LIMITS.normalWorkMultiplier,
    paused: false,
    severity: 'normal',
    reason: `Conditions allow normal ${operation} work.`,
  };
}
