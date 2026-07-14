import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentCompanyId: vi.fn(() => 'company-1'),
  getCompanyBuyMarketOffer: vi.fn(),
  purchaseStorageVesselOffer: vi.fn(async () => ({ success: true })),
  getBuyMarketDomainAdapter: vi.fn(),
}));

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId,
}));
vi.mock('@/lib/database/market/buyMarketOffersDB', () => ({
  getCompanyBuyMarketOffer: mocks.getCompanyBuyMarketOffer,
}));
vi.mock('@/lib/services/market/buyMarketDomainRegistry', () => ({
  getBuyMarketDomainAdapter: mocks.getBuyMarketDomainAdapter,
}));

describe('buyMarketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentCompanyId.mockReturnValue('company-1');
    mocks.getCompanyBuyMarketOffer.mockResolvedValue({
      data: { offerId: 'cask-offer-1', wareGroup: 'storage_vessels' },
      error: null,
    });
    mocks.getBuyMarketDomainAdapter.mockReturnValue({
      purchase: mocks.purchaseStorageVesselOffer,
    });
  });

  it('dispatches a storage-vessel offer to its adapter with the default input', async () => {
    const { purchaseBuyMarketOffer } = await import('@/lib/services/market/buyMarketService');

    await expect(purchaseBuyMarketOffer('cask-offer-1', 2)).resolves.toEqual({ success: true });

    expect(mocks.getBuyMarketDomainAdapter).toHaveBeenCalledWith('storage_vessels');
    expect(mocks.purchaseStorageVesselOffer).toHaveBeenCalledWith('cask-offer-1', 2, {});
  });
});
