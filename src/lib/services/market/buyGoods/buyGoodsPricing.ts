import { clamp, deterministicSeasonalVariation, NormalizeScrewed1000To01WithTail } from '@/lib/utils';

export interface BuyGoodsPriceInput {
  basePrice: number;
  itemMultiplier?: number;
  marketMultiplier?: number;
  supplierRelationshipMultiplier?: number;
  companyPrestige?: number;
  spreadMultiplier?: number;
  minimumPrice: number;
  maximumPrice: number;
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
  const price = input.basePrice
    * (input.itemMultiplier ?? 1)
    * (input.marketMultiplier ?? 1)
    * (input.supplierRelationshipMultiplier ?? 1)
    * getBuyGoodsPrestigePriceMultiplier(input.companyPrestige ?? 0)
    * (input.spreadMultiplier ?? 1);
  return clamp(price, input.minimumPrice, input.maximumPrice);
}
