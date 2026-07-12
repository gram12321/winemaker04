import {
  WEATHER_FORECAST_HIT_RATE,
  WEATHER_INTENSITIES,
  WEATHER_SITE_EXPOSURE_BOUNDS,
  WEATHER_STATES,
  WEATHER_VINEYARD_MULTIPLIERS,
} from '@/lib/constants/weatherConstants';
import type { GameState, Vineyard, WeatherIntensity, WeatherState } from '@/lib/types/types';
import { getWeatherMarketContext, WEATHER_INTENSITY_MARKET_MULTIPLIER, WEATHER_MARKET_PRESSURE } from './weatherMarketService';
import type { VineyardMetricProjection, VineyardWeeklyProjection, WeatherWeekContext } from './weatherTypes';
import { projectVineyardWeek } from './weatherVineyardService';

const WEATHER_ICONS: Record<WeatherState, string> = {
  Clear: '☀️', Rain: '🌧️', Heat: '🌡️', Frost: '🧊', Storm: '⛈️', Snow: '❄️',
};

export interface WeatherConditionPresentation {
  label: string;
  icon: string;
  description: string;
  confidence?: string;
}

export interface VineyardWeatherMetricPresentation {
  current: number;
  normalChange: number;
  weatherContribution: number;
  projected: number;
}

export interface VineyardWeatherRowPresentation {
  id: string;
  name: string;
  status: string;
  siteNote: string;
  explanation: string;
  ripeness: VineyardWeatherMetricPresentation;
  health: VineyardWeatherMetricPresentation;
}

export interface WeatherCenterPresentation {
  currentWeather: WeatherConditionPresentation;
  forecast: WeatherConditionPresentation;
  seasonalOutlook: string;
  outlooks: Array<{ label: string; detail: string }>;
  rows: VineyardWeatherRowPresentation[];
}

export interface VineyardWeatherTooltipPresentation {
  label: string;
  weather: string;
  siteNote: string;
  ripeness: VineyardWeatherMetricPresentation;
  health: VineyardWeatherMetricPresentation;
}

export function getWeatherIcon(state: WeatherState): string {
  return WEATHER_ICONS[state];
}

export function getWeatherLabel(state: WeatherState, intensity: WeatherIntensity): string {
  return `${state} (${intensity})`;
}

export function createWeatherWeekContext(gameState: Partial<GameState>): WeatherWeekContext {
  const state = gameState.weatherState ?? 'Clear';
  const intensity = gameState.weatherIntensity ?? 'Mild';
  return {
    date: {
      year: gameState.currentYear ?? 2024,
      season: gameState.season ?? 'Spring',
      week: gameState.week ?? 1,
    },
    state,
    intensity,
    seasonalPattern: gameState.weatherForecastPattern ?? 'Stable',
    forecast: {
      state: gameState.nextWeekForecastState ?? state,
      intensity: gameState.nextWeekForecastIntensity ?? intensity,
      confidence: gameState.weatherForecastConfidence ?? 'Medium',
    },
  };
}

function toMetricPresentation(metric: VineyardMetricProjection): VineyardWeatherMetricPresentation {
  return {
    current: metric.current,
    normalChange: metric.normalDelta,
    weatherContribution: metric.weatherContribution,
    projected: metric.projected,
  };
}

function toRow(vineyard: Vineyard, projection: VineyardWeeklyProjection): VineyardWeatherRowPresentation {
  return {
    id: vineyard.id,
    name: vineyard.name,
    status: vineyard.status,
    siteNote: projection.siteNote,
    explanation: `Normal weekly vineyard progression is adjusted by the forecast. ${projection.siteNote}`,
    ripeness: toMetricPresentation(projection.ripeness),
    health: toMetricPresentation(projection.health),
  };
}

function direction(value: number, positive: string, negative: string): string {
  if (value > 0.0001) return positive;
  if (value < -0.0001) return negative;
  return 'stays close to its normal weekly path';
}

function buildOutlooks(weather: WeatherWeekContext): WeatherCenterPresentation['outlooks'] {
  const forecastProjection = {
    ripeness: WEATHER_VINEYARD_MULTIPLIERS.ripeness[weather.forecast.state][weather.forecast.intensity] - 1,
    health: WEATHER_VINEYARD_MULTIPLIERS.health[weather.forecast.state][weather.forecast.intensity] - 1,
  };
  const market = getWeatherMarketContext({ ...weather, state: weather.forecast.state, intensity: weather.forecast.intensity });
  return [
    { label: 'Ripening outlook', detail: `Next week ${direction(forecastProjection.ripeness, 'accelerates ripening', 'slows ripening')}.` },
    { label: 'Vine-health outlook', detail: `Next week ${direction(-forecastProjection.health, 'adds vine stress', 'eases normal vine stress')}.` },
    { label: 'Grape-market outlook', detail: market.reason },
  ];
}

export function buildWeatherCenterPresentation(input: { companyId: string; weather: WeatherWeekContext; vineyards: Vineyard[] }): WeatherCenterPresentation {
  const rows = input.vineyards
    .filter((vineyard) => vineyard.grape)
    .map((vineyard) => toRow(vineyard, projectVineyardWeek({ companyId: input.companyId, vineyard, weather: { ...input.weather, state: input.weather.forecast.state, intensity: input.weather.forecast.intensity } })))
    .sort((left, right) => (left.health.weatherContribution + left.ripeness.weatherContribution) - (right.health.weatherContribution + right.ripeness.weatherContribution));

  return {
    currentWeather: {
      label: 'Current weather', icon: getWeatherIcon(input.weather.state),
      description: getWeatherLabel(input.weather.state, input.weather.intensity),
    },
    forecast: {
      label: 'Next-week forecast', icon: getWeatherIcon(input.weather.forecast.state),
      description: getWeatherLabel(input.weather.forecast.state, input.weather.forecast.intensity),
      confidence: input.weather.forecast.confidence,
    },
    seasonalOutlook: `${input.weather.seasonalPattern} seasonal outlook`,
    outlooks: buildOutlooks(input.weather),
    rows,
  };
}

export function buildVineyardWeatherTooltip(input: { companyId: string; vineyard: Vineyard; weather: WeatherWeekContext }): VineyardWeatherTooltipPresentation {
  const forecastWeather = { ...input.weather, state: input.weather.forecast.state, intensity: input.weather.forecast.intensity };
  const projection = projectVineyardWeek({ companyId: input.companyId, vineyard: input.vineyard, weather: forecastWeather });
  return {
    label: 'Next-week forecast',
    weather: getWeatherLabel(forecastWeather.state, forecastWeather.intensity),
    siteNote: projection.siteNote,
    ripeness: toMetricPresentation(projection.ripeness),
    health: toMetricPresentation(projection.health),
  };
}

export function buildWeatherReference() {
  return {
    formula: 'final weekly change = normal seasonal change × weather multiplier; weather contribution = final weekly change − normal seasonal change.',
    vineyardMatrix: WEATHER_STATES.map((state) => ({
      state,
      intensities: WEATHER_INTENSITIES.map((intensity) => ({
        intensity,
        ripenessMultiplier: WEATHER_VINEYARD_MULTIPLIERS.ripeness[state][intensity],
        healthMultiplier: WEATHER_VINEYARD_MULTIPLIERS.health[state][intensity],
      })),
    })),
    marketMatrix: WEATHER_STATES.map((state) => ({
      state,
      intensities: WEATHER_INTENSITIES.map((intensity) => ({
        intensity,
        priceMultiplier: WEATHER_MARKET_PRESSURE[state].price * WEATHER_INTENSITY_MARKET_MULTIPLIER[intensity],
        supplyMultiplier: WEATHER_MARKET_PRESSURE[state].supply * WEATHER_INTENSITY_MARKET_MULTIPLIER[intensity],
      })),
    })),
    siteRules: `Site exposure combines aspect, altitude, grape suitability, and soil response, bounded from ${WEATHER_SITE_EXPOSURE_BOUNDS.min} to ${WEATHER_SITE_EXPOSURE_BOUNDS.max}.`,
    forecastBehavior: `Week-ahead forecasts are labeled with their confidence. Typical hit rates are High ${WEATHER_FORECAST_HIT_RATE.High * 100}%, Medium ${WEATHER_FORECAST_HIT_RATE.Medium * 100}%, and Low ${WEATHER_FORECAST_HIT_RATE.Low * 100}%.`,
    scope: 'Weather modifies weekly vineyard ripeness and health and grape-market volatility. It does not currently create events, actions, research, or direct wine-score effects.',
  };
}
