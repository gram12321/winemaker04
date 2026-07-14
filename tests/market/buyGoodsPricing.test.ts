import { describe, expect, it } from 'vitest';
import { calculateBuyGoodsPrice, getBuyGoodsCompanyScale, getBuyGoodsPriceBreakdown } from '@/lib/services/market/buyGoods/buyGoodsPricing';
import { getBuyGoodsSupplierTrustPreview } from '@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService';

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

  it('exposes the same multiplier chain used by the final price calculation', () => {
    const input = { basePrice: 850, itemMultiplier: 2.1, supplierRelationshipMultiplier: 0.93, companyPrestige: 500, minimumPrice: 500, maximumPrice: 1_000 };
    const breakdown = getBuyGoodsPriceBreakdown(input);

    expect(breakdown.finalPrice).toBe(calculateBuyGoodsPrice(input));
    expect(breakdown.itemMultiplier).toBe(2.1);
    expect(breakdown.supplierRelationshipMultiplier).toBe(0.93);
    expect(breakdown.companyPrestigeMultiplier).toBeLessThan(1);
    expect(breakdown.unclampedPrice).toBeGreaterThan(breakdown.finalPrice);
  });

  it('previews supplier trust using the same yearly cap as purchase recording', () => {
    const preview = getBuyGoodsSupplierTrustPreview({ yearGuardYear: 2026, yearRelationshipPoints: 2_590 }, 100, 0, 2026);

    expect(preview.rawPoints).toBe(25);
    expect(preview.appliedPoints).toBe(10);
    expect(preview.cappedPoints).toBe(15);
    expect(preview.yearlyCap).toBe(2_600);
  });
});
