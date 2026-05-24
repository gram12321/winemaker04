import { v4 as uuidv4 } from 'uuid';
import { addTransaction } from '../finance/financeService';
import { getGameState } from '../core/gameState';
import { notificationService } from '../core/notificationService';
import { companyService } from '../user/companyService';
import { calculateCompanyValue } from '../finance/financeService';
import { saveWineBatch } from '../../database/activities/inventoryDB';
import {
  BuyMarketOfferRow,
  deleteBuyOfferRow,
  getCompanyBuyOfferRow,
  getCompanyBuyOfferRows,
  upsertBuyOfferRows,
  updateBuyOfferRow,
} from '../../database/sales/buyMarketOffersDB';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { clamp, formatNumber, getRandomFromArray, randomInt, randomInRange } from '../../utils';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { GAME_INITIALIZATION, SEASON_ORDER } from '../../constants';
import { NotificationCategory } from '../../types/types';
import type { EconomyPhase, GrapeVariety, Nationality, Season, WeatherIntensity, WeatherState, WineBatch, WineBatchState } from '../../types/types';
import {
  BUYER_ECONOMY_PRICE_MULTIPLIERS,
  BUYER_SEASON_PRICE_MULTIPLIERS,
  getBulkBuyer,
} from './grapeBuyerMarketService';
import {
  getBulkSupplier,
  getSeasonalSuppliers,
  recordMarketSupplierPurchase,
  type BuyMarketSupplierProfile,
} from './grapeSupplierMarketService';
import {
  type SupplierLoyaltyLevel,
  type SupplierLoyaltyRecord,
  getSupplierLoyalties,
  getSupplierRelationshipPriceMultiplier,
  getSupplierPersistenceBonus,
  recordSupplierPurchase,
} from './grapeSupplierLoyaltyService';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { NormalizeScrewed1000To01WithTail } from '../../utils/calculator';

export type BuyOfferBatchState = Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>;

export interface BuyGrapeMarketOffer {
  id: string;
  supplierId: string;
  supplierName: string;
  originTag: 'trusted_carryover' | 'seasonal_rotation' | 'country_special';
  batchState: BuyOfferBatchState;
  grapeVariety: GrapeVariety;
  availableKg: number;
  qualityScore: number;
  basePricePerKg: number;
  effectivePricePerKg: number;
  weeksOnMarket: number;
  qualityDecayPerWeek: number;
  minQualityFloor: number;
  isPersistent: boolean;
  createdYear: number;
  createdSeason: Season;
  createdWeek: number;
  supplierLoyalty: SupplierLoyaltyRecord | null;
  demandFactors: BuyMarketDemandFactors;
}

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

export interface BuyOfferPriceBreakdown {
  basePricePerKg: number;
  qualityMultiplier: number;
  qualityAdjustedPricePerKg: number;
  seasonPriceMultiplier: number;
  economyPriceMultiplier: number;
  yearCyclePriceMultiplier: number;
  volatilityPriceMultiplier: number;
  buyerSensitivityMultiplier: number;
  supplierRelationshipMultiplier: number;
  companyPrestigeMultiplier: number;
  statePremiumMultiplier: number;
  marketSpreadMultiplier: number;
  marketFloorPrice: number;
  finalPricePerKg: number;
}

export const BUY_MARKET_FIXED_SPREAD = 0.22;
const BASE_BUY_MARKET_PRICE_PER_KG = 2.9;
const BUY_MARKET_MIN_PRICE = 0.8;
const BUY_MARKET_MAX_PRICE = 14;
const MIN_SEASONAL_OFFERS = 8;
const MAX_SEASONAL_OFFERS = 12;
const BUY_OFFER_MIN_AVAILABLE_KG = 120;
const BUY_OFFER_MAX_AVAILABLE_KG = 6000;
const BUY_OFFER_COMPANY_VALUE_REFERENCE = 10000;
const BUY_OFFER_COMPANY_VALUE_MAX_MULTIPLIER = 2.1;
const BUY_OFFER_PRESTIGE_MAX_DISCOUNT = 0.3;

const YEAR_PRICE_CYCLE = [0.96, 1.0, 1.05, 1.02] as const;

const STATE_PREMIUMS: Record<BuyOfferBatchState, number> = {
  grapes: 1.0,
  must_ready: 1.12,
  must_fermenting: 1.2,
};

const STATE_QUALITY_DECAY_PER_WEEK: Record<BuyOfferBatchState, number> = {
  grapes: 0.012,
  must_ready: 0.008,
  must_fermenting: 0.005,
};

const STATE_DISTRIBUTION: BuyOfferBatchState[] = [
  'grapes',
  'grapes',
  'grapes',
  'must_ready',
  'must_ready',
  'must_fermenting',
];

const DEFAULT_DEMAND_FACTORS: BuyMarketDemandFactors = {
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

function getYearCycleMultiplier(year: number): number {
  const index = Math.abs(year) % YEAR_PRICE_CYCLE.length;
  return YEAR_PRICE_CYCLE[index] ?? 1;
}

function getBuyOfferCompanyValueMultiplier(companyValue: number): number {
  if (companyValue <= 0) return 1;

  const normalized = Math.max(0, Math.log10(Math.max(BUY_OFFER_COMPANY_VALUE_REFERENCE, companyValue)) - 4);
  return clamp(1 + normalized * 0.45, 1, BUY_OFFER_COMPANY_VALUE_MAX_MULTIPLIER);
}

function getBuyOfferPrestigeMultiplier(prestige: number): number {
  if (prestige <= 0) return 1;

  const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
  const scaledPrestige = Math.max(0, (normalizedPrestige - 0.1) / 0.899);
  return clamp(1 + scaledPrestige * 0.3, 1, 1.3);
}

function computeBuyOfferAvailableKg(companyValue: number, prestige: number): number {
  const baseQuantity = randomInt(BUY_OFFER_MIN_AVAILABLE_KG, 1800);
  const companyValueMultiplier = getBuyOfferCompanyValueMultiplier(companyValue);
  const prestigeMultiplier = getBuyOfferPrestigeMultiplier(prestige);

  return clamp(
    Math.round(baseQuantity * companyValueMultiplier * prestigeMultiplier),
    BUY_OFFER_MIN_AVAILABLE_KG,
    BUY_OFFER_MAX_AVAILABLE_KG
  );
}

function toNationality(country?: string): Nationality {
  if (country === 'France' || country === 'Germany' || country === 'Italy' || country === 'Spain' || country === 'United States') {
    return country;
  }
  return 'France';
}
function computeOfferAvailableKgForSupplier(supplier: BuyMarketSupplierProfile, companyValue: number, prestige: number): number {
  if (supplier.remainingSeasonSupplyKg <= 0) return 0;

  const baseAvailableKg = computeBuyOfferAvailableKg(companyValue, prestige);
  const supplyScale = clamp(supplier.effectiveSeasonSupplyKg / 3000, 0.75, 4);
  const scaled = clamp(Math.round(baseAvailableKg * supplyScale), BUY_OFFER_MIN_AVAILABLE_KG, BUY_OFFER_MAX_AVAILABLE_KG);
  return Math.max(1, Math.min(scaled, supplier.remainingSeasonSupplyKg));
}

function toOfferModel(
  row: BuyMarketOfferRow,
  demandFactors: BuyMarketDemandFactors,
  supplierLoyaltyById: Record<string, SupplierLoyaltyRecord>
): BuyGrapeMarketOffer {
  return {
    id: row.offer_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    originTag: row.origin_tag,
    batchState: row.batch_state,
    grapeVariety: row.grape_variety as GrapeVariety,
    availableKg: row.available_kg,
    qualityScore: row.quality_score,
    basePricePerKg: row.base_price_per_kg,
    effectivePricePerKg: row.effective_price_per_kg,
    weeksOnMarket: row.weeks_on_market,
    qualityDecayPerWeek: row.quality_decay_per_week,
    minQualityFloor: row.min_quality_floor,
    isPersistent: row.is_persistent,
    createdYear: row.created_year,
    createdSeason: row.created_season as Season,
    createdWeek: row.created_week,
    supplierLoyalty: supplierLoyaltyById[row.supplier_id] ?? null,
    demandFactors,
  };
}

function toPriceQualityMultiplier(qualityScore: number): number {
  return clamp(0.55 + qualityScore * 1.05, 0.52, 1.7);
}

export function computeBuyOfferPricePerKg(input: {
  basePrice: number;
  qualityScore: number;
  state: BuyOfferBatchState;
  season: Season;
  economyPhase: EconomyPhase;
  year: number;
  companyPrestige?: number;
  volatilityMultiplier: number;
  supplierRelationshipPriceMultiplier?: number;
  demandFactors?: BuyMarketDemandFactors;
}): number {
  const qualityMultiplier = toPriceQualityMultiplier(input.qualityScore);
  const seasonMultiplier = input.demandFactors?.seasonPriceMultiplier ?? BUYER_SEASON_PRICE_MULTIPLIERS[input.season] ?? 1;
  const economyMultiplier = input.demandFactors?.economyPriceMultiplier ?? BUYER_ECONOMY_PRICE_MULTIPLIERS[input.economyPhase] ?? 1;
  const yearCycleMultiplier = input.demandFactors?.yearCyclePriceMultiplier ?? getYearCycleMultiplier(input.year);
  const volatilityMultiplier = input.demandFactors?.volatilityPriceMultiplier ?? input.volatilityMultiplier;
  const buyerSensitivityMultiplier = input.demandFactors?.volatilityBuyerPriceSensitivityMultiplier ?? 1;
  const supplierRelationshipPriceMultiplier = input.supplierRelationshipPriceMultiplier ?? 1;
  const companyPrestigeMultiplier = clamp(1 - NormalizeScrewed1000To01WithTail(input.companyPrestige ?? 0) * BUY_OFFER_PRESTIGE_MAX_DISCOUNT, 0.7, 1);
  const mirroredBaseline = input.basePrice
    * qualityMultiplier
    * seasonMultiplier
    * economyMultiplier
    * yearCycleMultiplier
    * volatilityMultiplier
    * buyerSensitivityMultiplier
    * supplierRelationshipPriceMultiplier
    * companyPrestigeMultiplier;
  const withStatePremium = mirroredBaseline * STATE_PREMIUMS[input.state];
  return clamp(withStatePremium * (1 + BUY_MARKET_FIXED_SPREAD), BUY_MARKET_MIN_PRICE, BUY_MARKET_MAX_PRICE);
}

export function getBuyOfferPriceBreakdown(offer: Pick<BuyGrapeMarketOffer, 'basePricePerKg' | 'qualityScore' | 'batchState' | 'effectivePricePerKg' | 'demandFactors' | 'supplierLoyalty'>): BuyOfferPriceBreakdown {
  const companyPrestige = getGameState().prestige ?? 0;
  const qualityMultiplier = toPriceQualityMultiplier(offer.qualityScore);
  const qualityAdjustedPricePerKg = offer.basePricePerKg * qualityMultiplier;
  const seasonPriceMultiplier = offer.demandFactors.seasonPriceMultiplier ?? 1;
  const economyPriceMultiplier = offer.demandFactors.economyPriceMultiplier ?? 1;
  const yearCyclePriceMultiplier = offer.demandFactors.yearCyclePriceMultiplier ?? 1;
  const volatilityPriceMultiplier = offer.demandFactors.volatilityPriceMultiplier ?? 1;
  const buyerSensitivityMultiplier = offer.demandFactors.volatilityBuyerPriceSensitivityMultiplier ?? 1;
  const supplierRelationshipMultiplier = getSupplierRelationshipPriceMultiplier((offer.supplierLoyalty?.level ?? 0) as SupplierLoyaltyLevel);
  const companyPrestigeMultiplier = clamp(1 - NormalizeScrewed1000To01WithTail(companyPrestige) * BUY_OFFER_PRESTIGE_MAX_DISCOUNT, 0.7, 1);
  const statePremiumMultiplier = STATE_PREMIUMS[offer.batchState] ?? 1;
  const marketSpreadMultiplier = 1 + BUY_MARKET_FIXED_SPREAD;

  return {
    basePricePerKg: offer.basePricePerKg,
    qualityMultiplier,
    qualityAdjustedPricePerKg,
    seasonPriceMultiplier,
    economyPriceMultiplier,
    yearCyclePriceMultiplier,
    volatilityPriceMultiplier,
    buyerSensitivityMultiplier,
    supplierRelationshipMultiplier,
    companyPrestigeMultiplier,
    statePremiumMultiplier,
    marketSpreadMultiplier,
    marketFloorPrice: BUY_MARKET_MIN_PRICE,
    finalPricePerKg: offer.effectivePricePerKg,
  };
}

function stateLabel(state: BuyOfferBatchState): string {
  if (state === 'must_ready') return 'Must';
  if (state === 'must_fermenting') return 'Fermenting';
  return 'Grapes';
}

function getCurrentTime(): { week: number; season: Season; year: number; economyPhase: EconomyPhase } {
  const gameState = getGameState();
  return {
    week: gameState.week ?? GAME_INITIALIZATION.STARTING_WEEK,
    season: (gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON) as Season,
    year: gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    economyPhase: (gameState.economyPhase ?? 'Stable') as EconomyPhase,
  };
}

async function resolveSyncedDemandFactors(startingCountry?: string): Promise<BuyMarketDemandFactors> {
  const bulkBuyer = await getBulkBuyer(startingCountry);
  if (!bulkBuyer?.demandFactors) {
    return DEFAULT_DEMAND_FACTORS;
  }

  return {
    ...DEFAULT_DEMAND_FACTORS,
    ...bulkBuyer.demandFactors,
  };
}

async function getMarketContext(companyId: string): Promise<{ country: Nationality; demandFactors: BuyMarketDemandFactors }> {
  const company = await companyService.getCompany(companyId).catch(() => null);
  const country = toNationality(company?.startingCountry);
  const demandFactors = await resolveSyncedDemandFactors(country);
  return { country, demandFactors };
}

function getNextSeason(season: Season, year: number): { season: Season; year: number } {
  const index = SEASON_ORDER.indexOf(season);
  const nextSeason = SEASON_ORDER[(index + 1) % SEASON_ORDER.length] as Season;
  const nextYear = nextSeason === 'Spring' ? year + 1 : year;
  return { season: nextSeason, year: nextYear };
}

function buildNewOffer(
  companyId: string,
  offerIndex: number,
  supplier: BuyMarketSupplierProfile,
  demandFactors: BuyMarketDemandFactors,
  companyValue: number,
  prestige: number,
): BuyMarketOfferRow {
  const { week, season, year, economyPhase } = getCurrentTime();
  const offerId = `buy_offer_${season.toLowerCase()}_${year}_${offerIndex}_${Math.random().toString(36).slice(2, 7)}`;
  const batchState = getRandomFromArray(STATE_DISTRIBUTION);
  const qualityScore = Number(randomInRange(0.36, 0.9).toFixed(3));
  const resolvedSupplierName = supplier.supplierName;
  const resolvedSupplierId = supplier.supplierId;
  const supplierRelationshipMultiplier = getSupplierRelationshipPriceMultiplier(supplier.loyaltyLevel);
  const basePricePerKg = Number((BASE_BUY_MARKET_PRICE_PER_KG * supplier.basePriceMultiplier).toFixed(2));
  const effectivePricePerKg = Number(computeBuyOfferPricePerKg({
    basePrice: basePricePerKg,
    qualityScore,
    state: batchState,
    season,
    economyPhase,
    year,
    companyPrestige: prestige,
    volatilityMultiplier: demandFactors.volatilityPriceMultiplier,
    supplierRelationshipPriceMultiplier: supplierRelationshipMultiplier,
    demandFactors,
  }).toFixed(2));

  const expires = getNextSeason(season, year);

  return {
    company_id: companyId,
    offer_id: offerId,
    ware_group: 'grapes',
    supplier_id: resolvedSupplierId,
    supplier_name: resolvedSupplierName,
    origin_tag: supplier.originTag,
    batch_state: batchState,
    grape_variety: getRandomFromArray(Object.keys(GRAPE_CONST)) as GrapeVariety,
    available_kg: computeOfferAvailableKgForSupplier(supplier, companyValue, prestige),
    quality_score: qualityScore,
    base_price_per_kg: basePricePerKg,
    effective_price_per_kg: effectivePricePerKg,
    weeks_on_market: 0,
    quality_decay_per_week: STATE_QUALITY_DECAY_PER_WEEK[batchState],
    min_quality_floor: 0.16,
    is_persistent: Math.random() < (0.32 + getSupplierPersistenceBonus(supplier.loyaltyLevel)),
    created_year: year,
    created_season: season,
    created_week: week,
    last_refreshed_year: year,
    last_refreshed_season: season,
    last_refreshed_week: week,
    expires_year: expires.year,
    expires_season: expires.season,
    expires_week: 1,
    updated_at: new Date().toISOString(),
  };
}

function pickPreferredSupplier(
  suppliers: BuyMarketSupplierProfile[],
  offerIndex: number
): BuyMarketSupplierProfile {
  return suppliers[offerIndex % suppliers.length] ?? suppliers[0];
}

async function ensureOffers(companyId: string): Promise<void> {
  const { data, error } = await getCompanyBuyOfferRows(companyId);
  if (error) return;

  const rows = ((data || []) as unknown) as BuyMarketOfferRow[];
  if (rows.length > 0) return;

  const { country, demandFactors } = await getMarketContext(companyId);
  const companyValue = await calculateCompanyValue().catch(() => 0);
  const prestige = getGameState().prestige ?? 0;
  const [bulkSupplier, seasonalSuppliers] = await Promise.all([
    getBulkSupplier(country),
    getSeasonalSuppliers(country),
  ]);
  const suppliers = [bulkSupplier, ...seasonalSuppliers].filter((supplier): supplier is BuyMarketSupplierProfile => !!supplier);
  if (suppliers.length === 0) return;

  const targetCount = randomInt(MIN_SEASONAL_OFFERS, MAX_SEASONAL_OFFERS);
  const generated = Array.from({ length: targetCount }, (_, index) => {
    const supplier = pickPreferredSupplier(suppliers, index);
    return buildNewOffer(
      companyId,
      index,
      supplier,
      demandFactors,
      companyValue,
      prestige
    );
  });
  await upsertBuyOfferRows(generated);
}

export async function getBuyGrapeMarketOffers(): Promise<BuyGrapeMarketOffer[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];

  await ensureOffers(companyId);

  const { data, error } = await getCompanyBuyOfferRows(companyId);
  if (error || !data) return [];

  const { demandFactors } = await getMarketContext(companyId);
  const rows = (data as unknown) as BuyMarketOfferRow[];
  const supplierIds = Array.from(new Set(rows.map((row) => row.supplier_id)));
  const supplierLoyaltyById = await getSupplierLoyalties(supplierIds);

  return rows
    .filter(row => row.available_kg > 0)
    .sort((left, right) => right.quality_score - left.quality_score)
    .map((row) => toOfferModel(row, demandFactors, supplierLoyaltyById));
}

export async function refreshBuyGrapeMarketForSeason(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;

  const { data, error } = await getCompanyBuyOfferRows(companyId);
  if (error) return;

  const { country, demandFactors } = await getMarketContext(companyId);
  const companyValue = await calculateCompanyValue().catch(() => 0);
  const prestige = getGameState().prestige ?? 0;
  const [bulkSupplier, seasonalSuppliers] = await Promise.all([
    getBulkSupplier(country),
    getSeasonalSuppliers(country),
  ]);
  const suppliers = [bulkSupplier, ...seasonalSuppliers].filter((supplier): supplier is BuyMarketSupplierProfile => !!supplier);
  if (suppliers.length === 0) return;

  const existingRows = ((data || []) as unknown) as BuyMarketOfferRow[];
  const persistentRows = existingRows
    .filter(row => row.is_persistent && row.available_kg > 0)
    .slice(0, 3)
    .map((row) => ({
      ...row,
      origin_tag: 'trusted_carryover' as const,
      supplier_name: row.supplier_name || 'Seasonal Supplier',
      updated_at: new Date().toISOString(),
    }));

  const targetCount = randomInt(MIN_SEASONAL_OFFERS, MAX_SEASONAL_OFFERS);
  const generatedCount = Math.max(0, targetCount - persistentRows.length);
  const newRows = Array.from({ length: generatedCount }, (_, index) => {
    const supplier = pickPreferredSupplier(suppliers, index + persistentRows.length);
    return buildNewOffer(
      companyId,
      index + persistentRows.length,
      supplier,
      demandFactors,
      companyValue,
      prestige
    );
  });

  const merged = [...persistentRows, ...newRows];

  const retainedIds = new Set(merged.map((row) => row.offer_id));
  const staleRows = existingRows.filter((row) => !retainedIds.has(row.offer_id));
  for (const staleRow of staleRows) {
    await deleteBuyOfferRow(companyId, staleRow.offer_id);
  }

  await upsertBuyOfferRows(merged);
}

export async function processWeeklyBuyGrapeOfferDecay(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;

  const { data, error } = await getCompanyBuyOfferRows(companyId);
  if (error || !data) return;

  const rows = (data as unknown) as BuyMarketOfferRow[];
  const { season, year, economyPhase } = getCurrentTime();
  const { demandFactors } = await getMarketContext(companyId);
  const prestige = getGameState().prestige ?? 0;
  const supplierIds = Array.from(new Set(rows.map((row) => row.supplier_id)));
  const supplierLoyaltyById = await getSupplierLoyalties(supplierIds);

  for (const row of rows) {
    if (row.available_kg <= 0) {
      await deleteBuyOfferRow(companyId, row.offer_id);
      continue;
    }

    const nextQuality = clamp(row.quality_score - row.quality_decay_per_week, row.min_quality_floor, 1);
    const nextPrice = Number(computeBuyOfferPricePerKg({
      basePrice: row.base_price_per_kg,
      qualityScore: nextQuality,
      state: row.batch_state,
      season,
      economyPhase,
      year,
      companyPrestige: prestige,
      volatilityMultiplier: demandFactors.volatilityPriceMultiplier,
      supplierRelationshipPriceMultiplier: getSupplierRelationshipPriceMultiplier((supplierLoyaltyById[row.supplier_id]?.level ?? 0) as SupplierLoyaltyLevel),
      demandFactors,
    }).toFixed(2));

    await updateBuyOfferRow(companyId, row.offer_id, {
      quality_score: Number(nextQuality.toFixed(3)),
      effective_price_per_kg: nextPrice,
      weeks_on_market: (row.weeks_on_market || 0) + 1,
      updated_at: new Date().toISOString(),
    });
  }
}

function buildPurchasedBatch(offer: BuyMarketOfferRow, quantityKg: number): WineBatch {
  const currentTime = getCurrentTime();
  const grapeConfig = GRAPE_CONST[offer.grape_variety as GrapeVariety] || GRAPE_CONST.Chardonnay;

  return {
    id: uuidv4(),
    vineyardId: 'market_purchase',
    vineyardName: `${offer.supplier_name} (${stateLabel(offer.batch_state)})`,
    grape: offer.grape_variety as GrapeVariety,
    quantity: quantityKg,
    state: offer.batch_state,
    fermentationProgress: offer.batch_state === 'must_fermenting' ? randomInt(5, 65) : 0,
    landValueModifierHarvestSnapshot: 0.5,
    structureIndexHarvestSnapshot: offer.quality_score,
    tasteQualityIndexHarvestSnapshot: offer.quality_score,
    landValueModifier: 0.5,
    structureIndex: offer.quality_score,
    tasteQualityIndex: offer.quality_score,
    characteristics: {
      acidity: offer.quality_score,
      aroma: offer.quality_score,
      body: offer.quality_score,
      spice: 0.5,
      sweetness: 0.5,
      tannins: 0.5,
    },
    estimatedPrice: 0,
    grapeColor: grapeConfig.grapeColor,
    naturalYield: grapeConfig.naturalYield,
    fragile: grapeConfig.fragile,
    proneToOxidation: grapeConfig.proneToOxidation,
    features: [],
    wineAnchors: {
      sugarPotential: offer.quality_score,
      acidPotential: offer.quality_score,
      phenolicPotential: offer.quality_score,
      aromaticPotential: offer.quality_score,
      bodyPotential: offer.quality_score,
      extractionState: offer.batch_state === 'grapes' ? 0.1 : 0.4,
      fermentationState: offer.batch_state === 'must_fermenting' ? 0.7 : offer.batch_state === 'must_ready' ? 0.3 : 0.05,
      leesState: 0.1,
      oxidationPressure: 0.25,
      maturationState: 0,
      terroirExpression: 0.5,
      processFootprint: 0.35,
    },
    harvestStartDate: { ...currentTime },
    harvestEndDate: { ...currentTime },
  };
}

export async function purchaseBuyGrapeOffer(offerId: string, quantityKg: number): Promise<{ success: boolean; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };

  const roundedQuantity = Math.max(1, Math.round(quantityKg));
  const { data, error } = await getCompanyBuyOfferRow(companyId, offerId);
  if (error || !data) {
    return { success: false, error: 'Offer not found.' };
  }

  const offer = (data as unknown) as BuyMarketOfferRow;
  if (roundedQuantity > offer.available_kg) {
    return { success: false, error: `Requested quantity exceeds available offer volume (${offer.available_kg.toLocaleString()} kg).` };
  }

  const totalCost = Number((offer.effective_price_per_kg * roundedQuantity).toFixed(2));
  const gameState = getGameState();
  const money = gameState.money ?? 0;
  const currentYear = gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;

  if (money < totalCost) {
    return { success: false, error: `Insufficient funds. Required ${formatNumber(totalCost, { currency: true, decimals: 0 })}.` };
  }

  const purchasedBatch = buildPurchasedBatch(offer, roundedQuantity);

  try {
    await saveWineBatch(purchasedBatch);
    await addTransaction(
      -totalCost,
      `Market Purchase: ${roundedQuantity} kg ${offer.grape_variety} (${stateLabel(offer.batch_state)}) from ${offer.supplier_name}`,
      TRANSACTION_CATEGORIES.SUPPLIES,
      false,
      companyId
    );

    await recordSupplierPurchase(offer.supplier_id, offer.supplier_name, roundedQuantity, currentYear);
    await recordMarketSupplierPurchase(
      offer.supplier_id,
      roundedQuantity,
      gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      (gameState.season ?? GAME_INITIALIZATION.STARTING_SEASON) as Season
    );

    const remainingKg = offer.available_kg - roundedQuantity;
    if (remainingKg <= 0) {
      await deleteBuyOfferRow(companyId, offerId);
    } else {
      await updateBuyOfferRow(companyId, offerId, {
        available_kg: remainingKg,
        updated_at: new Date().toISOString(),
      });
    }

    await notificationService.addMessage(
      `Purchased ${roundedQuantity} kg of ${offer.grape_variety} (${stateLabel(offer.batch_state)}) from ${offer.supplier_name} for ${formatNumber(totalCost, { currency: true, decimals: 0 })}.`,
      'buyGrapeMarketService.purchaseBuyGrapeOffer',
      'Market Purchase',
      NotificationCategory.WINEMAKING_PROCESS
    );

    triggerTopicUpdate('wine_batches');

    return { success: true };
  } catch (purchaseError) {
    console.error('Failed to purchase market offer:', purchaseError);
    return { success: false, error: 'Could not complete purchase. Please try again.' };
  }
}

export async function ensureBuyGrapeMarketHasData(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;

  await ensureOffers(companyId);
}

export function getBuyOfferStateLabel(state: BuyOfferBatchState): 'Grapes' | 'Must' | 'Fermenting' {
  if (state === 'must_ready') return 'Must';
  if (state === 'must_fermenting') return 'Fermenting';
  return 'Grapes';
}
