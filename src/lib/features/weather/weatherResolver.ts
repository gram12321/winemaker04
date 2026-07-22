import {
  WEATHER_FORECAST_CONFIDENCE_WEIGHTS,
  WEATHER_FORECAST_HIT_RATE,
  WEATHER_FORECAST_NEIGHBORS,
  WEATHER_FORECAST_PATTERN_BY_SEASON,
  WEATHER_INTENSITIES,
  WEATHER_INTENSITY_BY_STATE,
  WEATHER_STATE_BY_SEASON,
  type WeightedChoice,
} from '@/lib/constants/weatherConstants';
import { SEASON_ORDER, WEEKS_PER_SEASON } from '@/lib/constants/timeConstants';
import type { GameDate, GameState, Season, WeatherForecastConfidence, WeatherForecastPattern, WeatherIntensity, WeatherState } from '@/lib/types/types';
import type { ResolveWeatherWeekInput, WeatherWeekContext } from './weatherTypes';

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

export function getNextWeatherDate(date: GameDate): GameDate {
  if (date.week < WEEKS_PER_SEASON) {
    return { ...date, week: date.week + 1 };
  }

  const seasonIndex = SEASON_ORDER.indexOf(date.season);
  const nextSeason = SEASON_ORDER[(seasonIndex + 1) % SEASON_ORDER.length] as Season;
  return {
    year: nextSeason === 'Spring' ? date.year + 1 : date.year,
    season: nextSeason,
    week: 1,
  };
}

function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

function pickWeighted<T extends string>(seed: string, choices: ReadonlyArray<WeightedChoice<T>>): T {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = seededUnit(seed) * totalWeight;

  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) return choice.value;
  }

  return choices[choices.length - 1].value;
}

/** Resolve the persisted seasonal outlook that biases each week's weather. */
export function resolveSeasonalWeatherForecast(
  companyId: string,
  year: number,
  season: Season,
): { pattern: WeatherForecastPattern; confidence: WeatherForecastConfidence } {
  const seed = `${companyId}:${year}:${season}:seasonal-forecast`;
  return {
    pattern: pickWeighted(`${seed}:pattern`, WEATHER_FORECAST_PATTERN_BY_SEASON[season]),
    confidence: pickWeighted(`${seed}:confidence`, WEATHER_FORECAST_CONFIDENCE_WEIGHTS),
  };
}

function resolveActualWeather(
  input: ResolveWeatherWeekInput,
  date: GameDate,
  seasonalPattern: WeatherForecastPattern,
  previousState?: WeatherState,
): Pick<WeatherWeekContext, 'state' | 'intensity'> {
  const choices = WEATHER_STATE_BY_SEASON[date.season].map((choice) => ({
    ...choice,
    weight: choice.weight
      * (previousState === choice.value ? 1.16 : 1)
      * patternWeight(seasonalPattern, choice.value),
  }));
  const seed = `${input.companyId}:${date.year}:${date.season}:${date.week}`;
  const state = pickWeighted(`${seed}:state`, choices);
  const intensity = pickWeighted(`${seed}:${state}:intensity`, WEATHER_INTENSITY_BY_STATE[state]);

  return { state, intensity };
}

function patternWeight(pattern: ResolveWeatherWeekInput['seasonalPattern'], state: WeatherState): number {
  if (pattern === 'Wet' && (state === 'Rain' || state === 'Storm')) return 1.38;
  if (pattern === 'Dry' && (state === 'Clear' || state === 'Heat')) return 1.32;
  if (pattern === 'Cold' && (state === 'Frost' || state === 'Snow')) return 1.44;
  if (pattern === 'Heat' && state === 'Heat') return 1.55;
  if (pattern === 'Storm-prone' && state === 'Storm') return 1.62;
  if (pattern === 'Stable' && (state === 'Clear' || state === 'Rain')) return 1.12;
  return 1;
}

function resolveForecast(input: ResolveWeatherWeekInput, actualNext: Pick<WeatherWeekContext, 'state' | 'intensity'>): Pick<WeatherWeekContext['forecast'], 'state' | 'intensity'> {
  const seed = `${input.companyId}:${input.date.year}:${input.date.season}:${input.date.week}:forecast`;
  if (seededUnit(`${seed}:hit`) <= WEATHER_FORECAST_HIT_RATE[input.forecastConfidence]) {
    return actualNext;
  }

  if (seededUnit(`${seed}:intensity-drift`) <= 0.55) {
    const index = WEATHER_INTENSITIES.indexOf(actualNext.intensity);
    const direction = seededUnit(`${seed}:intensity-direction`) <= 0.5 ? -1 : 1;
    const intensity = WEATHER_INTENSITIES[Math.max(0, Math.min(WEATHER_INTENSITIES.length - 1, index + direction))] as WeatherIntensity;
    return { state: actualNext.state, intensity };
  }

  const state = pickWeighted(`${seed}:state-drift`, WEATHER_FORECAST_NEIGHBORS[actualNext.state].map((value) => ({ value, weight: 1 })));
  const intensity = pickWeighted(`${seed}:${state}:drift-intensity`, WEATHER_INTENSITY_BY_STATE[state]);
  return { state, intensity };
}

export function resolveWeatherWeek(input: ResolveWeatherWeekInput): WeatherWeekContext {
  const current = resolveActualWeather(input, input.date, input.seasonalPattern, input.previousState);
  const nextDate = getNextWeatherDate(input.date);
  const nextSeasonalForecast = nextDate.season === input.date.season
    ? { pattern: input.seasonalPattern, confidence: input.forecastConfidence }
    : resolveSeasonalWeatherForecast(input.companyId, nextDate.year, nextDate.season);
  const next = resolveActualWeather(input, nextDate, nextSeasonalForecast.pattern, current.state);
  const forecast = resolveForecast(input, next);

  return {
    date: input.date,
    ...current,
    seasonalPattern: input.seasonalPattern,
    forecast: { ...forecast, confidence: input.forecastConfidence },
  };
}
