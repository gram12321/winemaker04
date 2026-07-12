import { describe, expect, it } from 'vitest';
import { WEATHER_INTENSITIES, WEATHER_STATES } from '@/lib/constants/weatherConstants';
import { getWeatherMarketContext, type WeatherWeekContext } from '@/lib/features/weather';

function weather(state: WeatherWeekContext['state'], intensity: WeatherWeekContext['intensity']): WeatherWeekContext {
  return {
    date: { year: 2026, season: 'Summer', week: 3 },
    state,
    intensity,
    seasonalPattern: 'Stable',
    forecast: { state: 'Clear', intensity: 'Moderate', confidence: 'High' },
  };
}

describe('weather market service', () => {
  it.each(WEATHER_STATES.flatMap((state) => WEATHER_INTENSITIES.map((intensity) => [state, intensity] as const)))
  ('provides bounded market multipliers and a reason for %s at %s intensity', (state, intensity) => {
    const context = getWeatherMarketContext(weather(state, intensity));

    expect(context).toMatchObject({ state, intensity });
    expect(context.priceMultiplier).toBeGreaterThanOrEqual(0.7);
    expect(context.priceMultiplier).toBeLessThanOrEqual(1.35);
    expect(context.supplyMultiplier).toBeGreaterThanOrEqual(0.65);
    expect(context.supplyMultiplier).toBeLessThanOrEqual(1.45);
    expect(context.reason).toContain('Intensity is');
  });
});
