import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const rows: any[] = [];

  return {
    rows,
    getCurrentCompanyId: vi.fn(() => 'company-1'),
    getGameState: vi.fn(() => ({
      week: 3,
      season: 'Spring',
      currentYear: 2026,
      economyPhase: 'Stable',
      prestige: 0,
      money: 100000,
    })),
    getCompany: vi.fn(async () => ({ id: 'company-1', startingCountry: 'France' })),
    getBulkBuyer: vi.fn(async () => null),
    getSupplierLoyalties: vi.fn(async () => ({})),
    getSupplierRelationshipPriceMultiplier: vi.fn(() => 1),
    getCompanyBuyOfferRows: vi.fn(async () => ({ data: rows, error: null })),
    updateBuyOfferRow: vi.fn(async () => ({ data: null, error: null })),
    deleteBuyOfferRow: vi.fn(async () => ({ data: null, error: null })),
  };
});

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId,
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState,
}));

vi.mock('@/lib/services/user/companyService', () => ({
  companyService: {
    getCompany: mocks.getCompany,
  },
}));

vi.mock('@/lib/services/sales/grapeBuyerMarketService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/sales/grapeBuyerMarketService')>('@/lib/services/sales/grapeBuyerMarketService');
  return {
    ...actual,
    getBulkBuyer: mocks.getBulkBuyer,
  };
});

vi.mock('@/lib/services/sales/grapeSupplierLoyaltyService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/sales/grapeSupplierLoyaltyService')>('@/lib/services/sales/grapeSupplierLoyaltyService');
  return {
    ...actual,
    getSupplierLoyalties: mocks.getSupplierLoyalties,
    getSupplierRelationshipPriceMultiplier: mocks.getSupplierRelationshipPriceMultiplier,
  };
});

vi.mock('@/lib/database/sales/buyMarketOffersDB', () => ({
  getCompanyBuyOfferRows: mocks.getCompanyBuyOfferRows,
  updateBuyOfferRow: mocks.updateBuyOfferRow,
  deleteBuyOfferRow: mocks.deleteBuyOfferRow,
  upsertBuyOfferRows: vi.fn(),
  getCompanyBuyOfferRow: vi.fn(),
}));

describe('buy grape market weekly decay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows.length = 0;

    mocks.rows.push(
      {
        company_id: 'company-1',
        offer_id: 'expired-offer',
        supplier_id: 'supplier-a',
        available_kg: 0,
        quality_score: 0.7,
        quality_decay_per_week: 0.01,
        min_quality_floor: 0.5,
        base_price_per_kg: 3,
        batch_state: 'grapes',
        weeks_on_market: 0,
      },
      {
        company_id: 'company-1',
        offer_id: 'active-offer',
        supplier_id: 'supplier-b',
        available_kg: 300,
        quality_score: 0.5,
        quality_decay_per_week: 0.1,
        min_quality_floor: 0.45,
        base_price_per_kg: 3,
        batch_state: 'grapes',
        weeks_on_market: 1,
      }
    );
  });

  it('deletes empty offers and decays active offer quality with floor protection', async () => {
    const { processWeeklyBuyGrapeOfferDecay } = await import('@/lib/services/sales/buyGrapeMarketService');

    await processWeeklyBuyGrapeOfferDecay();

    expect(mocks.deleteBuyOfferRow).toHaveBeenCalledWith('company-1', 'expired-offer');
    expect(mocks.updateBuyOfferRow).toHaveBeenCalledWith(
      'company-1',
      'active-offer',
      expect.objectContaining({
        quality_score: 0.45,
        weeks_on_market: 2,
        effective_price_per_kg: expect.any(Number),
      })
    );
  });
});
