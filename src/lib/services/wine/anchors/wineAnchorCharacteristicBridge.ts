/**
 * Links compact wine anchors to structure channels.
 */
import { WineAnchorValues, WineCharacteristics } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';
import { weightedMean } from '@/lib/services/wine/anchors/wineAnchorService';

const ANCHOR_MODIFIER_STRENGTH = 0.52;
const SCALE_MIN = 0.66;
const SCALE_MAX = 1.34;
const RANGE_SHIFT_STRENGTH = 0.25;
const RANGE_WIDTH_BLEND = 0.22;
const PENALTY_SOFT_MIN = 0.76;
const PENALTY_SOFT_MAX = 1.1;

function clampScale(n: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, n));
}

export function characteristicAnchorCapacity(
  anchors: WineAnchorValues,
  characteristic: keyof WineCharacteristics
): number {
  const a = anchors;
  switch (characteristic) {
    case 'acidity':
      return clamp01(
        weightedMean([
          { value: a.acidPotential, weight: 0.62 },
          { value: a.terroirExpression, weight: 0.28 },
          { value: 1 - a.oxidationPressure, weight: 0.1 }
        ])
      );
    case 'aroma':
      return clamp01(
        weightedMean([
          { value: a.aromaticPotential, weight: 0.52 },
          { value: a.terroirExpression, weight: 0.28 },
          { value: a.fermentationState, weight: 0.2 }
        ])
      );
    case 'body':
      return clamp01(
        weightedMean([
          { value: a.bodyPotential, weight: 0.5 },
          { value: a.sugarPotential, weight: 0.24 },
          { value: a.phenolicPotential, weight: 0.26 }
        ])
      );
    case 'sweetness':
      return clamp01(
        weightedMean([
          { value: a.sugarPotential, weight: 0.78 },
          { value: a.maturationState, weight: 0.22 }
        ])
      );
    case 'tannins':
      return clamp01(
        weightedMean([
          { value: a.phenolicPotential, weight: 0.58 },
          { value: a.extractionState, weight: 0.28 },
          { value: a.fermentationState, weight: 0.14 }
        ])
      );
    case 'spice':
      return clamp01(
        weightedMean([
          { value: a.fermentationState, weight: 0.42 },
          { value: a.maturationState, weight: 0.38 },
          { value: a.processFootprint, weight: 0.2 }
        ])
      );
    default:
      return 0.5;
  }
}

export function anchorModifierScaleForCharacteristic(
  anchors: WineAnchorValues,
  characteristic: keyof WineCharacteristics
): number {
  const capacity = characteristicAnchorCapacity(anchors, characteristic);
  return clampScale(1 + (capacity - 0.5) * ANCHOR_MODIFIER_STRENGTH);
}

export function anchorPenaltyScale(anchors: WineAnchorValues): number {
  const site = clamp01(
    weightedMean([
      { value: anchors.terroirExpression, weight: 0.65 },
      { value: 1 - anchors.oxidationPressure, weight: 0.2 },
      { value: anchors.acidPotential, weight: 0.15 }
    ])
  );
  return PENALTY_SOFT_MIN + (PENALTY_SOFT_MAX - PENALTY_SOFT_MIN) * (1 - site);
}

export function scaleCharacteristicModifierByAnchors(
  anchors: WineAnchorValues,
  characteristic: keyof WineCharacteristics,
  rawModifier: number
): number {
  if (rawModifier >= 0) {
    return rawModifier * anchorModifierScaleForCharacteristic(anchors, characteristic);
  }
  return rawModifier * anchorPenaltyScale(anchors);
}

const STRUCTURE_KEYS: (keyof WineCharacteristics)[] = [
  'acidity',
  'aroma',
  'body',
  'spice',
  'sweetness',
  'tannins'
];

export function getAnchorAdjustedStructureRanges(
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  anchors: WineAnchorValues
): Record<keyof WineCharacteristics, [number, number]> {
  const forgiveness = clamp01(
    weightedMean([
      { value: anchors.terroirExpression, weight: 0.55 },
      { value: anchors.aromaticPotential, weight: 0.2 },
      { value: anchors.bodyPotential, weight: 0.15 },
      { value: 1 - anchors.oxidationPressure, weight: 0.1 }
    ])
  );
  const widthFactor = 1 + (forgiveness - 0.5) * RANGE_WIDTH_BLEND;

  const out = {} as Record<keyof WineCharacteristics, [number, number]>;

  for (const k of STRUCTURE_KEYS) {
    const [min0, max0] = baseRanges[k];
    const w0 = Math.max(0.0001, max0 - min0);
    const mid0 = (min0 + max0) / 2;
    const cap = characteristicAnchorCapacity(anchors, k);
    const midShift = (cap - 0.5) * w0 * RANGE_SHIFT_STRENGTH;
    const newMid = clamp01(mid0 + midShift);
    const newW = w0 * widthFactor;
    let newMin = clamp01(newMid - newW / 2);
    let newMax = clamp01(newMid + newW / 2);
    if (newMax - newMin < 0.02) {
      const c = (newMin + newMax) / 2;
      newMin = clamp01(c - 0.01);
      newMax = clamp01(c + 0.01);
    }
    out[k] = [newMin, newMax];
  }

  return out;
}

export function scaleCharacteristicEffectModifiersByAnchors<
  T extends { characteristic: keyof WineCharacteristics; modifier: number }
>(anchors: WineAnchorValues, effects: T[]): T[] {
  return effects.map((e) => ({
    ...e,
    modifier: scaleCharacteristicModifierByAnchors(anchors, e.characteristic, e.modifier)
  }));
}
