import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUY_MARKET_DEMAND_FACTORS } from '@/lib/constants';
import { computeBuyOfferPricePerKg, processWeeklyBuyGrapeOfferDecay } from '@/lib/services/sales/buyGrapeMarketService';

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
    getSupplierRelationshipPriceMultiplier: vi.fn<(level: number) => number>(() => 1),
    getCompanyGrapeMarketOfferRows: vi.fn(async () => ({ data: rows, error: null })),
    updateGrapeMarketOfferRow: vi.fn(async () => ({ data: null, error: null })),
    deleteGrapeMarketOfferRow: vi.fn(async () => ({ data: null, error: null })),
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

vi.mock('@/lib/features/company', () => ({
  companyFeature: { records: { get: mocks.getCompany } },
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

vi.mock('@/lib/services/market/grapes/grapeMarketOfferPersistence', () => ({
  getCompanyGrapeMarketOfferRows: mocks.getCompanyGrapeMarketOfferRows,
  updateGrapeMarketOfferRow: mocks.updateGrapeMarketOfferRow,
  deleteGrapeMarketOfferRow: mocks.deleteGrapeMarketOfferRow,
  upsertGrapeMarketOfferRows: vi.fn(),
  getCompanyGrapeMarketOfferRow: vi.fn(),
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
        price_snapshot: {
          supplierRelationshipMultiplier: 1,
          companyPrestige: 0,
          seasonPriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.seasonPriceMultiplier,
          economyPriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.economyPriceMultiplier,
          yearCyclePriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.yearCyclePriceMultiplier,
          volatilityPriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.volatilityPriceMultiplier,
          volatilityBuyerPriceSensitivityMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.volatilityBuyerPriceSensitivityMultiplier ?? 1,
        },
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
    mocks.getGameState.mockReturnValue({
      week: 3,
      season: 'Spring',
      currentYear: 2026,
      economyPhase: 'Stable',
      prestige: 650,
      money: 100000,
    });
    mocks.getSupplierLoyalties.mockResolvedValue({
      'supplier-b': { level: 4 },
    });
    mocks.getSupplierRelationshipPriceMultiplier.mockImplementation((level: number) => level === 4 ? 0.95 : 1);

    await processWeeklyBuyGrapeOfferDecay();

    const refreshedPriceSnapshot = {
      supplierRelationshipMultiplier: 0.95,
      companyPrestige: 650,
      seasonPriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.seasonPriceMultiplier,
      economyPriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.economyPriceMultiplier,
      yearCyclePriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.yearCyclePriceMultiplier,
      volatilityPriceMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.volatilityPriceMultiplier,
      volatilityBuyerPriceSensitivityMultiplier: DEFAULT_BUY_MARKET_DEMAND_FACTORS.volatilityBuyerPriceSensitivityMultiplier ?? 1,
    };
    const expectedPrice = Number(computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.45,
      state: 'grapes',
      season: 'Spring',
      economyPhase: 'Stable',
      year: 2026,
      previewValueMultiplier: 1,
      priceSnapshot: refreshedPriceSnapshot,
    }).toFixed(2));

    expect(mocks.deleteGrapeMarketOfferRow).toHaveBeenCalledWith('company-1', 'expired-offer');
    expect(mocks.deleteGrapeMarketOfferRow).toHaveBeenCalledWith('company-1', 'time-expired-offer');
    expect(mocks.updateGrapeMarketOfferRow).toHaveBeenCalledWith(
      'company-1',
      'active-offer',
      expect.objectContaining({
        quality_score: 0.45,
        weeks_on_market: 2,
        price_snapshot: refreshedPriceSnapshot,
        effective_price_per_kg: expectedPrice,
        preview_version: expect.any(Number),
        preview_snapshot: expect.any(Object),
        provenance_snapshot: expect.any(Object),
      })
    );
  });
});
