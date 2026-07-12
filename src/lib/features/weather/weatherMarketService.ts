import {
  WEATHER_INTENSITY_MARKET_MULTIPLIER,
  WEATHER_MARKET_MULTIPLIER_BOUNDS,
  WEATHER_MARKET_PRESSURE,
  WEATHER_MARKET_THEME,
} from '@/lib/constants/weatherConstants';
import { clamp } from '@/lib/utils';
import type { WeatherMarketContext, WeatherWeekContext } from './weatherTypes';

export function getWeatherMarketContext(weather: WeatherWeekContext): WeatherMarketContext {
  const pressure = WEATHER_MARKET_PRESSURE[weather.state];
  const intensityMultiplier = WEATHER_INTENSITY_MARKET_MULTIPLIER[weather.intensity];

  return {
    state: weather.state,
    intensity: weather.intensity,
    priceMultiplier: clamp(pressure.price * intensityMultiplier, WEATHER_MARKET_MULTIPLIER_BOUNDS.price.min, WEATHER_MARKET_MULTIPLIER_BOUNDS.price.max),
    supplyMultiplier: clamp(pressure.supply * intensityMultiplier, WEATHER_MARKET_MULTIPLIER_BOUNDS.supply.min, WEATHER_MARKET_MULTIPLIER_BOUNDS.supply.max),
    reason: `${WEATHER_MARKET_THEME[weather.state]} Intensity is ${weather.intensity.toLowerCase()}.`,
  };
}
