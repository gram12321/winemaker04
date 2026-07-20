import { describe, expect, it } from 'vitest';
import { projectGlobalGrapeLot } from '@/lib/services/market/grapes/globalGrapeMarketLifecycleService';

const batch = {
  id: 'batch-1', vineyardId: 'market', vineyardName: 'Market', grape: 'Chardonnay', quantity: 100,
  state: 'must_fermenting', fermentationProgress: 40, landValueModifierHarvestSnapshot: .5,
  structureIndexHarvestSnapshot: .5, tasteQualityIndexHarvestSnapshot: .5, landValueModifier: .5,
  tasteQualityIndex: .5, structureIndex: .5, characteristics: { acidity: .5, aroma: .5, body: .5, spice: .5, sweetness: .5, tannins: .5 },
  estimatedPrice: 0, grapeColor: 'white', naturalYield: 1, fragile: false, proneToOxidation: false, features: [], wineAnchors: {},
  harvestStartDate: { year: 2026, season: 'Spring', week: 1 }, harvestEndDate: { year: 2026, season: 'Spring', week: 1 }, agingProgress: 0,
} as any;

describe('global grape lot lifecycle', () => {
  it('projects identical fermenting state for every viewer at the same game date', () => {
    const snapshot = { batch, qualityScore: .8, batchState: 'must_fermenting' as const, qualityDecayPerWeek: .005, minQualityFloor: .16 };
    const date = { year: 2026, season: 'Spring', week: 3 };
    expect(projectGlobalGrapeLot(snapshot, { year: 2026, season: 'Spring', week: 1 }, date))
      .toEqual(projectGlobalGrapeLot(snapshot, { year: 2026, season: 'Spring', week: 1 }, date));
  });

  it('retires a fermenting lot when deterministic progress completes', () => {
    const projection = projectGlobalGrapeLot(
      { batch: { ...batch, fermentationProgress: 90 }, qualityScore: .8, batchState: 'must_fermenting', qualityDecayPerWeek: .005, minQualityFloor: .16 },
      { year: 2026, season: 'Spring', week: 1 }, { year: 2026, season: 'Spring', week: 2 },
    );
    expect(projection.batch.fermentationProgress).toBe(100);
    expect(projection.visible).toBe(false);
  });
});
