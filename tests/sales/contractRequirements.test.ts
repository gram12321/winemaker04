import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateWineAgainstContract } from '@/lib/services/sales/contractService';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';
import type { ContractRequirement, Vineyard, WineBatch, WineContract } from '@/lib/types/types';

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: vi.fn()
}));

const { loadVineyards } = await import('@/lib/database/activities/vineyardDB');
const mockedLoadVineyards = vi.mocked(loadVineyards);

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'vineyard-1',
    name: 'Test Vineyard',
    country: 'France',
    region: 'Bourgogne',
    hectares: 1,
    grape: 'Pinot Noir',
    vineAge: 12,
    soil: ['Limestone'],
    altitude: 260,
    aspect: 'East',
    density: 4500,
    vineyardHealth: 0.8,
    landValue: 120000,
    vineyardTotalValue: 120000,
    status: 'Growing',
    ripeness: 0.7,
    vineyardPrestige: 1,
    vineYield: 1,
    ...overrides
  };
}

function wineBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'Test Vineyard',
    grape: 'Pinot Noir',
    quantity: 100,
    state: 'bottled',
    fermentationProgress: 100,
    landValueModifierHarvestSnapshot: 1,
    structureIndexHarvestSnapshot: 0.75,
    qualityIndexHarvestSnapshot: 0.5,
    landValueModifier: 1,
    structureIndex: 0.75,
    qualityIndex: 0.5,
    characteristics: {
      acidity: 0.5,
      aroma: 0.5,
      body: 0.5,
      spice: 0.5,
      sweetness: 0.5,
      tannins: 0.5
    },
    estimatedPrice: 0,
    grapeColor: 'red',
    naturalYield: 0.5,
    fragile: 0.3,
    proneToOxidation: 0.3,
    features: [],
    wineAnchors: { ...NEUTRAL_WINE_ANCHORS },
    harvestStartDate: { week: 1, season: 'Fall', year: 2026 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2026 },
    bottledDate: { week: 8, season: 'Winter', year: 2026 },
    ...overrides
  };
}

function contract(requirements: ContractRequirement[]): WineContract {
  return {
    id: 'contract-1',
    companyId: 'company-1',
    customerId: 'customer-1',
    customerName: 'Test Customer',
    customerCountry: 'France',
    customerType: 'Restaurant',
    requirements,
    requestedQuantity: 10,
    offeredPrice: 20,
    totalValue: 200,
    status: 'pending',
    createdWeek: 1,
    createdSeason: 'Spring',
    createdYear: 2026,
    expiresWeek: 12,
    expiresSeason: 'Spring',
    expiresYear: 2026,
    relationshipAtCreation: 20
  };
}

describe('contract requirements', () => {
  beforeEach(() => {
    mockedLoadVineyards.mockResolvedValue([vineyard()]);
  });

  it('validates tasteQuality against computed taste quality instead of land value modifier', async () => {
    const highLandWeakTasteWine = wineBatch({
      landValueModifier: 1,
      features: [
        {
          id: 'oxidation',
          name: 'Oxidation',
          icon: '',
          isPresent: true,
          risk: 1,
          severity: 1
        }
      ]
    });

    const result = await validateWineAgainstContract(
      highLandWeakTasteWine,
      contract([{ type: 'tasteQuality', value: 0.95 }])
    );

    expect(result.isValid).toBe(false);
    expect(result.failedRequirements[0]).toContain('Taste Quality');
  });

  it('keeps landValue as a separate site parameter requirement', async () => {
    mockedLoadVineyards.mockResolvedValue([vineyard({ landValue: 50000 })]);

    const result = await validateWineAgainstContract(
      wineBatch({ landValueModifier: 1 }),
      contract([{ type: 'landValue', value: 120000 }])
    );

    expect(result.isValid).toBe(false);
    expect(result.failedRequirements[0]).toContain('Land Value');
  });

  it('validates region and country as site parameters from the source vineyard', async () => {
    mockedLoadVineyards.mockResolvedValue([
      vineyard({
        country: 'Italy',
        region: 'Tuscany'
      })
    ]);

    const matching = await validateWineAgainstContract(
      wineBatch(),
      contract([
        { type: 'country', value: 1, params: { targetCountry: 'Italy' } },
        { type: 'region', value: 1, params: { targetRegion: 'Tuscany' } }
      ])
    );

    const mismatching = await validateWineAgainstContract(
      wineBatch(),
      contract([{ type: 'region', value: 1, params: { targetRegion: 'Bourgogne' } }])
    );

    expect(matching.isValid).toBe(true);
    expect(mismatching.isValid).toBe(false);
    expect(mismatching.failedRequirements[0]).toContain('Region');
  });
});
