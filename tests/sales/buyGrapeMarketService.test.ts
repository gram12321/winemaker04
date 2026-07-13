import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUY_MARKET_FIXED_SPREAD } from '@/lib/constants';
import { computeBuyOfferPricePerKg, getBuyOfferStateLabel } from '@/lib/services/sales/buyGrapeMarketService';

const mocks = vi.hoisted(() => ({
  getCurrentCompanyId: vi.fn(() => 'company-1'),
  getGameState: vi.fn(() => ({
    week: 3,
    season: 'Spring',
    currentYear: 2026,
    economyPhase: 'Stable',
    prestige: 75,
    money: 100000,
  })),
  getCompany: vi.fn(async () => ({ id: 'company-1', startingCountry: 'France' })),
  getBulkSupplier: vi.fn(async () => ({
    supplierId: 'bulk_supplier',
    supplierName: 'Bulk Supply Syndicate',
    country: 'France',
    originTag: 'country_special',
    basePriceMultiplier: 0.88,
    baseSeasonSupplyKg: 22000,
    effectiveSeasonSupplyKg: 600,
    suppliedThisSeasonKg: 200,
    remainingSeasonSupplyKg: 400,
    loyaltyLevel: 0,
    isBulkSupplier: true,
  })),
  getSeasonalSuppliers: vi.fn(async () => []),
  getCompanyBuyOfferRow: vi.fn(async () => ({
    data: {
      company_id: 'company-1',
      offer_id: 'offer-1',
      ware_group: 'grapes',
      supplier_id: 'bulk_supplier',
      supplier_name: 'Bulk Supply Syndicate',
      origin_tag: 'country_special',
      batch_state: 'grapes',
      grape_variety: 'Chardonnay',
      available_kg: 500,
      quality_score: 0.62,
      base_price_per_kg: 3.2,
      effective_price_per_kg: 4,
      weeks_on_market: 1,
      quality_decay_per_week: 0.01,
      min_quality_floor: 0.45,
      is_persistent: false,
      created_year: 2026,
      created_season: 'Spring',
      created_week: 3,
      last_refreshed_year: 2026,
      last_refreshed_season: 'Spring',
      last_refreshed_week: 3,
      expires_year: 2026,
      expires_season: 'Summer',
      expires_week: 1,
      updated_at: new Date().toISOString(),
    },
    error: null,
  })),
  deleteBuyOfferRow: vi.fn(async () => ({ data: null, error: null })),
  updateBuyOfferRow: vi.fn(async () => ({ data: null, error: null })),
  claimBuyMarketOfferUnits: vi.fn(async () => ({ claimed: true, error: null })),
  releaseBuyMarketOfferUnits: vi.fn(async () => ({ released: true, error: null })),
  saveInventoryBatch: vi.fn(async () => true),
  deleteInventoryBatch: vi.fn(async () => undefined),
  createStorageAllocationPlan: vi.fn(async () => ({ planId: 'plan-1' })),
  activateStoragePlanForBatch: vi.fn(async () => true),
  releaseStorageAllocationPlan: vi.fn(async () => true),
  addTransaction: vi.fn(async () => undefined),
  recordSupplierPurchase: vi.fn(async () => ({
    companyId: 'company-1',
    supplierId: 'bulk_supplier',
    supplierName: 'Bulk Supply Syndicate',
    totalPurchases: 1,
    consecutiveYears: 1,
    totalKgPurchased: 0,
    loyaltyScore: 0,
    yearGuardYear: 2026,
    yearKgPurchased: 0,
    yearLoyaltyPoints: 0,
    lastPurchaseYear: 2026,
    level: 0,
  })),
  recordMarketSupplierPurchase: vi.fn(async () => undefined),
  addMessage: vi.fn(async () => undefined),
  triggerTopicUpdate: vi.fn(() => undefined),
  getSupplierLoyalties: vi.fn(async () => ({})),
  getSupplierRelationshipPriceMultiplier: vi.fn(() => 1),
  getBulkBuyer: vi.fn(async () => null),
  getCompanyBuyOfferRows: vi.fn(async () => ({ data: [], error: null })),
  upsertBuyOfferRows: vi.fn(async () => ({ data: null, error: null })),
  buildMarketPreviewBatch: vi.fn(async (input: any) => ({
    id: 'preview-batch',
    vineyardId: 'market_purchase',
    vineyardName: input.supplierName,
    grape: input.grape,
    quantity: input.quantity,
    state: input.stateProfile?.state ?? 'grapes',
    fermentationProgress: input.stateProfile?.fermentationProgress ?? 0,
    fermentationOptions: input.stateProfile?.fermentationOptions,
    landValueModifierHarvestSnapshot: input.source.baseQualityScore ?? 0.6,
    structureIndexHarvestSnapshot: input.source.baseQualityScore ?? 0.6,
    tasteQualityIndexHarvestSnapshot: input.source.baseQualityScore ?? 0.6,
    landValueModifier: input.source.baseQualityScore ?? 0.6,
    structureIndex: input.source.baseQualityScore ?? 0.6,
    tasteQualityIndex: input.source.baseQualityScore ?? 0.6,
    characteristics: {
      acidity: input.source.baseQualityScore ?? 0.6,
      aroma: input.source.baseQualityScore ?? 0.6,
      body: input.source.baseQualityScore ?? 0.6,
      spice: 0.5,
      sweetness: 0.5,
      tannins: 0.5,
    },
    estimatedPrice: 10,
    grapeColor: input.grape === 'Pinot Noir' ? 'red' : 'white',
    naturalYield: 1,
    fragile: 0.3,
    proneToOxidation: 0.3,
    features: [],
    wineAnchors: {
      sugarPotential: 0.6,
      acidPotential: 0.6,
      phenolicPotential: 0.6,
      aromaticPotential: 0.6,
      bodyPotential: 0.6,
      extractionState: input.stateProfile?.state === 'grapes' ? 0.1 : 0.4,
      fermentationState: input.stateProfile?.state === 'must_fermenting' ? 0.7 : input.stateProfile?.state === 'must_ready' ? 0.3 : 0.05,
      leesState: 0.1,
      oxidationPressure: 0.25,
      maturationState: 0,
      terroirExpression: 0.55,
      processFootprint: 0.35,
    },
    breakdown: {
      effects: [],
      anchorEffects: [{ anchor: 'terroirExpression', modifier: 0.05, description: 'Market preview' }],
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
}));

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

vi.mock('@/lib/services/sales/grapeSupplierMarketService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/sales/grapeSupplierMarketService')>('@/lib/services/sales/grapeSupplierMarketService');
  return {
    ...actual,
    getBulkSupplier: mocks.getBulkSupplier,
    getSeasonalSuppliers: mocks.getSeasonalSuppliers,
    recordMarketSupplierPurchase: mocks.recordMarketSupplierPurchase,
  };
});

vi.mock('@/lib/services/sales/grapeSupplierLoyaltyService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/sales/grapeSupplierLoyaltyService')>('@/lib/services/sales/grapeSupplierLoyaltyService');
  return {
    ...actual,
    recordSupplierPurchase: mocks.recordSupplierPurchase,
    getSupplierLoyalties: mocks.getSupplierLoyalties,
    getSupplierRelationshipPriceMultiplier: mocks.getSupplierRelationshipPriceMultiplier,
  };
});

vi.mock('@/lib/services/sales/grapeBuyerMarketService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/sales/grapeBuyerMarketService')>('@/lib/services/sales/grapeBuyerMarketService');
  return {
    ...actual,
    getBulkBuyer: mocks.getBulkBuyer,
  };
});

vi.mock('@/lib/services/market/grapes/grapeMarketOfferPersistence', () => ({
  getCompanyBuyOfferRow: mocks.getCompanyBuyOfferRow,
  getCompanyBuyOfferRows: mocks.getCompanyBuyOfferRows,
  updateBuyOfferRow: mocks.updateBuyOfferRow,
  deleteBuyOfferRow: mocks.deleteBuyOfferRow,
  upsertBuyOfferRows: mocks.upsertBuyOfferRows,
}));

vi.mock('@/lib/services/finance/financeService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/finance/financeService')>('@/lib/services/finance/financeService');
  return {
    ...actual,
    addTransaction: mocks.addTransaction,
  };
});

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: {
    addMessage: mocks.addMessage,
  },
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerTopicUpdate: mocks.triggerTopicUpdate,
}));

vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  buildMarketPreviewBatch: mocks.buildMarketPreviewBatch,
  saveInventoryBatch: mocks.saveInventoryBatch,
  deleteInventoryBatch: mocks.deleteInventoryBatch,
}));

vi.mock('@/lib/database/market/buyMarketOffersDB', () => ({
  claimBuyMarketOfferUnits: mocks.claimBuyMarketOfferUnits,
  releaseBuyMarketOfferUnits: mocks.releaseBuyMarketOfferUnits,
}));
vi.mock('@/lib/services/wine/winery/storageVesselAllocationService', () => ({
  initializeHarvestVolumeLitres: (kg: number) => Math.ceil(kg * 0.5),
  createStorageAllocationPlan: mocks.createStorageAllocationPlan,
  activateStoragePlanForBatch: mocks.activateStoragePlanForBatch,
  releaseStorageAllocationPlan: mocks.releaseStorageAllocationPlan,
}));

describe('buy grape market service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentCompanyId.mockReturnValue('company-1');
    mocks.getGameState.mockReturnValue({
      week: 3,
      season: 'Spring',
      currentYear: 2026,
      economyPhase: 'Stable',
      prestige: 75,
      money: 100000,
    });
  });

  it('applies fixed spread above mirrored baseline', () => {
    const value = computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.65,
      state: 'grapes',
      season: 'Spring',
      economyPhase: 'Stable',
      year: 2026,
      volatilityMultiplier: 1,
    });

    const approximateMirroredBaseline = 3 * (0.55 + 0.65 * 1.05) * 1.03 * 1 * 1.05;
    expect(value).toBeGreaterThan(approximateMirroredBaseline);
    expect(value).toBeGreaterThan(3 * (1 + BUY_MARKET_FIXED_SPREAD * 0.5));
  });

  it('prices fermenting state above grapes for same quality and market context', () => {
    const grapesPrice = computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.6,
      state: 'grapes',
      season: 'Fall',
      economyPhase: 'Stable',
      year: 2026,
      volatilityMultiplier: 1,
    });

    const fermentingPrice = computeBuyOfferPricePerKg({
      basePrice: 3,
      qualityScore: 0.6,
      state: 'must_fermenting',
      season: 'Fall',
      economyPhase: 'Stable',
      year: 2026,
      volatilityMultiplier: 1,
    });

    expect(fermentingPrice).toBeGreaterThan(grapesPrice);
  });

  it('returns expected state labels', () => {
    expect(getBuyOfferStateLabel('grapes')).toBe('Grapes');
    expect(getBuyOfferStateLabel('must_ready')).toBe('Must');
    expect(getBuyOfferStateLabel('must_fermenting')).toBe('Fermenting');
  });

  it('recreates active-company offers without touching supplier relationships', async () => {
    mocks.getCompanyBuyOfferRows
      .mockResolvedValueOnce({ data: [{ offer_id: 'stale-offer' }] as never, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const { recreateBuyGrapeMarketOffers } = await import('@/lib/services/sales/buyGrapeMarketService');
    await recreateBuyGrapeMarketOffers();

    expect(mocks.deleteBuyOfferRow).toHaveBeenCalledWith('company-1', 'stale-offer');
    expect(mocks.upsertBuyOfferRows).toHaveBeenCalledOnce();
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('buy_grape_market');
    expect(mocks.recordSupplierPurchase).not.toHaveBeenCalled();
  });

  it('creates inventory, writes transaction, and updates offer volume after successful purchase', async () => {
    const { purchaseBuyGrapeOffer } = await import('@/lib/services/sales/buyGrapeMarketService');

    const result = await purchaseBuyGrapeOffer('offer-1', 120, ['vessel-1']);

    expect(result).toEqual({ success: true });
    expect(mocks.saveInventoryBatch).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 120,
      grape: 'Chardonnay',
      state: 'grapes',
      wineAnchors: expect.any(Object),
      characteristics: expect.any(Object),
      originSnapshot: expect.objectContaining({
        sourceKind: 'market',
        supplierId: 'bulk_supplier',
        supplierName: 'Bulk Supply Syndicate',
        terroirSummary: expect.any(String)
      })
    }));
    expect(mocks.addTransaction).toHaveBeenCalledWith(
      -480,
      expect.stringContaining('Market Purchase: 120 kg Chardonnay (Grapes) from Bulk Supply Syndicate'),
      'Supplies',
      false,
      'company-1',
      true,
    );
    expect(mocks.recordSupplierPurchase).toHaveBeenCalledWith('bulk_supplier', 'Bulk Supply Syndicate', 120, 2026, 480);
    expect(mocks.recordMarketSupplierPurchase).toHaveBeenCalledWith('bulk_supplier', 120, 2026, 'Spring');
    expect(mocks.claimBuyMarketOfferUnits).toHaveBeenCalledWith('company-1', 'offer-1', 120);
    expect(mocks.addMessage).toHaveBeenCalledOnce();
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('wine_batches');
  });

  it('creates deterministic fermenting batches from the stored market offer preview contract', async () => {
    mocks.getCompanyBuyOfferRow.mockResolvedValueOnce({
      data: {
        company_id: 'company-1',
        offer_id: 'offer-2',
        ware_group: 'grapes',
        supplier_id: 'bulk_supplier',
        supplier_name: 'Bulk Supply Syndicate',
        origin_tag: 'country_special',
        batch_state: 'must_fermenting',
        grape_variety: 'Pinot Noir',
        available_kg: 300,
        quality_score: 0.71,
        base_price_per_kg: 3.6,
        effective_price_per_kg: 4.2,
        weeks_on_market: 2,
        quality_decay_per_week: 0.01,
        min_quality_floor: 0.45,
        is_persistent: true,
        created_year: 2026,
        created_season: 'Spring',
        created_week: 3,
        last_refreshed_year: 2026,
        last_refreshed_season: 'Spring',
        last_refreshed_week: 3,
        expires_year: 2026,
        expires_season: 'Summer',
        expires_week: 1,
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const { purchaseBuyGrapeOffer } = await import('@/lib/services/sales/buyGrapeMarketService');
    const result = await purchaseBuyGrapeOffer('offer-2', 75, ['vessel-1']);

    expect(result).toEqual({ success: true });
    expect(mocks.saveInventoryBatch).toHaveBeenCalledWith(expect.objectContaining({
      grape: 'Pinot Noir',
      quantity: 75,
      state: 'must_fermenting',
      fermentationOptions: expect.objectContaining({
        method: expect.any(String),
        temperature: expect.any(String)
      }),
      fermentationProgress: expect.any(Number),
      originSnapshot: expect.objectContaining({
        sourceKind: 'market',
        supplierName: 'Bulk Supply Syndicate'
      })
    }));
  });

  it('blocks purchase when requested quantity exceeds supplier seasonal remaining capacity', async () => {
    const { purchaseBuyGrapeOffer } = await import('@/lib/services/sales/buyGrapeMarketService');

    const result = await purchaseBuyGrapeOffer('offer-1', 450, ['vessel-1']);

    expect(result.success).toBe(false);
    expect(result.error).toContain('remaining seasonal supply (400 kg)');
    expect(mocks.saveInventoryBatch).not.toHaveBeenCalled();
    expect(mocks.addTransaction).not.toHaveBeenCalled();
    expect(mocks.recordSupplierPurchase).not.toHaveBeenCalled();
    expect(mocks.recordMarketSupplierPurchase).not.toHaveBeenCalled();
    expect(mocks.updateBuyOfferRow).not.toHaveBeenCalledWith(
      'company-1',
      'offer-1',
      expect.objectContaining({ available_kg: expect.any(Number) })
    );
    expect(mocks.deleteBuyOfferRow).not.toHaveBeenCalled();
  });
});
