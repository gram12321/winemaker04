import {
  ensureBuyGrapeMarketHasData,
  processWeeklyBuyGrapeOfferDecay,
  purchaseBuyGrapeOffer,
  refreshBuyGrapeMarketForSeason,
} from '@/lib/services/sales/buyGrapeMarketService';
import {
  purchaseStorageVesselOffer,
  refreshStorageVesselMarket,
} from './storageVessels/storageVesselMarketAdapter';
import type { BuyMarketPurchaseResult, BuyMarketWareGroup } from '@/lib/types/market';

export interface BuyMarketPurchaseInput {
  storageVesselIds?: string[];
}

export interface BuyMarketDomainAdapter {
  id: BuyMarketWareGroup;
  label: string;
  ensureOffers(): Promise<void>;
  purchase(offerId: string, quantity: number, input: BuyMarketPurchaseInput): Promise<BuyMarketPurchaseResult>;
  refreshForSeason(): Promise<void>;
  processWeekly?(): Promise<void>;
}

const adapters: Record<BuyMarketWareGroup, BuyMarketDomainAdapter> = {
  grapes: {
    id: 'grapes',
    label: 'Grapes',
    ensureOffers: ensureBuyGrapeMarketHasData,
    purchase: (offerId, quantity, input) => purchaseBuyGrapeOffer(offerId, quantity, input.storageVesselIds ?? []),
    refreshForSeason: refreshBuyGrapeMarketForSeason,
    processWeekly: processWeeklyBuyGrapeOfferDecay,
  },
  storage_vessels: {
    id: 'storage_vessels',
    label: 'Casks',
    ensureOffers: refreshStorageVesselMarket,
    purchase: (offerId, quantity) => purchaseStorageVesselOffer(offerId, quantity),
    refreshForSeason: refreshStorageVesselMarket,
  },
};

export const BUY_MARKET_DOMAINS = Object.values(adapters);

export function getBuyMarketDomainAdapter(domain: BuyMarketWareGroup): BuyMarketDomainAdapter {
  return adapters[domain];
}
