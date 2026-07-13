import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureGrapes: vi.fn(async () => undefined),
  purchaseGrapes: vi.fn(async () => ({ success: true })),
  refreshGrapes: vi.fn(async () => undefined),
  decayGrapes: vi.fn(async () => undefined),
  purchaseVessels: vi.fn(async () => ({ success: true })),
  refreshVessels: vi.fn(async () => undefined),
}));

vi.mock('@/lib/services/sales/buyGrapeMarketService', () => ({
  ensureBuyGrapeMarketHasData: mocks.ensureGrapes,
  purchaseBuyGrapeOffer: mocks.purchaseGrapes,
  refreshBuyGrapeMarketForSeason: mocks.refreshGrapes,
  processWeeklyBuyGrapeOfferDecay: mocks.decayGrapes,
}));
vi.mock('@/lib/services/market/storageVessels/storageVesselMarketAdapter', () => ({
  purchaseStorageVesselOffer: mocks.purchaseVessels,
  refreshStorageVesselMarket: mocks.refreshVessels,
}));

describe('Buy Market domain registry', () => {
  it('registers each active domain with shared orchestration hooks', async () => {
    const { BUY_MARKET_DOMAINS } = await import('@/lib/services/market/buyMarketDomainRegistry');

    expect(BUY_MARKET_DOMAINS.map((adapter) => adapter.id)).toEqual(['grapes', 'storage_vessels']);
    await Promise.all(BUY_MARKET_DOMAINS.map((adapter) => adapter.ensureOffers()));

    expect(mocks.ensureGrapes).toHaveBeenCalledOnce();
    expect(mocks.refreshVessels).toHaveBeenCalledOnce();
  });

  it('keeps grape storage requirements inside the grape adapter', async () => {
    const { getBuyMarketDomainAdapter } = await import('@/lib/services/market/buyMarketDomainRegistry');

    await getBuyMarketDomainAdapter('grapes').purchase('offer-1', 50, { storageVesselIds: ['vessel-1'] });
    await getBuyMarketDomainAdapter('storage_vessels').purchase('offer-2', 1, {});

    expect(mocks.purchaseGrapes).toHaveBeenCalledWith('offer-1', 50, ['vessel-1']);
    expect(mocks.purchaseVessels).toHaveBeenCalledWith('offer-2', 1);
  });
});
