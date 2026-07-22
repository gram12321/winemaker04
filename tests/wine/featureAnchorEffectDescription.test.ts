import { describe, expect, it } from 'vitest';
import { getFeatureLayerAnchorEffectDescription } from '@/lib/services/wine/features/featureService';
import type { FeatureConfig, WineFeature } from '@/lib/types/wineFeatures';

const features: WineFeature[] = [
  { id: 'terroir', isPresent: true, severity: 0.0001, name: 'Terroir Expression', icon: 'T' },
  { id: 'noble_rot', isPresent: true, severity: 0.7, name: 'Noble Rot', icon: 'N' }
];

const configs = [
  { id: 'terroir', name: 'Terroir Expression' },
  { id: 'noble_rot', name: 'Noble Rot' }
] as FeatureConfig[];

describe('getFeatureLayerAnchorEffectDescription', () => {
  it('lists only the features that contribute to the selected anchor', () => {
    expect(getFeatureLayerAnchorEffectDescription('terroirExpression', features, configs))
      .toBe('Feature layer (Terroir Expression)');
    expect(getFeatureLayerAnchorEffectDescription('oxidationPressure', features, configs))
      .toBe('Feature layer');
    expect(getFeatureLayerAnchorEffectDescription('processFootprint', features, configs))
      .toBe('Feature layer (Terroir Expression, Noble Rot)');
  });
});
