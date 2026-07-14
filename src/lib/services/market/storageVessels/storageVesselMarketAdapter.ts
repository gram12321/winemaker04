import { syncPersistedTransaction } from '@/lib/services/finance/financeService';
import { notificationService } from '@/lib/services/core/notificationService';
import { getGameState } from '@/lib/services/core/gameState';
import {
  getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers,
  updateBuyMarketOffer,
  deleteBuyMarketOffer,
  purchaseStorageVesselOfferAtomically,
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
  const expectedOfferCount = STORAGE_VESSEL_SUPPLIERS.length * STORAGE_VESSEL_SIZES_LITRES.length;
  if (existing.some((offer) => offer.lastRefreshedYear === createdYear && offer.lastRefreshedSeason === createdSeason)) return;

  const previousOffers = existing;
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
  const offersNeeded = Math.max(0, expectedOfferCount - retainedOffers.length);
  const activeIds = retainedIds;
  await Promise.all(existing.filter((offer) => !activeIds.has(offer.offerId)).map((offer) => deleteBuyMarketOffer(companyId, offer.offerId)));
  await upsertBuyMarketOffers(created.filter((offer) => !activeIds.has(offer.offerId)).slice(0, offersNeeded));
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

export async function purchaseStorageVesselOffer(offerId: string, quantity: number, purchaseId = uuidv4()): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const safeQuantity = Math.max(1, Math.round(quantity));
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer || offer.wareGroup !== 'storage_vessels') return { success: false, error: 'Storage Vessel offer not found.' };
  if (safeQuantity > offer.availableUnits) return { success: false, error: `Requested quantity exceeds available vessels (${offer.availableUnits}).` };

  const totalCost = Number((offer.effectivePricePerUnit * safeQuantity).toFixed(2));
  if ((getGameState().money ?? 0) < totalCost) return { success: false, error: `Insufficient funds. Required ${formatNumber(totalCost, { currency: true, decimals: 0 })}.` };

  const state = getGameState();
  const purchase = await purchaseStorageVesselOfferAtomically({
    companyId,
    purchaseId,
    offerId: offer.offerId,
    quantity: safeQuantity,
    week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
    season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
    year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    description: `Market Purchase: ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName}`,
    category: TRANSACTION_CATEGORIES.SUPPLIES,
  });
  if (purchase.error || !purchase.data?.transaction) return { success: false, error: 'Offer availability or funds changed. Please reopen the market.' };
  await syncPersistedTransaction(purchase.data.transaction);

  try {
    if (purchase.data.completedNow) {
      await recordBuyGoodsSupplierPurchase('storage_vessels', offer.sellerId, offer.sellerName, safeQuantity, totalCost);
    }
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
