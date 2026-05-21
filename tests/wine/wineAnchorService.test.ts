import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_WINE_ANCHORS,
  parseWineAnchorsFromDb
} from '@/lib/services/wine/anchors/wineAnchorService';

describe('parseWineAnchorsFromDb', () => {
  it('parses the current compact anchor model from database JSON', () => {
    const parsed = parseWineAnchorsFromDb({
      sugarPotential: 0.8,
      acidPotential: 0.7,
      phenolicPotential: 0.9,
      aromaticPotential: 0.65,
      bodyPotential: 0.6,
      extractionState: 0.55,
      fermentationState: 0.45,
      leesState: 0.35,
      oxidationPressure: 0.2,
      maturationState: 0.3,
      terroirExpression: 0.85,
      processFootprint: 0.33
    });

    expect(parsed).toEqual({
      sugarPotential: 0.8,
      acidPotential: 0.7,
      phenolicPotential: 0.9,
      aromaticPotential: 0.65,
      bodyPotential: 0.6,
      extractionState: 0.55,
      fermentationState: 0.45,
      leesState: 0.35,
      oxidationPressure: 0.2,
      maturationState: 0.3,
      terroirExpression: 0.85,
      processFootprint: 0.33
    });
  });

  it('uses neutral defaults for missing anchors and clamps invalid numeric input', () => {
    const parsed = parseWineAnchorsFromDb({
      sugarPotential: 1.4,
      acidPotential: -0.3,
      bodyPotential: 'not a number'
    });

    expect(parsed.sugarPotential).toBe(1);
    expect(parsed.acidPotential).toBe(0);
    expect(parsed.bodyPotential).toBe(NEUTRAL_WINE_ANCHORS.bodyPotential);
    expect(parsed.terroirExpression).toBe(NEUTRAL_WINE_ANCHORS.terroirExpression);
  });

  it('ignores unknown keys instead of mapping removed anchor shapes', () => {
    const parsed = parseWineAnchorsFromDb({
      unknownSweetnessSignal: 0.9,
      unknownAcidSignal: 0.8,
      unknownProcessSignal: 0.7
    });

    expect(parsed).toEqual(NEUTRAL_WINE_ANCHORS);
  });
});
