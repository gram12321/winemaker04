import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_WINE_ANCHORS,
  parseWineAnchorsFromDb
} from '@/lib/services/wine/anchors/wineAnchorService';

const legacyAnchors = {
  residualSugar: 0.8,
  harvestTiming: 0.6,
  juiceAcidity: 0.7,
  phenolicExtract: 0.9,
  colorIntensity: 0.4,
  skinContactEvolution: 0.5,
  aromaticIntensity: 0.65,
  varietyCharacter: 0.75,
  textureRichness: 0.6,
  alcoholPotential: 0.8,
  crushingExtraction: 0.55,
  fermentationProfile: 0.45,
  leesContact: 0.35,
  oxidativeCharacter: 0.2,
  cellarEvolution: 0.3,
  regionalTypicity: 0.9,
  soilAffinity: 0.7,
  solarClimateFit: 0.8,
  microclimateBlend: 0.6,
  siteAltitude: 0.4,
  aspectWarmth: 0.5,
  vineAgeCharacter: 0.6,
  rowCompetition: 0.7,
  siteWildness: 0.2,
  vineyardHealth: 0.9,
  featureFootprint: 0.33
};

describe('parseWineAnchorsFromDb', () => {
  it('migrates legacy 26-anchor JSON into the current compact anchor model', () => {
    const parsed = parseWineAnchorsFromDb(legacyAnchors);

    expect(parsed.sugarPotential).toBeCloseTo(0.73, 2);
    expect(parsed.acidPotential).toBe(0.7);
    expect(parsed.phenolicPotential).toBeCloseTo(0.655, 3);
    expect(parsed.aromaticPotential).toBeCloseTo(0.68, 2);
    expect(parsed.bodyPotential).toBeCloseTo(0.69, 2);
    expect(parsed.extractionState).toBe(0.55);
    expect(parsed.fermentationState).toBe(0.45);
    expect(parsed.leesState).toBe(0.35);
    expect(parsed.oxidationPressure).toBe(0.2);
    expect(parsed.maturationState).toBe(0.3);
    expect(parsed.terroirExpression).toBeGreaterThan(0.65);
    expect(parsed.processFootprint).toBe(0.33);
    expect(parsed).not.toEqual(NEUTRAL_WINE_ANCHORS);
  });

  it('migrates legacy anchors when they are nested under a values wrapper', () => {
    const parsed = parseWineAnchorsFromDb({ version: 1, values: legacyAnchors });

    expect(parsed.sugarPotential).toBeGreaterThan(NEUTRAL_WINE_ANCHORS.sugarPotential);
    expect(parsed.processFootprint).toBe(legacyAnchors.featureFootprint);
  });
});
