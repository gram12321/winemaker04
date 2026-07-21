import { addTransaction, calculateCompanyValue, syncPersistedTransaction } from '@/lib/services/finance/financeService';
import { notificationService } from '@/lib/services/core/notificationService';
import { getGameState } from '@/lib/services/core/gameState';
import {
  getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers,
  updateBuyMarketOffer,
  deleteBuyMarketOffer,
  upsertBuyMarketOffers,
  claimBuyMarketOfferUnits,
  releaseBuyMarketOfferUnits,
} from '@/lib/database/market/buyMarketOffersDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { calculateAsymmetricalMultiplier, deterministicSeasonalVariation, formatNumber, getNextSeasonDate } from '@/lib/utils';
import { GAME_INITIALIZATION, getStorageVesselCatalogueEntry, STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS, STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER, STORAGE_VESSEL_BASE_PRICE, STORAGE_VESSEL_CATALOGUE, STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS, STORAGE_VESSEL_FILL_HISTORY_PRICE_DECAY, STORAGE_VESSEL_MAX_GENERATED_AGE_YEARS, STORAGE_VESSEL_OFFER_PREFIX, STORAGE_VESSEL_OFFER_RETENTION_CHANCE, STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES, STORAGE_VESSEL_SUPPLIERS, TRANSACTION_CATEGORIES } from '@/lib/constants';
import { getCompanyStorageVessels, insertStorageVessels } from '@/lib/database/winery/storageVesselsDB';
import { getActiveStorageVesselMarketListings, purchaseUsedStorageVesselListing } from '@/lib/database/market/storageVesselMarketListingsDB';
import { getBuyGoodsOfferAvailability, getBuyGoodsPriceBreakdown, type BuyGoodsPriceBreakdown } from '@/lib/services/market/buyGoods/buyGoodsPricing';
import {
  getBuyMarketCounterpartyKey,
  getBuyMarketCounterpartyPersistenceBonus,
  getBuyMarketCounterpartyPriceMultiplier,
  getBuyMarketCounterpartyRelationships,
  recordBuyMarketCounterpartyPurchaseForActiveCompany,
  type BuyMarketCounterpartyRelationship,
  type BuyMarketCounterpartyRelationshipLevel,
} from '@/lib/services/market/buyMarketCounterpartyRelationshipService';
import type { BuyMarketOfferRecord, BuyMarketOfferSource, BuyMarketPurchaseResult } from '@/lib/types/market';
import type { StorageVessel, StorageVesselCleanliness, StorageVesselMarketListing, StorageVesselOfferPayload, StorageVesselOfferPriceSnapshot } from '@/lib/types/storageVessels';
import { calculateUsedStorageVesselMarketValue, isUsedStorageVesselListingVisible, projectUsedStorageVesselCondition } from './usedStorageVesselMarketService';
import { ensureGlobalStorageVesselSupplierListings } from './globalStorageVesselSupplierService';
import { getStorageVesselNameBase } from './storageVesselNamingService';
import { NotificationCategory, type Season } from '@/lib/types/types';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { v4 as uuidv4 } from 'uuid';

export interface StorageVesselMarketOffer {
  kind: 'supplier' | 'used_listing';
  source: BuyMarketOfferSource;
  id: string;
  availableUnits: number;
  basePricePerVessel: number;
  pricePerVessel: number;
  createdYear: number;
  createdSeason: Season;
  createdWeek: number;
  expiresYear: number | null;
  expiresSeason: Season | null;
  expiresWeek: number | null;
  counterpartyRelationship?: BuyMarketCounterpartyRelationship;
  priceBreakdown: StorageVesselPriceBreakdown;
  payload: StorageVesselOfferPayload;
  usedListing?: StorageVesselMarketListing;
  listedVessel?: StorageVessel;
}

export interface StorageVesselPriceBreakdown extends BuyGoodsPriceBreakdown {
  capacityMultiplier: number;
  materialMultiplier: number;
  qualityMultiplier: number;
  supplierBaseMultiplier: number;
  qualityScore: number;
  cleanlinessMultiplier: number;
  conditionMultiplier: number;
  fillHistoryMultiplier: number;
  ageYears: number;
  ageMultiplier: number;
  capacityLitres: number;
  catalogueId: StorageVesselOfferPayload['catalogueId'];
  finalPricePerVessel: number;
}

export function getStorageVesselOfferRetentionChance(level: BuyMarketCounterpartyRelationshipLevel): number {
  return Math.min(1, STORAGE_VESSEL_OFFER_RETENTION_CHANCE + getBuyMarketCounterpartyPersistenceBonus(level));
}

export function getStorageVesselPriceBreakdown(input: {
  capacityLitres: number;
  catalogueId?: StorageVesselOfferPayload['catalogueId'];
  productionYear: number;
  currentYear: number;
  qualityScore: number;
  cleanliness: StorageVesselCleanliness;
  condition?: number;
  fillHistory?: number;
  supplierBaseMultiplier: number;
  supplierRelationshipMultiplier?: number;
  companyPrestige?: number;
  effectivePricePerVessel?: number;
}): StorageVesselPriceBreakdown {
  const capacityMultiplier = input.capacityLitres / STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES;
  const materialMultiplier = input.catalogueId ? getStorageVesselCatalogueEntry(input.catalogueId).materialPriceMultiplier : 1;
  const ageYears = Math.max(0, input.currentYear - input.productionYear);
  const ageMultiplier = STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER
    + (1 - STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER) * Math.exp(-ageYears / STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS);
  const qualityMultiplier = input.qualityScore * calculateAsymmetricalMultiplier(input.qualityScore);
  const cleanlinessMultiplier = STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS[input.cleanliness];
  const conditionMultiplier = input.condition ?? 1;
  const fillHistoryMultiplier = 1 / (1 + (input.fillHistory ?? 0) * STORAGE_VESSEL_FILL_HISTORY_PRICE_DECAY);
  const genericBreakdown = getBuyGoodsPriceBreakdown({
    basePrice: STORAGE_VESSEL_BASE_PRICE,
    itemMultiplier: capacityMultiplier * materialMultiplier * qualityMultiplier * ageMultiplier * cleanlinessMultiplier * conditionMultiplier * fillHistoryMultiplier * input.supplierBaseMultiplier,
    supplierRelationshipMultiplier: input.supplierRelationshipMultiplier,
    companyPrestige: input.companyPrestige,
  });

  return {
    ...genericBreakdown,
    capacityMultiplier,
    materialMultiplier,
    qualityMultiplier,
    cleanlinessMultiplier,
    conditionMultiplier,
    fillHistoryMultiplier,
    ageYears,
    ageMultiplier,
    supplierBaseMultiplier: input.supplierBaseMultiplier,
    qualityScore: input.qualityScore,
    capacityLitres: input.capacityLitres,
    catalogueId: input.catalogueId ?? 'stainless_steel_tank_500',
    finalPricePerVessel: input.effectivePricePerVessel ?? genericBreakdown.finalPrice,
  };
}

function isStorageVesselOfferPriceSnapshot(value: unknown): value is StorageVesselOfferPriceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<StorageVesselOfferPriceSnapshot>;
  return typeof snapshot.supplierBaseMultiplier === 'number'
    && typeof snapshot.supplierRelationshipMultiplier === 'number'
    && typeof snapshot.companyPrestige === 'number';
}

function isCurrentStorageVesselOffer(record: BuyMarketOfferRecord): record is BuyMarketOfferRecord & { payload: StorageVesselOfferPayload } {
  if (!STORAGE_VESSEL_SUPPLIERS.some((supplier) => supplier.id === record.sellerId) || record.originTag !== 'seasonal_supplier') return false;
  const payload = record.payload as Partial<StorageVesselOfferPayload>;
  return typeof payload.catalogueId === 'string'
    && Boolean(getStorageVesselCatalogueEntry(payload.catalogueId))
    && getStorageVesselCatalogueEntry(payload.catalogueId).vesselType === payload.vesselType
    && getStorageVesselCatalogueEntry(payload.catalogueId).material === payload.material
    && getStorageVesselCatalogueEntry(payload.catalogueId).capacityLitres === payload.capacityLitres
    && typeof payload.qualityScore === 'number'
    && typeof payload.productionYear === 'number'
    && typeof payload.capacityLitres === 'number'
    && isStorageVesselOfferPriceSnapshot(payload.priceSnapshot);
}

function toStorageVesselOffer(record: BuyMarketOfferRecord & { payload: StorageVesselOfferPayload }, counterpartyRelationship?: BuyMarketCounterpartyRelationship): StorageVesselMarketOffer {
  const payload = record.payload;
  const priceBreakdown = getStorageVesselPriceBreakdown({
    capacityLitres: payload.capacityLitres,
    catalogueId: payload.catalogueId,
    productionYear: payload.productionYear,
    currentYear: getGameState().currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    qualityScore: payload.qualityScore,
    cleanliness: 'clean',
    supplierBaseMultiplier: payload.priceSnapshot.supplierBaseMultiplier,
    supplierRelationshipMultiplier: payload.priceSnapshot.supplierRelationshipMultiplier,
    companyPrestige: payload.priceSnapshot.companyPrestige,
    effectivePricePerVessel: record.effectivePricePerUnit,
  });

  return {
    kind: 'supplier',
    source: {
      kind: 'supplier_stock',
      seller: { kind: 'supplier', id: record.sellerId, name: record.sellerName },
    },
    id: record.offerId,
    availableUnits: record.availableUnits,
    basePricePerVessel: record.basePricePerUnit,
    pricePerVessel: record.effectivePricePerUnit,
    createdYear: record.createdYear,
    createdSeason: record.createdSeason,
    createdWeek: record.createdWeek,
    expiresYear: record.expiresYear,
    expiresSeason: record.expiresSeason,
    expiresWeek: record.expiresWeek,
    counterpartyRelationship,
    priceBreakdown,
    payload,
  };
}

function toUsedStorageVesselOffer(listing: StorageVesselMarketListing, vessel: StorageVessel, date: { year: number; season: string; week: number }, counterpartyRelationship?: BuyMarketCounterpartyRelationship): StorageVesselMarketOffer {
  const condition = projectUsedStorageVesselCondition(listing, vessel, date);
  const basePrice = calculateUsedStorageVesselMarketValue(vessel, condition, date.year);
  let source: BuyMarketOfferSource;
  if (listing.sellerKind === 'company') {
    const sellerCompanyId = listing.sellerCompanyId;
    if (!sellerCompanyId) throw new Error(`Company listing ${listing.id} is missing seller company provenance.`);
    source = {
      kind: 'company_listing',
      seller: { kind: 'company', id: sellerCompanyId, name: listing.sellerName, companyId: sellerCompanyId },
    };
  } else {
    source = { kind: 'npc_used', seller: { kind: 'npc', id: listing.sellerCounterpartyId, name: listing.sellerName } };
  }
  const relationshipMultiplier = getBuyMarketCounterpartyPriceMultiplier(counterpartyRelationship?.level ?? 0);
  const price = Number((basePrice * relationshipMultiplier).toFixed(2));
  return {
    kind: 'used_listing', source,
    id: listing.id,
    availableUnits: 1, basePricePerVessel: price, pricePerVessel: price,
    createdYear: listing.listedYear, createdSeason: listing.listedSeason as Season, createdWeek: listing.listedWeek,
    expiresYear: listing.retiredYear, expiresSeason: listing.retiredSeason as Season, expiresWeek: listing.retiredWeek,
    priceBreakdown: getStorageVesselPriceBreakdown({
      capacityLitres: vessel.capacityLitres, catalogueId: vessel.catalogueId, productionYear: vessel.productionYear, currentYear: date.year,
      qualityScore: vessel.qualityScore, cleanliness: vessel.cleanliness, condition, fillHistory: vessel.fillHistory,
      supplierBaseMultiplier: 1, supplierRelationshipMultiplier: relationshipMultiplier, companyPrestige: 0, effectivePricePerVessel: price,
    }),
    payload: {
      vesselType: vessel.vesselType, material: vessel.material, qualityScore: vessel.qualityScore,
      vesselName: vessel.vesselName, condition, fillHistory: vessel.fillHistory, cleanliness: vessel.cleanliness,
      catalogueId: vessel.catalogueId, productionYear: vessel.productionYear, capacityLitres: vessel.capacityLitres,
      priceSnapshot: { supplierBaseMultiplier: 1, supplierRelationshipMultiplier: 1, companyPrestige: 0 },
    },
    usedListing: listing, listedVessel: vessel,
    counterpartyRelationship,
  };
}

async function ensureStorageVesselOffers(companyId: string): Promise<void> {
  const { data: existing, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;
  const currentOffers = existing.filter(isCurrentStorageVesselOffer);
  await Promise.all(existing.filter((offer) => !isCurrentStorageVesselOffer(offer)).map((offer) => deleteBuyMarketOffer(companyId, offer.offerId)));
  const state = getGameState();
  const createdYear = state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;
  const createdSeason = state.season ?? GAME_INITIALIZATION.STARTING_SEASON;
  const expires = getNextSeasonDate(createdSeason, createdYear);
  const expectedOfferCount = STORAGE_VESSEL_SUPPLIERS.length * STORAGE_VESSEL_CATALOGUE.length;
  if (currentOffers.some((offer) => offer.lastRefreshedYear === createdYear && offer.lastRefreshedSeason === createdSeason)) return;

  const previousOffers = currentOffers;
  const relationships = await getBuyMarketCounterpartyRelationships(STORAGE_VESSEL_SUPPLIERS.map((supplier) => ({ kind: 'supplier' as const, id: supplier.id, name: supplier.name })));
  const retainedOffers = previousOffers
    .filter((offer) => offer.availableUnits > 0 && deterministicSeasonalVariation(`${offer.offerId}:${createdYear}:${createdSeason}:retention`, 0, 1) < getStorageVesselOfferRetentionChance(relationships[`supplier:${offer.sellerId}`]?.level ?? 0))
    .slice(0, expectedOfferCount);
  const retainedIds = new Set(retainedOffers.map((offer) => offer.offerId));
  await Promise.all(retainedOffers.map((offer) => updateBuyMarketOffer(companyId, offer.offerId, {
    lastRefreshedYear: createdYear,
    lastRefreshedSeason: createdSeason,
    lastRefreshedWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
    expiresYear: expires.year,
    expiresSeason: expires.season,
    expiresWeek: 1,
  })));

  const companyValue = await calculateCompanyValue().catch(() => 0);
  const generatedNameCounts = new Map<string, number>();
  const created = STORAGE_VESSEL_SUPPLIERS.flatMap((supplier) => STORAGE_VESSEL_CATALOGUE.map<BuyMarketOfferRecord>((catalogue) => {
    const { id: catalogueId, vesselType, material, capacityLitres } = catalogue;
    const seed = `${companyId}:${state.currentYear}:${state.season}:${supplier.id}:${catalogueId}`;
    const qualityScore = Number(deterministicSeasonalVariation(`${seed}:quality`, 0, 1).toFixed(2));
    const ageSample = deterministicSeasonalVariation(`${seed}:age`, 0, 1);
    // Cubic weighting makes younger casks the normal case while retaining an occasional old cask.
    const ageYears = Math.floor(Math.pow(ageSample, 3) * (STORAGE_VESSEL_MAX_GENERATED_AGE_YEARS + 1));
    const productionYear = (state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR) - ageYears;
    const priceSnapshot = {
      supplierBaseMultiplier: supplier.basePriceMultiplier,
      supplierRelationshipMultiplier: getBuyMarketCounterpartyPriceMultiplier(relationships[`supplier:${supplier.id}`]?.level ?? 0),
      companyPrestige: state.prestige ?? 0,
    };
    const priceBreakdown = getStorageVesselPriceBreakdown({
      capacityLitres,
      catalogueId,
      productionYear,
      currentYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      qualityScore,
      cleanliness: 'clean',
      ...priceSnapshot,
    });
    const nameBase = getStorageVesselNameBase(`${companyId}:${supplier.id}:${productionYear}:${catalogueId}`, material, capacityLitres);
    const nameNumber = (generatedNameCounts.get(nameBase) ?? 0) + 1;
    generatedNameCounts.set(nameBase, nameNumber);
    return {
      companyId,
      offerId: `${STORAGE_VESSEL_OFFER_PREFIX}_${companyId}_${state.currentYear}_${state.season}_${supplier.id}_${capacityLitres}`,
      wareGroup: 'storage_vessels',
      sellerId: supplier.id, sellerName: supplier.name, originTag: 'seasonal_supplier', availableUnits: getBuyGoodsOfferAvailability(`${seed}:availability`, companyValue, state.prestige ?? 0, 1, 4),
      unit: 'vessel',
      basePricePerUnit: STORAGE_VESSEL_BASE_PRICE * (capacityLitres / STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES) * catalogue.materialPriceMultiplier, effectivePricePerUnit: Number(priceBreakdown.finalPrice.toFixed(2)), isPersistent: false,
      createdYear,
      createdSeason,
      createdWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      lastRefreshedYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      lastRefreshedSeason: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
      lastRefreshedWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      expiresYear: expires.year,
      expiresSeason: expires.season,
      expiresWeek: 1,
      payload: {
        catalogueId, vesselType, material, qualityScore, productionYear, capacityLitres, priceSnapshot,
        vesselName: `${nameBase} #${nameNumber}`,
        condition: 1, fillHistory: 0, cleanliness: 'clean',
      },
    };
  }));
  const offersNeeded = Math.max(0, expectedOfferCount - retainedOffers.length);
  const activeIds = retainedIds;
  await Promise.all(currentOffers.filter((offer) => !activeIds.has(offer.offerId)).map((offer) => deleteBuyMarketOffer(companyId, offer.offerId)));
  await upsertBuyMarketOffers(created.filter((offer) => !activeIds.has(offer.offerId)).slice(0, offersNeeded));
}

export async function getStorageVesselMarketOffers(): Promise<StorageVesselMarketOffer[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  await ensureStorageVesselOffers(companyId);
  const state = getGameState();
  await ensureGlobalStorageVesselSupplierListings({
    year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
    week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
  });
  const [{ data, error }, usedResult] = await Promise.all([getCompanyBuyMarketOffers(companyId, 'storage_vessels'), getActiveStorageVesselMarketListings()]);
  if (error) throw error;
  if (usedResult.error) throw usedResult.error;
  const date = { year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR, season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON, week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK };
  const sourceRows = usedResult.data.map(({ listing }) => listing.sellerKind === 'company'
    ? { kind: 'company' as const, id: listing.sellerCompanyId ?? '', companyId: listing.sellerCompanyId ?? '', name: listing.sellerName }
    : { kind: 'npc' as const, id: listing.sellerCounterpartyId, name: listing.sellerName });
  const relationships = await getBuyMarketCounterpartyRelationships([
    ...data.map((offer) => ({ kind: 'supplier' as const, id: offer.sellerId, name: offer.sellerName })),
    ...sourceRows.filter((source) => source.id),
  ]);
  const supplierOffers = data.filter((offer): offer is BuyMarketOfferRecord & { payload: StorageVesselOfferPayload } => offer.availableUnits > 0 && isCurrentStorageVesselOffer(offer)).map((offer) => toStorageVesselOffer(offer, relationships[`supplier:${offer.sellerId}`]));
  const usedOffers = usedResult.data
    .filter(({ listing }) => isUsedStorageVesselListingVisible(listing, date))
    .map(({ listing, vessel }) => {
      const source = listing.sellerKind === 'company' ? { kind: 'company' as const, id: listing.sellerCompanyId ?? '' } : { kind: 'npc' as const, id: listing.sellerCounterpartyId };
      return toUsedStorageVesselOffer(listing, vessel, date, source.id ? relationships[getBuyMarketCounterpartyKey(source)] : undefined);
    });
  return [...supplierOffers, ...usedOffers];
}

export async function purchaseUsedStorageVesselOffer(offer: StorageVesselMarketOffer): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId || offer.kind !== 'used_listing' || !offer.usedListing) return { success: false, error: 'Used vessel listing not found.' };
  const state = getGameState();
  if ((state.money ?? 0) < offer.pricePerVessel) return { success: false, error: 'Insufficient funds.' };
  const result = await purchaseUsedStorageVesselListing({
    companyId, listingId: offer.usedListing.id,
    year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR, season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON, week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
  });
  if (result.error || !result.data?.transaction) return { success: false, error: 'This vessel is no longer available.' };
  await syncPersistedTransaction(result.data.transaction);
  triggerTopicUpdate('storage_vessels');
  return { success: true };
}

export async function purchaseStorageVesselOffer(offerId: string, quantity: number): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const safeQuantity = Math.max(1, Math.round(quantity));
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer || offer.wareGroup !== 'storage_vessels') {
    const usedOffer = (await getStorageVesselMarketOffers()).find((candidate) => candidate.id === offerId && candidate.kind === 'used_listing');
    return usedOffer ? purchaseUsedStorageVesselOffer(usedOffer) : { success: false, error: 'Storage Vessel offer not found.' };
  }
  if (safeQuantity > offer.availableUnits) return { success: false, error: `Requested quantity exceeds available vessels (${offer.availableUnits}).` };
  const payload = offer.payload as unknown as StorageVesselOfferPayload;

  const totalCost = Number((offer.effectivePricePerUnit * safeQuantity).toFixed(2));
  if ((getGameState().money ?? 0) < totalCost) return { success: false, error: `Insufficient funds. Required ${formatNumber(totalCost, { currency: true, decimals: 0 })}.` };

  const state = getGameState();
  const date = {
    week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
    season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
    year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
  };
  const existingVesselsResult = await getCompanyStorageVessels(companyId);
  if (existingVesselsResult.error) return { success: false, error: 'Could not determine the next vessel name.' };
  const vesselNameBase = getStorageVesselNameBase(`${companyId}:${offer.sellerId}:${payload.productionYear}`, payload.material, payload.capacityLitres);
  const existingNameCount = existingVesselsResult.data.filter((vessel) =>
    vessel.vesselName?.startsWith(`${vesselNameBase} #`)
    && vessel.productionYear === payload.productionYear
    && vessel.material === payload.material
    && vessel.capacityLitres <= 500 === (payload.capacityLitres <= 500)
  ).length;
  const { claimed, error: claimError } = await claimBuyMarketOfferUnits(companyId, offer.offerId, safeQuantity);
  if (claimError || !claimed) {
    return { success: false, error: 'Offer availability or funds changed. Please reopen the market.' };
  }

  try {
    await addTransaction(
      -totalCost,
      `Market Purchase: ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName}`,
      TRANSACTION_CATEGORIES.SUPPLIES,
      false,
      companyId,
      true,
    );
  } catch (transactionError) {
    await releaseBuyMarketOfferUnits(companyId, offer.offerId, safeQuantity);
    console.error('Storage Vessel purchase transaction failed:', transactionError);
    return { success: false, error: 'Insufficient funds. Please reopen the market and try again.' };
  }

  const vessels: StorageVessel[] = Array.from({ length: safeQuantity }, (_, index) => ({
    id: uuidv4(),
    vesselName: `${vesselNameBase} #${existingNameCount + index + 1}`,
    ownerKind: 'company',
    ownerCompanyId: companyId,
    catalogueId: payload.catalogueId,
    vesselType: payload.vesselType,
    material: payload.material,
    qualityScore: payload.qualityScore,
    condition: 1,
    fillHistory: 0,
    productionYear: payload.productionYear,
    capacityLitres: payload.capacityLitres,
    acquisitionPrice: offer.effectivePricePerUnit,
    sourceOfferId: offer.offerId,
    operationalStatus: 'operational',
    cleanliness: 'clean',
    occupancy: 'available',
    purchasedYear: date.year,
    purchasedSeason: date.season,
    purchasedWeek: date.week,
  }));
  const { error: vesselError } = await insertStorageVessels(vessels);
  if (vesselError) {
    console.error('Storage Vessel purchase could not persist purchased vessels:', vesselError);
    return { success: false, error: 'Payment succeeded, but the cask could not be saved. Please reload before trying again.' };
  }

  try {
    await recordBuyMarketCounterpartyPurchaseForActiveCompany({ kind: 'supplier', id: offer.sellerId, name: offer.sellerName }, safeQuantity, totalCost);
    await notificationService.addMessage(
      `Purchased ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName} for ${formatNumber(totalCost, { currency: true, decimals: 0 })}.`,
      'storageVesselMarketAdapter.purchaseStorageVesselOffer',
      'Storage Vessel Purchase',
      NotificationCategory.WINEMAKING_PROCESS,
    );
    triggerTopicUpdate('storage_vessels');
  } catch (postPurchaseError) {
    console.error('Storage Vessel purchase completed without optional follow-up:', postPurchaseError);
  }
  return { success: true };
}

export async function refreshStorageVesselMarket(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;
  await ensureStorageVesselOffers(companyId);
}

/**
 * Admin-only market reset for the active company. Supplier relationships and
 * purchased inventory remain intact; only persisted storage vessel listings refresh.
 */
export async function recreateStorageVesselMarketOffers(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) throw new Error('No active company selected.');

  const { data, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;

  const deletionResults = await Promise.all(
    data.map((offer) => deleteBuyMarketOffer(companyId, offer.offerId)),
  );
  const deletionError = deletionResults.find((result) => result.error)?.error;
  if (deletionError) throw deletionError;

  await ensureStorageVesselOffers(companyId);
  triggerTopicUpdate('storage_vessels');
}
