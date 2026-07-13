import { getCompanyBuyMarketOffer, getCompanyBuyMarketOffers } from '@/lib/database/market/buyMarketOffersDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { BuyMarketOfferRecord, BuyMarketPurchaseResult, BuyMarketWareGroup } from '@/lib/types/market';
import { BUY_MARKET_DOMAINS, getBuyMarketDomainAdapter } from './buyMarketDomainRegistry';
import type { BuyMarketPurchaseInput } from './buyMarketDomainRegistry';

export async function getBuyMarketOffers(wareGroup?: BuyMarketWareGroup): Promise<BuyMarketOfferRecord[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const { data, error } = await getCompanyBuyMarketOffers(companyId, wareGroup);
  if (error) throw error;
  return data.filter((offer) => offer.availableUnits > 0);
}

export async function purchaseBuyMarketOffer(offerId: string, quantity: number, input: BuyMarketPurchaseInput = {}): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer) return { success: false, error: 'Offer not found.' };
  return getBuyMarketDomainAdapter(offer.wareGroup).purchase(offerId, quantity, input);
}

export async function ensureBuyMarketHasData(): Promise<void> {
  await Promise.all(BUY_MARKET_DOMAINS.map((adapter) => adapter.ensureOffers()));
}
