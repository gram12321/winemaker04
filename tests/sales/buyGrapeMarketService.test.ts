import { describe, expect, it } from 'vitest';
import { BUY_MARKET_FIXED_SPREAD, computeBuyOfferPricePerKg, getBuyOfferStateLabel } from '@/lib/services/sales/buyGrapeMarketService';

describe('buy grape market service', () => {
  it('applies fixed spread above mirrored baseline', () => {
    const value = computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.65,
      state: 'grapes',
      season: 'Spring',
      economyPhase: 'Stable',
      year: 2026,
      volatilityMultiplier: 1,
    });

    const approximateMirroredBaseline = 3 * (0.55 + 0.65 * 1.05) * 1.03 * 1 * 1.05;
    expect(value).toBeGreaterThan(approximateMirroredBaseline);
    expect(value).toBeGreaterThan(3 * (1 + BUY_MARKET_FIXED_SPREAD * 0.5));
  });

  it('prices fermenting state above grapes for same quality and market context', () => {
    const grapesPrice = computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.6,
      state: 'grapes',
      season: 'Fall',
      economyPhase: 'Stable',
      year: 2026,
      volatilityMultiplier: 1,
    });

    const fermentingPrice = computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.6,
      state: 'must_fermenting',
      season: 'Fall',
      economyPhase: 'Stable',
      year: 2026,
      volatilityMultiplier: 1,
    });

    expect(fermentingPrice).toBeGreaterThan(grapesPrice);
  });

  it('returns expected state labels', () => {
    expect(getBuyOfferStateLabel('grapes')).toBe('Grapes');
    expect(getBuyOfferStateLabel('must_ready')).toBe('Must');
    expect(getBuyOfferStateLabel('must_fermenting')).toBe('Fermenting');
  });
});
