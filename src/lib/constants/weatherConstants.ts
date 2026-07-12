import type {
  Season,
  WeatherForecastConfidence,
  WeatherForecastPattern,
  WeatherIntensity,
  WeatherState,
} from '@/lib/types/types';

export type WeightedChoice<T extends string> = { value: T; weight: number };

export const WEATHER_STATES = ['Clear', 'Rain', 'Heat', 'Frost', 'Storm', 'Snow'] as const satisfies readonly WeatherState[];
export const WEATHER_INTENSITIES = ['VeryMild', 'Mild', 'Moderate', 'Severe', 'Extreme'] as const satisfies readonly WeatherIntensity[];

export const WEATHER_FORECAST_CONFIDENCE_WEIGHTS: ReadonlyArray<WeightedChoice<WeatherForecastConfidence>> = [
  { value: 'High', weight: 0.42 },
  { value: 'Medium', weight: 0.4 },
  { value: 'Low', weight: 0.18 },
];

export const WEATHER_FORECAST_PATTERN_BY_SEASON: Record<Season, ReadonlyArray<WeightedChoice<WeatherForecastPattern>>> = {
  Spring: [
    { value: 'Stable', weight: 0.24 }, { value: 'Wet', weight: 0.24 }, { value: 'Dry', weight: 0.12 },
    { value: 'Cold', weight: 0.14 }, { value: 'Heat', weight: 0.1 }, { value: 'Storm-prone', weight: 0.16 },
  ],
  Summer: [
    { value: 'Stable', weight: 0.18 }, { value: 'Wet', weight: 0.1 }, { value: 'Dry', weight: 0.24 },
    { value: 'Cold', weight: 0.04 }, { value: 'Heat', weight: 0.28 }, { value: 'Storm-prone', weight: 0.16 },
  ],
  Fall: [
    { value: 'Stable', weight: 0.18 }, { value: 'Wet', weight: 0.28 }, { value: 'Dry', weight: 0.1 },
    { value: 'Cold', weight: 0.16 }, { value: 'Heat', weight: 0.08 }, { value: 'Storm-prone', weight: 0.2 },
  ],
  Winter: [
    { value: 'Stable', weight: 0.18 }, { value: 'Wet', weight: 0.18 }, { value: 'Dry', weight: 0.08 },
    { value: 'Cold', weight: 0.27 }, { value: 'Heat', weight: 0 }, { value: 'Storm-prone', weight: 0.29 },
  ],
};

export const WEATHER_STATE_BY_SEASON: Record<Season, ReadonlyArray<WeightedChoice<WeatherState>>> = {
  Spring: [
    { value: 'Clear', weight: 0.28 }, { value: 'Rain', weight: 0.32 }, { value: 'Heat', weight: 0.08 },
    { value: 'Frost', weight: 0.12 }, { value: 'Storm', weight: 0.14 }, { value: 'Snow', weight: 0.06 },
  ],
  Summer: [
    { value: 'Clear', weight: 0.32 }, { value: 'Rain', weight: 0.18 }, { value: 'Heat', weight: 0.27 },
    { value: 'Frost', weight: 0 }, { value: 'Storm', weight: 0.2 }, { value: 'Snow', weight: 0.03 },
  ],
  Fall: [
    { value: 'Clear', weight: 0.2 }, { value: 'Rain', weight: 0.32 }, { value: 'Heat', weight: 0.08 },
    { value: 'Frost', weight: 0.12 }, { value: 'Storm', weight: 0.22 }, { value: 'Snow', weight: 0.06 },
  ],
  Winter: [
    { value: 'Clear', weight: 0.16 }, { value: 'Rain', weight: 0.18 }, { value: 'Heat', weight: 0.02 },
    { value: 'Frost', weight: 0.2 }, { value: 'Storm', weight: 0.17 }, { value: 'Snow', weight: 0.27 },
  ],
};

export const WEATHER_INTENSITY_BY_STATE: Record<WeatherState, ReadonlyArray<WeightedChoice<WeatherIntensity>>> = {
  Clear: [{ value: 'VeryMild', weight: 0.32 }, { value: 'Mild', weight: 0.72 }, { value: 'Moderate', weight: 0.26 }, { value: 'Severe', weight: 0.08 }, { value: 'Extreme', weight: 0.02 }],
  Rain: [{ value: 'VeryMild', weight: 0.22 }, { value: 'Mild', weight: 0.65 }, { value: 'Moderate', weight: 0.34 }, { value: 'Severe', weight: 0.13 }, { value: 'Extreme', weight: 0.04 }],
  Heat: [{ value: 'VeryMild', weight: 0.1 }, { value: 'Mild', weight: 0.4 }, { value: 'Moderate', weight: 0.42 }, { value: 'Severe', weight: 0.2 }, { value: 'Extreme', weight: 0.08 }],
  Frost: [{ value: 'VeryMild', weight: 0.08 }, { value: 'Mild', weight: 0.34 }, { value: 'Moderate', weight: 0.42 }, { value: 'Severe', weight: 0.24 }, { value: 'Extreme', weight: 0.1 }],
  Storm: [{ value: 'VeryMild', weight: 0.06 }, { value: 'Mild', weight: 0.3 }, { value: 'Moderate', weight: 0.44 }, { value: 'Severe', weight: 0.28 }, { value: 'Extreme', weight: 0.1 }],
  Snow: [{ value: 'VeryMild', weight: 0.1 }, { value: 'Mild', weight: 0.34 }, { value: 'Moderate', weight: 0.42 }, { value: 'Severe', weight: 0.22 }, { value: 'Extreme', weight: 0.06 }],
};

export const WEATHER_FORECAST_HIT_RATE: Record<WeatherForecastConfidence, number> = {
  High: 0.88,
  Medium: 0.78,
  Low: 0.66,
};

export const WEATHER_FORECAST_NEIGHBORS: Record<WeatherState, readonly WeatherState[]> = {
  Clear: ['Rain', 'Heat'], Rain: ['Clear', 'Storm', 'Snow'], Heat: ['Clear', 'Storm'],
  Frost: ['Snow', 'Clear'], Storm: ['Rain', 'Heat', 'Snow'], Snow: ['Frost', 'Rain'],
};

export const WEATHER_OPERATION_LIMITS = {
  normalWorkMultiplier: 1,
  severeWorkMultiplier: 0.6,
  extremeWorkMultiplier: 0.35,
  plantingUnavailableSeasons: ['Winter'] as readonly Season[],
  forcedPauseStates: ['Frost', 'Storm', 'Snow'] as readonly WeatherState[],
} as const satisfies {
  normalWorkMultiplier: number;
  severeWorkMultiplier: number;
  extremeWorkMultiplier: number;
  plantingUnavailableSeasons: readonly Season[];
  forcedPauseStates: readonly WeatherState[];
};

export const WEATHER_VINEYARD_MULTIPLIERS: Record<
  'ripeness' | 'health',
  Record<WeatherState, Record<WeatherIntensity, number>>
> = {
  ripeness: {
    Clear: { VeryMild: 1.096, Mild: 1.128, Moderate: 1.16, Severe: 1.288, Extreme: 1.384 },
    Rain: { VeryMild: 1.036, Mild: 1.048, Moderate: 1.06, Severe: 1.108, Extreme: 1.144 },
    Heat: { VeryMild: 1.264, Mild: 1.352, Moderate: 1.44, Severe: 1.6, Extreme: 1.6 },
    Frost: { VeryMild: 0.616, Mild: 0.488, Moderate: 0.4, Severe: 0.4, Extreme: 0.4 },
    Storm: { VeryMild: 0.712, Mild: 0.616, Moderate: 0.52, Severe: 0.4, Extreme: 0.4 },
    Snow: { VeryMild: 0.784, Mild: 0.712, Moderate: 0.64, Severe: 0.4, Extreme: 0.4 },
  },
  health: {
    Clear: { VeryMild: 0.88, Mild: 0.84, Moderate: 0.8, Severe: 0.64, Extreme: 0.52 },
    Rain: { VeryMild: 0.904, Mild: 0.872, Moderate: 0.84, Severe: 0.712, Extreme: 0.616 },
    Heat: { VeryMild: 1.192, Mild: 1.256, Moderate: 1.32, Severe: 1.5, Extreme: 1.5 },
    Frost: { VeryMild: 1.264, Mild: 1.352, Moderate: 1.44, Severe: 1.5, Extreme: 1.5 },
    Storm: { VeryMild: 1.336, Mild: 1.448, Moderate: 1.5, Severe: 1.5, Extreme: 1.5 },
    Snow: { VeryMild: 1.216, Mild: 1.288, Moderate: 1.36, Severe: 1.5, Extreme: 1.5 },
  },
};

export const WEATHER_SITE_EXPOSURE_BOUNDS = { min: 0.7, max: 1.3 } as const;
export const WEATHER_SITE_NOTE_THRESHOLDS = { amplified: 1.03, buffered: 0.97 } as const;

export const WEATHER_ASPECT_EXPOSURE: Record<string, { heat: number; cold: number }> = {
  North: { heat: -0.08, cold: 0.1 }, Northeast: { heat: -0.05, cold: 0.08 },
  East: { heat: -0.02, cold: 0.02 }, Southeast: { heat: 0.05, cold: -0.05 },
  South: { heat: 0.08, cold: -0.08 }, Southwest: { heat: 0.05, cold: -0.05 },
  West: { heat: -0.02, cold: 0.02 }, Northwest: { heat: -0.05, cold: 0.08 },
};

export const WEATHER_SOIL_RESPONSE_KEYWORDS = {
  highRetention: ['clay', 'marl', 'barros'],
  fastDrain: ['sand', 'gravel', 'arenas', 'schist', 'slate'],
  highInertia: ['clay', 'limestone', 'chalk', 'marl'],
  lowInertia: ['sand', 'gravel', 'slate', 'schist'],
} as const;

export const WEATHER_SOIL_RESPONSE_BOUNDS = { min: 0.85, max: 1.15, step: 0.03 } as const;
export const WEATHER_ALTITUDE_EXPOSURE = { reference: 300, range: 700, adjustment: 0.08 } as const;
export const WEATHER_SUITABILITY_EXPOSURE = {
  neutral: 0.5,
  adjustment: 0.2,
  min: 0.9,
  max: 1.1,
} as const;
