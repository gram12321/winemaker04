import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processWeeklyBuyGrapeOfferDecay } from '@/lib/services/sales/buyGrapeMarketService';

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
    getBulkSupplier: vi.fn(async () => ({ supplierId: 'supplier-a', country: 'France' })),
    getSeasonalSuppliers: vi.fn(async () => ([{ supplierId: 'supplier-b', country: 'France' }])),
    getSupplierLoyalties: vi.fn(async () => ({})),
    getSupplierRelationshipPriceMultiplier: vi.fn(() => 1),
    getCompanyBuyOfferRows: vi.fn(async () => ({ data: rows, error: null })),
    updateBuyOfferRow: vi.fn(async () => ({ data: null, error: null })),
    deleteBuyOfferRow: vi.fn(async () => ({ data: null, error: null })),
    buildMarketPreviewBatch: vi.fn(async (input: any) => ({
      id: 'preview-batch',
      vineyardId: 'market_purchase',
      vineyardName: input.supplierName,
      grape: input.grape,
      quantity: input.quantity,
      state: input.stateProfile?.state ?? 'grapes',
      fermentationProgress: input.stateProfile?.fermentationProgress ?? 0,
      fermentationOptions: input.stateProfile?.fermentationOptions,
      landValueModifierHarvestSnapshot: input.source.baseQualityScore ?? 0.5,
      structureIndexHarvestSnapshot: input.source.baseQualityScore ?? 0.5,
      tasteQualityIndexHarvestSnapshot: input.source.baseQualityScore ?? 0.5,
      landValueModifier: input.source.baseQualityScore ?? 0.5,
      structureIndex: input.source.baseQualityScore ?? 0.5,
      tasteQualityIndex: input.source.baseQualityScore ?? 0.5,
      characteristics: { acidity: 0.5, aroma: 0.5, body: 0.5, spice: 0.5, sweetness: 0.5, tannins: 0.5 },
      estimatedPrice: 8,
      grapeColor: 'red',
      naturalYield: 1,
      fragile: 0.3,
      proneToOxidation: 0.3,
      features: [],
      wineAnchors: {
        sugarPotential: 0.5,
        acidPotential: 0.5,
        phenolicPotential: 0.5,
        aromaticPotential: 0.5,
        bodyPotential: 0.5,
        extractionState: 0.1,
        fermentationState: 0.05,
        leesState: 0.1,
        oxidationPressure: 0.25,
        maturationState: 0,
        terroirExpression: 0.5,
        processFootprint: 0.35,
      },
      originSnapshot: {
        sourceKind: 'market',
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        originTag: input.originTag,
        previewState: input.stateProfile?.state ?? 'grapes',
        terroirSummary: `${input.source.region}, ${input.source.country}`,
        provenance: input.source,
      },
      harvestStartDate: input.harvestStartDate,
      harvestEndDate: input.harvestEndDate,
    })),
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

vi.mock('@/lib/services/sales/grapeSupplierMarketService', () => ({
  getBulkSupplier: mocks.getBulkSupplier,
  getSeasonalSuppliers: mocks.getSeasonalSuppliers,
  recordMarketSupplierPurchase: vi.fn(),
}));

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

vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  buildMarketPreviewBatch: mocks.buildMarketPreviewBatch,
}));

describe('buy grape market weekly decay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows.length = 0;

    mocks.rows.push(
      {
        company_id: 'company-1',
        offer_id: 'expired-offer',
        ware_group: 'grapes',
        supplier_id: 'supplier-a',
        supplier_name: 'Supplier A',
        origin_tag: 'seasonal_rotation',
        grape_variety: 'Chardonnay',
        available_kg: 0,
        quality_score: 0.7,
        quality_decay_per_week: 0.01,
        min_quality_floor: 0.5,
        base_price_per_kg: 3,
        batch_state: 'grapes',
        weeks_on_market: 0,
        created_year: 2026,
        created_season: 'Spring',
        created_week: 1,
        last_refreshed_year: 2026,
        last_refreshed_season: 'Spring',
        last_refreshed_week: 2,
      },
      {
        company_id: 'company-1',
        offer_id: 'active-offer',
        ware_group: 'grapes',
        supplier_id: 'supplier-b',
        supplier_name: 'Supplier B',
        origin_tag: 'seasonal_rotation',
        grape_variety: 'Pinot Noir',
        available_kg: 300,
        quality_score: 0.5,
        quality_decay_per_week: 0.1,
        min_quality_floor: 0.45,
        base_price_per_kg: 3,
        batch_state: 'grapes',
        weeks_on_market: 1,
        created_year: 2026,
        created_season: 'Spring',
        created_week: 1,
        last_refreshed_year: 2026,
        last_refreshed_season: 'Spring',
        last_refreshed_week: 2,
      },
      {
        company_id: 'company-1',
        offer_id: 'time-expired-offer',
        ware_group: 'grapes',
        supplier_id: 'supplier-a',
        supplier_name: 'Supplier A',
        origin_tag: 'seasonal_rotation',
        grape_variety: 'Chardonnay',
        available_kg: 250,
        quality_score: 0.7,
        quality_decay_per_week: 0.01,
        min_quality_floor: 0.5,
        base_price_per_kg: 3,
        batch_state: 'grapes',
        weeks_on_market: 0,
        created_year: 2026,
        created_season: 'Spring',
        created_week: 1,
        last_refreshed_year: 2026,
        last_refreshed_season: 'Spring',
        last_refreshed_week: 2,
        expires_year: 2026,
        expires_season: 'Spring',
        expires_week: 3,
      }
    );
  });

  it('deletes empty offers and decays active offer quality with floor protection', async () => {
    await processWeeklyBuyGrapeOfferDecay();

    expect(mocks.deleteBuyOfferRow).toHaveBeenCalledWith('company-1', 'expired-offer');
    expect(mocks.deleteBuyOfferRow).toHaveBeenCalledWith('company-1', 'time-expired-offer');
    expect(mocks.updateBuyOfferRow).toHaveBeenCalledWith(
      'company-1',
      'active-offer',
      expect.objectContaining({
        quality_score: 0.45,
        weeks_on_market: 2,
        effective_price_per_kg: expect.any(Number),
        preview_version: expect.any(Number),
        preview_snapshot: expect.any(Object),
        provenance_snapshot: expect.any(Object),
      })
    );
  });
});
