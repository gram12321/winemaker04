import { NAMES, GRAPE_MERCHANT_SUFFIXES } from '../../constants/namesConstants';
import { calculateCompanyValue } from '../finance/financeService';
import { getGameState } from '../core/gameState';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { GRAPE_VARIETIES, type GrapeVariety, type EconomyPhase, type Season } from '../../types/types';
import {
  getBuyerLoyalty,
  getBuyerRelationshipPriceMultiplier,
  getBuyerRelationshipYearlyLimitBonus,
  type BuyerLoyaltyLevel,
} from '@/lib/services';
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

export type CountryKey = 'France' | 'Germany' | 'Italy' | 'Spain' | 'United States';
type BuyerOriginTag = 'Relationship carry-over' | 'Seasonal rotation' | 'Country special';

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

function toLegacyYearlyLimit(baseSeasonLimitKg: number): number {
  return Math.max(500, Math.round(baseSeasonLimitKg * 4));
}

export const COUNTRY_MULTIPLIER_RANGE: Record<CountryKey, { min: number; max: number; baseLimitMin: number; baseLimitMax: number; title: string }> = {
  France: { min: 1.08, max: 2.0, baseLimitMin: 500, baseLimitMax: 2200, title: 'Negoce Buyer' },
  Germany: { min: 1.1, max: 2.0, baseLimitMin: 600, baseLimitMax: 2400, title: 'Regional Traubenhandler' },
  Italy: { min: 1.06, max: 1.95, baseLimitMin: 550, baseLimitMax: 2100, title: 'Cantina Broker' },
  Spain: { min: 1.03, max: 1.9, baseLimitMin: 500, baseLimitMax: 2000, title: 'Bodega Broker' },
  'United States': { min: 1.07, max: 2.0, baseLimitMin: 600, baseLimitMax: 2500, title: 'Valley Fruit Broker' },
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function toCountryKey(country?: string): CountryKey {
  if (country === 'France' || country === 'Germany' || country === 'Italy' || country === 'Spain' || country === 'United States') {
    return country;
  }
  return 'France';
}

function parseCountryKey(country?: string): CountryKey | null {
  if (country === 'France' || country === 'Germany' || country === 'Italy' || country === 'Spain' || country === 'United States') {
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
    ? male[Math.floor(Math.random() * male.length)]
    : female[Math.floor(Math.random() * female.length)];
  const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
  const suffixes = GRAPE_MERCHANT_SUFFIXES[country];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${firstName} ${lastName} ${suffix}`;
}

function pickFavoriteGrapes(): [GrapeVariety, GrapeVariety | null] {
  const first = GRAPE_VARIETIES[Math.floor(Math.random() * GRAPE_VARIETIES.length)];
  const includeSecond = Math.random() < 0.5;
  if (!includeSecond) return [first, null];
  const remaining = GRAPE_VARIETIES.filter(g => g !== first);
  const second = remaining[Math.floor(Math.random() * remaining.length)] || null;
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

async function getSeasonalBuyerCountFromResearch(): Promise<number> {
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
    return foreignPool[Math.floor(Math.random() * foreignPool.length)] || homeCountry;
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
  const baseMultiplier = Number(randomBetween(multiplierMin, multiplierMax).toFixed(2));
  const baseSeasonLimitKg = randomInt(config.baseLimitMin, config.baseLimitMax);
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
    base_yearly_limit_kg: toLegacyYearlyLimit(baseSeasonLimitKg),
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
      base_season_limit_kg: 3400,
      base_yearly_limit_kg: toLegacyYearlyLimit(3400),
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
      base_yearly_limit_kg: toLegacyYearlyLimit(BULK_BASE_SEASON_LIMIT_KG),
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
  loyaltyLevel: BuyerLoyaltyLevel,
  companyValue: number,
  currentSeason: Season,
  economyPhase: EconomyPhase,
  limitResearchMultiplier: number,
  multiplierResearchBonus: number,
  originTag: BuyerOriginTag,
  originReason: string
): GrapeBuyer {
  const relationshipMultiplier = getBuyerRelationshipPriceMultiplier(loyaltyLevel);
  const relationshipLimitBonus = getBuyerRelationshipYearlyLimitBonus(loyaltyLevel);
  const scaledBaseLimit = computeScaledSeasonLimit(row.base_season_limit_kg, companyValue);
  const priceDemandMultiplier = computeCompanyValuePriceMultiplier(companyValue)
    * getSeasonPriceMultiplier(currentSeason)
    * getEconomyPriceMultiplier(economyPhase)
    * (1 + multiplierResearchBonus);
  const limitDemandMultiplier = getSeasonLimitMultiplier(currentSeason)
    * getEconomyLimitMultiplier(economyPhase)
    * limitResearchMultiplier;
  const effectiveSeasonLimitKg = Math.max(
    200,
    Math.round(scaledBaseLimit * limitDemandMultiplier * (1 + relationshipLimitBonus))
  );
  const effectiveMultiplier = Number((row.base_multiplier * priceDemandMultiplier).toFixed(2));
  const soldThisSeasonKg = Math.max(0, row.sold_this_season_kg || 0);
  const remainingSeasonLimitKg = Math.max(0, effectiveSeasonLimitKg - soldThisSeasonKg);
  const favoriteGrapes = [row.favorite_grape_1, row.favorite_grape_2].filter(Boolean) as GrapeVariety[];

  return {
    id: row.buyer_id,
    name: row.display_name,
    description: row.description || 'Seasonal grape buyer',
    priceMultiplier: effectiveMultiplier,
    floorPricePerKg: row.is_germany_coop ? 1.0 : 0,
    exclusiveCountry: row.country,
    multiplierRangeMin: row.multiplier_min,
    multiplierRangeMax: row.multiplier_max,
    baseSeasonLimitKg: scaledBaseLimit,
    effectiveSeasonLimitKg,
    soldThisSeasonKg,
    remainingSeasonLimitKg,
    relationshipMultiplier,
    favoriteGrapes,
    buyerCategory: row.is_germany_coop ? 'cooperative' : 'seasonal',
    originTag,
    originReason,
    dealStyle: 'spot',
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
      loyaltyLevel,
      companyValue,
      currentSeason,
      economyPhase,
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

  const row = await ensureBulkBuyer(companyId, country, currentYear, currentSeason);
  if (!row) return null;

  const [companyValue, limitResearchMultiplier, multiplierResearchBonus] = await Promise.all([
    calculateCompanyValue(),
    getBuyerLimitMultiplierFromResearch(),
    getBuyerMultiplierBonusFromResearch(),
  ]);
  const effectiveSeasonLimitKg = Math.max(
    200,
    Math.round(
      computeScaledSeasonLimit(row.base_season_limit_kg, companyValue)
      * getSeasonLimitMultiplier(currentSeason)
      * getEconomyLimitMultiplier(economyPhase)
      * limitResearchMultiplier
    )
  );
  const soldThisSeasonKg = Math.max(0, row.sold_this_season_kg || 0);
  const priceMultiplier = Number((
    row.base_multiplier
    * computeCompanyValuePriceMultiplier(companyValue)
    * getSeasonPriceMultiplier(currentSeason)
    * getEconomyPriceMultiplier(economyPhase)
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
