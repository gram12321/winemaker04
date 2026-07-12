import { processWeeklyBuyGrapeOfferDecay, refreshBuyGrapeMarketForSeason } from '@/lib/services/sales/buyGrapeMarketService';
import { refreshStorageVesselMarket } from './storageVessels/storageVesselMarketAdapter';

export async function refreshBuyMarketForSeason(): Promise<void> {
  await Promise.all([refreshBuyGrapeMarketForSeason(), refreshStorageVesselMarket()]);
}

export async function processWeeklyBuyMarketLifecycle(): Promise<void> {
  await processWeeklyBuyGrapeOfferDecay();
}
