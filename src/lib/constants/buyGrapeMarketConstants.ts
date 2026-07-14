import type { CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import type { FermentationOptions } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import type { EconomyPhase, Season, WeatherIntensity, WeatherState, WineBatchState } from '@/lib/types/types';

export type BuyOfferBatchState = Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>;

export interface BuyMarketDemandFactors {
  volatilitySeason?: Season;
  volatilityEconomyPhase?: EconomyPhase;
  volatilityWeatherState?: WeatherState;
  volatilityWeatherIntensity?: WeatherIntensity;
  seasonPriceMultiplier: number;
  seasonLimitMultiplier: number;
  economyPriceMultiplier: number;
  economyLimitMultiplier: number;
  yearCyclePriceMultiplier: number;
  yearCycleLimitMultiplier: number;
  volatilityPriceMultiplier: number;
  volatilityLimitMultiplier: number;
  volatilitySeasonPressureMultiplier?: number;
  volatilityEconomyPressureMultiplier?: number;
  volatilityWeatherPricePressureMultiplier?: number;
  volatilityWeatherLimitPressureMultiplier?: number;
  volatilitySentimentPriceMultiplier?: number;
  volatilitySentimentLimitMultiplier?: number;
  volatilityBuyerPriceSensitivityMultiplier?: number;
  volatilityBuyerLimitSensitivityMultiplier?: number;
  volatilityBuyerSensitivityReason?: string;
  volatilityWeatherReason?: string;
  volatilityPriceReason?: string;
  volatilityLimitReason?: string;
}

export const BUY_MARKET_FIXED_SPREAD = 0.22;
export const BASE_BUY_MARKET_PRICE_PER_KG = 2.9;
export const BUY_MARKET_MIN_PRICE = 0.8;
export const BUY_MARKET_MAX_PRICE = 14;
export const MIN_SEASONAL_OFFERS = 8;
export const MAX_SEASONAL_OFFERS = 12;
export const BUY_OFFER_MIN_AVAILABLE_KG = 120;
export const BUY_OFFER_COMPANY_VALUE_REFERENCE = 10000;
export const BUY_OFFER_COMPANY_VALUE_MAX_MULTIPLIER = 2.1;
export const BUY_OFFER_PREVIEW_VERSION = 1;
export const BUY_OFFER_PREVIEW_WINE_SCORE_WEIGHT = 0.75;
export const BUY_OFFER_PREVIEW_LAND_VALUE_WEIGHT = 0.25;
export const BUY_OFFER_PREVIEW_QUALITY_MIN_MULTIPLIER = 0.75;
export const BUY_OFFER_PREVIEW_QUALITY_MAX_MULTIPLIER = 1.25;
export const MARKET_FERMENTATION_PREVIEW_TOTAL_WEEKS = 6;

export const MARKET_CRUSHING_PROFILE_BY_COLOR: Record<'red' | 'white', CrushingOptions> = {
  red: {
    method: 'Mechanical Press',
    destemming: true,
    coldSoak: true,
    pressingIntensity: 0.52,
  },
  white: {
    method: 'Pneumatic Press',
    destemming: false,
    coldSoak: false,
    pressingIntensity: 0.36,
  },
};

export const MARKET_FERMENTATION_PROFILE_BY_COLOR: Record<'red' | 'white', FermentationOptions> = {
  red: {
    method: 'Extended Maceration',
    temperature: 'Warm',
  },
  white: {
    method: 'Temperature Controlled',
    temperature: 'Cool',
  },
};

export const YEAR_PRICE_CYCLE = [0.96, 1.0, 1.05, 1.02] as const;

export const STATE_PREMIUMS: Record<BuyOfferBatchState, number> = {
  grapes: 1.0,
  must_ready: 1.08,
  must_fermenting: 1.15,
};

export const STATE_QUALITY_DECAY_PER_WEEK: Record<BuyOfferBatchState, number> = {
  grapes: 0.012,
  must_ready: 0.008,
  must_fermenting: 0.005,
};

export const STATE_DISTRIBUTION: BuyOfferBatchState[] = [
  'grapes',
  'grapes',
  'grapes',
  'must_ready',
  'must_ready',
  'must_fermenting',
];

export const DEFAULT_BUY_MARKET_DEMAND_FACTORS: BuyMarketDemandFactors = {
  volatilitySeason: 'Spring',
  volatilityEconomyPhase: 'Stable',
  volatilityWeatherState: 'Clear',
  volatilityWeatherIntensity: 'Moderate',
  seasonPriceMultiplier: 1,
  seasonLimitMultiplier: 1,
  economyPriceMultiplier: 1,
  economyLimitMultiplier: 1,
  yearCyclePriceMultiplier: 1,
  yearCycleLimitMultiplier: 1,
  volatilityPriceMultiplier: 1,
  volatilityLimitMultiplier: 1,
  volatilitySeasonPressureMultiplier: 1,
  volatilityEconomyPressureMultiplier: 1,
  volatilityWeatherPricePressureMultiplier: 1,
  volatilityWeatherLimitPressureMultiplier: 1,
  volatilitySentimentPriceMultiplier: 1,
  volatilitySentimentLimitMultiplier: 1,
  volatilityBuyerPriceSensitivityMultiplier: 1,
  volatilityBuyerLimitSensitivityMultiplier: 1,
  volatilityBuyerSensitivityReason: 'No buyer sensitivity applied.',
  volatilityWeatherReason: 'No weather pressure applied.',
  volatilityPriceReason: 'Baseline market pricing conditions.',
  volatilityLimitReason: 'Baseline market limit conditions.',
};
