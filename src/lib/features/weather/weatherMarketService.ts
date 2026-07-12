import type { WeatherIntensity, WeatherState } from '@/lib/types/types';
import type { WeatherWeekContext } from './weatherTypes';

export interface WeatherMarketContext {
  state: WeatherState;
  intensity: WeatherIntensity;
  priceMultiplier: number;
  supplyMultiplier: number;
  reason: string;
}

export const WEATHER_MARKET_PRESSURE: Record<WeatherState, { price: number; supply: number }> = {
  Clear: { price: 1, supply: 1 },
  Rain: { price: 1.04, supply: 1.06 },
  Heat: { price: 1.07, supply: 1.11 },
  Frost: { price: 1.09, supply: 1.14 },
  Storm: { price: 1.13, supply: 1.2 },
  Snow: { price: 1.1, supply: 1.17 },
};

export const WEATHER_INTENSITY_MARKET_MULTIPLIER: Record<WeatherIntensity, number> = {
  VeryMild: 0.92,
  Mild: 0.96,
  Moderate: 1,
  Severe: 1.08,
  Extreme: 1.16,
};

const WEATHER_MARKET_THEME: Record<WeatherState, string> = {
  Clear: 'Stable weather keeps logistics predictable this week.',
  Rain: 'Rainfall variability introduces moderate logistics friction.',
  Heat: 'Heat pressure increases handling and spoilage risk.',
  Frost: 'Frost risk tightens procurement timing and flexibility.',
  Storm: 'Storm disruptions create sharp short-term buying uncertainty.',
  Snow: 'Snowy transport constraints amplify delivery uncertainty.',
};

const MIN_PRICE_MULTIPLIER = 0.7;
const MAX_PRICE_MULTIPLIER = 1.35;
const MIN_SUPPLY_MULTIPLIER = 0.65;
const MAX_SUPPLY_MULTIPLIER = 1.45;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getWeatherMarketContext(weather: WeatherWeekContext): WeatherMarketContext {
  const pressure = WEATHER_MARKET_PRESSURE[weather.state];
  const intensityMultiplier = WEATHER_INTENSITY_MARKET_MULTIPLIER[weather.intensity];

  return {
    state: weather.state,
    intensity: weather.intensity,
    priceMultiplier: clamp(pressure.price * intensityMultiplier, MIN_PRICE_MULTIPLIER, MAX_PRICE_MULTIPLIER),
    supplyMultiplier: clamp(pressure.supply * intensityMultiplier, MIN_SUPPLY_MULTIPLIER, MAX_SUPPLY_MULTIPLIER),
    reason: `${WEATHER_MARKET_THEME[weather.state]} Intensity is ${weather.intensity.toLowerCase()}.`,
  };
}
