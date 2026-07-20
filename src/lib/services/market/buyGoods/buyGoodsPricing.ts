import { clamp, deterministicSeasonalVariation, NormalizeScrewed1000To01WithTail } from '@/lib/utils';
import type { BuyGoodsPriceQuoteInput } from '@/lib/types/market';

export interface BuyGoodsPriceInput extends Partial<BuyGoodsPriceQuoteInput> {
  basePrice: number;
  itemMultiplier?: number;
  marketMultiplier?: number;
  spreadMultiplier?: number;
  minimumPrice?: number;
  maximumPrice?: number;
}

export interface BuyGoodsPriceBreakdown {
  basePrice: number;
  itemMultiplier: number;
  marketMultiplier: number;
  supplierRelationshipMultiplier: number;
  marketRelationshipMultiplier: number;
  companyPrestigeMultiplier: number;
  spreadMultiplier: number;
  unclampedPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  finalPrice: number;
}

export function getBuyGoodsCompanyScale(companyValue: number, prestige: number, referenceValue = 10_000, maximum = 2.1): number {
  const companyValueScale = companyValue <= 0
    ? 1
    : clamp(1 + Math.max(0, Math.log10(Math.max(referenceValue, companyValue)) - 4) * 0.45, 1, maximum);
  const prestigeScale = prestige <= 0 ? 1 : clamp(1 + Math.max(0, (NormalizeScrewed1000To01WithTail(prestige) - 0.1) / 0.899) * 0.3, 1, 1.3);
  return companyValueScale * prestigeScale;
}

export function getBuyGoodsPrestigePriceMultiplier(prestige: number, maximumDiscount = 0.3): number {
  return clamp(1 - NormalizeScrewed1000To01WithTail(prestige) * maximumDiscount, 1 - maximumDiscount, 1);
}

export function getBuyGoodsOfferAvailability(seed: string, companyValue: number, prestige: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.round(deterministicSeasonalVariation(seed, minimum, maximum) * getBuyGoodsCompanyScale(companyValue, prestige)));
}

export function calculateBuyGoodsPrice(input: BuyGoodsPriceInput): number {
  return getBuyGoodsPriceBreakdown(input).finalPrice;
}

export function getBuyGoodsPriceBreakdown(input: BuyGoodsPriceInput): BuyGoodsPriceBreakdown {
  const itemMultiplier = input.itemMultiplier ?? 1;
  const marketMultiplier = input.marketMultiplier ?? 1;
  const marketRelationshipMultiplier = input.marketRelationshipMultiplier ?? input.supplierRelationshipMultiplier ?? 1;
  const supplierRelationshipMultiplier = marketRelationshipMultiplier;
  const companyPrestigeMultiplier = getBuyGoodsPrestigePriceMultiplier(input.companyPrestige ?? 0);
  const spreadMultiplier = input.spreadMultiplier ?? 1;
  const unclampedPrice = input.basePrice
    * itemMultiplier
    * marketMultiplier
    * supplierRelationshipMultiplier
    * companyPrestigeMultiplier
    * spreadMultiplier;

  return {
    basePrice: input.basePrice,
    itemMultiplier,
    marketMultiplier,
    supplierRelationshipMultiplier,
    marketRelationshipMultiplier,
    companyPrestigeMultiplier,
    spreadMultiplier,
    unclampedPrice,
    minimumPrice: input.minimumPrice ?? 0,
    maximumPrice: input.maximumPrice ?? Number.POSITIVE_INFINITY,
    finalPrice: clamp(unclampedPrice, input.minimumPrice ?? 0, input.maximumPrice ?? Number.POSITIVE_INFINITY),
  };
}
