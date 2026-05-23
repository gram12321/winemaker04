import { describe, expect, it } from 'vitest';
import type { WineBatch } from '@/lib/types/types';
import { initializeBatchFeatures, getFeatureDisplaySeverity } from '@/lib/services/wine/features/featureService';
import { resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { applyTestLabBatchOverrides } from '@/lib/services/admin/testLab/testLabFixtureService';

function makeBatch(overrides: Partial<WineBatch> = {}): WineBatch {
  return {
    id: 'batch-1',
    vineyardId: 'vineyard-1',
    vineyardName: 'North Block',
    grape: 'Pinot Noir',
    quantity: 1200,
    state: 'grapes',
    fermentationProgress: 0,
    landValueModifierHarvestSnapshot: 0.62,
    structureIndexHarvestSnapshot: 0.58,
    tasteQualityIndexHarvestSnapshot: 0.55,
    landValueModifier: 0.62,
    structureIndex: 0.58,
    tasteQualityIndex: 0.55,
    characteristics: {
      acidity: 0.55,
      aroma: 0.54,
      body: 0.56,
      spice: 0.42,
      sweetness: 0.46,
      tannins: 0.57
    },
    estimatedPrice: 28,
    grapeColor: 'red',
    naturalYield: 0.6,
    fragile: 0.35,
    proneToOxidation: 0.42,
    features: initializeBatchFeatures(),
    wineAnchors: resolveWineAnchors(undefined),
    harvestStartDate: { week: 2, season: 'Fall', year: 2026 },
    harvestEndDate: { week: 2, season: 'Fall', year: 2026 },
    ...overrides
  };
}

describe('Admin Test Lab batch overrides', () => {
  it('applies direct anchor and risk overrides to the generated batch', () => {
    const updated = applyTestLabBatchOverrides(makeBatch(), {
      featurePreset: 'oxidation-risk',
      terroirExpressionOverride: '0.91',
      oxidationRiskOverride: '0.33',
      greyRotRiskOverride: '0.18'
    });

    expect(updated.wineAnchors.terroirExpression).toBeCloseTo(0.91);
    expect(updated.wineAnchors.oxidationPressure).toBeGreaterThan(0.7);
    expect(updated.features.find(feature => feature.id === 'oxidation')?.risk).toBeCloseTo(0.33);
    expect(updated.features.find(feature => feature.id === 'grey_rot')?.risk).toBeCloseTo(0.18);
  });

  it('can seed visible evolving history for bottled wines', () => {
    const updated = applyTestLabBatchOverrides(
      makeBatch({
        state: 'bottled',
        bottledDate: { week: 8, season: 'Winter', year: 2026 },
        agingProgress: 0
      }),
      {
        featurePreset: 'cellar-evolution',
        agingProgressWeeksOverride: '104',
        terroirSeverityOverride: '0.67'
      }
    );

    expect(updated.agingProgress).toBe(104);
    expect(updated.wineAnchors.maturationState).toBeGreaterThanOrEqual(0.75);
    expect(updated.features.find(feature => feature.id === 'terroir')?.severity).toBeCloseTo(0.67);
    expect(getFeatureDisplaySeverity(updated, 'bottle_aging')).toBeGreaterThan(0.2);
  });
});
