import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_VESSEL_OFFER_RETENTION_CHANCE } from '@/lib/constants';
import type { BuyMarketOfferRecord } from '@/lib/types/market';
import { deterministicSeasonalVariation } from '@/lib/utils';

const mocks = vi.hoisted(() => ({
  getCurrentCompanyId: vi.fn(() => 'company-1'),
  getGameState: vi.fn(() => ({ money: 5000, currentYear: 2026, season: 'Spring', week: 1, prestige: 0 })),
  getCompanyBuyMarketOffer: vi.fn(),
  getCompanyBuyMarketOffers: vi.fn(),
  deleteBuyMarketOffer: vi.fn(),
  updateBuyMarketOffer: vi.fn(),
  purchaseStorageVesselOfferAtomically: vi.fn(async () => ({ data: { transaction: { id: 'tx-1', week: 1, season: 'Spring', year: 2026, amount: -1900, description: 'purchase', category: 'Supplies', recurring: false, money: 3100 }, completedNow: true }, error: null })),
  upsertBuyMarketOffers: vi.fn(async (_records: BuyMarketOfferRecord[]) => ({ error: null })),
  syncPersistedTransaction: vi.fn(async () => 'tx-1'),
  addMessage: vi.fn(async () => undefined),
  triggerTopicUpdate: vi.fn(),
  recordBuyGoodsSupplierPurchase: vi.fn(async () => null),
  getBuyGoodsSupplierPersistenceBonus: vi.fn<(level: number) => number>(() => 0),
  getBuyGoodsSupplierRelationships: vi.fn(async () => ({})),
}));

vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: mocks.getCurrentCompanyId }));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState }));
vi.mock('@/lib/database/market/buyMarketOffersDB', () => ({
  getCompanyBuyMarketOffer: mocks.getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers: mocks.getCompanyBuyMarketOffers,
  deleteBuyMarketOffer: mocks.deleteBuyMarketOffer,
  updateBuyMarketOffer: mocks.updateBuyMarketOffer,
  upsertBuyMarketOffers: mocks.upsertBuyMarketOffers,
}));
vi.mock('@/lib/database/market/storageVesselMarketOffersDB', () => ({
  purchaseStorageVesselOfferAtomically: mocks.purchaseStorageVesselOfferAtomically,
}));
vi.mock('@/lib/services/finance/financeService', () => ({ calculateCompanyValue: vi.fn(async () => 0), syncPersistedTransaction: mocks.syncPersistedTransaction }));
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: mocks.addMessage } }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerTopicUpdate: mocks.triggerTopicUpdate }));
vi.mock('@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService', () => ({
  recordBuyGoodsSupplierPurchase: mocks.recordBuyGoodsSupplierPurchase,
  getBuyGoodsSupplierRelationships: mocks.getBuyGoodsSupplierRelationships,
  getBuyGoodsSupplierRelationshipPriceMultiplier: vi.fn(() => 1),
  getBuyGoodsSupplierPersistenceBonus: mocks.getBuyGoodsSupplierPersistenceBonus,
  getBuyGoodsSupplierPriorityProfiles: vi.fn(async () => []),
}));

const offer = {
  companyId: 'company-1', offerId: 'storage_vessel_oak_cask_225', wareGroup: 'storage_vessels' as const,
  sellerId: 'merchant', sellerName: 'Cellar Equipment Merchant', originTag: 'catalogue', availableUnits: 3,
  unit: 'vessel' as const, basePricePerUnit: 950, effectivePricePerUnit: 950, isPersistent: true,
  createdYear: 2026, createdSeason: 'Spring' as const, createdWeek: 1,
  lastRefreshedYear: 2026, lastRefreshedSeason: 'Spring' as const, lastRefreshedWeek: 1,
  expiresYear: null, expiresSeason: null, expiresWeek: null,
  payload: { vesselType: 'cask', material: 'oak', qualityScore: 0.78, productionYear: 2024, capacityLitres: 225 },
};

describe('Storage Vessel market adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyBuyMarketOffer.mockResolvedValue({ data: offer, error: null });
  });

  it('creates one individually owned fixed-capacity vessel per purchased cask', async () => {
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    await expect(purchaseStorageVesselOffer(offer.offerId, 2)).resolves.toEqual({ success: true });

    expect(mocks.purchaseStorageVesselOfferAtomically).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'company-1', offerId: offer.offerId, quantity: 2 }));
    expect(mocks.syncPersistedTransaction).toHaveBeenCalledOnce();
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('storage_vessels');
  });

  it('does not create a vessel when the requested quantity exceeds availability', async () => {
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const result = await purchaseStorageVesselOffer(offer.offerId, 4);
    expect(result.success).toBe(false);
    expect(mocks.purchaseStorageVesselOfferAtomically).not.toHaveBeenCalled();
  });

  it('leaves no client-side compensation path when the atomic purchase is rejected', async () => {
    mocks.purchaseStorageVesselOfferAtomically.mockResolvedValueOnce({ data: null, error: new Error('insufficient funds') } as any);
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    const result = await purchaseStorageVesselOffer(offer.offerId, 1);

    expect(result.success).toBe(false);
    expect(mocks.syncPersistedTransaction).not.toHaveBeenCalled();
  });

  it('reports Supabase authentication failures instead of misreporting funds or availability', async () => {
    mocks.purchaseStorageVesselOfferAtomically.mockResolvedValueOnce({ data: null, error: { status: 401, message: 'Invalid JWT' } } as any);
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    await expect(purchaseStorageVesselOffer(offer.offerId, 1)).resolves.toEqual({
      success: false,
      error: 'Supabase authentication failed. Please sign in again or check the deployed Supabase URL and anon key.',
    });
  });

  it('recognizes a PostgREST authentication error returned as a string code', async () => {
    mocks.purchaseStorageVesselOfferAtomically.mockResolvedValueOnce({ data: null, error: { code: '401', message: 'JWT expired' } } as any);
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    await expect(purchaseStorageVesselOffer(offer.offerId, 1)).resolves.toEqual({
      success: false,
      error: 'Supabase authentication failed. Please sign in again or check the deployed Supabase URL and anon key.',
    });
  });

  it('reports an unapplied purchase RPC migration clearly', async () => {
    mocks.purchaseStorageVesselOfferAtomically.mockResolvedValueOnce({ data: null, error: { status: 404, code: 'PGRST202', message: 'function is missing' } } as any);
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    await expect(purchaseStorageVesselOffer(offer.offerId, 1)).resolves.toEqual({
      success: false,
      error: 'The market purchase update is not installed in this database. Apply the latest migrations and reload the market.',
    });
  });

  it('keeps a paid purchase when its notification fails', async () => {
    mocks.addMessage.mockRejectedValueOnce(new Error('notification failed'));
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    await expect(purchaseStorageVesselOffer(offer.offerId, 1)).resolves.toEqual({ success: true });

    expect(mocks.syncPersistedTransaction).toHaveBeenCalledOnce();
  });

  it('exposes the cask-specific multiplier breakdown used by the market UI', async () => {
    const { getStorageVesselPriceBreakdown } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const breakdown = getStorageVesselPriceBreakdown({ capacityLitres: 500, qualityScore: 0.8, supplierBaseMultiplier: 1.04, supplierRelationshipMultiplier: 0.93, companyPrestige: 500 });

    expect(breakdown.capacityMultiplier).toBe(2);
    expect(breakdown.qualityMultiplier).toBeCloseTo(1.21, 8);
    expect(breakdown.supplierBaseMultiplier).toBe(1.04);
    expect(breakdown.finalPricePerVessel).toBe(breakdown.finalPrice);
  });

  it('adds supplier persistence to the cask offer retention chance', async () => {
    mocks.getBuyGoodsSupplierPersistenceBonus.mockImplementation((level: number) => level === 4 ? 0.22 : level === 5 ? 0.8 : 0);
    const { getStorageVesselOfferRetentionChance } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    expect(getStorageVesselOfferRetentionChance(0)).toBe(0.45);
    expect(getStorageVesselOfferRetentionChance(4)).toBe(0.67);
    expect(getStorageVesselOfferRetentionChance(5)).toBe(1);
  });

  it('retains a cask only because its supplier relationship raises the deterministic chance', async () => {
    mocks.getGameState.mockReturnValue({ money: 5000, currentYear: 2026, season: 'Summer', week: 1, prestige: 0 });
    mocks.getBuyGoodsSupplierPersistenceBonus.mockImplementation((level: number) => level === 4 ? 0.22 : 0);
    mocks.getBuyGoodsSupplierRelationships.mockResolvedValue({
      cooperage_duval: { level: 4 },
    });
    const retentionOfferId = Array.from({ length: 10_000 }, (_, index) => `retention-cask-${index}`)
      .find((offerId) => {
        const draw = deterministicSeasonalVariation(`${offerId}:2026:Summer:retention`, 0, 1);
        return draw > STORAGE_VESSEL_OFFER_RETENTION_CHANCE && draw < STORAGE_VESSEL_OFFER_RETENTION_CHANCE + 0.22;
      });
    expect(retentionOfferId).toBeDefined();
    const retentionDraw = deterministicSeasonalVariation(`${retentionOfferId}:2026:Summer:retention`, 0, 1);
    expect(retentionDraw).toBeGreaterThan(STORAGE_VESSEL_OFFER_RETENTION_CHANCE);
    expect(retentionDraw).toBeLessThan(STORAGE_VESSEL_OFFER_RETENTION_CHANCE + 0.22);

    let marketOffers: BuyMarketOfferRecord[] = [{
      companyId: 'company-1',
      offerId: retentionOfferId!,
      wareGroup: 'storage_vessels',
      sellerId: 'cooperage_duval',
      sellerName: 'Cooperage Duval',
      originTag: 'seasonal_supplier',
      availableUnits: 1,
      unit: 'vessel',
      basePricePerUnit: 1000,
      effectivePricePerUnit: 1000,
      isPersistent: false,
      createdYear: 2026,
      createdSeason: 'Spring',
      createdWeek: 1,
      lastRefreshedYear: 2026,
      lastRefreshedSeason: 'Spring',
      lastRefreshedWeek: 1,
      expiresYear: 2026,
      expiresSeason: 'Summer',
      expiresWeek: 1,
      payload: {
        vesselType: 'cask',
        material: 'oak',
        qualityScore: 0.75,
        productionYear: 2020,
        capacityLitres: 500,
        priceSnapshot: { supplierBaseMultiplier: 1.04, supplierRelationshipMultiplier: 1, companyPrestige: 0 },
      },
    }];
    mocks.getCompanyBuyMarketOffers.mockImplementation(async () => ({ data: marketOffers, error: null }));
    mocks.updateBuyMarketOffer.mockImplementation(async (_companyId: string, offerId: string, patch: Partial<BuyMarketOfferRecord>) => {
      marketOffers = marketOffers.map((marketOffer) => marketOffer.offerId === offerId ? { ...marketOffer, ...patch } : marketOffer);
      return { error: null };
    });
    mocks.deleteBuyMarketOffer.mockImplementation(async (_companyId: string, offerId: string) => {
      marketOffers = marketOffers.filter((marketOffer) => marketOffer.offerId !== offerId);
      return { error: null };
    });
    mocks.upsertBuyMarketOffers.mockImplementation(async (records: BuyMarketOfferRecord[]) => {
      marketOffers = [...marketOffers, ...records];
      return { error: null };
    });

    const { getStorageVesselMarketOffers } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    await getStorageVesselMarketOffers();

    expect(mocks.updateBuyMarketOffer).toHaveBeenCalledWith('company-1', retentionOfferId, expect.objectContaining({ lastRefreshedSeason: 'Summer' }));
    expect(mocks.deleteBuyMarketOffer).not.toHaveBeenCalledWith('company-1', retentionOfferId);
  });

  it('retires legacy catalogue rows before generating current supplier offers', async () => {
    let marketOffers: BuyMarketOfferRecord[] = [offer];
    mocks.getCompanyBuyMarketOffers.mockImplementation(async () => ({ data: marketOffers, error: null }));
    mocks.deleteBuyMarketOffer.mockImplementation(async (_companyId: string, offerId: string) => {
      marketOffers = marketOffers.filter((marketOffer) => marketOffer.offerId !== offerId);
      return { error: null };
    });
    mocks.upsertBuyMarketOffers.mockImplementation(async (records: BuyMarketOfferRecord[]) => {
      marketOffers = [...marketOffers, ...records];
      return { error: null };
    });

    const { getStorageVesselMarketOffers } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const offers = await getStorageVesselMarketOffers();

    expect(mocks.deleteBuyMarketOffer).toHaveBeenCalledWith('company-1', offer.offerId);
    expect(mocks.upsertBuyMarketOffers).toHaveBeenCalledOnce();
    expect(offers).toHaveLength(9);
    expect(offers[0]).toMatchObject({ sellerId: 'cooperage_duval', payload: { priceSnapshot: expect.any(Object) } });
    expect(offers[0].priceBreakdown.finalPricePerVessel).toBe(offers[0].pricePerVessel);
  });
});
