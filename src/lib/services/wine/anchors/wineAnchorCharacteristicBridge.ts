/**
 * Scales **structure-channel deltas** (harvest / crush / ferment / features) by wine anchors.
 * Mid anchors (0.5) → scale ≈ 1.0; high relevant anchors boost deltas, low anchors dampen them.
 *
 * Anchors stay upstream; this only shapes how strong each modifier is when applied to `WineCharacteristics`.
 */
import { WineAnchorValues, WineCharacteristics } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';
import { weightedMean } from '@/lib/services/wine/anchors/wineAnchorService';

/** Max deviation from 1.0 when anchor capacity runs 0 → 1. */
const ANCHOR_MODIFIER_STRENGTH = 0.52;
const SCALE_MIN = 0.66;
const SCALE_MAX = 1.34;

function clampScale(n: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, n));
}

/**
 * Per-structure-channel capacity (0–1) from blended anchors, then mapped to a modifier multiplier
 * with 0.5 capacity → 1.0 scale.
 */
export function anchorModifierScaleForCharacteristic(
  anchors: WineAnchorValues,
  characteristic: keyof WineCharacteristics
): number {
  const a = anchors;
  let capacity: number;

  switch (characteristic) {
    case 'acidity':
      capacity = weightedMean([
        { value: a.juiceAcidity, weight: 0.55 },
        { value: a.microclimateBlend, weight: 0.25 },
        { value: 1 - a.harvestTiming, weight: 0.2 }
      ]);
      break;
    case 'aroma':
      capacity = weightedMean([
        { value: a.aromaticIntensity, weight: 0.5 },
        { value: a.varietyCharacter, weight: 0.35 },
        { value: a.vineyardHealth, weight: 0.15 }
      ]);
      break;
    case 'body':
      capacity = weightedMean([
        { value: a.textureRichness, weight: 0.4 },
        { value: a.alcoholPotential, weight: 0.35 },
        { value: a.residualSugar, weight: 0.25 }
      ]);
      break;
    case 'sweetness':
      capacity = weightedMean([
        { value: a.residualSugar, weight: 0.6 },
        { value: a.harvestTiming, weight: 0.4 }
      ]);
      break;
    case 'tannins':
      capacity = weightedMean([
        { value: a.phenolicExtract, weight: 0.45 },
        { value: a.skinContactEvolution, weight: 0.35 },
        { value: a.crushingExtraction, weight: 0.2 }
      ]);
      break;
    case 'spice':
      capacity = weightedMean([
        { value: a.varietyCharacter, weight: 0.4 },
        { value: a.fermentationProfile, weight: 0.35 },
        { value: a.leesContact, weight: 0.25 }
      ]);
      break;
    default:
      capacity = 0.5;
  }

  return clampScale(1 + (clamp01(capacity) - 0.5) * ANCHOR_MODIFIER_STRENGTH);
}

export function scaleCharacteristicEffectModifiersByAnchors<
  T extends { characteristic: keyof WineCharacteristics; modifier: number }
>(anchors: WineAnchorValues, effects: T[]): T[] {
  return effects.map((e) => ({
    ...e,
    modifier: e.modifier * anchorModifierScaleForCharacteristic(anchors, e.characteristic)
  }));
}
