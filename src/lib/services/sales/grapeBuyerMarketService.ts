import { NAMES, GRAPE_MERCHANT_SUFFIXES } from '../../constants/namesConstants';
import { calculateCompanyValue } from '../finance/financeService';
import { getGameState } from '../core/gameState';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { GRAPE_VARIETIES, type GrapeVariety, type EconomyPhase, type Nationality, type Season, type WeatherIntensity, type WeatherState } from '../../types/types';
import {
  getBuyerLoyalty,
  getBuyerRelationshipPriceMultiplier,
  getBuyerRelationshipYearlyLimitBonus,
  type BuyerLoyaltyLevel,
} from '@/lib/services';
import { clamp, getRandomFromArray, randomInRange, randomInt } from '@/lib/utils';
import type { GrapeBuyer } from './sellGrapesService';
import { researchEnforcer } from '../../features/researchUpgrade/services/research/researchEnforcer';
import {
  createBuyerRow,
  getBuyerRow,
  getBuyerSeasonStateRow,
  getKnownCountryBuyerRowsForCountries,
  getSeasonBuyerRowsForCountries,
  updateBuyerRow,
} from '../../database/sales/grapeBuyerMarketDB';
import { getBuyerPriorityRows } from '../../database/sales/grapeBuyerLoyaltyDB';

export const BASE_SEASONAL_BUYER_COUNT = 3;
export const MAX_SEASONAL_BUYER_COUNT = 7;
const BULK_BUYER_ID = 'bulk_buyer';
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

const BUYER_YEAR_PRICE_CYCLE = [0.96, 1.0, 1.05, 1.02] as const;
const BUYER_YEAR_LIMIT_CYCLE = [0.94, 1.0, 1.08, 1.03] as const;

const BUYER_SEASON_VOLATILITY_PRESSURE: Record<Season, number> = {
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

const PRICE_SEASON_THEME: Record<Season, string> = {
  Spring: 'Spring planting optimism supports premium contracts.',
  Summer: 'Summer heat stress softens average grape spot prices.',
  Fall: 'Harvest oversupply pressure weighs on spot grape prices.',
  Winter: 'Harsh winter logistics raise replacement-value pricing.',
};

const LIMIT_SEASON_THEME: Record<Season, string> = {
  Spring: 'Fresh campaign budgets keep intake channels open.',
  Summer: 'Heat-related handling constraints reduce intake appetite.',
  Fall: 'Cellar congestion during harvest tightens intake limits.',
  Winter: 'Off-season replenishment programs increase buyer intake plans.',
};

const WEATHER_THEME: Record<WeatherState, string> = {
  Clear: 'Stable weather keeps logistics predictable this week.',
  Rain: 'Rainfall variability introduces moderate logistics friction.',
  Heat: 'Heat pressure increases handling and spoilage risk.',
  Frost: 'Frost risk tightens procurement timing and flexibility.',
  Storm: 'Storm disruptions create sharp short-term buying uncertainty.',
  Snow: 'Snowy transport constraints amplify delivery uncertainty.',
};

export type CountryKey = Nationality;
type BuyerOriginTag = 'Relationship carry-over' | 'Seasonal rotation' | 'Country special';

const COUNTRY_KEYS: readonly CountryKey[] = ['France', 'Germany', 'Italy', 'Spain', 'United States'];

interface BuyerMarketRow {
  buyer_id: string;
  display_name: string;
  country: string;
  description: string | null;
  is_germany_coop: boolean;
  base_multiplier: number;
  multiplier_min: number;
  multiplier_max: number;
  base_season_limit_kg: number;
  sold_this_season_kg: number;
  favorite_grape_1: GrapeVariety | null;
  favorite_grape_2: GrapeVariety | null;
  last_active_year: number | null;
  last_active_season: string | null;
}

export const COUNTRY_MULTIPLIER_RANGE: Record<CountryKey, { min: number; max: number; baseLimitMin: number; baseLimitMax: number; title: string }> = {
  France: { min: 1.08, max: 2.0, baseLimitMin: 500, baseLimitMax: 2200, title: 'Negoce Buyer' },
  Germany: { min: 1.1, max: 2.0, baseLimitMin: 600, baseLimitMax: 2400, title: 'Regional Traubenhandler' },
  Italy: { min: 1.06, max: 1.95, baseLimitMin: 550, baseLimitMax: 2100, title: 'Cantina Broker' },
  Spain: { min: 1.03, max: 1.9, baseLimitMin: 500, baseLimitMax: 2000, title: 'Bodega Broker' },
  'United States': { min: 1.07, max: 2.0, baseLimitMin: 600, baseLimitMax: 2500, title: 'Valley Fruit Broker' },
};

function isCountryKey(country?: string): country is CountryKey {
  return !!country && COUNTRY_KEYS.includes(country as CountryKey);
}

function toCountryKey(country?: string): CountryKey {
  if (isCountryKey(country)) {
    return country;
  }
  return 'France';
}

function parseCountryKey(country?: string): CountryKey | null {
  if (isCountryKey(country)) {
    return country;
  }
  return null;
}

function generateBuyerId(country: CountryKey, year: number, season: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `merchant_${country.toLowerCase().replace(/\s+/g, '_')}_${year}_${season.toLowerCase()}_${random}`;
}

function generateBuyerName(country: CountryKey): string {
  const pool = NAMES[country];
  const male = pool.firstNames.male;
  const female = pool.firstNames.female;
  const firstName = Math.random() < 0.5
    ? getRandomFromArray(male)
    : getRandomFromArray(female);
  const lastName = getRandomFromArray(pool.lastNames);
  const suffixes = GRAPE_MERCHANT_SUFFIXES[country];
  const suffix = getRandomFromArray(suffixes);
  return `${firstName} ${lastName} ${suffix}`;
}

function pickFavoriteGrapes(): [GrapeVariety, GrapeVariety | null] {
  const first = getRandomFromArray(GRAPE_VARIETIES);
  const includeSecond = Math.random() < 0.5;
  if (!includeSecond) return [first, null];
  const remaining = GRAPE_VARIETIES.filter(g => g !== first);
  const second = remaining.length > 0 ? getRandomFromArray(remaining) : null;
  return [first, second as GrapeVariety | null];
}

function computeScaledSeasonLimit(baseSeasonLimitKg: number, companyValue: number): number {
  const normalized = Math.max(0, Math.log10(Math.max(10000, companyValue)) - 4);
  const factor = Math.min(3.1, 1 + normalized * 0.5);
  return Math.max(200, Math.round(baseSeasonLimitKg * factor));
}

function computeCompanyValuePriceMultiplier(companyValue: number): number {
  if (companyValue <= 0) return 1;
  const normalized = Math.max(0, Math.log10(Math.max(50000, companyValue)) - 4.7);
  return Math.min(1.28, 1 + normalized * 0.14);
}

function getSeasonPriceMultiplier(season: Season): number {
  return BUYER_SEASON_PRICE_MULTIPLIERS[season];
}

function getSeasonLimitMultiplier(season: Season): number {
  return BUYER_SEASON_LIMIT_MULTIPLIERS[season];
}

function getEconomyPriceMultiplier(phase: EconomyPhase): number {
  return BUYER_ECONOMY_PRICE_MULTIPLIERS[phase];
}

function getEconomyLimitMultiplier(phase: EconomyPhase): number {
  return BUYER_ECONOMY_LIMIT_MULTIPLIERS[phase];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededCenteredUnit(seed: string): number {
  const hash = hashString(seed);
  const normalized = (hash % 10000) / 10000;
  return normalized * 2 - 1;
}

function getYearCycleMultiplier(year: number, cycle: readonly number[]): number {
  const index = Math.abs(year) % cycle.length;
  return cycle[index] ?? 1;
}

function getDemandVolatilityMultipliers(
  companyId: string,
  currentYear: number,
  currentSeason: Season,
  economyPhase: EconomyPhase,
  weatherState?: WeatherState,
  weatherIntensity?: WeatherIntensity
): {
  price: number;
  limit: number;
  seasonPressure: number;
  economyPressure: number;
  weatherPricePressure: number;
  weatherLimitPressure: number;
  sentimentPriceMultiplier: number;
  sentimentLimitMultiplier: number;
  weatherReason: string;
  priceReason: string;
  limitReason: string;
} {
  const amplitude = BUYER_ECONOMY_VOLATILITY_AMPLITUDE[economyPhase];
  const yearPriceCycle = getYearCycleMultiplier(currentYear, BUYER_YEAR_PRICE_CYCLE);
  const yearLimitCycle = getYearCycleMultiplier(currentYear, BUYER_YEAR_LIMIT_CYCLE);
  const seasonPressure = BUYER_SEASON_VOLATILITY_PRESSURE[currentSeason];
  const economyPressure = BUYER_ECONOMY_VOLATILITY_PRESSURE[economyPhase];
  const resolvedWeatherState: WeatherState = weatherState ?? 'Clear';
  const resolvedWeatherIntensity: WeatherIntensity = weatherIntensity ?? 'Moderate';
  const weatherBase = BUYER_WEATHER_VOLATILITY_PRESSURE[resolvedWeatherState];
  const weatherIntensityScale = WEATHER_INTENSITY_MULTIPLIER[resolvedWeatherIntensity] ?? 1;
  const weatherPricePressure = weatherBase.price * weatherIntensityScale;
  const weatherLimitPressure = weatherBase.limit * weatherIntensityScale;

  // Deterministic per company/year/season so volatility stays stable for all buyers within the season.
  const volatilitySeedBase = `${companyId}:${currentYear}:${currentSeason}:${economyPhase}`;
  const priceNoise = seededCenteredUnit(`${volatilitySeedBase}:price`);
  const limitNoise = seededCenteredUnit(`${volatilitySeedBase}:limit`);
  const sentimentPriceMultiplier = 1 + priceNoise * amplitude.price;
  const sentimentLimitMultiplier = 1 + limitNoise * amplitude.limit;
  const priceVolatility = seasonPressure * economyPressure * weatherPricePressure * sentimentPriceMultiplier;
  const limitVolatility = seasonPressure * economyPressure * weatherLimitPressure * sentimentLimitMultiplier;
  const priceShock = priceNoise >= 0
    ? 'Buyer sentiment shock favors higher bids this season.'
    : 'Buyer sentiment shock favors lower bid discipline this season.';
  const limitShock = limitNoise >= 0
    ? 'Operational confidence expands planned intake this season.'
    : 'Operational caution trims planned intake this season.';
  const priceCycleTheme = yearPriceCycle >= 1
    ? 'Supply cycle is in a tighter phase, supporting bid strength.'
    : 'Supply cycle is in a looser phase, easing bid pressure.';
  const limitCycleTheme = yearLimitCycle >= 1
    ? 'Cycle timing points to stronger replenishment demand.'
    : 'Cycle timing points to softer replenishment demand.';
  const weatherReason = `${WEATHER_THEME[resolvedWeatherState]} Intensity is ${resolvedWeatherIntensity.toLowerCase()}.`;
  const priceReason = `${PRICE_SEASON_THEME[currentSeason]} ${weatherReason} ${priceCycleTheme} ${priceShock}`;
  const limitReason = `${LIMIT_SEASON_THEME[currentSeason]} ${weatherReason} ${limitCycleTheme} ${limitShock}`;

  return {
    price: clamp(yearPriceCycle * priceVolatility, 0.7, 1.35),
    limit: clamp(yearLimitCycle * limitVolatility, 0.65, 1.45),
    seasonPressure,
    economyPressure,
    weatherPricePressure,
    weatherLimitPressure,
    sentimentPriceMultiplier,
    sentimentLimitMultiplier,
    weatherReason,
    priceReason,
    limitReason,
  };
}

function getDemandFactorComponents(
  companyId: string,
  currentYear: number,
  currentSeason: Season,
  economyPhase: EconomyPhase,
  weatherState?: WeatherState,
  weatherIntensity?: WeatherIntensity
): {
  volatilitySeason: Season;
  volatilityEconomyPhase: EconomyPhase;
  volatilityWeatherState: WeatherState;
  volatilityWeatherIntensity: WeatherIntensity;
  seasonPriceMultiplier: number;
  seasonLimitMultiplier: number;
  economyPriceMultiplier: number;
  economyLimitMultiplier: number;
  yearCyclePriceMultiplier: number;
  yearCycleLimitMultiplier: number;
  volatilityPriceMultiplier: number;
  volatilityLimitMultiplier: number;
  volatilitySeasonPressureMultiplier: number;
  volatilityEconomyPressureMultiplier: number;
  volatilityWeatherPricePressureMultiplier: number;
  volatilityWeatherLimitPressureMultiplier: number;
  volatilitySentimentPriceMultiplier: number;
  volatilitySentimentLimitMultiplier: number;
  volatilityWeatherReason: string;
  volatilityPriceReason: string;
  volatilityLimitReason: string;
} {
  const seasonPriceMultiplier = getSeasonPriceMultiplier(currentSeason);
  const seasonLimitMultiplier = getSeasonLimitMultiplier(currentSeason);
  const economyPriceMultiplier = getEconomyPriceMultiplier(economyPhase);
  const economyLimitMultiplier = getEconomyLimitMultiplier(economyPhase);
  const yearCyclePriceMultiplier = getYearCycleMultiplier(currentYear, BUYER_YEAR_PRICE_CYCLE);
  const yearCycleLimitMultiplier = getYearCycleMultiplier(currentYear, BUYER_YEAR_LIMIT_CYCLE);
  const demandVolatility = getDemandVolatilityMultipliers(
    companyId,
    currentYear,
    currentSeason,
    economyPhase,
    weatherState,
    weatherIntensity
  );
  const resolvedWeatherState: WeatherState = weatherState ?? 'Clear';
  const resolvedWeatherIntensity: WeatherIntensity = weatherIntensity ?? 'Moderate';

  return {
    volatilitySeason: currentSeason,
    volatilityEconomyPhase: economyPhase,
    volatilityWeatherState: resolvedWeatherState,
    volatilityWeatherIntensity: resolvedWeatherIntensity,
    seasonPriceMultiplier,
    seasonLimitMultiplier,
    economyPriceMultiplier,
    economyLimitMultiplier,
    yearCyclePriceMultiplier,
    yearCycleLimitMultiplier,
    volatilityPriceMultiplier: Number((demandVolatility.price / Math.max(0.01, yearCyclePriceMultiplier)).toFixed(3)),
    volatilityLimitMultiplier: Number((demandVolatility.limit / Math.max(0.01, yearCycleLimitMultiplier)).toFixed(3)),
    volatilitySeasonPressureMultiplier: Number(demandVolatility.seasonPressure.toFixed(3)),
    volatilityEconomyPressureMultiplier: Number(demandVolatility.economyPressure.toFixed(3)),
    volatilityWeatherPricePressureMultiplier: Number(demandVolatility.weatherPricePressure.toFixed(3)),
    volatilityWeatherLimitPressureMultiplier: Number(demandVolatility.weatherLimitPressure.toFixed(3)),
    volatilitySentimentPriceMultiplier: Number(demandVolatility.sentimentPriceMultiplier.toFixed(3)),
    volatilitySentimentLimitMultiplier: Number(demandVolatility.sentimentLimitMultiplier.toFixed(3)),
    volatilityWeatherReason: demandVolatility.weatherReason,
    volatilityPriceReason: demandVolatility.priceReason,
    volatilityLimitReason: demandVolatility.limitReason,
  };
}

function getBuyerVolatilitySensitivity(
  buyerCategory: NonNullable<GrapeBuyer['buyerCategory']>,
  dealStyle: NonNullable<GrapeBuyer['dealStyle']>,
  originTag: BuyerOriginTag
): { price: number; limit: number; reason: string } {
  let price = 1;
  let limit = 1;

  if (buyerCategory === 'bulk') {
    price *= 1.08;
    limit *= 1.05;
  } else if (buyerCategory === 'cooperative') {
    price *= 0.94;
    limit *= 0.96;
  }

  if (dealStyle === 'spot') {
    price *= 1.06;
    limit *= 1.04;
  } else if (dealStyle === 'volume_bonus') {
    limit *= 1.08;
  } else if (dealStyle === 'relationship_bonus') {
    price *= 0.97;
    limit *= 0.96;
  }

  if (originTag === 'Relationship carry-over') {
    price *= 0.97;
    limit *= 0.95;
  } else if (originTag === 'Seasonal rotation') {
    price *= 1.03;
    limit *= 1.02;
  }

  return {
    price: Number(price.toFixed(3)),
    limit: Number(limit.toFixed(3)),
    reason: `Buyer profile response (${buyerCategory}, ${dealStyle}, ${originTag}).`,
  };
}

async function getSeasonalBuyerCountFromResearch(): Promise<number> {
  // Intentionally shared with supplier market progression.
  const unlocked = await researchEnforcer.getUnlockedItems('grape_buyer_slots');
  const additional = unlocked.reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  const total = BASE_SEASONAL_BUYER_COUNT + Math.max(0, Math.floor(additional));
  return Math.max(BASE_SEASONAL_BUYER_COUNT, Math.min(MAX_SEASONAL_BUYER_COUNT, total));
}

async function getBuyerLimitMultiplierFromResearch(): Promise<number> {
  const unlocked = await researchEnforcer.getUnlockedItems('grape_buyer_limit_multiplier');
  const additive = unlocked.reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return Math.max(1, 1 + additive);
}

async function getBuyerMultiplierBonusFromResearch(): Promise<number> {
  const unlocked = await researchEnforcer.getUnlockedItems('grape_buyer_multiplier_bonus');
  const bonus = unlocked.reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return Math.max(0, bonus);
}

async function getUnlockedBuyerCountriesFromResearch(homeCountry: CountryKey): Promise<CountryKey[]> {
  // Intentionally shared with supplier market progression.
  const unlocked = await researchEnforcer.getUnlockedItems('grape_buyer_country_access');
  const allowed = new Set<CountryKey>([homeCountry]);

  for (const value of unlocked) {
    const parsed = parseCountryKey(String(value));
    if (parsed) {
      allowed.add(parsed);
    }
  }

  return Array.from(allowed);
}

function chooseMarketBuyerCountry(homeCountry: CountryKey, eligibleCountries: CountryKey[]): CountryKey {
  const pool = eligibleCountries.length > 0 ? eligibleCountries : [homeCountry];
  const foreignPool = pool.filter(country => country !== homeCountry);

  if (foreignPool.length > 0 && Math.random() < 0.35) {
    return getRandomFromArray(foreignPool);
  }

  return homeCountry;
}

async function createMarketBuyer(
  companyId: string,
  country: CountryKey,
  currentYear: number,
  currentSeason: string
): Promise<BuyerMarketRow | null> {
  const config = COUNTRY_MULTIPLIER_RANGE[country];
  const buyerId = generateBuyerId(country, currentYear, currentSeason);
  const multiplierMin = Number(config.min.toFixed(2));
  const multiplierMax = Number(config.max.toFixed(2));
  const baseMultiplier = Number(randomInRange(multiplierMin, multiplierMax).toFixed(2));
  const baseSeasonLimitKg = randomInt(config.baseLimitMin, config.baseLimitMax);
  const baseYearlyLimitKg = Math.max(500, Math.round(baseSeasonLimitKg * 4));
  const [favorite1, favorite2] = pickFavoriteGrapes();

  const insertData = {
    company_id: companyId,
    buyer_id: buyerId,
    display_name: generateBuyerName(country),
    country,
    description: `${config.title} active for ${currentSeason} ${currentYear}.`,
    is_germany_coop: false,
    base_multiplier: baseMultiplier,
    multiplier_min: multiplierMin,
    multiplier_max: multiplierMax,
    base_season_limit_kg: baseSeasonLimitKg,
    base_yearly_limit_kg: baseYearlyLimitKg,
    sold_this_season_kg: 0,
    favorite_grape_1: favorite1,
    favorite_grape_2: favorite2,
    last_active_year: currentYear,
    last_active_season: currentSeason,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await createBuyerRow(insertData);

  if (error) {
    console.error('Failed to create seasonal grape buyer:', error);
    return null;
  }

  return data as BuyerMarketRow;
}

async function ensureGermanyCoop(
  companyId: string,
  currentYear: number,
  currentSeason: string
): Promise<BuyerMarketRow | null> {
  const coopId = 'winzergenossenschaft';
  const baseSeasonLimitKg = 3400;
  const baseYearlyLimitKg = Math.max(500, Math.round(baseSeasonLimitKg * 4));

  const { data: existing } = await getBuyerRow(companyId, coopId);

  if (existing) {
    const changedSeason = existing.last_active_year !== currentYear || existing.last_active_season !== currentSeason;
    await updateBuyerRow(companyId, coopId, {
      last_active_year: currentYear,
      last_active_season: currentSeason,
      sold_this_season_kg: changedSeason ? 0 : existing.sold_this_season_kg,
      updated_at: new Date().toISOString(),
    });
    return existing as BuyerMarketRow;
  }

  const { data, error } = await createBuyerRow({
      company_id: companyId,
      buyer_id: coopId,
      display_name: 'Winzergenossenschaft',
      country: 'Germany',
      description: 'German cooperative buyer with an elevated floor protection and strong yearly demand.',
      is_germany_coop: true,
      base_multiplier: 1.65,
      multiplier_min: 1.35,
      multiplier_max: 2.2,
      base_season_limit_kg: baseSeasonLimitKg,
      base_yearly_limit_kg: baseYearlyLimitKg,
      sold_this_season_kg: 0,
      favorite_grape_1: 'Chardonnay',
      favorite_grape_2: 'Sauvignon Blanc',
      last_active_year: currentYear,
      last_active_season: currentSeason,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to create germany coop buyer:', error);
    return null;
  }

  return data as BuyerMarketRow;
}

async function ensureBulkBuyer(
  companyId: string,
  country: CountryKey,
  currentYear: number,
  currentSeason: string
): Promise<BuyerMarketRow | null> {
  const { data: existing } = await getBuyerRow(companyId, BULK_BUYER_ID);
  const baseYearlyLimitKg = Math.max(500, Math.round(BULK_BASE_SEASON_LIMIT_KG * 4));

  if (existing) {
    const changedSeason = existing.last_active_year !== currentYear || existing.last_active_season !== currentSeason;
    await updateBuyerRow(companyId, BULK_BUYER_ID, {
      country,
      last_active_year: currentYear,
      last_active_season: currentSeason,
      sold_this_season_kg: changedSeason ? 0 : existing.sold_this_season_kg,
      updated_at: new Date().toISOString(),
    });
    return {
      ...(existing as BuyerMarketRow),
      country,
      sold_this_season_kg: changedSeason ? 0 : (existing.sold_this_season_kg || 0),
      last_active_year: currentYear,
      last_active_season: currentSeason,
    };
  }

  const { data, error } = await createBuyerRow({
      company_id: companyId,
      buyer_id: BULK_BUYER_ID,
      display_name: 'Bulk Grape Merchant',
      country,
      description: 'A generic merchant buying grapes for blended bulk production. Available everywhere, no minimums.',
      is_germany_coop: false,
      base_multiplier: 1.0,
      multiplier_min: 1.0,
      multiplier_max: 1.0,
      base_season_limit_kg: BULK_BASE_SEASON_LIMIT_KG,
      base_yearly_limit_kg: baseYearlyLimitKg,
      sold_this_season_kg: 0,
      favorite_grape_1: null,
      favorite_grape_2: null,
      last_active_year: currentYear,
      last_active_season: currentSeason,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to create bulk grape buyer:', error);
    return null;
  }

  return data as BuyerMarketRow;
}

async function getRelationshipPriorityBuyerIds(companyId: string, country: CountryKey): Promise<string[]> {
  const { data, error } = await getBuyerPriorityRows(companyId, 12);

  if (error || !data) {
    return [];
  }

  const ids = data.map((row: any) => String(row.buyer_id));

  if (country !== 'Germany') {
    return ids.filter(id => id !== 'winzergenossenschaft');
  }

  return ids;
}

function rowToBuyer(
  row: BuyerMarketRow,
  companyId: string,
  currentYear: number,
  loyaltyLevel: BuyerLoyaltyLevel,
  companyValue: number,
  currentSeason: Season,
  economyPhase: EconomyPhase,
  weatherState: WeatherState | undefined,
  weatherIntensity: WeatherIntensity | undefined,
  limitResearchMultiplier: number,
  multiplierResearchBonus: number,
  originTag: BuyerOriginTag,
  originReason: string
): GrapeBuyer {
  const buyerCategory: NonNullable<GrapeBuyer['buyerCategory']> = row.is_germany_coop ? 'cooperative' : 'seasonal';
  const dealStyle: NonNullable<GrapeBuyer['dealStyle']> = row.is_germany_coop ? 'relationship_bonus' : 'spot';
  const volatilitySensitivity = getBuyerVolatilitySensitivity(buyerCategory, dealStyle, originTag);
  const demandComponents = getDemandFactorComponents(
    companyId,
    currentYear,
    currentSeason,
    economyPhase,
    weatherState,
    weatherIntensity
  );
  const relationshipMultiplier = getBuyerRelationshipPriceMultiplier(loyaltyLevel);
  const relationshipLimitBonus = getBuyerRelationshipYearlyLimitBonus(loyaltyLevel);
  const scaledBaseLimit = computeScaledSeasonLimit(row.base_season_limit_kg, companyValue);
  const marketContextMultiplier = computeCompanyValuePriceMultiplier(companyValue)
    * demandComponents.seasonPriceMultiplier
    * demandComponents.economyPriceMultiplier
    * demandComponents.yearCyclePriceMultiplier
    * demandComponents.volatilityPriceMultiplier;
  const buyerSpecificPriceMultiplier = 1 + multiplierResearchBonus;
  const limitDemandMultiplier = demandComponents.seasonLimitMultiplier
    * demandComponents.economyLimitMultiplier
    * demandComponents.yearCycleLimitMultiplier
    * demandComponents.volatilityLimitMultiplier
    * volatilitySensitivity.limit
    * limitResearchMultiplier;
  const effectiveSeasonLimitKg = Math.max(
    200,
    Math.round(scaledBaseLimit * limitDemandMultiplier * (1 + relationshipLimitBonus))
  );
  const effectiveMultiplier = Number((row.base_multiplier * buyerSpecificPriceMultiplier).toFixed(2));
  const soldThisSeasonKg = Math.max(0, row.sold_this_season_kg || 0);
  const remainingSeasonLimitKg = Math.max(0, effectiveSeasonLimitKg - soldThisSeasonKg);
  const favoriteGrapes = [row.favorite_grape_1, row.favorite_grape_2].filter(Boolean) as GrapeVariety[];

  return {
    id: row.buyer_id,
    name: row.display_name,
    description: row.description || 'Seasonal grape buyer',
    priceMultiplier: effectiveMultiplier,
    marketSensitivityMultiplier: volatilitySensitivity.price,
    floorPricePerKg: row.is_germany_coop ? 1.0 : 0,
    exclusiveCountry: row.country,
    multiplierRangeMin: row.multiplier_min,
    multiplierRangeMax: row.multiplier_max,
    baseSeasonLimitKg: scaledBaseLimit,
    effectiveSeasonLimitKg,
    soldThisSeasonKg,
    remainingSeasonLimitKg,
    relationshipMultiplier,
    marketContextMultiplier,
    favoriteGrapes,
    buyerCategory,
    originTag,
    originReason,
    dealStyle,
    demandFactors: {
      ...demandComponents,
      volatilityBuyerPriceSensitivityMultiplier: volatilitySensitivity.price,
      volatilityBuyerLimitSensitivityMultiplier: volatilitySensitivity.limit,
      volatilityBuyerSensitivityReason: volatilitySensitivity.reason,
    },
  };
}

export async function getSeasonalBuyers(startingCountry?: string): Promise<GrapeBuyer[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId || !startingCountry) return [];

  const country = toCountryKey(startingCountry);
  const eligibleCountries = await getUnlockedBuyerCountriesFromResearch(country);
  const gameState = getGameState();
  const currentYear = gameState.currentYear ?? 2024;
  const currentSeason = gameState.season ?? 'Spring';
  const economyPhase = (gameState.economyPhase ?? 'Stable') as EconomyPhase;
  const weatherState = gameState.weatherState as WeatherState | undefined;
  const weatherIntensity = gameState.weatherIntensity as WeatherIntensity | undefined;
  const seasonalBuyerCount = await getSeasonalBuyerCountFromResearch();

  const { data: currentSeasonRowsRaw } = await getSeasonBuyerRowsForCountries(
    companyId,
    eligibleCountries,
    currentYear,
    currentSeason,
    BULK_BUYER_ID,
    12
  );

  let seasonRows = (currentSeasonRowsRaw || []) as BuyerMarketRow[];
  const buyerOrigins = new Map<string, { tag: BuyerOriginTag; reason: string }>();

  for (const row of seasonRows) {
    buyerOrigins.set(row.buyer_id, {
      tag: 'Seasonal rotation',
      reason: `Active seasonal buyer for ${currentSeason} ${currentYear}.`,
    });
  }

  if (seasonRows.length < seasonalBuyerCount) {
    const prioritizedIds = await getRelationshipPriorityBuyerIds(companyId, country);
    const selectedRows: BuyerMarketRow[] = [];

    if (country === 'Germany') {
      const coop = await ensureGermanyCoop(companyId, currentYear, currentSeason);
      if (coop) {
        selectedRows.push(coop);
        buyerOrigins.set(coop.buyer_id, {
          tag: 'Country special',
          reason: 'German cooperative buyer available as a country-specific channel.',
        });
      }
    }

    const { data: knownRowsRaw } = await getKnownCountryBuyerRowsForCountries(companyId, eligibleCountries, BULK_BUYER_ID, 40);
    const knownRows = (knownRowsRaw || []) as BuyerMarketRow[];

    for (const buyerId of prioritizedIds) {
      if (selectedRows.length >= seasonalBuyerCount) break;
      if (selectedRows.some(r => r.buyer_id === buyerId)) continue;
      const row = knownRows.find(r => r.buyer_id === buyerId);
      if (!row) continue;
      selectedRows.push(row);
      buyerOrigins.set(row.buyer_id, {
        tag: 'Relationship carry-over',
        reason: 'Selected because this buyer has an existing relationship with your winery.',
      });
    }

    while (selectedRows.length < seasonalBuyerCount) {
      const marketCountry = chooseMarketBuyerCountry(country, eligibleCountries);
      const created = await createMarketBuyer(companyId, marketCountry, currentYear, currentSeason);
      if (!created) break;
      selectedRows.push(created);
      buyerOrigins.set(created.buyer_id, {
        tag: 'Seasonal rotation',
        reason: `New seasonal buyer rotation for ${currentSeason} ${currentYear}.`,
      });
    }

    for (const row of selectedRows) {
      await updateBuyerRow(companyId, row.buyer_id, {
        last_active_year: currentYear,
        last_active_season: currentSeason,
        sold_this_season_kg: 0,
        updated_at: new Date().toISOString(),
      });
    }

    seasonRows = selectedRows;
  }

  const companyValue = await calculateCompanyValue();
  const [limitResearchMultiplier, multiplierResearchBonus] = await Promise.all([
    getBuyerLimitMultiplierFromResearch(),
    getBuyerMultiplierBonusFromResearch(),
  ]);
  const buyers: GrapeBuyer[] = [];

  for (const row of seasonRows.slice(0, seasonalBuyerCount)) {
    const loyalty = await getBuyerLoyalty(row.buyer_id);
    const loyaltyLevel = (loyalty?.level ?? 0) as BuyerLoyaltyLevel;
    const baseOrigin = buyerOrigins.get(row.buyer_id) || {
      tag: 'Seasonal rotation' as BuyerOriginTag,
      reason: `Active seasonal buyer for ${currentSeason} ${currentYear}.`,
    };
    const hasRelationship = (loyalty?.loyaltyScore ?? 0) > 0;
    const origin = hasRelationship && baseOrigin.tag !== 'Country special'
      ? {
          tag: 'Relationship carry-over' as BuyerOriginTag,
          reason: 'Selected because this buyer has an existing relationship with your winery.',
        }
      : baseOrigin;
    buyers.push(rowToBuyer(
      row,
      companyId,
      currentYear,
      loyaltyLevel,
      companyValue,
      currentSeason,
      economyPhase,
      weatherState,
      weatherIntensity,
      limitResearchMultiplier,
      multiplierResearchBonus,
      origin.tag,
      origin.reason
    ));
  }

  return buyers;
}

export async function getBulkBuyer(startingCountry?: string): Promise<GrapeBuyer | null> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return null;

  const country = toCountryKey(startingCountry);
  const gameState = getGameState();
  const currentYear = gameState.currentYear ?? 2024;
  const currentSeason = gameState.season ?? 'Spring';
  const economyPhase = (gameState.economyPhase ?? 'Stable') as EconomyPhase;
  const weatherState = gameState.weatherState as WeatherState | undefined;
  const weatherIntensity = gameState.weatherIntensity as WeatherIntensity | undefined;

  const row = await ensureBulkBuyer(companyId, country, currentYear, currentSeason);
  if (!row) return null;

  const [companyValue, limitResearchMultiplier, multiplierResearchBonus] = await Promise.all([
    calculateCompanyValue(),
    getBuyerLimitMultiplierFromResearch(),
    getBuyerMultiplierBonusFromResearch(),
  ]);
  const demandComponents = getDemandFactorComponents(
    companyId,
    currentYear,
    currentSeason,
    economyPhase,
    weatherState,
    weatherIntensity
  );
  const volatilitySensitivity = getBuyerVolatilitySensitivity('bulk', 'spot', 'Country special');
  const effectiveSeasonLimitKg = Math.max(
    200,
    Math.round(
      computeScaledSeasonLimit(row.base_season_limit_kg, companyValue)
      * demandComponents.seasonLimitMultiplier
      * demandComponents.economyLimitMultiplier
      * demandComponents.yearCycleLimitMultiplier
      * demandComponents.volatilityLimitMultiplier
      * volatilitySensitivity.limit
      * limitResearchMultiplier
    )
  );
  const soldThisSeasonKg = Math.max(0, row.sold_this_season_kg || 0);
  const priceMultiplier = Number((
    row.base_multiplier
    * computeCompanyValuePriceMultiplier(companyValue)
    * demandComponents.seasonPriceMultiplier
    * demandComponents.economyPriceMultiplier
    * demandComponents.yearCyclePriceMultiplier
    * demandComponents.volatilityPriceMultiplier
    * volatilitySensitivity.price
    * (1 + multiplierResearchBonus)
  ).toFixed(2));

  const loyalty = await getBuyerLoyalty(BULK_BUYER_ID);
  const relationshipMultiplier = getBuyerRelationshipPriceMultiplier((loyalty?.level ?? 0) as BuyerLoyaltyLevel);

  return {
    id: BULK_BUYER_ID,
    name: 'Bulk Grape Merchant',
    description: row.description || 'A generic merchant buying grapes for blended bulk production. Available everywhere, no minimums.',
    priceMultiplier,
    floorPricePerKg: 0,
    exclusiveCountry: row.country,
    multiplierRangeMin: 1.0,
    multiplierRangeMax: 1.0,
    baseSeasonLimitKg: row.base_season_limit_kg,
    effectiveSeasonLimitKg,
    soldThisSeasonKg,
    remainingSeasonLimitKg: Math.max(0, effectiveSeasonLimitKg - soldThisSeasonKg),
    relationshipMultiplier,
    favoriteGrapes: [],
    buyerCategory: 'bulk',
    originTag: 'Country special',
    originReason: 'Always available bulk channel for immediate liquidity.',
    dealStyle: 'spot',
    demandFactors: {
      ...demandComponents,
      volatilityBuyerPriceSensitivityMultiplier: volatilitySensitivity.price,
      volatilityBuyerLimitSensitivityMultiplier: volatilitySensitivity.limit,
      volatilityBuyerSensitivityReason: volatilitySensitivity.reason,
    },
  };
}

export async function recordMarketBuyerSale(
  buyerId: string,
  kgSold: number,
  currentYear: number,
  currentSeason: string
): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;

  const { data } = await getBuyerSeasonStateRow(companyId, buyerId);

  if (!data) return;

  const sameSeason = data.last_active_year === currentYear && data.last_active_season === currentSeason;
  const soldThisSeasonKg = sameSeason ? (data.sold_this_season_kg || 0) + kgSold : kgSold;

  await updateBuyerRow(companyId, buyerId, {
    sold_this_season_kg: soldThisSeasonKg,
    last_active_year: currentYear,
    last_active_season: currentSeason,
    updated_at: new Date().toISOString(),
  });
}
