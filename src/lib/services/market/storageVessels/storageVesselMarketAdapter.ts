import { addTransaction, calculateCompanyValue } from '@/lib/services/finance/financeService';
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
import { GAME_INITIALIZATION, STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS, STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER, STORAGE_VESSEL_BASE_PRICE, STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS, STORAGE_VESSEL_OFFER_PREFIX, STORAGE_VESSEL_OFFER_RETENTION_CHANCE, STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES, STORAGE_VESSEL_SIZES_LITRES, STORAGE_VESSEL_SUPPLIERS, TRANSACTION_CATEGORIES } from '@/lib/constants';
import { insertStorageVessels } from '@/lib/database/winery/storageVesselsDB';
import { getBuyGoodsOfferAvailability, getBuyGoodsPriceBreakdown, type BuyGoodsPriceBreakdown } from '@/lib/services/market/buyGoods/buyGoodsPricing';
import {
  getBuyGoodsSupplierPersistenceBonus,
  getBuyGoodsSupplierRelationshipPriceMultiplier,
  getBuyGoodsSupplierRelationships,
  recordBuyGoodsSupplierPurchase,
  type BuyGoodsSupplierRelationship,
  type BuyGoodsSupplierRelationshipLevel,
} from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';
import type { BuyMarketOfferRecord, BuyMarketPurchaseResult } from '@/lib/types/market';
import type { StorageVessel, StorageVesselCleanliness, StorageVesselOfferPayload, StorageVesselOfferPriceSnapshot } from '@/lib/types/storageVessels';
import { NotificationCategory, type Season } from '@/lib/types/types';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { v4 as uuidv4 } from 'uuid';

export interface StorageVesselMarketOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  availableUnits: number;
  basePricePerVessel: number;
  pricePerVessel: number;
  createdYear: number;
  createdSeason: Season;
  createdWeek: number;
  expiresYear: number | null;
  expiresSeason: Season | null;
  expiresWeek: number | null;
  supplierLoyalty?: BuyGoodsSupplierRelationship;
  priceBreakdown: StorageVesselPriceBreakdown;
  payload: StorageVesselOfferPayload;
}

export interface StorageVesselPriceBreakdown extends BuyGoodsPriceBreakdown {
  capacityMultiplier: number;
  qualityMultiplier: number;
  supplierBaseMultiplier: number;
  qualityScore: number;
  cleanlinessMultiplier: number;
  ageYears: number;
  ageMultiplier: number;
  capacityLitres: number;
  finalPricePerVessel: number;
}

export function getStorageVesselOfferRetentionChance(level: BuyGoodsSupplierRelationshipLevel): number {
  return Math.min(1, STORAGE_VESSEL_OFFER_RETENTION_CHANCE + getBuyGoodsSupplierPersistenceBonus(level));
}

export function getStorageVesselPriceBreakdown(input: {
  capacityLitres: number;
  productionYear: number;
  currentYear: number;
  qualityScore: number;
  cleanliness: StorageVesselCleanliness;
  supplierBaseMultiplier: number;
  supplierRelationshipMultiplier?: number;
  companyPrestige?: number;
  effectivePricePerVessel?: number;
}): StorageVesselPriceBreakdown {
  const capacityMultiplier = input.capacityLitres / STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES;
  const ageYears = Math.max(0, input.currentYear - input.productionYear);
  const ageMultiplier = STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER
    + (1 - STORAGE_VESSEL_AGE_RESIDUAL_MULTIPLIER) * Math.exp(-ageYears / STORAGE_VESSEL_AGE_DECAY_SCALE_YEARS);
  const qualityMultiplier = input.qualityScore * calculateAsymmetricalMultiplier(input.qualityScore);
  const cleanlinessMultiplier = STORAGE_VESSEL_CLEANLINESS_MULTIPLIERS[input.cleanliness];
  const genericBreakdown = getBuyGoodsPriceBreakdown({
    basePrice: STORAGE_VESSEL_BASE_PRICE,
    itemMultiplier: capacityMultiplier * qualityMultiplier * ageMultiplier * cleanlinessMultiplier * input.supplierBaseMultiplier,
    supplierRelationshipMultiplier: input.supplierRelationshipMultiplier,
    companyPrestige: input.companyPrestige,
  });

  return {
    ...genericBreakdown,
    capacityMultiplier,
    qualityMultiplier,
    cleanlinessMultiplier,
    ageYears,
    ageMultiplier,
    supplierBaseMultiplier: input.supplierBaseMultiplier,
    qualityScore: input.qualityScore,
    capacityLitres: input.capacityLitres,
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
  return payload.vesselType === 'cask'
    && payload.material === 'oak'
    && typeof payload.qualityScore === 'number'
    && typeof payload.productionYear === 'number'
    && typeof payload.capacityLitres === 'number'
    && isStorageVesselOfferPriceSnapshot(payload.priceSnapshot);
}

function toStorageVesselOffer(record: BuyMarketOfferRecord & { payload: StorageVesselOfferPayload }, supplierLoyalty?: BuyGoodsSupplierRelationship): StorageVesselMarketOffer {
  const payload = record.payload;
  const priceBreakdown = getStorageVesselPriceBreakdown({
    capacityLitres: payload.capacityLitres,
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
    id: record.offerId,
    sellerId: record.sellerId,
    sellerName: record.sellerName,
    availableUnits: record.availableUnits,
    basePricePerVessel: record.basePricePerUnit,
    pricePerVessel: record.effectivePricePerUnit,
    createdYear: record.createdYear,
    createdSeason: record.createdSeason,
    createdWeek: record.createdWeek,
    expiresYear: record.expiresYear,
    expiresSeason: record.expiresSeason,
    expiresWeek: record.expiresWeek,
    supplierLoyalty,
    priceBreakdown,
    payload,
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
  const expectedOfferCount = STORAGE_VESSEL_SUPPLIERS.length * STORAGE_VESSEL_SIZES_LITRES.length;
  if (currentOffers.some((offer) => offer.lastRefreshedYear === createdYear && offer.lastRefreshedSeason === createdSeason)) return;

  const previousOffers = currentOffers;
  const relationships = await getBuyGoodsSupplierRelationships('storage_vessels', STORAGE_VESSEL_SUPPLIERS.map((supplier) => supplier.id));
  const retainedOffers = previousOffers
    .filter((offer) => offer.availableUnits > 0 && deterministicSeasonalVariation(`${offer.offerId}:${createdYear}:${createdSeason}:retention`, 0, 1) < getStorageVesselOfferRetentionChance(relationships[offer.sellerId]?.level ?? 0))
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
  const created = STORAGE_VESSEL_SUPPLIERS.flatMap((supplier) => STORAGE_VESSEL_SIZES_LITRES.map<BuyMarketOfferRecord>((capacityLitres) => {
    const seed = `${state.currentYear}:${state.season}:${supplier.id}:${capacityLitres}`;
    const qualityScore = Number(deterministicSeasonalVariation(`${seed}:quality`, 0, 1).toFixed(2));
    const ageSample = deterministicSeasonalVariation(`${seed}:age`, 0, 1);
    // Cubic weighting makes younger casks the normal case while retaining an occasional old cask.
    const ageYears = Math.floor(Math.pow(ageSample, 3) * 41);
    const productionYear = (state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR) - ageYears;
    const priceSnapshot = {
      supplierBaseMultiplier: supplier.basePriceMultiplier,
      supplierRelationshipMultiplier: getBuyGoodsSupplierRelationshipPriceMultiplier(relationships[supplier.id]?.level ?? 0),
      companyPrestige: state.prestige ?? 0,
    };
    const priceBreakdown = getStorageVesselPriceBreakdown({
      capacityLitres,
      productionYear,
      currentYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      qualityScore,
      cleanliness: 'clean',
      ...priceSnapshot,
    });
    return {
      companyId,
      offerId: `${STORAGE_VESSEL_OFFER_PREFIX}_${state.currentYear}_${state.season}_${supplier.id}_${capacityLitres}`,
      wareGroup: 'storage_vessels',
      sellerId: supplier.id, sellerName: supplier.name, originTag: 'seasonal_supplier', availableUnits: getBuyGoodsOfferAvailability(`${seed}:availability`, companyValue, state.prestige ?? 0, 1, 4),
      unit: 'vessel',
      basePricePerUnit: STORAGE_VESSEL_BASE_PRICE * (capacityLitres / STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES), effectivePricePerUnit: Number(priceBreakdown.finalPrice.toFixed(2)), isPersistent: false,
      createdYear,
      createdSeason,
      createdWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      lastRefreshedYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      lastRefreshedSeason: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
      lastRefreshedWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      expiresYear: expires.year,
      expiresSeason: expires.season,
      expiresWeek: 1,
      payload: { vesselType: 'cask', material: 'oak', qualityScore, productionYear, capacityLitres, priceSnapshot },
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
  const { data, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;
  const relationships = await getBuyGoodsSupplierRelationships('storage_vessels', data.map((offer) => offer.sellerId));
  return data.filter((offer): offer is BuyMarketOfferRecord & { payload: StorageVesselOfferPayload } => offer.availableUnits > 0 && isCurrentStorageVesselOffer(offer)).map((offer) => toStorageVesselOffer(offer, relationships[offer.sellerId]));
}

export async function purchaseStorageVesselOffer(offerId: string, quantity: number): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const safeQuantity = Math.max(1, Math.round(quantity));
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer || offer.wareGroup !== 'storage_vessels') return { success: false, error: 'Storage Vessel offer not found.' };
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

  const vessels: StorageVessel[] = Array.from({ length: safeQuantity }, () => ({
    id: uuidv4(),
    companyId,
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
    await recordBuyGoodsSupplierPurchase('storage_vessels', offer.sellerId, offer.sellerName, safeQuantity, totalCost);
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
