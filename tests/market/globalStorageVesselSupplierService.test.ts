import { describe, expect, it, vi } from 'vitest';

const persist = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock('@/lib/database/market/storageVesselMarketListingsDB', () => ({
  ensureNpcUsedStorageVesselListings: persist,
}));

describe('Global Storage Vessel supplier service', () => {
  it('creates one deterministic, individually named listing for every supported material', async () => {
    const { ensureGlobalStorageVesselSupplierListings } = await import('@/lib/services/market/storageVessels/globalStorageVesselSupplierService');

    await ensureGlobalStorageVesselSupplierListings({ year: 2026, season: 'Spring', week: 1 });

    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      year: 2026,
      season: 'Spring',
      week: 1,
      listings: expect.arrayContaining([
        expect.objectContaining({ material: 'oak', vesselName: expect.stringMatching(/ #1$/) }),
        expect.objectContaining({ material: 'plastic', sellerCounterpartyId: 'npc:vintner_recovery_house', vesselName: expect.stringMatching(/ #1$/) }),
      ]),
    }));
    const persistedInput = (persist.mock.calls as unknown as Array<[{ listings: unknown[] }]>)[0]?.[0];
    expect(persistedInput?.listings).toHaveLength(6);
  });
});
