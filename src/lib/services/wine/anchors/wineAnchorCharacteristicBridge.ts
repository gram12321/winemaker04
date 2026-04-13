/**
 * Links **wine anchors** to **structure channels** (`WineCharacteristics`):
 * - Scales harvest / crush / ferment / feature **deltas** (boosts use per-channel capacity; penalties use site “forgiveness”).
 * - Biases **structure index** base ranges so ideals shift slightly with wine potential (typicity/health widen tolerance).
 */
import { WineAnchorValues, WineCharacteristics } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';
import { weightedMean } from '@/lib/services/wine/anchors/wineAnchorService';

/** Max deviation from 1.0 for positive deltas when anchor capacity runs 0 → 1. */
const ANCHOR_MODIFIER_STRENGTH = 0.52;
const SCALE_MIN = 0.66;
const SCALE_MAX = 1.34;

/** Shifts ideal band midpoint as fraction of base width. */
const RANGE_SHIFT_STRENGTH = 0.25;
/** Widens/narrows all bands from typicity + health (forgiveness). */
const RANGE_WIDTH_BLEND = 0.22;

const PENALTY_SOFT_MIN = 0.76;
const PENALTY_SOFT_MAX = 1.1;

function clampScale(n: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, n));
}

/**
 * 0–1 “capacity” per structure channel from blended anchors (mid = neutral).
 */
export function characteristicAnchorCapacity(
  anchors: WineAnchorValues,
  characteristic: keyof WineCharacteristics
): number {
  const a = anchors;
  switch (characteristic) {
    case 'acidity':
      return clamp01(
        weightedMean([
          { value: a.juiceAcidity, weight: 0.55 },
          { value: a.microclimateBlend, weight: 0.25 },
          { value: 1 - a.harvestTiming, weight: 0.2 }
        ])
      );
    case 'aroma':
      return clamp01(
        weightedMean([
          { value: a.aromaticIntensity, weight: 0.5 },
          { value: a.varietyCharacter, weight: 0.35 },
          { value: a.vineyardHealth, weight: 0.15 }
        ])
      );
    case 'body':
      return clamp01(
        weightedMean([
          { value: a.textureRichness, weight: 0.4 },
          { value: a.alcoholPotential, weight: 0.35 },
          { value: a.residualSugar, weight: 0.25 }
        ])
      );
    case 'sweetness':
      return clamp01(
        weightedMean([
          { value: a.residualSugar, weight: 0.6 },
          { value: a.harvestTiming, weight: 0.4 }
        ])
      );
    case 'tannins':
      return clamp01(
        weightedMean([
          { value: a.phenolicExtract, weight: 0.45 },
          { value: a.skinContactEvolution, weight: 0.35 },
          { value: a.crushingExtraction, weight: 0.2 }
        ])
      );
    case 'spice':
      return clamp01(
        weightedMean([
          { value: a.varietyCharacter, weight: 0.4 },
          { value: a.fermentationProfile, weight: 0.35 },
          { value: a.leesContact, weight: 0.25 }
        ])
      );
    default:
      return 0.5;
  }
}

/** Multiplier for **positive** characteristic deltas (mid anchor → 1.0). */
export function anchorModifierScaleForCharacteristic(
  anchors: WineAnchorValues,
  characteristic: keyof WineCharacteristics
): number {
  const capacity = characteristicAnchorCapacity(anchors, characteristic);
  return clampScale(1 + (capacity - 0.5) * ANCHOR_MODIFIER_STRENGTH);
}

/**
 * Softens **negative** deltas when site typicity/health/microclimate are strong (limits harsh penalties).
 */
export function anchorPenaltyScale(anchors: WineAnchorValues): number {
  const site = clamp01(
    weightedMean([
      { value: anchors.vineyardHealth, weight: 0.45 },
      { value: anchors.regionalTypicity, weight: 0.35 },
      { value: anchors.microclimateBlend, weight: 0.2 }
    ])
  );
  return PENALTY_SOFT_MIN + (PENALTY_SOFT_MAX - PENALTY_SOFT_MIN) * (1 - site);
}

/**
 * Apply anchor shaping to a single modifier (used by features and shared effect lists).
 */
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

/**
 * Anchor-biased ideal bands for structure scoring: midpoint follows channel capacity; width follows site forgiveness.
 */
export function getAnchorAdjustedStructureRanges(
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  anchors: WineAnchorValues
): Record<keyof WineCharacteristics, [number, number]> {
  const forgiveness = clamp01(
    weightedMean([
      { value: anchors.regionalTypicity, weight: 0.4 },
      { value: anchors.vineyardHealth, weight: 0.35 },
      { value: anchors.varietyCharacter, weight: 0.25 }
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
