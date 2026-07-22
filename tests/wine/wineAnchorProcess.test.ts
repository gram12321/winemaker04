import { describe, expect, it } from 'vitest';
import { applyFeatureLayerAnchors } from '@/lib/services/wine/anchors/wineAnchorProcess';
import { NEUTRAL_WINE_ANCHORS } from '@/lib/services/wine/anchors/wineAnchorService';
import type { WineBatch } from '@/lib/types/types';

function makeBatch(features: WineBatch['features']): WineBatch {
  return {
    grape: 'Chardonnay',
    features,
    agingProgress: 0,
    proneToOxidation: 0
  } as WineBatch;
}

describe('applyFeatureLayerAnchors', () => {
  it('preserves harvest terroir expression when no Terroir Expression feature is active', () => {
    const batch = makeBatch([
      { id: 'oxidation', isPresent: true, severity: 0.6, name: 'Oxidation', icon: 'x' }
    ]);
    const harvestAnchors = { ...NEUTRAL_WINE_ANCHORS, terroirExpression: 0.587 };

    const afterOnePass = applyFeatureLayerAnchors(batch, harvestAnchors);
    const afterThreePasses = applyFeatureLayerAnchors(
      batch,
      applyFeatureLayerAnchors(batch, afterOnePass)
    );

    expect(afterOnePass.terroirExpression).toBe(0.587);
    expect(afterThreePasses.terroirExpression).toBe(0.587);
  });

  it('applies the Terroir Expression feature when it has a positive severity', () => {
    const batch = makeBatch([
      { id: 'terroir', isPresent: true, severity: 0.8, name: 'Terroir Expression', icon: 'T' }
    ]);
    const anchors = { ...NEUTRAL_WINE_ANCHORS, terroirExpression: 0.5 };

    expect(applyFeatureLayerAnchors(batch, anchors).terroirExpression).toBeCloseTo(0.554);
  });
});
