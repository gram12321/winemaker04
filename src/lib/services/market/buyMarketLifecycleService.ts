import { BUY_MARKET_DOMAINS } from './buyMarketDomainRegistry';
import type { BuyMarketGameDate } from './buyMarketDate';

/** Shared lifecycle contract. Adapters own the meaning of projected state. */
export interface BuyMarketLifecycleAdapter<TListing, TAsset, TProjection> {
  project(listing: TListing, asset: TAsset, date: BuyMarketGameDate): TProjection;
  isVisible(listing: TListing, date: BuyMarketGameDate): boolean;
  /** Optional because many adapters price from both projection and asset metadata. */
  price?: (projection: TProjection, date: BuyMarketGameDate) => number;
}

export async function refreshBuyMarketForSeason(): Promise<void> {
  await Promise.all(BUY_MARKET_DOMAINS.map((adapter) => adapter.refreshForSeason()));
}

export async function processWeeklyBuyMarketLifecycle(): Promise<void> {
  await Promise.all(BUY_MARKET_DOMAINS.flatMap((adapter) => adapter.processWeekly ? [adapter.processWeekly()] : []));
}
