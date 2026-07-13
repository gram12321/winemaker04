import { addTransaction } from '@/lib/services/finance/financeService';
import { notificationService } from '@/lib/services/core/notificationService';
import { getGameState } from '@/lib/services/core/gameState';
import { createPurchasedStorageVessels, removePurchasedStorageVessels } from '@/lib/services/wine/winery/storageVesselService';
import {
  getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers,
  claimBuyMarketOfferUnits,
  updateBuyMarketOffer,
  deleteBuyMarketOffer,
  releaseBuyMarketOfferUnits,
  upsertBuyMarketOffers,
} from '@/lib/database/market/buyMarketOffersDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { deterministicSeasonalVariation, formatNumber } from '@/lib/utils';
import { GAME_INITIALIZATION, STORAGE_VESSEL_BASE_PRICE, STORAGE_VESSEL_MAX_PRICE, STORAGE_VESSEL_MIN_PRICE, STORAGE_VESSEL_OFFER_PREFIX, STORAGE_VESSEL_OFFER_RETENTION_CHANCE, STORAGE_VESSEL_SIZES_LITRES, STORAGE_VESSEL_SUPPLIERS, TRANSACTION_CATEGORIES } from '@/lib/constants';
import { calculateCompanyValue } from '@/lib/services/finance/financeService';
import { calculateBuyGoodsPrice, getBuyGoodsOfferAvailability } from '@/lib/services/market/buyGoods/buyGoodsPricing';
import { getBuyGoodsSupplierRelationshipPriceMultiplier, getBuyGoodsSupplierRelationships, recordBuyGoodsSupplierPurchase } from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';
import type { BuyMarketOfferRecord, BuyMarketPurchaseResult } from '@/lib/types/market';
import type { StorageVesselOfferPayload } from '@/lib/types/storageVessels';
import { NotificationCategory, type Season } from '@/lib/types/types';
import type { BuyGoodsSupplierRelationship } from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';

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
  payload: StorageVesselOfferPayload;
}

function toStorageVesselOffer(record: BuyMarketOfferRecord, supplierLoyalty?: BuyGoodsSupplierRelationship): StorageVesselMarketOffer {
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
    payload: record.payload as unknown as StorageVesselOfferPayload,
  };
}

function getNextSeason(season: Season, year: number): { season: Season; year: number } {
  const order: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];
  const nextIndex = (order.indexOf(season) + 1) % order.length;
  return { season: order[nextIndex], year: season === 'Winter' ? year + 1 : year };
}

async function ensureStorageVesselOffers(companyId: string): Promise<void> {
  const { data: existing, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;
  const state = getGameState();
  const createdYear = state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR;
  const createdSeason = state.season ?? GAME_INITIALIZATION.STARTING_SEASON;
  const expires = getNextSeason(createdSeason, createdYear);
  const currentOfferPrefix = `${STORAGE_VESSEL_OFFER_PREFIX}_${state.currentYear}_${state.season}_`;
  const expectedOfferCount = STORAGE_VESSEL_SUPPLIERS.length * STORAGE_VESSEL_SIZES_LITRES.length;
  if (existing.filter((offer) => offer.offerId.startsWith(currentOfferPrefix)).length === expectedOfferCount) return;

  const previousOffers = existing.filter((offer) => !offer.offerId.startsWith(currentOfferPrefix));
  const retainedOffers = previousOffers
    .filter((offer) => offer.availableUnits > 0 && deterministicSeasonalVariation(`${offer.offerId}:${createdYear}:${createdSeason}:retention`, 0, 1) < STORAGE_VESSEL_OFFER_RETENTION_CHANCE)
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
  const relationships = await getBuyGoodsSupplierRelationships('storage_vessels', STORAGE_VESSEL_SUPPLIERS.map((supplier) => supplier.id));
  const created = STORAGE_VESSEL_SUPPLIERS.flatMap((supplier) => STORAGE_VESSEL_SIZES_LITRES.map<BuyMarketOfferRecord>((capacityLitres) => {
    const seed = `${state.currentYear}:${state.season}:${supplier.id}:${capacityLitres}`;
    const qualityScore = Number(deterministicSeasonalVariation(`${seed}:quality`, 0.35, 0.95).toFixed(2));
    const productionYear = (state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR) - Math.floor(deterministicSeasonalVariation(`${seed}:age`, 0, 12));
    const price = calculateBuyGoodsPrice({ basePrice: STORAGE_VESSEL_BASE_PRICE, itemMultiplier: (capacityLitres / 250) * (0.65 + qualityScore * 0.7) * supplier.basePriceMultiplier, supplierRelationshipMultiplier: getBuyGoodsSupplierRelationshipPriceMultiplier(relationships[supplier.id]?.level ?? 0), companyPrestige: state.prestige ?? 0, minimumPrice: STORAGE_VESSEL_MIN_PRICE, maximumPrice: STORAGE_VESSEL_MAX_PRICE });
    return {
      companyId,
      offerId: `${STORAGE_VESSEL_OFFER_PREFIX}_${state.currentYear}_${state.season}_${supplier.id}_${capacityLitres}`,
      wareGroup: 'storage_vessels',
      sellerId: supplier.id, sellerName: supplier.name, originTag: 'seasonal_supplier', availableUnits: getBuyGoodsOfferAvailability(`${seed}:availability`, companyValue, state.prestige ?? 0, 1, 4),
      unit: 'vessel',
      basePricePerUnit: STORAGE_VESSEL_BASE_PRICE * (capacityLitres / 250), effectivePricePerUnit: Number(price.toFixed(2)), isPersistent: false,
      createdYear,
      createdSeason,
      createdWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      lastRefreshedYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      lastRefreshedSeason: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
      lastRefreshedWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      expiresYear: expires.year,
      expiresSeason: expires.season,
      expiresWeek: 1,
      payload: { vesselType: 'cask', material: 'oak', qualityScore, productionYear, capacityLitres },
    };
  }));
  const currentOfferCount = existing.filter((offer) => offer.offerId.startsWith(currentOfferPrefix)).length;
  const offersNeeded = Math.max(0, expectedOfferCount - retainedOffers.length - currentOfferCount);
  const activeIds = new Set([...retainedIds, ...existing.filter((offer) => offer.offerId.startsWith(currentOfferPrefix)).map((offer) => offer.offerId)]);
  await Promise.all(existing.filter((offer) => !activeIds.has(offer.offerId)).map((offer) => deleteBuyMarketOffer(companyId, offer.offerId)));
  await upsertBuyMarketOffers(created.slice(0, offersNeeded));
}

export async function getStorageVesselMarketOffers(): Promise<StorageVesselMarketOffer[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  await ensureStorageVesselOffers(companyId);
  const { data, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;
  const relationships = await getBuyGoodsSupplierRelationships('storage_vessels', data.map((offer) => offer.sellerId));
  return data.filter((offer) => offer.availableUnits > 0).map((offer) => toStorageVesselOffer(offer, relationships[offer.sellerId]));
}

export async function purchaseStorageVesselOffer(offerId: string, quantity: number): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const safeQuantity = Math.max(1, Math.round(quantity));
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer || offer.wareGroup !== 'storage_vessels') return { success: false, error: 'Storage Vessel offer not found.' };
  if (safeQuantity > offer.availableUnits) return { success: false, error: `Requested quantity exceeds available vessels (${offer.availableUnits}).` };

  const totalCost = Number((offer.effectivePricePerUnit * safeQuantity).toFixed(2));
  if ((getGameState().money ?? 0) < totalCost) return { success: false, error: `Insufficient funds. Required ${formatNumber(totalCost, { currency: true, decimals: 0 })}.` };

  const claim = await claimBuyMarketOfferUnits(companyId, offer.offerId, safeQuantity);
  if (claim.error || !claim.claimed) return { success: false, error: 'Offer availability changed. Please reopen the market.' };

  let purchasedVesselIds: string[] = [];
  try {
    const vessels = await createPurchasedStorageVessels(offer.payload as unknown as StorageVesselOfferPayload, offer.offerId, offer.effectivePricePerUnit, safeQuantity);
    purchasedVesselIds = vessels.map((vessel) => vessel.id);
    await addTransaction(-totalCost, `Market Purchase: ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName}`, TRANSACTION_CATEGORIES.SUPPLIES, false, companyId, true);
    try {
      await recordBuyGoodsSupplierPurchase('storage_vessels', offer.sellerId, offer.sellerName, safeQuantity, totalCost);
    } catch (relationshipError) {
      console.error('Failed to record Storage Vessel supplier relationship:', relationshipError);
    }
    await notificationService.addMessage(
      `Purchased ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName} for ${formatNumber(totalCost, { currency: true, decimals: 0 })}.`,
      'storageVesselMarketAdapter.purchaseStorageVesselOffer',
      'Storage Vessel Purchase',
      NotificationCategory.WINEMAKING_PROCESS,
    );
    triggerTopicUpdate('storage_vessels');
    return { success: true };
  } catch (purchaseError) {
    let removed = purchasedVesselIds.length === 0;
    try {
      await removePurchasedStorageVessels(purchasedVesselIds);
      removed = true;
    } catch (removeError) {
      console.error('Failed to remove partially created Storage Vessels:', removeError);
    }
    if (removed) {
      try {
        await releaseBuyMarketOfferUnits(companyId, offer.offerId, safeQuantity);
      } catch (releaseError) {
        console.error('Failed to restore Storage Vessel offer availability:', releaseError);
      }
    }
    console.error('Failed to purchase Storage Vessel offer:', purchaseError);
    return removed
      ? { success: false, error: 'Could not complete Storage Vessel purchase. Please try again.' }
      : { success: false, error: 'The Storage Vessel purchase needs reconciliation before trying again.' };
  }
}

export async function refreshStorageVesselMarket(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;
  await ensureStorageVesselOffers(companyId);
}
