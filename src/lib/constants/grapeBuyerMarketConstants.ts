import type { EconomyPhase, Nationality, Season, WeatherIntensity, WeatherState } from '@/lib/types/types';

export const BASE_SEASONAL_BUYER_COUNT = 3;
export const MAX_SEASONAL_BUYER_COUNT = 7;
export const BULK_BASE_SEASON_LIMIT_KG = 14000;

export const BUYER_SEASON_PRICE_MULTIPLIERS: Record<Season, number> = {
  Spring: 1.03,
  Summer: 0.92,
  Fall: 0.9,
  Winter: 1.12,
};

export const BUYER_SEASON_LIMIT_MULTIPLIERS: Record<Season, number> = {
  Spring: 1,
  Summer: 0.9,
  Fall: 0.88,
  Winter: 1.15,
};

export const BUYER_ECONOMY_PRICE_MULTIPLIERS: Record<EconomyPhase, number> = {
  Crash: 0.82,
  Recession: 0.92,
  Stable: 1,
  Expansion: 1.08,
  Boom: 1.2,
};

export const BUYER_ECONOMY_LIMIT_MULTIPLIERS: Record<EconomyPhase, number> = {
  Crash: 0.78,
  Recession: 0.9,
  Stable: 1,
  Expansion: 1.12,
  Boom: 1.25,
};

export const BUYER_ECONOMY_VOLATILITY_AMPLITUDE: Record<EconomyPhase, { price: number; limit: number }> = {
  Crash: { price: 0.13, limit: 0.2 },
  Recession: { price: 0.1, limit: 0.15 },
  Stable: { price: 0.06, limit: 0.1 },
  Expansion: { price: 0.08, limit: 0.12 },
  Boom: { price: 0.11, limit: 0.16 },
};

export const BUYER_YEAR_PRICE_CYCLE = [0.96, 1.0, 1.05, 1.02] as const;
export const BUYER_YEAR_LIMIT_CYCLE = [0.94, 1.0, 1.08, 1.03] as const;

export const BUYER_SEASON_VOLATILITY_PRESSURE: Record<Season, number> = {
  Spring: 0.97,
  Summer: 1.06,
  Fall: 1.12,
  Winter: 1.15,
};

export const BUYER_ECONOMY_VOLATILITY_PRESSURE: Record<EconomyPhase, number> = {
  Crash: 1.26,
  Recession: 1.14,
  Stable: 1.0,
  Expansion: 1.08,
  Boom: 1.16,
};

export const BUYER_WEATHER_VOLATILITY_PRESSURE: Record<WeatherState, { price: number; limit: number }> = {
  Clear: { price: 1.0, limit: 1.0 },
  Rain: { price: 1.04, limit: 1.06 },
  Heat: { price: 1.07, limit: 1.11 },
  Frost: { price: 1.09, limit: 1.14 },
  Storm: { price: 1.13, limit: 1.2 },
  Snow: { price: 1.1, limit: 1.17 },
};

export const WEATHER_INTENSITY_MULTIPLIER: Record<WeatherIntensity, number> = {
  VeryMild: 0.92,
  Mild: 0.96,
  Moderate: 1.0,
  Severe: 1.08,
  Extreme: 1.16,
};

export const PRICE_SEASON_THEME: Record<Season, string> = {
  Spring: 'Spring planting optimism supports premium contracts.',
  Summer: 'Summer heat stress softens average grape spot prices.',
  Fall: 'Harvest oversupply pressure weighs on spot grape prices.',
  Winter: 'Harsh winter logistics raise replacement-value pricing.',
};

export const LIMIT_SEASON_THEME: Record<Season, string> = {
  Spring: 'Fresh campaign budgets keep intake channels open.',
  Summer: 'Heat-related handling constraints reduce intake appetite.',
  Fall: 'Cellar congestion during harvest tightens intake limits.',
  Winter: 'Off-season replenishment programs increase buyer intake plans.',
};

export const WEATHER_THEME: Record<WeatherState, string> = {
  Clear: 'Stable weather keeps logistics predictable this week.',
  Rain: 'Rainfall variability introduces moderate logistics friction.',
  Heat: 'Heat pressure increases handling and spoilage risk.',
  Frost: 'Frost risk tightens procurement timing and flexibility.',
  Storm: 'Storm disruptions create sharp short-term buying uncertainty.',
  Snow: 'Snowy transport constraints amplify delivery uncertainty.',
};

export type BuyerMarketCountryKey = Nationality;

export const BUYER_MARKET_COUNTRY_KEYS: readonly BuyerMarketCountryKey[] = ['France', 'Germany', 'Italy', 'Spain', 'United States'];

export const COUNTRY_MULTIPLIER_RANGE: Record<BuyerMarketCountryKey, { min: number; max: number; baseLimitMin: number; baseLimitMax: number; title: string }> = {
  France: { min: 1.08, max: 2.0, baseLimitMin: 500, baseLimitMax: 2200, title: 'Negoce Buyer' },
  Germany: { min: 1.1, max: 2.0, baseLimitMin: 600, baseLimitMax: 2400, title: 'Regional Traubenhandler' },
  Italy: { min: 1.06, max: 1.95, baseLimitMin: 550, baseLimitMax: 2100, title: 'Cantina Broker' },
  Spain: { min: 1.03, max: 1.9, baseLimitMin: 500, baseLimitMax: 2000, title: 'Bodega Broker' },
  'United States': { min: 1.07, max: 2.0, baseLimitMin: 600, baseLimitMax: 2500, title: 'Valley Fruit Broker' },
};
