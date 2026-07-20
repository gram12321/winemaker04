import type { BuyMarketPurchaseResult } from '@/lib/types/market';
import { getBuyMarketDomainAdapter, getBuyMarketOffers, type BuyMarketPurchaseInput } from './buyMarketDomainRegistry';

export async function purchaseBuyMarketOfferForDomain(
  wareGroup: Parameters<typeof getBuyMarketDomainAdapter>[0],
  offerId: string,
  quantity: number,
  input: BuyMarketPurchaseInput = {},
): Promise<BuyMarketPurchaseResult> {
  return getBuyMarketDomainAdapter(wareGroup).purchase(offerId, quantity, input);
}

/** Shared read seam used by future market panels and global goods adapters. */
export { getBuyMarketOffers };
