import {
  type Season,
  type WeatherForecastConfidence,
  type WeatherForecastPattern,
  type WeatherIntensity,
  type WeatherState,
} from '@/lib/types/types';

type WeightedChoice<T extends string> = { value: T; weight: number };

type WeeklyWeatherBundle = {
  currentState: WeatherState;
  currentIntensity: WeatherIntensity;
  nextForecastState: WeatherState;
  nextForecastIntensity: WeatherIntensity;
};

const FORECAST_CONFIDENCE_WEIGHTS: ReadonlyArray<WeightedChoice<WeatherForecastConfidence>> = [
  { value: 'High', weight: 0.42 },
  { value: 'Medium', weight: 0.4 },
  { value: 'Low', weight: 0.18 },
];

const FORECAST_PATTERN_BY_SEASON: Record<Season, ReadonlyArray<WeightedChoice<WeatherForecastPattern>>> = {
  Spring: [
    { value: 'Stable', weight: 0.24 },
    { value: 'Wet', weight: 0.24 },
    { value: 'Dry', weight: 0.12 },
    { value: 'Cold', weight: 0.2 },
    { value: 'Heat', weight: 0.08 },
    { value: 'Storm-prone', weight: 0.12 },
  ],
  Summer: [
    { value: 'Stable', weight: 0.22 },
    { value: 'Wet', weight: 0.12 },
    { value: 'Dry', weight: 0.22 },
    { value: 'Cold', weight: 0.02 },
    { value: 'Heat', weight: 0.32 },
    { value: 'Storm-prone', weight: 0.1 },
  ],
  Fall: [
    { value: 'Stable', weight: 0.22 },
    { value: 'Wet', weight: 0.24 },
    { value: 'Dry', weight: 0.14 },
    { value: 'Cold', weight: 0.15 },
    { value: 'Heat', weight: 0.05 },
    { value: 'Storm-prone', weight: 0.2 },
  ],
  Winter: [
    { value: 'Stable', weight: 0.14 },
    { value: 'Wet', weight: 0.12 },
    { value: 'Dry', weight: 0.1 },
    { value: 'Cold', weight: 0.34 },
    { value: 'Heat', weight: 0.01 },
    { value: 'Storm-prone', weight: 0.29 },
  ],
};

const BASE_WEATHER_STATE_BY_SEASON: Record<Season, ReadonlyArray<WeightedChoice<WeatherState>>> = {
  Spring: [
    { value: 'Clear', weight: 0.28 },
    { value: 'Rain', weight: 0.32 },
    { value: 'Heat', weight: 0.08 },
    { value: 'Frost', weight: 0.14 },
    { value: 'Storm', weight: 0.14 },
    { value: 'Snow', weight: 0.04 },
  ],
  Summer: [
    { value: 'Clear', weight: 0.35 },
    { value: 'Rain', weight: 0.16 },
    { value: 'Heat', weight: 0.3 },
    { value: 'Frost', weight: 0.0 },
    { value: 'Storm', weight: 0.18 },
    { value: 'Snow', weight: 0.01 },
  ],
  Fall: [
    { value: 'Clear', weight: 0.28 },
    { value: 'Rain', weight: 0.27 },
    { value: 'Heat', weight: 0.06 },
    { value: 'Frost', weight: 0.15 },
    { value: 'Storm', weight: 0.2 },
    { value: 'Snow', weight: 0.04 },
  ],
  Winter: [
    { value: 'Clear', weight: 0.16 },
    { value: 'Rain', weight: 0.12 },
    { value: 'Heat', weight: 0.0 },
    { value: 'Frost', weight: 0.23 },
    { value: 'Storm', weight: 0.22 },
    { value: 'Snow', weight: 0.27 },
  ],
};

const INTENSITY_BY_STATE: Record<WeatherState, ReadonlyArray<WeightedChoice<WeatherIntensity>>> = {
  Clear: [
    { value: 'VeryMild', weight: 0.32 },
    { value: 'Mild', weight: 0.72 },
    { value: 'Moderate', weight: 0.26 },
    { value: 'Severe', weight: 0.02 },
    { value: 'Extreme', weight: 0.0 },
  ],
  Rain: [
    { value: 'VeryMild', weight: 0.12 },
    { value: 'Mild', weight: 0.55 },
    { value: 'Moderate', weight: 0.35 },
    { value: 'Severe', weight: 0.1 },
    { value: 'Extreme', weight: 0.02 },
  ],
  Heat: [
    { value: 'VeryMild', weight: 0.08 },
    { value: 'Mild', weight: 0.44 },
    { value: 'Moderate', weight: 0.4 },
    { value: 'Severe', weight: 0.16 },
    { value: 'Extreme', weight: 0.06 },
  ],
  Frost: [
    { value: 'VeryMild', weight: 0.1 },
    { value: 'Mild', weight: 0.5 },
    { value: 'Moderate', weight: 0.35 },
    { value: 'Severe', weight: 0.15 },
    { value: 'Extreme', weight: 0.04 },
  ],
  Storm: [
    { value: 'VeryMild', weight: 0.06 },
    { value: 'Mild', weight: 0.35 },
    { value: 'Moderate', weight: 0.45 },
    { value: 'Severe', weight: 0.2 },
    { value: 'Extreme', weight: 0.1 },
  ],
  Snow: [
    { value: 'VeryMild', weight: 0.08 },
    { value: 'Mild', weight: 0.38 },
    { value: 'Moderate', weight: 0.43 },
    { value: 'Severe', weight: 0.19 },
    { value: 'Extreme', weight: 0.06 },
  ],
};

const CONFIDENCE_HIT_RATE: Record<WeatherForecastConfidence, number> = {
  High: 0.88,
  Medium: 0.78,
  Low: 0.66,
};

const FORECAST_NEIGHBORS: Record<WeatherState, readonly WeatherState[]> = {
  Clear: ['Rain', 'Heat'],
  Rain: ['Clear', 'Storm', 'Snow'],
  Heat: ['Clear', 'Storm'],
  Frost: ['Snow', 'Clear'],
  Storm: ['Rain', 'Snow', 'Heat'],
  Snow: ['Frost', 'Storm'],
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededUnit(seed: string): number {
  const hash = hashString(seed);
  return (hash % 10000) / 10000;
}

function pickWeighted<T extends string>(seed: string, entries: ReadonlyArray<WeightedChoice<T>>): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) {
    return entries[0]!.value;
  }

  let cursor = seededUnit(seed) * total;
  for (const entry of entries) {
    const weight = Math.max(0, entry.weight);
    if (cursor <= weight) {
      return entry.value;
    }
    cursor -= weight;
  }

  return entries[entries.length - 1]!.value;
}

function withPatternBias(
  season: Season,
  pattern: WeatherForecastPattern,
  previousState?: WeatherState
): ReadonlyArray<WeightedChoice<WeatherState>> {
  const base = BASE_WEATHER_STATE_BY_SEASON[season];
  return base.map(entry => {
    let weight = entry.weight;

    if (pattern === 'Wet' && (entry.value === 'Rain' || entry.value === 'Storm')) weight *= 1.38;
    if (pattern === 'Dry' && (entry.value === 'Clear' || entry.value === 'Heat')) weight *= 1.32;
    if (pattern === 'Cold' && (entry.value === 'Frost' || entry.value === 'Snow')) weight *= 1.44;
    if (pattern === 'Heat' && entry.value === 'Heat') weight *= 1.55;
    if (pattern === 'Storm-prone' && entry.value === 'Storm') weight *= 1.62;
    if (pattern === 'Stable' && (entry.value === 'Clear' || entry.value === 'Rain')) weight *= 1.12;

    if (previousState && entry.value === previousState) {
      weight *= 1.16;
    }

    return {
      value: entry.value,
      weight,
    };
  });
}

function rollActualWeather(
  companyId: string,
  year: number,
  season: Season,
  week: number,
  pattern: WeatherForecastPattern,
  previousState?: WeatherState
): { state: WeatherState; intensity: WeatherIntensity } {
  const stateChoices = withPatternBias(season, pattern, previousState);
  const stateSeed = `${companyId}:${year}:${season}:${week}:state`;
  const state = pickWeighted(stateSeed, stateChoices);
  const intensitySeed = `${companyId}:${year}:${season}:${week}:${state}:intensity`;
  const intensity = pickWeighted(intensitySeed, INTENSITY_BY_STATE[state]);
  return { state, intensity };
}

function rollForecastState(
  companyId: string,
  year: number,
  season: Season,
  week: number,
  confidence: WeatherForecastConfidence,
  actualNext: { state: WeatherState; intensity: WeatherIntensity }
): { state: WeatherState; intensity: WeatherIntensity } {
  const seedBase = `${companyId}:${year}:${season}:${week}:forecast`;
  const hitRoll = seededUnit(`${seedBase}:hit`);
  const hitRate = CONFIDENCE_HIT_RATE[confidence];

  if (hitRoll <= hitRate) {
    return actualNext;
  }

  const intensityDriftRoll = seededUnit(`${seedBase}:intensity-drift`);
  if (intensityDriftRoll <= 0.55) {
    const intensityOrder: WeatherIntensity[] = ['VeryMild', 'Mild', 'Moderate', 'Severe', 'Extreme'];
    const currentIndex = intensityOrder.indexOf(actualNext.intensity);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 2;
    const downIndex = Math.max(0, fallbackIndex - 1);
    const upIndex = Math.min(intensityOrder.length - 1, fallbackIndex + 1);
    const nextIntensity = seededUnit(`${seedBase}:intensity-direction`) <= 0.5
      ? intensityOrder[downIndex]
      : intensityOrder[upIndex];

    return {
      state: actualNext.state,
      intensity: nextIntensity,
    };
  }

  const neighbors = FORECAST_NEIGHBORS[actualNext.state];
  const state = pickWeighted(`${seedBase}:state-drift`, neighbors.map(value => ({ value, weight: 1 })));
  const intensity = pickWeighted(`${seedBase}:${state}:drift-intensity`, INTENSITY_BY_STATE[state]);

  return {
    state,
    intensity,
  };
}

export function rollSeasonalWeatherForecast(
  companyId: string,
  year: number,
  season: Season
): { pattern: WeatherForecastPattern; confidence: WeatherForecastConfidence } {
  const seedBase = `${companyId}:${year}:${season}:seasonal-forecast`;
  const pattern = pickWeighted(`${seedBase}:pattern`, FORECAST_PATTERN_BY_SEASON[season]);
  const confidence = pickWeighted(`${seedBase}:confidence`, FORECAST_CONFIDENCE_WEIGHTS);
  return { pattern, confidence };
}

export function buildWeeklyWeatherBundle(params: {
  companyId: string;
  year: number;
  season: Season;
  week: number;
  pattern: WeatherForecastPattern;
  confidence: WeatherForecastConfidence;
  previousState?: WeatherState;
}): WeeklyWeatherBundle {
  const {
    companyId,
    year,
    season,
    week,
    pattern,
    confidence,
    previousState,
  } = params;

  const currentActual = rollActualWeather(companyId, year, season, week, pattern, previousState);
  const nextActual = rollActualWeather(companyId, year, season, week + 1, pattern, currentActual.state);
  const nextForecast = rollForecastState(companyId, year, season, week, confidence, nextActual);

  return {
    currentState: currentActual.state,
    currentIntensity: currentActual.intensity,
    nextForecastState: nextForecast.state,
    nextForecastIntensity: nextForecast.intensity,
  };
}

export function getWeatherIcon(state?: WeatherState): string {
  if (state === 'Rain') return '🌧';
  if (state === 'Heat') return '🌡';
  if (state === 'Frost') return '🧊';
  if (state === 'Storm') return '⛈';
  if (state === 'Snow') return '❄';
  return '☀';
}
