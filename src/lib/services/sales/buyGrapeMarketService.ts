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
import { clamp, deterministicSeasonalVariation, formatNumber, getRandomFromArray, randomInt, randomInRange } from '../../utils';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { GAME_INITIALIZATION, SEASON_ORDER } from '../../constants';
import { COUNTRY_REGION_MAP, REGION_ALTITUDE_RANGES, REGION_PRICE_RANGES, REGION_SOIL_TYPES } from '../../constants/vineyardConstants';
import { NotificationCategory } from '../../types/types';
import type { EconomyPhase, GrapeVariety, MarketBatchProvenanceSnapshot, MarketOfferOriginTag, Nationality, Season, WeatherIntensity, WeatherState, WineBatch, WineBatchState } from '../../types/types';
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
import { calculateAsymmetricalMultiplier, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { buildMarketPreviewBatch, type CreateMarketWineBatchInput, type MarketBatchStateProfile } from '../wine/winery/inventoryService';
import type { FermentationOptions } from '../wine/characteristics/fermentationCharacteristics';
import { v4 as uuidv4 } from 'uuid';

export type BuyOfferBatchState = Extract<WineBatchState, 'grapes' | 'must_ready' | 'must_fermenting'>;

export interface BuyGrapeMarketOffer {
  id: string;
  supplierId: string;
  supplierName: string;
  originTag: MarketOfferOriginTag;
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
  provenanceSnapshot: MarketBatchProvenanceSnapshot;
  previewBatch: WineBatch;
  previewVersion: number;
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
const BUY_OFFER_PREVIEW_VERSION = 1;
const MARKET_FERMENTATION_PREVIEW_TOTAL_WEEKS = 6;

const MARKET_CRUSHING_PROFILE_BY_COLOR: Record<'red' | 'white', NonNullable<MarketBatchStateProfile['crushingOptions']>> = {
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

const MARKET_FERMENTATION_PROFILE_BY_COLOR: Record<'red' | 'white', FermentationOptions> = {
  red: {
    method: 'Extended Maceration',
    temperature: 'Warm',
  },
  white: {
    method: 'Temperature Controlled',
    temperature: 'Cool',
  },
};

const YEAR_PRICE_CYCLE = [0.96, 1.0, 1.05, 1.02] as const;

const STATE_PREMIUMS: Record<BuyOfferBatchState, number> = {
  grapes: 1.0,
  must_ready: 1.08,
  must_fermenting: 1.15,
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

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function cloneStateProfile<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pickDeterministic<T>(items: readonly T[], seed: string): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty list.');
  }

  const index = Math.min(items.length - 1, Math.floor(deterministicSeasonalVariation(seed, 0, items.length)));
  return items[index] as T;
}

function getOfferSeed(row: Pick<BuyMarketOfferRow, 'offer_id' | 'supplier_id' | 'grape_variety' | 'batch_state'>): string {
  return `${row.offer_id}:${row.supplier_id}:${row.grape_variety}:${row.batch_state}`;
}

function buildOfferProvenanceSnapshot(
  row: Pick<BuyMarketOfferRow, 'offer_id' | 'supplier_id' | 'grape_variety' | 'quality_score' | 'batch_state'>,
  supplierCountry: Nationality
): MarketBatchProvenanceSnapshot {
  const seed = getOfferSeed(row);
  const regions = COUNTRY_REGION_MAP[supplierCountry] as readonly string[];
  const region = pickDeterministic(regions, `${seed}:region`);
  const countrySoils = ((REGION_SOIL_TYPES as Record<string, Record<string, readonly string[]>>)[supplierCountry]?.[region] ?? ['Clay']) as readonly string[];
  const [minAltitude, maxAltitude] = (((REGION_ALTITUDE_RANGES as Record<string, Record<string, readonly [number, number]>>)[supplierCountry]?.[region]) ?? [0, 100]) as readonly [number, number];
  const [minLandValue, maxLandValue] = (((REGION_PRICE_RANGES as Record<string, Record<string, readonly [number, number]>>)[supplierCountry]?.[region]) ?? [25000, 90000]) as readonly [number, number];
  const aspectPool = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'] as const;
  const primarySoil = pickDeterministic(countrySoils, `${seed}:soil:0`);
  const secondarySoil = pickDeterministic(countrySoils, `${seed}:soil:1`);
  const selectedSoils = Array.from(new Set([primarySoil, secondarySoil])).slice(0, 2);
  const quality = row.quality_score;

  return {
    country: supplierCountry,
    region,
    soil: selectedSoils.length > 0 ? selectedSoils : [primarySoil],
    aspect: pickDeterministic(aspectPool, `${seed}:aspect`),
    altitude: Math.round(deterministicSeasonalVariation(`${seed}:altitude`, minAltitude, maxAltitude)),
    density: Math.round(deterministicSeasonalVariation(`${seed}:density`, 2200, 8200)),
    vineyardHealth: clamp01(0.45 + quality * 0.45 + deterministicSeasonalVariation(`${seed}:health`, -0.08, 0.08)),
    ripeness: clamp01(0.42 + quality * 0.5 + deterministicSeasonalVariation(`${seed}:ripeness`, -0.08, 0.08)),
    vineAge: Math.max(4, Math.round(deterministicSeasonalVariation(`${seed}:vine-age`, 4, 38))),
    landValue: Math.round(deterministicSeasonalVariation(`${seed}:land-value`, minLandValue, maxLandValue)),
    vineyardPrestige: clamp01(0.2 + quality * 0.55 + deterministicSeasonalVariation(`${seed}:prestige`, -0.1, 0.1)),
    overgrowth: {
      vegetation: 0,
      debris: 0,
      uproot: 0,
      replant: 0,
    },
    pendingFeatures: [],
    baseQualityScore: quality,
  };
}

function getMarketStateProfile(
  row: Pick<BuyMarketOfferRow, 'offer_id' | 'supplier_id' | 'grape_variety' | 'batch_state'>
): MarketBatchStateProfile {
  const grapeColor = GRAPE_CONST[row.grape_variety as GrapeVariety]?.grapeColor ?? 'white';
  const crushingOptions = cloneStateProfile(MARKET_CRUSHING_PROFILE_BY_COLOR[grapeColor]);

  if (row.batch_state === 'grapes') {
    return { state: 'grapes' };
  }

  if (row.batch_state === 'must_ready') {
    return {
      state: 'must_ready',
      crushingOptions,
    };
  }

  const fermentationOptions = cloneStateProfile(MARKET_FERMENTATION_PROFILE_BY_COLOR[grapeColor]);
  const progress = Math.round(deterministicSeasonalVariation(`${getOfferSeed(row)}:fermentation-progress`, 18, 68));
  const fermentationWeeksApplied = Math.max(
    0,
    Math.min(
      MARKET_FERMENTATION_PREVIEW_TOTAL_WEEKS,
      Math.floor((progress / 100) * MARKET_FERMENTATION_PREVIEW_TOTAL_WEEKS)
    )
  );

  return {
    state: 'must_fermenting',
    crushingOptions,
    fermentationOptions,
    fermentationProgress: progress,
    fermentationWeeksApplied,
  };
}

function buildPreviewDates(
  row: Pick<BuyMarketOfferRow, 'created_week' | 'created_season' | 'created_year' | 'last_refreshed_week' | 'last_refreshed_season' | 'last_refreshed_year'>
): Pick<CreateMarketWineBatchInput, 'harvestStartDate' | 'harvestEndDate'> {
  const refreshWeek = row.last_refreshed_week ?? row.created_week;
  const refreshSeason = (row.last_refreshed_season ?? row.created_season) as Season;
  const refreshYear = row.last_refreshed_year ?? row.created_year;

  return {
    harvestStartDate: {
      week: row.created_week,
      season: row.created_season as Season,
      year: row.created_year,
    },
    harvestEndDate: {
      week: refreshWeek,
      season: refreshSeason,
      year: refreshYear,
    },
  };
}

function toPreviewInput(
  row: BuyMarketOfferRow,
  provenanceSnapshot: MarketBatchProvenanceSnapshot,
  quantityKg: number = row.available_kg
): CreateMarketWineBatchInput {
  return {
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    originTag: row.origin_tag,
    source: provenanceSnapshot,
    grape: row.grape_variety as GrapeVariety,
    quantity: quantityKg,
    stateProfile: getMarketStateProfile(row),
    ...buildPreviewDates(row),
  };
}

async function buildOfferPreviewArtifacts(
  row: BuyMarketOfferRow,
  supplierCountry: Nationality,
  quantityKg: number = row.available_kg,
  qualityScoreOverride?: number
): Promise<Pick<BuyMarketOfferRow, 'provenance_snapshot' | 'preview_snapshot' | 'preview_version'>> {
  const provenanceRow = qualityScoreOverride === undefined
    ? row
    : { ...row, quality_score: qualityScoreOverride };
  const provenanceSnapshot = buildOfferProvenanceSnapshot(provenanceRow, supplierCountry);
  const previewSnapshot = await buildMarketPreviewBatch(
    toPreviewInput(row, provenanceSnapshot, quantityKg)
  );

  return {
    provenance_snapshot: provenanceSnapshot,
    preview_snapshot: previewSnapshot,
    preview_version: BUY_OFFER_PREVIEW_VERSION,
  };
}

async function resolveSupplierCountry(
  companyCountry: Nationality,
  supplierId: string
): Promise<Nationality> {
  const [bulkSupplier, seasonalSuppliers] = await Promise.all([
    getBulkSupplier(companyCountry),
    getSeasonalSuppliers(companyCountry),
  ]);
  const supplier = [bulkSupplier, ...seasonalSuppliers]
    .filter((profile): profile is BuyMarketSupplierProfile => Boolean(profile))
    .find((profile) => profile.supplierId === supplierId);

  return toNationality(supplier?.country ?? companyCountry);
}

async function hydrateOfferRow(
  companyId: string,
  companyCountry: Nationality,
  row: BuyMarketOfferRow
): Promise<BuyMarketOfferRow | null> {
  const hasCompatiblePreview =
    Boolean(row.provenance_snapshot) &&
    Boolean(row.preview_snapshot) &&
    row.preview_version === BUY_OFFER_PREVIEW_VERSION;

  if (hasCompatiblePreview) {
    return row;
  }

  try {
    const supplierCountry = await resolveSupplierCountry(companyCountry, row.supplier_id);
    const artifacts = await buildOfferPreviewArtifacts(row, supplierCountry);
    const hydratedRow: BuyMarketOfferRow = {
      ...row,
      ...artifacts,
    };

    await updateBuyOfferRow(companyId, row.offer_id, {
      provenance_snapshot: hydratedRow.provenance_snapshot,
      preview_snapshot: hydratedRow.preview_snapshot,
      preview_version: hydratedRow.preview_version,
      updated_at: new Date().toISOString(),
    });

    return hydratedRow;
  } catch (error) {
    console.warn('Dropping stale buy-market offer that could not be rehydrated.', row.offer_id, error);
    await deleteBuyOfferRow(companyId, row.offer_id);
    return null;
  }
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
    provenanceSnapshot: row.provenance_snapshot!,
    previewBatch: row.preview_snapshot!,
    previewVersion: row.preview_version ?? BUY_OFFER_PREVIEW_VERSION,
  };
}

function toPriceQualityMultiplier(qualityScore: number): number {
  return qualityScore * calculateAsymmetricalMultiplier(qualityScore);
}

async function getSupplierRemainingSeasonCapKg(companyId: string, supplierId: string): Promise<number | null> {
  const company = await companyService.getCompany(companyId).catch(() => null);
  const startingCountry = company?.startingCountry;
  const [bulkSupplier, seasonalSuppliers] = await Promise.all([
    getBulkSupplier(startingCountry),
    getSeasonalSuppliers(startingCountry),
  ]);

  const supplierProfile = [bulkSupplier, ...seasonalSuppliers]
    .filter((profile): profile is BuyMarketSupplierProfile => Boolean(profile))
    .find((profile) => profile.supplierId === supplierId);

  if (!supplierProfile) return null;

  return Math.max(0, supplierProfile.effectiveSeasonSupplyKg - supplierProfile.suppliedThisSeasonKg);
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

async function buildNewOffer(
  companyId: string,
  offerIndex: number,
  supplier: BuyMarketSupplierProfile,
  demandFactors: BuyMarketDemandFactors,
  companyValue: number,
  prestige: number,
): Promise<BuyMarketOfferRow> {
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
  const baseRow: BuyMarketOfferRow = {
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

  const artifacts = await buildOfferPreviewArtifacts(baseRow, toNationality(supplier.country));
  return {
    ...baseRow,
    ...artifacts,
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
  const generated = await Promise.all(Array.from({ length: targetCount }, (_, index) => {
    const supplier = pickPreferredSupplier(suppliers, index);
    return buildNewOffer(
      companyId,
      index,
      supplier,
      demandFactors,
      companyValue,
      prestige
    );
  }));
  await upsertBuyOfferRows(generated);
}

export async function getBuyGrapeMarketOffers(): Promise<BuyGrapeMarketOffer[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];

  await ensureOffers(companyId);

  const { data, error } = await getCompanyBuyOfferRows(companyId);
  if (error || !data) return [];

  const { country, demandFactors } = await getMarketContext(companyId);
  const rows = (data as unknown) as BuyMarketOfferRow[];
  const hydratedRows = (await Promise.all(rows.map((row) => hydrateOfferRow(companyId, country, row))))
    .filter((row): row is BuyMarketOfferRow => Boolean(row));
  const supplierIds = Array.from(new Set(hydratedRows.map((row) => row.supplier_id)));
  const supplierLoyaltyById = await getSupplierLoyalties(supplierIds);

  return hydratedRows
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
  const now = getCurrentTime();
  const persistentRows = await Promise.all(
    existingRows
      .filter(row => row.is_persistent && row.available_kg > 0)
      .slice(0, 3)
      .map(async (row) => {
        const supplierCountry = await resolveSupplierCountry(country, row.supplier_id);
        const refreshedBaseRow: BuyMarketOfferRow = {
          ...row,
          origin_tag: 'trusted_carryover' as const,
          supplier_name: row.supplier_name || 'Seasonal Supplier',
          last_refreshed_year: now.year,
          last_refreshed_season: now.season,
          last_refreshed_week: now.week,
          updated_at: new Date().toISOString(),
        };
        const artifacts = await buildOfferPreviewArtifacts(refreshedBaseRow, supplierCountry);
        return {
          ...refreshedBaseRow,
          ...artifacts,
        };
      })
  );

  const targetCount = randomInt(MIN_SEASONAL_OFFERS, MAX_SEASONAL_OFFERS);
  const generatedCount = Math.max(0, targetCount - persistentRows.length);
  const newRows = await Promise.all(Array.from({ length: generatedCount }, (_, index) => {
    const supplier = pickPreferredSupplier(suppliers, index + persistentRows.length);
    return buildNewOffer(
      companyId,
      index + persistentRows.length,
      supplier,
      demandFactors,
      companyValue,
      prestige
    );
  }));

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
  const { country, demandFactors } = await getMarketContext(companyId);
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

    const supplierCountry = await resolveSupplierCountry(country, row.supplier_id);
    const artifacts = await buildOfferPreviewArtifacts(row, supplierCountry, row.available_kg, nextQuality);

    await updateBuyOfferRow(companyId, row.offer_id, {
      quality_score: Number(nextQuality.toFixed(3)),
      effective_price_per_kg: nextPrice,
      weeks_on_market: (row.weeks_on_market || 0) + 1,
      provenance_snapshot: artifacts.provenance_snapshot,
      preview_snapshot: artifacts.preview_snapshot,
      preview_version: artifacts.preview_version,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function purchaseBuyGrapeOffer(offerId: string, quantityKg: number): Promise<{ success: boolean; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };

  const roundedQuantity = Math.max(1, Math.round(quantityKg));
  const { data, error } = await getCompanyBuyOfferRow(companyId, offerId);
  if (error || !data) {
    return { success: false, error: 'Offer not found.' };
  }

  const { country } = await getMarketContext(companyId);
  const rawOffer = (data as unknown) as BuyMarketOfferRow;
  const offer = await hydrateOfferRow(companyId, country, rawOffer);
  if (!offer) {
    return { success: false, error: 'Offer expired and was refreshed. Please reopen the market.' };
  }
  if (roundedQuantity > offer.available_kg) {
    return { success: false, error: `Requested quantity exceeds available offer volume (${offer.available_kg.toLocaleString()} kg).` };
  }

  const remainingSupplierCapacityKg = await getSupplierRemainingSeasonCapKg(companyId, offer.supplier_id);
  if (remainingSupplierCapacityKg !== null && roundedQuantity > remainingSupplierCapacityKg) {
    return {
      success: false,
      error: `Requested quantity exceeds ${offer.supplier_name}'s remaining seasonal supply (${remainingSupplierCapacityKg.toLocaleString()} kg).`,
    };
  }

  const totalCost = Number((offer.effective_price_per_kg * roundedQuantity).toFixed(2));
  const gameState = getGameState();
  const money = gameState.money ?? 0;
  const currentYear = gameState.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;

  if (money < totalCost) {
    return { success: false, error: `Insufficient funds. Required ${formatNumber(totalCost, { currency: true, decimals: 0 })}.` };
  }

  const previewBatch = offer.preview_snapshot;
  if (!previewBatch) {
    return { success: false, error: 'Offer preview could not be loaded. Please reopen the market.' };
  }

  const purchasedBatch: WineBatch = {
    ...previewBatch,
    id: uuidv4(),
    quantity: roundedQuantity,
    originSnapshot: previewBatch.originSnapshot ? {
      ...previewBatch.originSnapshot,
      previewState: offer.batch_state,
    } : previewBatch.originSnapshot,
  };

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
