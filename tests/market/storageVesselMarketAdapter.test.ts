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
  claimBuyMarketOfferUnits: vi.fn(async () => ({ claimed: true, error: null })),
  releaseBuyMarketOfferUnits: vi.fn(async () => ({ released: true, error: null })),
  addTransaction: vi.fn(async () => 'tx-1'),
  syncPersistedTransaction: vi.fn(async () => 'tx-used-1'),
  insertStorageVessels: vi.fn(async () => ({ data: [], error: null })),
  getCompanyStorageVessels: vi.fn(async () => ({ data: [], error: null })),
  upsertBuyMarketOffers: vi.fn(async (_records: BuyMarketOfferRecord[]) => ({ error: null })),
  addMessage: vi.fn(async () => undefined),
  triggerTopicUpdate: vi.fn(),
  recordBuyMarketCounterpartyPurchaseForActiveCompany: vi.fn(async () => null),
  getBuyMarketCounterpartyPersistenceBonus: vi.fn<(level: number) => number>(() => 0),
  getBuyMarketCounterpartyRelationships: vi.fn(async () => ({})),
  ensureGlobalStorageVesselSupplierListings: vi.fn(async () => undefined),
  getActiveStorageVesselMarketListings: vi.fn(async () => ({ data: [], error: null })),
  purchaseUsedStorageVesselListing: vi.fn(async () => ({ data: { transaction: { id: 'tx-used-1', week: 1, season: 'Spring', year: 2026, amount: -900, description: 'Used vessel market purchase', category: 'supplies', recurring: false, money: 4100, money_version: 2 } }, error: null })),
}));

vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: mocks.getCurrentCompanyId }));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState }));
vi.mock('@/lib/database/market/buyMarketOffersDB', () => ({
  getCompanyBuyMarketOffer: mocks.getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers: mocks.getCompanyBuyMarketOffers,
  deleteBuyMarketOffer: mocks.deleteBuyMarketOffer,
  updateBuyMarketOffer: mocks.updateBuyMarketOffer,
  upsertBuyMarketOffers: mocks.upsertBuyMarketOffers,
  claimBuyMarketOfferUnits: mocks.claimBuyMarketOfferUnits,
  releaseBuyMarketOfferUnits: mocks.releaseBuyMarketOfferUnits,
}));
vi.mock('@/lib/database/winery/storageVesselsDB', () => ({ insertStorageVessels: mocks.insertStorageVessels, getCompanyStorageVessels: mocks.getCompanyStorageVessels }));
vi.mock('@/lib/database/market/storageVesselMarketListingsDB', () => ({
  getActiveStorageVesselMarketListings: mocks.getActiveStorageVesselMarketListings,
  purchaseUsedStorageVesselListing: mocks.purchaseUsedStorageVesselListing,
}));
vi.mock('@/lib/services/market/storageVessels/globalStorageVesselSupplierService', () => ({
  ensureGlobalStorageVesselSupplierListings: mocks.ensureGlobalStorageVesselSupplierListings,
}));
vi.mock('@/lib/services/finance/financeService', () => ({ calculateCompanyValue: vi.fn(async () => 0), addTransaction: mocks.addTransaction, syncPersistedTransaction: mocks.syncPersistedTransaction }));
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: mocks.addMessage } }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerTopicUpdate: mocks.triggerTopicUpdate }));
vi.mock('@/lib/services/market/buyMarketCounterpartyRelationshipService', () => ({
  recordBuyMarketCounterpartyPurchaseForActiveCompany: mocks.recordBuyMarketCounterpartyPurchaseForActiveCompany,
  getBuyMarketCounterpartyRelationships: mocks.getBuyMarketCounterpartyRelationships,
  getBuyMarketCounterpartyPriceMultiplier: vi.fn(() => 1),
  getBuyMarketCounterpartyPersistenceBonus: mocks.getBuyMarketCounterpartyPersistenceBonus,
  getBuyMarketCounterpartyKey: ({ kind, id }: { kind: string; id: string }) => `${kind}:${id}`,
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

    expect(mocks.claimBuyMarketOfferUnits).toHaveBeenCalledWith('company-1', offer.offerId, 2);
    expect(mocks.addTransaction).toHaveBeenCalledWith(-1900, expect.any(String), 'Supplies', false, 'company-1', true);
    expect(mocks.insertStorageVessels).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ ownerKind: 'company', ownerCompanyId: 'company-1', capacityLitres: 225, operationalStatus: 'operational' }),
    ]));
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('storage_vessels');
  });

  it('does not create a vessel when the requested quantity exceeds availability', async () => {
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const result = await purchaseStorageVesselOffer(offer.offerId, 4);
    expect(result.success).toBe(false);
    expect(mocks.claimBuyMarketOfferUnits).not.toHaveBeenCalled();
  });

  it('does not charge when the offer claim is rejected', async () => {
    mocks.claimBuyMarketOfferUnits.mockResolvedValueOnce({ claimed: false, error: null });
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    const result = await purchaseStorageVesselOffer(offer.offerId, 1);

    expect(result.success).toBe(false);
    expect(mocks.addTransaction).not.toHaveBeenCalled();
  });

  it('synchronizes the committed balance after buying a global used listing', async () => {
    const { purchaseUsedStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const result = await purchaseUsedStorageVesselOffer({
      kind: 'used_listing',
      source: { kind: 'company_listing', seller: { kind: 'company', id: 'company-2', companyId: 'company-2', name: 'Nordic Cellar Craft' } },
      id: 'listing-1', availableUnits: 1, basePricePerVessel: 900, pricePerVessel: 900,
      createdYear: 2026, createdSeason: 'Spring', createdWeek: 1, expiresYear: 2027, expiresSeason: 'Spring', expiresWeek: 1,
      priceBreakdown: {} as any,
      payload: { vesselType: 'cask', material: 'oak', qualityScore: 0.7, condition: 0.8, fillHistory: 3, cleanliness: 'dirty', productionYear: 2020, capacityLitres: 500, priceSnapshot: { supplierBaseMultiplier: 1, supplierRelationshipMultiplier: 1, companyPrestige: 0 } },
      usedListing: { id: 'listing-1', vesselId: 'vessel-1', sellerKind: 'company', sellerCounterpartyId: 'company-2', sellerCompanyId: 'company-2', sellerName: 'Nordic Cellar Craft', origin: 'player_sellback', status: 'active', evolutionSeed: 'seed', startingCondition: 0.8, listedYear: 2026, listedSeason: 'Spring', listedWeek: 1, retiredYear: 2027, retiredSeason: 'Spring', retiredWeek: 1 },
    });

    expect(result).toEqual({ success: true });
    expect(mocks.syncPersistedTransaction).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-used-1', money: 4100 }));
  });

  it('releases a claimed offer when the standard transaction rejects the payment', async () => {
    mocks.addTransaction.mockRejectedValueOnce(new Error('Insufficient funds'));
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    await expect(purchaseStorageVesselOffer(offer.offerId, 1)).resolves.toEqual({
      success: false,
      error: 'Insufficient funds. Please reopen the market and try again.',
    });
    expect(mocks.releaseBuyMarketOfferUnits).toHaveBeenCalledWith('company-1', offer.offerId, 1);
  });

  it('keeps a paid purchase when its notification fails', async () => {
    mocks.addMessage.mockRejectedValueOnce(new Error('notification failed'));
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    await expect(purchaseStorageVesselOffer(offer.offerId, 1)).resolves.toEqual({ success: true });

    expect(mocks.addTransaction).toHaveBeenCalledOnce();
  });

  it('exposes the cask-specific multiplier breakdown used by the market UI', async () => {
    const { getStorageVesselPriceBreakdown } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const breakdown = getStorageVesselPriceBreakdown({ capacityLitres: 500, productionYear: 2026, currentYear: 2026, qualityScore: 0.8, cleanliness: 'clean', supplierBaseMultiplier: 1.04, supplierRelationshipMultiplier: 0.93, companyPrestige: 500 });

    expect(breakdown.capacityMultiplier).toBe(2);
    expect(breakdown.qualityMultiplier).toBeCloseTo(2.224, 8);
    expect(breakdown.cleanlinessMultiplier).toBe(1);
    expect(breakdown.supplierBaseMultiplier).toBe(1.04);
    expect(breakdown.finalPricePerVessel).toBe(breakdown.finalPrice);
  });

  it('prices a dirty vessel below an otherwise identical clean vessel', async () => {
    const { getStorageVesselPriceBreakdown } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const input = { capacityLitres: 500, productionYear: 2026, currentYear: 2026, qualityScore: 0.8, supplierBaseMultiplier: 1.04, supplierRelationshipMultiplier: 1, companyPrestige: 0 };
    const clean = getStorageVesselPriceBreakdown({ ...input, cleanliness: 'clean' });
    const dirty = getStorageVesselPriceBreakdown({ ...input, cleanliness: 'dirty' });

    expect(dirty.cleanlinessMultiplier).toBeLessThan(clean.cleanlinessMultiplier);
    expect(dirty.finalPrice).toBeLessThan(clean.finalPrice);
  });

  it('uses an aggressively rising quality curve near the top end', async () => {
    const { getStorageVesselPriceBreakdown } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const input = { capacityLitres: 250, productionYear: 2026, currentYear: 2026, cleanliness: 'clean' as const, supplierBaseMultiplier: 1, supplierRelationshipMultiplier: 1, companyPrestige: 0 };
    const good = getStorageVesselPriceBreakdown({ ...input, qualityScore: 0.8 });
    const excellent = getStorageVesselPriceBreakdown({ ...input, qualityScore: 0.95 });
    const nearPerfect = getStorageVesselPriceBreakdown({ ...input, qualityScore: 0.99 });

    expect(excellent.qualityMultiplier).toBeGreaterThan(good.qualityMultiplier * 2);
    expect(nearPerfect.qualityMultiplier).toBeGreaterThan(excellent.qualityMultiplier * 100);
  });

  it('applies an asymptotic age discount without reaching zero', async () => {
    const { getStorageVesselPriceBreakdown } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const input = { capacityLitres: 250, qualityScore: 0.8, cleanliness: 'clean' as const, supplierBaseMultiplier: 1, supplierRelationshipMultiplier: 1, companyPrestige: 0, currentYear: 2026 };
    const newVessel = getStorageVesselPriceBreakdown({ ...input, productionYear: 2026 });
    const oldVessel = getStorageVesselPriceBreakdown({ ...input, productionYear: 1926 });

    expect(oldVessel.ageYears).toBe(100);
    expect(oldVessel.ageMultiplier).toBeGreaterThan(0);
    expect(oldVessel.ageMultiplier).toBeLessThan(newVessel.ageMultiplier);
    expect(oldVessel.finalPrice).toBeLessThan(newVessel.finalPrice);
  });

  it('adds supplier persistence to the cask offer retention chance', async () => {
    mocks.getBuyMarketCounterpartyPersistenceBonus.mockImplementation((level: number) => level === 4 ? 0.22 : level === 5 ? 0.8 : 0);
    const { getStorageVesselOfferRetentionChance } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');

    expect(getStorageVesselOfferRetentionChance(0)).toBe(0.45);
    expect(getStorageVesselOfferRetentionChance(4)).toBe(0.67);
    expect(getStorageVesselOfferRetentionChance(5)).toBe(1);
  });

  it('retains a cask only because its supplier relationship raises the deterministic chance', async () => {
    mocks.getGameState.mockReturnValue({ money: 5000, currentYear: 2026, season: 'Summer', week: 1, prestige: 0 });
    mocks.getBuyMarketCounterpartyPersistenceBonus.mockImplementation((level: number) => level === 4 ? 0.22 : 0);
    mocks.getBuyMarketCounterpartyRelationships.mockResolvedValue({
      'supplier:cooperage_duval': { level: 4 },
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
    expect(offers[0]).toMatchObject({ source: { kind: 'supplier_stock', seller: { id: 'cooperage_duval' } }, payload: { priceSnapshot: expect.any(Object) } });
    expect(offers[0].priceBreakdown.finalPricePerVessel).toBe(offers[0].pricePerVessel);
  });
});
