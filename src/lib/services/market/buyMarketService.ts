import { getCompanyBuyMarketOffer, getCompanyBuyMarketOffers } from '@/lib/database/market/buyMarketOffersDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { purchaseBuyGrapeOffer } from '@/lib/services/sales/buyGrapeMarketService';
import { purchaseStorageVesselOffer, refreshStorageVesselMarket } from './storageVessels/storageVesselMarketAdapter';
import type { BuyMarketOfferRecord, BuyMarketPurchaseResult, BuyMarketWareGroup } from '@/lib/types/market';

export async function getBuyMarketOffers(wareGroup?: BuyMarketWareGroup): Promise<BuyMarketOfferRecord[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const { data, error } = await getCompanyBuyMarketOffers(companyId, wareGroup);
  if (error) throw error;
  return data.filter((offer) => offer.availableUnits > 0);
}

export async function purchaseBuyMarketOffer(offerId: string, quantity: number, storageVesselIds: string[] = []): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer) return { success: false, error: 'Offer not found.' };
  if (offer.wareGroup === 'grapes') return purchaseBuyGrapeOffer(offerId, quantity, storageVesselIds);
  return purchaseStorageVesselOffer(offerId, quantity);
}

export async function ensureBuyMarketHasData(): Promise<void> {
  await Promise.all([
    refreshStorageVesselMarket(),
    import('@/lib/services/sales/buyGrapeMarketService').then(({ ensureBuyGrapeMarketHasData }) => ensureBuyGrapeMarketHasData()),
  ]);
}
