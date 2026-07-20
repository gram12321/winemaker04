import type { Season } from './types';

export type BuyMarketWareGroup = 'grapes' | 'storage_vessels';
export type BuyMarketUnit = 'kg' | 'vessel';
export type BuyMarketOfferSourceKind = 'supplier_stock' | 'npc_used' | 'company_listing';
export type BuyMarketSourceFilter = 'all' | 'local_supplier' | 'global_market';
export type BuyMarketSellerKind = 'supplier' | 'npc' | 'company';

/**
 * Market-facing origin for an offer. Inventory and fulfilment may differ by
 * source, but every Buy Market domain presents the same seller/source model.
 * Buyers build a one-way relationship with this displayed counterparty;
 * backend custody never changes the market-facing seller.
 */
export interface BuyMarketOfferSource {
  kind: BuyMarketOfferSourceKind;
  seller: BuyMarketOfferSeller;
}

export interface BuyMarketOfferLifecycle {
  createdYear: number;
  createdSeason: Season;
  createdWeek: number;
  expiresYear?: number | null;
  expiresSeason?: Season | null;
  expiresWeek?: number | null;
}

/**
 * Shared market-facing read model. Domain adapters may add richer payload and
 * pricing breakdowns, but the modal only needs this stable contract for source,
 * seller, quantity, lifecycle, and purchase presentation.
 */
export interface BuyMarketOfferView<TPayload = Record<string, unknown>> extends BuyMarketOfferLifecycle {
  id: string;
  wareGroup: BuyMarketWareGroup;
  source: BuyMarketOfferSource;
  availableUnits: number;
  unit: BuyMarketUnit;
  basePricePerUnit: number;
  effectivePricePerUnit: number;
  payload: TPayload;
}

export type BuyMarketOfferSeller =
  | { kind: 'supplier' | 'npc'; id: string; name: string; companyId?: never }
  | { kind: 'company'; id: string; name: string; companyId: string };

export interface BuyGoodsPriceQuoteInput {
  supplierRelationshipMultiplier: number;
  /** Generic buyer-to-market-counterparty term. */
  marketRelationshipMultiplier?: number;
  companyPrestige: number;
}

export interface BuyMarketOfferRecord {
  companyId: string;
  offerId: string;
  wareGroup: BuyMarketWareGroup;
  sellerId: string;
  sellerName: string;
  originTag: string;
  availableUnits: number;
  unit: BuyMarketUnit;
  basePricePerUnit: number;
  effectivePricePerUnit: number;
  isPersistent: boolean;
  createdYear: number;
  createdSeason: Season;
  createdWeek: number;
  lastRefreshedYear: number;
  lastRefreshedSeason: Season;
  lastRefreshedWeek: number;
  expiresYear: number | null;
  expiresSeason: Season | null;
  expiresWeek: number | null;
  payload: Record<string, unknown>;
}

export interface BuyMarketPurchaseResult {
  success: boolean;
  error?: string;
}
