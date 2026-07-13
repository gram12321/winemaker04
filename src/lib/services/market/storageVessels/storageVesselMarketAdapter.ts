import { addTransaction } from '@/lib/services/finance/financeService';
import { notificationService } from '@/lib/services/core/notificationService';
import { getGameState } from '@/lib/services/core/gameState';
import { createPurchasedStorageVessels, removePurchasedStorageVessels } from '@/lib/services/wine/winery/storageVesselService';
import {
  getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers,
  claimBuyMarketOfferUnits,
  releaseBuyMarketOfferUnits,
  upsertBuyMarketOffers,
} from '@/lib/database/market/buyMarketOffersDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { formatNumber } from '@/lib/utils';
import { GAME_INITIALIZATION, STORAGE_VESSEL_CATALOG, STORAGE_VESSEL_OFFER_PREFIX, TRANSACTION_CATEGORIES } from '@/lib/constants';
import type { BuyMarketOfferRecord, BuyMarketPurchaseResult } from '@/lib/types/market';
import type { StorageVesselOfferPayload } from '@/lib/types/storageVessels';
import { NotificationCategory } from '@/lib/types/types';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';

export interface StorageVesselMarketOffer {
  id: string;
  sellerName: string;
  availableUnits: number;
  pricePerVessel: number;
  payload: StorageVesselOfferPayload;
}

function toStorageVesselOffer(record: BuyMarketOfferRecord): StorageVesselMarketOffer {
  return {
    id: record.offerId,
    sellerName: record.sellerName,
    availableUnits: record.availableUnits,
    pricePerVessel: record.effectivePricePerUnit,
    payload: record.payload as unknown as StorageVesselOfferPayload,
  };
}

async function ensureStorageVesselOffers(companyId: string): Promise<void> {
  const { data, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;
  const existing = new Set(data.map((offer) => offer.offerId));
  const state = getGameState();
  const created = STORAGE_VESSEL_CATALOG
    .filter((entry) => !existing.has(`${STORAGE_VESSEL_OFFER_PREFIX}_${entry.id}`))
    .map<BuyMarketOfferRecord>((entry) => ({
      companyId,
      offerId: `${STORAGE_VESSEL_OFFER_PREFIX}_${entry.id}`,
      wareGroup: 'storage_vessels',
      sellerId: 'cellar_equipment_merchant',
      sellerName: 'Cellar Equipment Merchant',
      originTag: 'catalogue',
      availableUnits: entry.availableUnits,
      unit: 'vessel',
      basePricePerUnit: entry.price,
      effectivePricePerUnit: entry.price,
      isPersistent: true,
      createdYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      createdSeason: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
      createdWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      lastRefreshedYear: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
      lastRefreshedSeason: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
      lastRefreshedWeek: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
      expiresYear: null,
      expiresSeason: null,
      expiresWeek: null,
      payload: {
        vesselType: entry.vesselType,
        material: entry.material,
        capacityLitres: entry.capacityLitres,
      },
    }));
  await upsertBuyMarketOffers(created);
}

export async function getStorageVesselMarketOffers(): Promise<StorageVesselMarketOffer[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  await ensureStorageVesselOffers(companyId);
  const { data, error } = await getCompanyBuyMarketOffers(companyId, 'storage_vessels');
  if (error) throw error;
  return data.filter((offer) => offer.availableUnits > 0).map(toStorageVesselOffer);
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
    await addTransaction(-totalCost, `Market Purchase: ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName}`, TRANSACTION_CATEGORIES.SUPPLIES, false, companyId);
    await notificationService.addMessage(
      `Purchased ${safeQuantity} storage vessel${safeQuantity === 1 ? '' : 's'} from ${offer.sellerName} for ${formatNumber(totalCost, { currency: true, decimals: 0 })}.`,
      'storageVesselMarketAdapter.purchaseStorageVesselOffer',
      'Storage Vessel Purchase',
      NotificationCategory.WINEMAKING_PROCESS,
    );
    triggerTopicUpdate('storage_vessels');
    return { success: true };
  } catch (purchaseError) {
    try {
      await removePurchasedStorageVessels(purchasedVesselIds);
    } catch (removeError) {
      console.error('Failed to remove partially created Storage Vessels:', removeError);
    }
    try {
      await releaseBuyMarketOfferUnits(companyId, offer.offerId, safeQuantity);
    } catch (releaseError) {
      console.error('Failed to restore Storage Vessel offer availability:', releaseError);
    }
    console.error('Failed to purchase Storage Vessel offer:', purchaseError);
    return { success: false, error: 'Could not complete Storage Vessel purchase. Please try again.' };
  }
}

export async function refreshStorageVesselMarket(): Promise<void> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;
  await ensureStorageVesselOffers(companyId);
}
