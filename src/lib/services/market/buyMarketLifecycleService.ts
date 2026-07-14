import { BUY_MARKET_DOMAINS } from './buyMarketDomainRegistry';

export async function refreshBuyMarketForSeason(): Promise<void> {
  await Promise.all(BUY_MARKET_DOMAINS.map((adapter) => adapter.refreshForSeason()));
}

export async function processWeeklyBuyMarketLifecycle(): Promise<void> {
  await Promise.all(BUY_MARKET_DOMAINS.flatMap((adapter) => adapter.processWeekly ? [adapter.processWeekly()] : []));
}
