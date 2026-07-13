import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentCompanyId: vi.fn(() => 'company-1'),
  getGameState: vi.fn(() => ({ money: 5000, currentYear: 2026, season: 'Spring', week: 1 })),
  getCompanyBuyMarketOffer: vi.fn(),
  getCompanyBuyMarketOffers: vi.fn(),
  claimBuyMarketOfferUnits: vi.fn(async () => ({ claimed: true, error: null })),
  upsertBuyMarketOffers: vi.fn(async () => ({ error: null })),
  createPurchasedStorageVessels: vi.fn(async () => []),
  addTransaction: vi.fn(async () => undefined),
  addMessage: vi.fn(async () => undefined),
  triggerTopicUpdate: vi.fn(),
  recordBuyGoodsSupplierPurchase: vi.fn(async () => null),
}));

vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: mocks.getCurrentCompanyId }));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: mocks.getGameState }));
vi.mock('@/lib/database/market/buyMarketOffersDB', () => ({
  getCompanyBuyMarketOffer: mocks.getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers: mocks.getCompanyBuyMarketOffers,
  claimBuyMarketOfferUnits: mocks.claimBuyMarketOfferUnits,
  upsertBuyMarketOffers: mocks.upsertBuyMarketOffers,
}));
vi.mock('@/lib/services/wine/winery/storageVesselService', () => ({ createPurchasedStorageVessels: mocks.createPurchasedStorageVessels }));
vi.mock('@/lib/services/finance/financeService', () => ({ addTransaction: mocks.addTransaction }));
vi.mock('@/lib/services/core/notificationService', () => ({ notificationService: { addMessage: mocks.addMessage } }));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerTopicUpdate: mocks.triggerTopicUpdate }));
vi.mock('@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService', () => ({
  recordBuyGoodsSupplierPurchase: mocks.recordBuyGoodsSupplierPurchase,
  getBuyGoodsSupplierRelationships: vi.fn(async () => ({})),
  getBuyGoodsSupplierRelationshipPriceMultiplier: vi.fn(() => 1),
  getBuyGoodsSupplierPersistenceBonus: vi.fn(() => 0),
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

    expect(mocks.createPurchasedStorageVessels).toHaveBeenCalledWith(
      { vesselType: 'cask', material: 'oak', qualityScore: 0.78, productionYear: 2024, capacityLitres: 225 },
      offer.offerId,
      950,
      2,
    );
    expect(mocks.addTransaction).toHaveBeenCalledWith(-1900, expect.stringContaining('2 storage vessels'), 'Supplies', false, 'company-1');
    expect(mocks.claimBuyMarketOfferUnits).toHaveBeenCalledWith('company-1', offer.offerId, 2);
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('storage_vessels');
  });

  it('does not create a vessel when the requested quantity exceeds availability', async () => {
    const { purchaseStorageVesselOffer } = await import('@/lib/services/market/storageVessels/storageVesselMarketAdapter');
    const result = await purchaseStorageVesselOffer(offer.offerId, 4);
    expect(result.success).toBe(false);
    expect(mocks.createPurchasedStorageVessels).not.toHaveBeenCalled();
    expect(mocks.addTransaction).not.toHaveBeenCalled();
  });
});
