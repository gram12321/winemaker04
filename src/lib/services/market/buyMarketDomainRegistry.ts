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
import type { BuyMarketOfferView, BuyMarketPurchaseResult, BuyMarketWareGroup } from '@/lib/types/market';

export type BuyMarketPurchaseInput = Record<string, unknown>;

export interface BuyMarketDomainAdapter {
  id: BuyMarketWareGroup;
  label: string;
  ensureOffers(): Promise<void>;
  /** Returns the adapter's normalized market-facing offers, including global assets. */
  getOffers?: () => Promise<BuyMarketOfferView[]>;
  purchase(offerId: string, quantity: number, input: BuyMarketPurchaseInput): Promise<BuyMarketPurchaseResult>;
  refreshForSeason(): Promise<void>;
  processWeekly?(): Promise<void>;
}

const adapters: Record<BuyMarketWareGroup, BuyMarketDomainAdapter> = {
  grapes: {
    id: 'grapes',
    label: 'Grapes',
    ensureOffers: ensureBuyGrapeMarketHasData,
    getOffers: async () => (await import('@/lib/services/sales/buyGrapeMarketService')).getBuyGrapeMarketOffers().then((offers) => offers.map((offer) => ({
      id: offer.id,
      wareGroup: 'grapes' as const,
      source: offer.source,
      availableUnits: offer.availableKg,
      unit: 'kg' as const,
      basePricePerUnit: offer.basePricePerKg,
      effectivePricePerUnit: offer.effectivePricePerKg,
      createdYear: offer.createdYear,
      createdSeason: offer.createdSeason,
      createdWeek: offer.createdWeek,
      expiresYear: null,
      expiresSeason: null,
      expiresWeek: null,
      payload: offer as unknown as Record<string, unknown>,
    }))),
    purchase: (offerId, quantity, input) => purchaseBuyGrapeOffer(offerId, quantity, Array.isArray(input.storageVesselIds) ? input.storageVesselIds.filter((id): id is string => typeof id === 'string') : []),
    refreshForSeason: refreshBuyGrapeMarketForSeason,
    processWeekly: processWeeklyBuyGrapeOfferDecay,
  },
  storage_vessels: {
    id: 'storage_vessels',
    label: 'Casks',
    ensureOffers: refreshStorageVesselMarket,
    getOffers: async () => (await import('./storageVessels/storageVesselMarketAdapter')).getStorageVesselMarketOffers().then((offers) => offers.map((offer) => ({
      id: offer.id,
      wareGroup: 'storage_vessels' as const,
      source: offer.source,
      availableUnits: offer.availableUnits,
      unit: 'vessel' as const,
      basePricePerUnit: offer.basePricePerVessel,
      effectivePricePerUnit: offer.pricePerVessel,
      createdYear: offer.createdYear,
      createdSeason: offer.createdSeason,
      createdWeek: offer.createdWeek,
      expiresYear: offer.expiresYear,
      expiresSeason: offer.expiresSeason,
      expiresWeek: offer.expiresWeek,
      payload: offer.payload as unknown as Record<string, unknown>,
    }))),
    purchase: (offerId, quantity) => purchaseStorageVesselOffer(offerId, quantity),
    refreshForSeason: refreshStorageVesselMarket,
  },
};

export const BUY_MARKET_DOMAINS = Object.values(adapters);

export function getBuyMarketDomainAdapter(domain: BuyMarketWareGroup): BuyMarketDomainAdapter {
  return adapters[domain];
}

export async function getBuyMarketOffers(domain: BuyMarketWareGroup): Promise<BuyMarketOfferView[]> {
  const adapter = getBuyMarketDomainAdapter(domain);
  return adapter.getOffers ? adapter.getOffers() : [];
}
