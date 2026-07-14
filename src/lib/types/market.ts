import type { Season } from './types';

export type BuyMarketWareGroup = 'grapes' | 'storage_vessels';
export type BuyMarketUnit = 'kg' | 'vessel';

export interface BuyGoodsPriceQuoteInput {
  supplierRelationshipMultiplier: number;
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
