/**
 * Process-phase anchor updates (after harvest).
 * Does **not** read `batch.characteristics` — uses existing anchors + grape priors + features (taste stays downstream).
 *
 * | Function | Updates |
 * |----------|---------|
 * | `applyCrushingToWineAnchors` | `crushingExtraction`, `skinContactEvolution` |
 * | `applyFermentationSetupToWineAnchors` | `fermentationProfile`, `leesContact`, `skinContactEvolution` |
 * | `applyWeeklyFermentationContactToWineAnchors` | `skinContactEvolution`, `leesContact` |
 * | `applyFeatureLayerAnchors` | `oxidativeCharacter`, `cellarEvolution`, `featureFootprint` |
 */
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { WineAnchorValues, WineBatch } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';
import { CrushingOptions } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import { FermentationOptions } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import { weightedMean } from '@/lib/services/wine/anchors/wineAnchorService';

const METHOD_EXTRACTION: Record<CrushingOptions['method'], number> = {
  'Hand Press': 0.42,
  'Mechanical Press': 0.56,
  'Pneumatic Press': 0.54
};

const METHOD_PROFILE: Record<FermentationOptions['method'], number> = {
  Basic: 0.38,
  'Temperature Controlled': 0.62,
  'Extended Maceration': 0.88
};

const TEMP_PROFILE: Record<FermentationOptions['temperature'], number> = {
  Ambient: 0.48,
  Cool: 0.36,
  Warm: 0.72
};

export function applyCrushingToWineAnchors(
  anchors: WineAnchorValues,
  options: CrushingOptions
): WineAnchorValues {
  const crushingExtraction = clamp01(
    weightedMean([
      { value: METHOD_EXTRACTION[options.method], weight: 0.4 },
      { value: clamp01(options.pressingIntensity), weight: 0.35 },
      { value: options.destemming ? 0.72 : 0.38, weight: 0.125 },
      { value: options.coldSoak ? 0.78 : 0.32, weight: 0.125 }
    ])
  );
  const bump =
    0.05 * clamp01(options.pressingIntensity) + (options.coldSoak ? 0.04 : 0) + (options.destemming ? 0.02 : 0);
  const skinContactEvolution = clamp01(anchors.skinContactEvolution + bump);
  return { ...anchors, crushingExtraction, skinContactEvolution };
}

export function applyFermentationSetupToWineAnchors(
  anchors: WineAnchorValues,
  options: FermentationOptions
): WineAnchorValues {
  const method = METHOD_PROFILE[options.method];
  const temp = TEMP_PROFILE[options.temperature];
  const fermentationProfile = clamp01(0.55 * method + 0.45 * temp);

  let leesBoost = 0;
  if (options.method === 'Extended Maceration') leesBoost += 0.14;
  else if (options.method === 'Temperature Controlled') leesBoost += 0.06;
  if (options.temperature === 'Warm') leesBoost += 0.05;
  if (options.temperature === 'Cool') leesBoost -= 0.04;

  const leesContact = clamp01(anchors.leesContact + leesBoost);
  const setupSkin = clamp01(
    weightedMean([
      { value: options.method === 'Extended Maceration' ? 0.9 : 0.4, weight: 0.6 },
      { value: anchors.varietyCharacter, weight: 0.2 },
      { value: anchors.phenolicExtract, weight: 0.2 }
    ])
  );
  const skinContactEvolution = clamp01(Math.max(anchors.skinContactEvolution, 0.06, setupSkin));

  return {
    ...anchors,
    fermentationProfile,
    leesContact,
    skinContactEvolution
  };
}

export function applyWeeklyFermentationContactToWineAnchors(
  anchors: WineAnchorValues,
  options: FermentationOptions
): WineAnchorValues {
  const baseGain =
    options.method === 'Extended Maceration' ? 0.055 :
    options.method === 'Temperature Controlled' ? 0.042 :
    0.032;
  const tempMod =
    options.temperature === 'Warm' ? 0.008 :
    options.temperature === 'Cool' ? -0.004 :
    0;
  const macWeekly =
    options.method === 'Extended Maceration' ? 0.018 :
    options.method === 'Temperature Controlled' ? 0.012 :
    0.008;
  const skinContactEvolution = clamp01(anchors.skinContactEvolution + baseGain + tempMod + macWeekly);

  const leesWeekly =
    0.012 * (options.method === 'Extended Maceration' ? 1.45 : options.method === 'Temperature Controlled' ? 1.15 : 1);
  const leesContact = clamp01(anchors.leesContact + leesWeekly);

  return { ...anchors, skinContactEvolution, leesContact };
}

export function applyFeatureLayerAnchors(batch: WineBatch, anchors: WineAnchorValues): WineAnchorValues {
  const present = (batch.features || []).filter((f) => f.isPresent);
  const oxidationSeverity = clamp01(present.find((f) => f.id === 'oxidation')?.severity ?? 0);
  const bottleAgingSeverity = clamp01(present.find((f) => f.id === 'bottle_aging')?.severity ?? 0);
  const featureDensity =
    batch.features.length > 0
      ? batch.features.filter((f) => f.isPresent && f.severity > 0).length / batch.features.length
      : 0;
  const bottleAgeNorm = clamp01((batch.agingProgress || 0) / (52 * 10));

  const grapeSpicePrior = GRAPE_CONST[batch.grape].baseCharacteristics.spice;

  const oxidativeCharacter = clamp01(
    weightedMean([
      { value: oxidationSeverity, weight: 0.35 },
      { value: clamp01(batch.proneToOxidation), weight: 0.25 },
      { value: bottleAgeNorm, weight: 0.15 },
      { value: featureDensity, weight: 0.12 },
      { value: 1 - anchors.juiceAcidity, weight: 0.13 }
    ])
  );

  const cellarEvolution = clamp01(
    weightedMean([
      { value: bottleAgingSeverity, weight: 0.5 },
      { value: bottleAgeNorm, weight: 0.35 },
      { value: grapeSpicePrior, weight: 0.15 }
    ])
  );

  const featureFootprint = clamp01(
    weightedMean([
      { value: featureDensity, weight: 0.65 },
      { value: bottleAgeNorm, weight: 0.2 },
      { value: oxidationSeverity, weight: 0.15 }
    ])
  );

  return {
    ...anchors,
    oxidativeCharacter,
    cellarEvolution,
    featureFootprint
  };
}
