import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  upsert: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/database/core/supabase', () => ({
  supabase: {
    from: database.from,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: () => 'weather-company',
}));

import { WEATHER_INTENSITIES, WEATHER_STATES } from '@/lib/constants/weatherConstants';
import { resolveWeatherWeek, type ResolveWeatherWeekInput } from '@/lib/features/weather';
import { loadGameState, saveGameState } from '@/lib/database/core/gamestateDB';

const input: ResolveWeatherWeekInput = {
  companyId: 'weather-company',
  date: { year: 2026, season: 'Summer', week: 3 },
  seasonalPattern: 'Dry',
  forecastConfidence: 'High',
  previousState: 'Clear',
};

describe('weather resolver', () => {
  it('resolves the same persisted weather context for the same weekly input', () => {
    expect(resolveWeatherWeek(input)).toEqual(resolveWeatherWeek(input));
  });

  it('can resolve every supported intensity tier', () => {
    const intensities = new Set(
      Array.from({ length: 1000 }, (_, week) => resolveWeatherWeek({
        ...input,
        date: { ...input.date, week: week + 1 },
      }).intensity)
    );

    expect([...intensities].sort()).toEqual([...WEATHER_INTENSITIES].sort());
  });

  it('can resolve every supported weather state', () => {
    const seasons = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
    const states = new Set(
      Array.from({ length: 1000 }, (_, week) => resolveWeatherWeek({
        ...input,
        date: { ...input.date, season: seasons[week % seasons.length], week: week + 1 },
      }).state)
    );

    expect([...states].sort()).toEqual([...WEATHER_STATES].sort());
  });

  it.each(['Low', 'Medium', 'High'] as const)('allows forecast hits and misses at %s confidence', (forecastConfidence) => {
    const results = Array.from({ length: 200 }, (_, week) => {
      const current = resolveWeatherWeek({
        ...input,
        date: { ...input.date, week: week + 1 },
        forecastConfidence,
      });
      const nextWeek = resolveWeatherWeek({
        ...input,
        date: { ...input.date, week: week + 2 },
        forecastConfidence,
        previousState: current.state,
      });

      return current.forecast.state === nextWeek.state
        && current.forecast.intensity === nextWeek.intensity;
    });

    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});

describe('game state weather persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.upsert.mockResolvedValue({ error: null });
    database.eq.mockResolvedValue({
      data: [{
        week: 3,
        season: 'Summer',
        current_year: 2026,
        money: 100,
        prestige: 4,
        economy_phase: 'Stable',
        weather_forecast_pattern: 'Dry',
        weather_forecast_confidence: 'High',
        weather_state: 'Heat',
        weather_intensity: 'Severe',
        next_week_forecast_state: 'Clear',
        next_week_forecast_intensity: 'Mild',
      }],
      error: null,
    });
    database.select.mockReturnValue({ eq: database.eq });
    database.from.mockReturnValue({
      upsert: database.upsert,
      select: database.select,
    });
  });

  it('round-trips all persisted weather fields through company-scoped game state', async () => {
    await saveGameState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      weatherForecastPattern: 'Dry',
      weatherForecastConfidence: 'High',
      weatherState: 'Heat',
      weatherIntensity: 'Severe',
      nextWeekForecastState: 'Clear',
      nextWeekForecastIntensity: 'Mild',
    });

    expect(database.from).toHaveBeenCalledWith('game_state');
    expect(database.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'weather-company',
      weather_forecast_pattern: 'Dry',
      weather_forecast_confidence: 'High',
      weather_state: 'Heat',
      weather_intensity: 'Severe',
      next_week_forecast_state: 'Clear',
      next_week_forecast_intensity: 'Mild',
    }));

    await expect(loadGameState()).resolves.toMatchObject({
      weatherForecastPattern: 'Dry',
      weatherForecastConfidence: 'High',
      weatherState: 'Heat',
      weatherIntensity: 'Severe',
      nextWeekForecastState: 'Clear',
      nextWeekForecastIntensity: 'Mild',
    });
  });
});
