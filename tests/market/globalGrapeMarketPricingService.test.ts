import { describe, expect, it, vi } from 'vitest';
import type { WineBatch } from '@/lib/types/types';

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: () => ({ currentYear: 2026, season: 'Spring', economyPhase: 'Stable' }),
}));
vi.mock('@/lib/services/wine/winescore/wineScoreCalculation', () => ({
  calculateWineScore: () => 0.6,
}));

describe('global grape market pricing', () => {
  it('uses one public quote and pays exactly a 70% immediate advance', async () => {
    const { getGlobalGrapeMarketPublicPricePerKg, getGlobalGrapeMarketSellbackPayout } = await import('@/lib/services/market/grapes/globalGrapeMarketPricingService');
    const batch = { state: 'must_fermenting' } as WineBatch;
    const publicPrice = getGlobalGrapeMarketPublicPricePerKg(batch);

    expect(getGlobalGrapeMarketSellbackPayout(batch, 100)).toBe(Number((publicPrice * 100 * 0.7).toFixed(2)));
  });
});
