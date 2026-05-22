import { describe, expect, it } from 'vitest';
import {
  calculateCompanyManifestationPrestige,
  calculateFeatureSalePrestigeWithReputation,
  calculateSalePrestigeWithAssets,
  calculateVineyardManifestationPrestige,
  calculateVineyardSalePrestige
} from '@/lib/services/prestige/prestigeCalculator';

describe('prestige calculator', () => {
  it('scales regular sale prestige with sale size and company assets while respecting the cap', () => {
    const smallSale = calculateSalePrestigeWithAssets(0.2, 1000, 10, 50000);
    const largeSale = calculateSalePrestigeWithAssets(0.2, 50000, 500, 1000000);
    const cappedSale = calculateSalePrestigeWithAssets(100, 1000000, 10000, 10000000);

    expect(largeSale).toBeGreaterThan(smallSale);
    expect(cappedSale).toBe(10);
  });

  it('uses current reputation to scale feature sale prestige and clamps negative impact', () => {
    const lowReputationPenalty = calculateFeatureSalePrestigeWithReputation(-1, 5000, 50, 10);
    const highReputationPenalty = calculateFeatureSalePrestigeWithReputation(-1, 5000, 50, 1000);
    const cappedPenalty = calculateFeatureSalePrestigeWithReputation(-100, 100000, 1000, 1000, undefined, -8);

    expect(highReputationPenalty).toBeLessThan(lowReputationPenalty);
    expect(cappedPenalty).toBe(-8);
  });

  it('scales manifestation events by batch size, quality, and company or vineyard reputation', () => {
    const companyEvent = calculateCompanyManifestationPrestige(1, 1200, 0.8, 600);
    const vineyardEvent = calculateVineyardManifestationPrestige(1, 1200, 0.8, 2);

    expect(companyEvent).toBeGreaterThan(0);
    expect(vineyardEvent).toBeGreaterThan(0);
  });

  it('keeps vineyard sale prestige tied directly to the vineyard prestige factor', () => {
    expect(calculateVineyardSalePrestige(2, 3)).toBe(6);
    expect(calculateVineyardSalePrestige(2, 0)).toBe(0.2);
  });
});
