/**
 * Process-phase anchor updates (after harvest).
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
  const extractionState = clamp01(
    weightedMean([
      { value: METHOD_EXTRACTION[options.method], weight: 0.45 },
      { value: clamp01(options.pressingIntensity), weight: 0.35 },
      { value: options.destemming ? 0.72 : 0.38, weight: 0.1 },
      { value: options.coldSoak ? 0.78 : 0.32, weight: 0.1 }
    ])
  );

  const phenolicPotential = clamp01(
    anchors.phenolicPotential +
      0.06 * clamp01(options.pressingIntensity) +
      (options.coldSoak ? 0.03 : 0) +
      (options.destemming ? 0.015 : 0)
  );

  const processFootprint = clamp01(
    anchors.processFootprint + 0.04 + 0.03 * clamp01(options.pressingIntensity)
  );

  return {
    ...anchors,
    extractionState,
    phenolicPotential,
    processFootprint
  };
}

export function applyFermentationSetupToWineAnchors(
  anchors: WineAnchorValues,
  options: FermentationOptions
): WineAnchorValues {
  const method = METHOD_PROFILE[options.method];
  const temp = TEMP_PROFILE[options.temperature];
  const fermentationState = clamp01(0.55 * method + 0.45 * temp);

  let leesBoost = 0;
  if (options.method === 'Extended Maceration') leesBoost += 0.14;
  else if (options.method === 'Temperature Controlled') leesBoost += 0.06;
  if (options.temperature === 'Warm') leesBoost += 0.05;
  if (options.temperature === 'Cool') leesBoost -= 0.04;

  const leesState = clamp01(anchors.leesState + leesBoost);

  const extractionTouch =
    options.method === 'Extended Maceration'
      ? 0.09
      : options.method === 'Temperature Controlled'
      ? 0.05
      : 0.03;

  const extractionState = clamp01(anchors.extractionState + extractionTouch);
  const processFootprint = clamp01(anchors.processFootprint + 0.06);

  return {
    ...anchors,
    fermentationState,
    leesState,
    extractionState,
    processFootprint
  };
}

export function applyWeeklyFermentationContactToWineAnchors(
  anchors: WineAnchorValues,
  options: FermentationOptions
): WineAnchorValues {
  const fermentGain =
    options.method === 'Extended Maceration'
      ? 0.042
      : options.method === 'Temperature Controlled'
      ? 0.032
      : 0.024;

  const tempMod = options.temperature === 'Warm' ? 0.008 : options.temperature === 'Cool' ? -0.003 : 0;
  const fermentationState = clamp01(anchors.fermentationState + fermentGain + tempMod);

  const leesWeekly =
    0.012 *
    (options.method === 'Extended Maceration' ? 1.45 : options.method === 'Temperature Controlled' ? 1.15 : 1);
  const leesState = clamp01(anchors.leesState + leesWeekly);

  const extractionState = clamp01(anchors.extractionState + fermentGain * 0.28);
  const processFootprint = clamp01(anchors.processFootprint + 0.01);

  return {
    ...anchors,
    fermentationState,
    leesState,
    extractionState,
    processFootprint
  };
}

export function applyFeatureLayerAnchors(batch: WineBatch, anchors: WineAnchorValues): WineAnchorValues {
  const present = (batch.features || []).filter((f) => f.isPresent);
  const oxidationSeverity = clamp01(present.find((f) => f.id === 'oxidation')?.severity ?? 0);
  const bottleAgingSeverity = clamp01(present.find((f) => f.id === 'bottle_aging')?.severity ?? 0);
  const terroirSeverity = clamp01(present.find((f) => f.id === 'terroir')?.severity ?? 0);

  const featureDensity =
    batch.features.length > 0
      ? batch.features.filter((f) => f.isPresent && f.severity > 0).length / batch.features.length
      : 0;

  const bottleAgeNorm = clamp01((batch.agingProgress || 0) / (52 * 10));
  const grapeSpicePrior = GRAPE_CONST[batch.grape].baseCharacteristics.spice;

  const oxidationPressure = clamp01(
    weightedMean([
      { value: anchors.oxidationPressure, weight: 0.35 },
      { value: oxidationSeverity, weight: 0.3 },
      { value: clamp01(batch.proneToOxidation), weight: 0.15 },
      { value: bottleAgeNorm, weight: 0.1 },
      { value: 1 - anchors.acidPotential, weight: 0.1 }
    ])
  );

  const maturationState = clamp01(
    weightedMean([
      { value: anchors.maturationState, weight: 0.45 },
      { value: bottleAgingSeverity, weight: 0.25 },
      { value: bottleAgeNorm, weight: 0.2 },
      { value: grapeSpicePrior, weight: 0.1 }
    ])
  );

  const terroirExpression = clamp01(
    weightedMean([
      { value: anchors.terroirExpression, weight: 0.82 },
      { value: terroirSeverity, weight: 0.18 }
    ])
  );

  const processFootprint = clamp01(
    weightedMean([
      { value: anchors.processFootprint, weight: 0.45 },
      { value: featureDensity, weight: 0.35 },
      { value: bottleAgeNorm, weight: 0.1 },
      { value: oxidationSeverity, weight: 0.1 }
    ])
  );

  return {
    ...anchors,
    oxidationPressure,
    maturationState,
    terroirExpression,
    processFootprint
  };
}
