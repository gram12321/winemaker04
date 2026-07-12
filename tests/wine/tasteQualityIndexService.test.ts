import { describe, expect, it } from 'vitest';
import {
  FLAVOR_FAMILY_IDS,
  type FlavorFamilyId,
  type WineBatch,
  type WineFlavorFamilyProfile
} from '@/lib/types/types';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';
import {
  calculateTasteQualityIndexFromProfile,
  type TasteQualityContext
} from '@/lib/services/wine/taste/tasteQualityIndexService';
import {
  calculateWineScore,
  getTasteQualityIndex
} from '@/lib/services/wine/winescore/wineScoreCalculation';

const redContext: TasteQualityContext = {
  grape: 'Pinot Noir',
  grapeColor: 'red'
};

function tasteProfile(overrides: Partial<Record<FlavorFamilyId, number>>): WineFlavorFamilyProfile {
  const profile = {} as WineFlavorFamilyProfile;
  for (const id of FLAVOR_FAMILY_IDS) {
    profile[id] = overrides[id] ?? 0.14;
  }
  return profile;
}

function wineBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'test-batch',
    vineyardId: 'test-vineyard',
    vineyardName: 'Test Vineyard',
    grape: 'Pinot Noir',
    quantity: 1000,
    state: 'bottled',
    fermentationProgress: 100,
    landValueModifierHarvestSnapshot: 0.55,
    structureIndexHarvestSnapshot: 0.82,
    tasteQualityIndexHarvestSnapshot: 0.5,
    landValueModifier: 0.55,
    structureIndex: 0.82,
    tasteQualityIndex: 0.5,
    characteristics: {
      acidity: 0.58,
      aroma: 0.6,
      body: 0.48,
      spice: 0.42,
      sweetness: 0.2,
      tannins: 0.52
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

describe('tasteQualityIndexService', () => {
  it('scores a coherent red-fruit profile higher than a clashing red profile', () => {
    const coherentRed = tasteProfile({
      flower: 0.24,
      citrus: 0.18,
      treeFruit: 0.28,
      tropicalFruit: 0.08,
      redFruit: 0.72,
      blackFruit: 0.5,
      driedFruit: 0.3,
      spiceFlavor: 0.34,
      vegetable: 0.12,
      earth: 0.28,
      microbial: 0.16,
      oakAging: 0.22,
      generalAging: 0.22,
      faults: 0.03
    });

    const clashingRed = tasteProfile({
      flower: 0.62,
      citrus: 0.7,
      treeFruit: 0.34,
      tropicalFruit: 0.74,
      redFruit: 0.72,
      blackFruit: 0.08,
      driedFruit: 0.05,
      spiceFlavor: 0.08,
      vegetable: 0.42,
      earth: 0.05,
      microbial: 0.08,
      oakAging: 0.05,
      generalAging: 0.08,
      faults: 0.34
    });

    const coherent = calculateTasteQualityIndexFromProfile(coherentRed, redContext);
    const clashing = calculateTasteQualityIndexFromProfile(clashingRed, redContext);

    expect(coherent.tasteQualityIndex).toBeGreaterThan(0.68);
    expect(clashing.tasteQualityIndex).toBeLessThan(0.55);
    expect(coherent.tasteQualityIndex).toBeGreaterThan(clashing.tasteQualityIndex + 0.2);
  });

  it('moves supporting-family targets when red fruit is high', () => {
    const lowRedFruit = calculateTasteQualityIndexFromProfile(
      tasteProfile({
        redFruit: 0.16,
        blackFruit: 0.18,
        driedFruit: 0.14,
        spiceFlavor: 0.14,
        tropicalFruit: 0.12,
        faults: 0.03
      }),
      redContext
    );

    const highRedFruit = calculateTasteQualityIndexFromProfile(
      tasteProfile({
        redFruit: 0.82,
        blackFruit: 0.18,
        driedFruit: 0.14,
        spiceFlavor: 0.14,
        tropicalFruit: 0.12,
        faults: 0.03
      }),
      redContext
    );

    expect(highRedFruit.families.blackFruit.acceptedRange[0]).toBeGreaterThan(
      lowRedFruit.families.blackFruit.acceptedRange[0]
    );
    expect(highRedFruit.families.driedFruit.ideal).toBeGreaterThan(
      lowRedFruit.families.driedFruit.ideal
    );
    expect(highRedFruit.families.tropicalFruit.acceptedRange[1]).toBeLessThan(
      lowRedFruit.families.tropicalFruit.acceptedRange[1]
    );
  });

  it('returns a family breakdown for exactly the 14 taste families', () => {
    const result = calculateTasteQualityIndexFromProfile(
      tasteProfile({
        citrus: 0.45,
        treeFruit: 0.46,
        flower: 0.32,
        tropicalFruit: 0.2,
        faults: 0.02
      }),
      {
        grape: 'Chardonnay',
        grapeColor: 'white'
      }
    );

    expect(Object.keys(result.families).sort()).toEqual([...FLAVOR_FAMILY_IDS].sort());
    expect(result.families.citrus.current).toBe(0.45);
    expect(result.tasteQualityIndex).toBeGreaterThanOrEqual(0);
    expect(result.tasteQualityIndex).toBeLessThanOrEqual(1);
  });

  it('reports the weighted family-fit average shown by the taste index UI', () => {
    const result = calculateTasteQualityIndexFromProfile(
      tasteProfile({
        flower: 0.24,
        citrus: 0.64,
        tropicalFruit: 0.52,
        redFruit: 0.62,
        blackFruit: 0.76,
        faults: 0.03
      }),
      redContext
    );
    const families = Object.values(result.families);
    const expectedIndex = families.reduce((sum, family) => sum + family.score * family.weight, 0)
      / families.reduce((sum, family) => sum + family.weight, 0);

    expect(result.tasteQualityIndex).toBeCloseTo(expectedIndex, 12);
  });

  it('uses computed taste quality in wine score instead of the fixed placeholder', () => {
    const batch = wineBatch();
    const tasteQualityIndex = getTasteQualityIndex(batch);

    expect(tasteQualityIndex).not.toBe(0.5);
    expect(calculateWineScore(batch)).toBeCloseTo(
      (tasteQualityIndex + batch.structureIndex) / 2,
      5
    );
  });
});
