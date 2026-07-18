import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrapeMarketPanel } from '@/components/ui/market/GrapeMarketPanel';
import { StorageVesselMarketPanel } from '@/components/ui/market/StorageVesselMarketPanel';

const mocks = vi.hoisted(() => ({
  calculateCompanyValue: vi.fn(async () => 0),
  getAvailableStorageVessels: vi.fn<() => Promise<Array<Record<string, unknown>>>>(async () => []),
  getBuyGrapeMarketOffers: vi.fn<() => Promise<Array<Record<string, unknown>>>>(async () => []),
  getBuyGoodsSupplierTrustPreview: vi.fn(() => ({ appliedPoints: 0, cappedPoints: 0, rawPoints: 0 })),
  getStorageVesselMarketOffers: vi.fn<() => Promise<Array<Record<string, unknown>>>>(async () => []),
  purchaseBuyMarketOffer: vi.fn(),
}));

vi.mock('@/components/ui', async () => {
  const react = await import('react');
  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => react.createElement('button', props, children),
    DialogFooter: ({ children }: { children: React.ReactNode }) => react.createElement('div', null, children),
  };
});
vi.mock('@/components/ui/shadCN/tooltip', async () => {
  const react = await import('react');
  return { UnifiedTooltip: ({ children }: { children: React.ReactNode }) => react.createElement(react.Fragment, null, children) };
});
vi.mock('@/components/ui/market/MarketOfferTable', async () => {
  const react = await import('react');
  return {
    MarketOfferTable: ({ rows, columns }: {
      rows: unknown[];
      columns: Array<{ key: string; render: (row: unknown) => React.ReactNode }>;
    }) => react.createElement('div', null, rows.map((row, rowIndex) => react.createElement(
      'div',
      { key: rowIndex },
      columns.map((column) => react.createElement('div', { key: column.key }, column.render(row)))
    ))),
  };
});
vi.mock('@/components/ui/market/MarketQuickBuyRowAction', () => ({ MarketQuickBuyRowAction: () => null }));
vi.mock('@/components/ui/market/BuyGoodsSupplierTrustPanel', () => ({
  BuyGoodsSupplierTrustPanel: () => null,
  getBuyGoodsSupplierTrustColor: () => '',
}));
vi.mock('@/lib/services/market/storageVessels/storageVesselMarketAdapter', () => ({
  getStorageVesselMarketOffers: mocks.getStorageVesselMarketOffers,
}));
vi.mock('@/lib/services/sales/buyGrapeMarketService', () => ({
  getBuyGrapeMarketOffers: mocks.getBuyGrapeMarketOffers,
  getBuyOfferPriceBreakdown: () => ({
    basePricePerKg: 10,
    qualityMultiplier: 1,
    previewValueMultiplier: 1,
    seasonPriceMultiplier: 1,
    economyPriceMultiplier: 1,
    yearCyclePriceMultiplier: 1,
    volatilityPriceMultiplier: 1,
    buyerSensitivityMultiplier: 1,
    supplierRelationshipMultiplier: 1,
    companyPrestigeMultiplier: 1,
    statePremiumMultiplier: 1,
    marketSpreadMultiplier: 1,
    marketFloorPrice: 1,
    finalPricePerKg: 10,
  }),
  getBuyOfferStateLabel: () => 'Grapes',
}));
vi.mock('@/lib/services/market/buyMarketService', () => ({ purchaseBuyMarketOffer: mocks.purchaseBuyMarketOffer }));
vi.mock('@/lib/services/market/buyGoods/buyGoodsSupplierRelationshipService', () => ({
  BUY_GOODS_SUPPLIER_LEVELS: { 0: { name: 'Unknown Seller' } },
  getBuyGoodsSupplierTrustPreview: mocks.getBuyGoodsSupplierTrustPreview,
}));
vi.mock('@/lib/services/finance/financeService', () => ({ calculateCompanyValue: mocks.calculateCompanyValue }));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: () => ({ currentYear: 2026, season: 'Spring' }) }));
vi.mock('@/lib/constants', () => ({
  STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG: 1,
  STORAGE_VESSEL_REFERENCE_CAPACITY_LITRES: 225,
}));
vi.mock('@/lib/constants/wineFeatures/commonFeaturesUtil', () => ({ getFeatureConfig: () => null }));
vi.mock('@/lib/features/weather', () => ({ getWeatherIcon: () => '', getWeatherLabel: () => '' }));
vi.mock('@/lib/services/wine/winery/storageVesselAllocationService', () => ({
  getAvailableStorageVessels: mocks.getAvailableStorageVessels,
  initializeHarvestVolumeLitres: (quantity: number) => quantity,
}));
vi.mock('@/lib/utils', () => ({
  formatNumber: (value: number) => String(value),
  getColorClass: () => '',
  getQualityCategory: () => 'Good',
  getQualityInfo: () => ({ category: 'Good' }),
}));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`Could not find button containing "${text}".`);
  return button;
}

describe('Buy Market panels', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('routes cask purchases through the shared Buy Market dispatcher', async () => {
    mocks.getStorageVesselMarketOffers.mockResolvedValueOnce([{
      id: 'cask-offer-1',
      sellerName: 'Cooper',
      availableUnits: 2,
      pricePerVessel: 100,
      payload: { capacityLitres: 225, productionYear: 2024, qualityScore: 0.8, material: 'oak', vesselType: 'barrel' },
      priceBreakdown: { basePrice: 100, capacityMultiplier: 1, qualityMultiplier: 1, ageYears: 2, ageMultiplier: 0.95, cleanlinessMultiplier: 1, supplierBaseMultiplier: 1, supplierRelationshipMultiplier: 1, companyPrestigeMultiplier: 1, qualityScore: 0.8, capacityLitres: 225, minimumPrice: 1, maximumPrice: 1_000, finalPricePerVessel: 100 },
    }]);
    mocks.purchaseBuyMarketOffer.mockResolvedValue({ success: true });
    const onClose = vi.fn();

    await act(async () => {
      root.render(React.createElement(StorageVesselMarketPanel, { onClose }));
      await flushPromises();
    });

    await act(async () => {
      findButton(container, 'Buy for').click();
      await flushPromises();
    });

    expect(mocks.purchaseBuyMarketOffer).toHaveBeenCalledWith('cask-offer-1', 1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows grapes as buying until the shared purchase request settles', async () => {
    const purchase = deferred<{ success: boolean }>();
    mocks.getBuyGrapeMarketOffers.mockResolvedValueOnce([{
      id: 'grape-offer-1',
      supplierName: 'Grower',
      grapeVariety: 'Cabernet Sauvignon',
      availableKg: 10,
      qualityScore: 0.8,
      effectivePricePerKg: 10,
      batchState: 'grapes',
      originTag: 'seasonal_rotation',
      weeksOnMarket: 0,
      previewBatch: { features: [] },
    }]);
    mocks.getAvailableStorageVessels.mockResolvedValueOnce([{ id: 'vessel-1', capacityLitres: 10, material: 'oak', vesselType: 'barrel' }]);
    mocks.purchaseBuyMarketOffer.mockReturnValueOnce(purchase.promise);
    const onClose = vi.fn();

    await act(async () => {
      root.render(React.createElement(GrapeMarketPanel, { onClose }));
      await flushPromises();
    });
    await act(async () => {
      const vessel = container.querySelector('input[type="checkbox"]');
      if (!vessel) throw new Error('Expected a storage vessel checkbox.');
      (vessel as HTMLInputElement).click();
      await flushPromises();
    });

    await act(async () => {
      findButton(container, 'Buy for').click();
      await flushPromises();
    });

    expect(findButton(container, 'Buying').disabled).toBe(true);
    expect(mocks.purchaseBuyMarketOffer).toHaveBeenCalledWith('grape-offer-1', 10, { storageVesselIds: ['vessel-1'] });

    await act(async () => {
      purchase.resolve({ success: true });
      await flushPromises();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders grape purchase errors and restores the purchase control', async () => {
    mocks.getBuyGrapeMarketOffers.mockResolvedValueOnce([{
      id: 'grape-offer-1',
      supplierName: 'Grower',
      grapeVariety: 'Cabernet Sauvignon',
      availableKg: 10,
      qualityScore: 0.8,
      effectivePricePerKg: 10,
      batchState: 'grapes',
      originTag: 'seasonal_rotation',
      weeksOnMarket: 0,
      previewBatch: { features: [] },
    }]);
    mocks.getAvailableStorageVessels.mockResolvedValueOnce([{ id: 'vessel-1', capacityLitres: 10, material: 'oak', vesselType: 'barrel' }]);
    mocks.purchaseBuyMarketOffer.mockResolvedValueOnce({ success: false, error: 'Supplier is unavailable.' });

    await act(async () => {
      root.render(React.createElement(GrapeMarketPanel, { onClose: vi.fn() }));
      await flushPromises();
    });
    await act(async () => {
      const vessel = container.querySelector('input[type="checkbox"]');
      if (!vessel) throw new Error('Expected a storage vessel checkbox.');
      (vessel as HTMLInputElement).click();
      await flushPromises();
    });
    await act(async () => {
      findButton(container, 'Buy for').click();
      await flushPromises();
    });

    expect(container.textContent).toContain('Supplier is unavailable.');
    expect(findButton(container, 'Buy for').disabled).toBe(false);
    expect(container.textContent).not.toContain('Buying…');
  });
});
