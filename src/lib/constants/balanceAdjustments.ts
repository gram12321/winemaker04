import { WineCharacteristics } from '@/lib/types/types';

// Typed config for dynamic range adjustments (Phase 2)
// Characteristic keys align with WineCharacteristics
export type CharacteristicKey = keyof WineCharacteristics;

export type Direction = 'above' | 'below';

export interface RangeShiftRule {
  target: CharacteristicKey;
  // Shift per unit of normalized deviation (unitless).
  // Final delta applied to target range = shiftPerUnit × normDiff × targetRangeWidth
  shiftPerUnit: number;
  // Optional absolute clamps for the target range after shift
  clamp?: [number, number];
}

// NOTE: PenaltyScaleRule is part of a future expansion for cross-trait effects.
// It is declared here for completeness but currently has NO effect in the code path.
export interface PenaltyScaleRule {
  target: CharacteristicKey;
  k: number; // linear coefficient
  p?: number; // exponent, defaults to 1
  cap?: [number, number]; // [minScale, maxScale]
}

export interface AdjustmentSet {
  rangeShifts?: RangeShiftRule[];
  // Future: currently ignored by the engine (see note above)
  penaltyScales?: PenaltyScaleRule[];
}

export type DynamicAdjustmentsConfig = Partial<Record<CharacteristicKey, Partial<Record<Direction, AdjustmentSet>>>>;

// Safe starter configuration: subtle, feelable shifts only
export const DYNAMIC_ADJUSTMENTS: DynamicAdjustmentsConfig = {
  acidity: {
    above: {
      rangeShifts: [{ target: 'sweetness', shiftPerUnit: -0.15 }]
    },
    below: {
      rangeShifts: [{ target: 'sweetness', shiftPerUnit: 0.15 }]
    }
  },
  body: {
    above: {
      rangeShifts: [
        { target: 'spice', shiftPerUnit: 0.08 },
        { target: 'tannins', shiftPerUnit: 0.08 }
      ]
    },
    below: {
      rangeShifts: [
        { target: 'spice', shiftPerUnit: -0.08 },
        { target: 'tannins', shiftPerUnit: -0.08 }
      ]
    }
  },
  sweetness: {
    above: { rangeShifts: [{ target: 'acidity', shiftPerUnit: -0.10 }] },
    below: { rangeShifts: [{ target: 'acidity', shiftPerUnit: 0.10 }] }
  },
  tannins: {
    above: { rangeShifts: [{ target: 'body', shiftPerUnit: 0.10 }, { target: 'aroma', shiftPerUnit: 0.08 }, { target: 'sweetness', shiftPerUnit: -0.05 }] },
    below: { rangeShifts: [{ target: 'body', shiftPerUnit: -0.10 }, { target: 'aroma', shiftPerUnit: -0.08 }, { target: 'sweetness', shiftPerUnit: 0.05 }] }
  },
  aroma: {
    above: { rangeShifts: [{ target: 'body', shiftPerUnit: 0.06 }] },
    below: { rangeShifts: [{ target: 'body', shiftPerUnit: -0.06 }] }
  }
};



