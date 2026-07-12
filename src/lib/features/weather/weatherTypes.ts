import type {
  GameDate,
  Vineyard,
  WeatherForecastConfidence,
  WeatherForecastPattern,
  WeatherIntensity,
  WeatherState,
} from '@/lib/types/types';

export interface WeatherWeekContext {
  date: GameDate;
  state: WeatherState;
  intensity: WeatherIntensity;
  seasonalPattern: WeatherForecastPattern;
  forecast: {
    state: WeatherState;
    intensity: WeatherIntensity;
    confidence: WeatherForecastConfidence;
  };
}

export interface ResolveWeatherWeekInput {
  companyId: string;
  date: GameDate;
  seasonalPattern: WeatherForecastPattern;
  forecastConfidence: WeatherForecastConfidence;
  previousState?: WeatherState;
}

export interface VineyardMetricProjection {
  current: number;
  normalDelta: number;
  weatherContribution: number;
  finalDelta: number;
  projected: number;
}

export interface VineyardWeeklyProjection {
  ripeness: VineyardMetricProjection;
  health: VineyardMetricProjection;
  siteExposure: number;
  siteNote: string;
}

export interface VineyardWeekProjectionInput {
  companyId: string;
  vineyard: Vineyard;
  weather: WeatherWeekContext;
  plantingProgressRatio?: number;
  healthDecayMultiplier?: number;
  ripenessGrowthActive?: boolean;
}
