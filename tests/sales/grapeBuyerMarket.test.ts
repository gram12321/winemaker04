import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_SEASONAL_BUYER_COUNT, BULK_BASE_SEASON_LIMIT_KG } from '@/lib/constants/grapeBuyerMarketConstants';

type BuyerRow = {
  company_id: string;
  buyer_id: string;
  display_name: string;
  country: string;
  description: string | null;
  is_germany_coop: boolean;
  base_multiplier: number;
  multiplier_min: number;
  multiplier_max: number;
  base_season_limit_kg: number;
  base_yearly_limit_kg: number;
  sold_this_season_kg: number;
  favorite_grape_1: string | null;
  favorite_grape_2: string | null;
  last_active_year: number | null;
  last_active_season: string | null;
  updated_at: string;
};

const mocks = vi.hoisted(() => {
  let rows: BuyerRow[] = [];

  const findRow = (companyId: string, buyerId: string) =>
    rows.find(row => row.company_id === companyId && row.buyer_id === buyerId);

  return {
    setRows: (nextRows: BuyerRow[]) => {
      rows = nextRows;
    },
    getRows: () => rows,
    getCurrentCompanyId: vi.fn(() => 'company-1'),
    getGameState: vi.fn(() => ({ currentYear: 2026, season: 'Spring', economyPhase: 'Stable' })),
    calculateCompanyValue: vi.fn(async () => 100000),
    getUnlockedItems: vi.fn(async (type: string) => (type === 'grape_buyer_slots' ? ['2'] : [])),
    getBuyerLoyalty: vi.fn(async () => null),
    getBuyerRelationshipPriceMultiplier: vi.fn(() => 1),
    getBuyerRelationshipYearlyLimitBonus: vi.fn(() => 0),
    getBuyerPriorityRows: vi.fn(async () => ({ data: [], error: null })),
    createBuyerRow: vi.fn(async (row: BuyerRow) => {
      rows = [...rows, row];
      return { data: row, error: null };
    }),
    getBuyerRow: vi.fn(async (companyId: string, buyerId: string) => ({
      data: findRow(companyId, buyerId) || null,
      error: null
    })),
    getBuyerSeasonStateRow: vi.fn(async (companyId: string, buyerId: string) => ({
      data: findRow(companyId, buyerId) || null,
      error: null
    })),
    getKnownCountryBuyerRowsForCountries: vi.fn(async (companyId: string, countries: string[], excludedBuyerId: string) => ({
      data: rows.filter(row =>
        row.company_id === companyId &&
        countries.includes(row.country) &&
        row.buyer_id !== excludedBuyerId
      ),
      error: null
    })),
    getSeasonBuyerRowsForCountries: vi.fn(async (
      companyId: string,
      countries: string[],
      year: number,
      season: string,
      excludedBuyerId: string
    ) => ({
      data: rows.filter(row =>
        row.company_id === companyId &&
        countries.includes(row.country) &&
        row.buyer_id !== excludedBuyerId &&
        row.last_active_year === year &&
        row.last_active_season === season
      ),
      error: null
    })),
    updateBuyerRow: vi.fn(async (companyId: string, buyerId: string, updates: Partial<BuyerRow>) => {
      rows = rows.map(row =>
        row.company_id === companyId && row.buyer_id === buyerId
          ? { ...row, ...updates }
          : row
      );
      return { data: findRow(companyId, buyerId) || null, error: null };
    })
  };
});

vi.mock('@/lib/utils/companyUtils', () => ({
  getCurrentCompanyId: mocks.getCurrentCompanyId
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState
}));

vi.mock('@/lib/services/finance/financeService', () => ({
  calculateCompanyValue: mocks.calculateCompanyValue
}));

vi.mock('@/lib/features/researchUpgrade/services/research/researchEnforcer', () => ({
  researchEnforcer: {
    getUnlockedItems: mocks.getUnlockedItems
  }
}));

vi.mock('@/lib/features/researchUpgrade', () => ({
  researchUpgradeFeature: {
    unlocks: {
      getUnlockedItems: mocks.getUnlockedItems
    }
  }
}));

vi.mock('@/lib/services', () => ({
  getBuyerLoyalty: mocks.getBuyerLoyalty,
  getBuyerRelationshipPriceMultiplier: mocks.getBuyerRelationshipPriceMultiplier,
  getBuyerRelationshipYearlyLimitBonus: mocks.getBuyerRelationshipYearlyLimitBonus
}));

vi.mock('@/lib/database/sales/grapeBuyerLoyaltyDB', () => ({
  getBuyerPriorityRows: mocks.getBuyerPriorityRows
}));

vi.mock('@/lib/database/sales/grapeBuyerMarketDB', () => ({
  createBuyerRow: mocks.createBuyerRow,
  getBuyerRow: mocks.getBuyerRow,
  getBuyerSeasonStateRow: mocks.getBuyerSeasonStateRow,
  getKnownCountryBuyerRowsForCountries: mocks.getKnownCountryBuyerRowsForCountries,
  getSeasonBuyerRowsForCountries: mocks.getSeasonBuyerRowsForCountries,
  updateBuyerRow: mocks.updateBuyerRow
}));

describe('grape buyer market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setRows([]);
    mocks.getCurrentCompanyId.mockReturnValue('company-1');
    mocks.getGameState.mockReturnValue({ currentYear: 2026, season: 'Spring', economyPhase: 'Stable' });
    mocks.calculateCompanyValue.mockResolvedValue(100000);
    mocks.getUnlockedItems.mockImplementation(async (type: string) =>
      type === 'grape_buyer_slots' ? ['2'] : []
    );
  });

  it('creates the always-available bulk buyer and scales its seasonal limit from company demand', async () => {
    const { getBulkBuyer } = await import('@/lib/services/sales/grapeBuyerMarketService');

    const buyer = await getBulkBuyer('France');

    expect(buyer).toMatchObject({
      id: 'bulk_buyer',
      name: 'Bulk Grape Merchant',
      buyerCategory: 'bulk',
      soldThisSeasonKg: 0,
      relationshipMultiplier: 1
    });
    expect(buyer!.baseSeasonLimitKg).toBe(BULK_BASE_SEASON_LIMIT_KG);
    expect(buyer!.effectiveSeasonLimitKg).toBeGreaterThan(BULK_BASE_SEASON_LIMIT_KG);
    expect(buyer!.remainingSeasonLimitKg).toBe(buyer!.effectiveSeasonLimitKg);
    expect(mocks.createBuyerRow).toHaveBeenCalledWith(expect.objectContaining({
      buyer_id: 'bulk_buyer',
      country: 'France',
      base_season_limit_kg: BULK_BASE_SEASON_LIMIT_KG
    }));
  });

  it('records seasonal buyer sales against the current season and affects remaining capacity', async () => {
    const { getBulkBuyer, recordMarketBuyerSale } = await import('@/lib/services/sales/grapeBuyerMarketService');

    const beforeSale = await getBulkBuyer('France');
    await recordMarketBuyerSale('bulk_buyer', 500, 2026, 'Spring');
    const afterSale = await getBulkBuyer('France');

    expect(afterSale!.soldThisSeasonKg).toBe(500);
    expect(afterSale!.remainingSeasonLimitKg).toBe(beforeSale!.effectiveSeasonLimitKg! - 500);
    expect(mocks.updateBuyerRow).toHaveBeenCalledWith(
      'company-1',
      'bulk_buyer',
      expect.objectContaining({
        sold_this_season_kg: 500,
        last_active_year: 2026,
        last_active_season: 'Spring'
      })
    );
  });

  it('uses research slot unlocks when filling the seasonal buyer rotation', async () => {
    const { getSeasonalBuyers } = await import('@/lib/services/sales/grapeBuyerMarketService');

    const buyers = await getSeasonalBuyers('France');

    expect(buyers).toHaveLength(BASE_SEASONAL_BUYER_COUNT + 2);
    expect(buyers.every(buyer => buyer.buyerCategory === 'seasonal')).toBe(true);
    expect(buyers.every(buyer => buyer.remainingSeasonLimitKg! > 0)).toBe(true);
    expect(mocks.createBuyerRow).toHaveBeenCalledTimes(BASE_SEASONAL_BUYER_COUNT + 2);
  });

  it('adds foreign buyer-country coverage when country access is unlocked', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    mocks.getUnlockedItems.mockImplementation(async (type: string) => {
      if (type === 'grape_buyer_country_access') return ['Italy'];
      if (type === 'grape_buyer_slots') return [];
      return [];
    });

    const { getSeasonalBuyers } = await import('@/lib/services/sales/grapeBuyerMarketService');
    const buyers = await getSeasonalBuyers('France');

    expect(buyers.some(buyer => buyer.exclusiveCountry === 'Italy')).toBe(true);
    randomSpy.mockRestore();
  });

  it('applies buyer multiplier and limit research unlocks to seasonal buyer breadth', async () => {
    const stableRows: BuyerRow[] = [
      {
        company_id: 'company-1',
        buyer_id: 'season-1',
        display_name: 'Season One',
        country: 'France',
        description: 'Season one buyer',
        is_germany_coop: false,
        base_multiplier: 1.3,
        multiplier_min: 1.1,
        multiplier_max: 1.8,
        base_season_limit_kg: 1000,
        base_yearly_limit_kg: 4000,
        sold_this_season_kg: 0,
        favorite_grape_1: null,
        favorite_grape_2: null,
        last_active_year: 2026,
        last_active_season: 'Spring',
        updated_at: new Date().toISOString(),
      },
      {
        company_id: 'company-1',
        buyer_id: 'season-2',
        display_name: 'Season Two',
        country: 'France',
        description: 'Season two buyer',
        is_germany_coop: false,
        base_multiplier: 1.4,
        multiplier_min: 1.1,
        multiplier_max: 1.9,
        base_season_limit_kg: 1100,
        base_yearly_limit_kg: 4400,
        sold_this_season_kg: 0,
        favorite_grape_1: null,
        favorite_grape_2: null,
        last_active_year: 2026,
        last_active_season: 'Spring',
        updated_at: new Date().toISOString(),
      },
      {
        company_id: 'company-1',
        buyer_id: 'season-3',
        display_name: 'Season Three',
        country: 'France',
        description: 'Season three buyer',
        is_germany_coop: false,
        base_multiplier: 1.5,
        multiplier_min: 1.2,
        multiplier_max: 2.0,
        base_season_limit_kg: 1200,
        base_yearly_limit_kg: 4800,
        sold_this_season_kg: 0,
        favorite_grape_1: null,
        favorite_grape_2: null,
        last_active_year: 2026,
        last_active_season: 'Spring',
        updated_at: new Date().toISOString(),
      }
    ];

    mocks.setRows(stableRows);
    mocks.getUnlockedItems.mockImplementation(async (type: string) => {
      if (type === 'grape_buyer_slots') return [];
      if (type === 'grape_buyer_limit_multiplier') return [];
      if (type === 'grape_buyer_multiplier_bonus') return [];
      return [];
    });

    const { getSeasonalBuyers } = await import('@/lib/services/sales/grapeBuyerMarketService');
    const baseline = await getSeasonalBuyers('France');

    mocks.setRows(stableRows);
    mocks.getUnlockedItems.mockImplementation(async (type: string) => {
      if (type === 'grape_buyer_slots') return [];
      if (type === 'grape_buyer_limit_multiplier') return ['0.5'];
      if (type === 'grape_buyer_multiplier_bonus') return ['0.2'];
      return [];
    });

    const boosted = await getSeasonalBuyers('France');

    for (const boostedBuyer of boosted) {
      const baseBuyer = baseline.find(candidate => candidate.id === boostedBuyer.id);
      const row = stableRows.find(candidate => candidate.buyer_id === boostedBuyer.id);
      expect(baseBuyer).toBeTruthy();
      expect(row).toBeTruthy();

      const expectedBoostedPriceMultiplier = Number((row!.base_multiplier * 1.2).toFixed(2));
      expect(boostedBuyer.priceMultiplier).toBe(expectedBoostedPriceMultiplier);
      expect(boostedBuyer.effectiveSeasonLimitKg!).toBeGreaterThan(baseBuyer!.effectiveSeasonLimitKg!);
    }
  });
});
