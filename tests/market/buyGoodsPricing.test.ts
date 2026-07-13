import { describe, expect, it } from 'vitest';
import { calculateBuyGoodsPrice, getBuyGoodsCompanyScale } from '@/lib/services/market/buyGoods/buyGoodsPricing';

describe('Buy Goods pricing', () => {
  it('scales offer availability with company value and prestige', () => {
    expect(getBuyGoodsCompanyScale(1_000_000, 5_000)).toBeGreaterThan(getBuyGoodsCompanyScale(0, 0));
  });

  it('prices a larger, higher-quality cask above a smaller low-quality cask and applies supplier trust discounts', () => {
    const lowQualitySmall = calculateBuyGoodsPrice({ basePrice: 850, itemMultiplier: 1 * (0.65 + 0.4 * 0.7), supplierRelationshipMultiplier: 1, minimumPrice: 500, maximumPrice: 10_000 });
    const highQualityLarge = calculateBuyGoodsPrice({ basePrice: 850, itemMultiplier: 4 * (0.65 + 0.9 * 0.7), supplierRelationshipMultiplier: 1, minimumPrice: 500, maximumPrice: 10_000 });
    const trustedSupplier = calculateBuyGoodsPrice({ basePrice: 850, itemMultiplier: 4 * (0.65 + 0.9 * 0.7), supplierRelationshipMultiplier: 0.93, minimumPrice: 500, maximumPrice: 10_000 });
    expect(highQualityLarge).toBeGreaterThan(lowQualitySmall);
    expect(trustedSupplier).toBeLessThan(highQualityLarge);
  });
});
