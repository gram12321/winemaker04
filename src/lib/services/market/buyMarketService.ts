import { getCompanyBuyMarketOffer } from '@/lib/database/market/buyMarketOffersDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { BuyMarketPurchaseResult } from '@/lib/types/market';
import { getBuyMarketDomainAdapter } from './buyMarketDomainRegistry';
import type { BuyMarketPurchaseInput } from './buyMarketDomainRegistry';

export async function purchaseBuyMarketOffer(offerId: string, quantity: number, input: BuyMarketPurchaseInput = {}): Promise<BuyMarketPurchaseResult> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const { data: offer, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (error || !offer) return { success: false, error: 'Offer not found.' };
  return getBuyMarketDomainAdapter(offer.wareGroup).purchase(offerId, quantity, input);
}
