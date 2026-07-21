import { describe, expect, it } from 'vitest';
import {
  calculateCompanyManifestationPrestige,
  calculateFeatureSalePrestigeWithReputation,
  calculateSalePrestigeWithAssets,
  calculateVineyardManifestationPrestige,
  calculateVineyardSalePrestige,
  softCapSigned
} from '@/lib/features/prestige/services/prestigeCalculator';

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

  it('scales feature sale prestige by feature severity before applying event caps', () => {
    const fullPositive = calculateFeatureSalePrestigeWithReputation(1, 1000, 10, 50, undefined, 10, 1);
    const mildPositive = calculateFeatureSalePrestigeWithReputation(1, 1000, 10, 50, undefined, 10, 0.25);
    const severePenalty = calculateFeatureSalePrestigeWithReputation(-1, 1000, 10, 50, undefined, -10, 1);
    const mildPenalty = calculateFeatureSalePrestigeWithReputation(-1, 1000, 10, 50, undefined, -10, 0.25);

    expect(mildPositive).toBeGreaterThan(0);
    expect(mildPositive).toBeLessThan(fullPositive * 0.3);
    expect(severePenalty).toBeLessThan(mildPenalty);
    expect(mildPenalty).toBeLessThan(0);
  });

  it('scales manifestation events by batch size, quality, and company or vineyard reputation', () => {
    const companyEvent = calculateCompanyManifestationPrestige(1, 1200, 0.8, 600);
    const vineyardEvent = calculateVineyardManifestationPrestige(1, 1200, 0.8, 2);

    expect(companyEvent).toBeGreaterThan(0);
    expect(vineyardEvent).toBeGreaterThan(0);
  });

  it('soft-caps regular vineyard sale prestige instead of multiplying directly by vineyard prestige', () => {
    const smallSale = calculateVineyardSalePrestige(0.012, 2, 120, 6);
    const prestigeVineyardSale = calculateVineyardSalePrestige(2, 250, 20000, 1000);
    const hugeSale = calculateVineyardSalePrestige(25, 1000, 250000, 10000);

    expect(smallSale).toBeGreaterThan(0);
    expect(prestigeVineyardSale).toBeGreaterThan(smallSale);
    expect(prestigeVineyardSale).toBeLessThan(15);
    expect(hugeSale).toBeLessThanOrEqual(15);
    expect(hugeSale).toBeGreaterThan(12);
    expect(calculateVineyardSalePrestige(2, 3, 120, 6)).toBeLessThan(6);
  });

  it('applies a smooth signed soft cap for bounded prestige events', () => {
    expect(softCapSigned(0, 2)).toBe(0);
    expect(softCapSigned(5, 2)).toBeGreaterThan(1.8);
    expect(softCapSigned(5, 2)).toBeLessThan(2);
    expect(softCapSigned(-5, 2)).toBeLessThan(-1.8);
    expect(softCapSigned(-5, 2)).toBeGreaterThan(-2);
  });
});
