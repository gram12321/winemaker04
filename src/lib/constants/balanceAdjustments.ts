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

export interface SynergyRule {
  characteristics: CharacteristicKey[];
  condition: (wine: WineCharacteristics) => boolean;
  reduction: (wine: WineCharacteristics) => number; // 0-1 reduction factor
}

export interface AdjustmentSet {
  rangeShifts?: RangeShiftRule[];
  // Cross-trait penalty scaling rules applied to target penalties
  penaltyScales?: PenaltyScaleRule[];
}

export type DynamicAdjustmentsConfig = Partial<Record<CharacteristicKey, Partial<Record<Direction, AdjustmentSet>>>>;

// Synergy rules for penalty reductions on good characteristic combinations
export const SYNERGY_RULES: SynergyRule[] = [
  {
    characteristics: ['acidity', 'tannins'],
    condition: (wine) => wine.acidity > 0.7 && wine.tannins > 0.7,
    reduction: (wine) => Math.min(0.75, (wine.acidity + wine.tannins - 1.4) * 0.5) // Up to 75% reduction
  },
  {
    characteristics: ['body', 'spice'],
    condition: (wine) => wine.body >= 0.6 && wine.body <= 0.8 && wine.spice >= 0.6 && wine.spice <= 0.8,
    reduction: (wine) => Math.min(0.75, 0.5 * (1 - Math.abs(wine.body - wine.spice))) // Up to 75% reduction
  },
  {
    characteristics: ['aroma', 'body', 'sweetness'],
    condition: (wine) => wine.aroma > wine.body && wine.sweetness >= 0.4 && wine.sweetness <= 0.6,
    reduction: (wine) => {
      const aromaBodyRatio = wine.aroma / wine.body;
      return aromaBodyRatio >= 1.1 && aromaBodyRatio <= 1.3 ? 0.6 : 0.3; // 60% or 30% reduction
    }
  }
];

// Safe starter configuration: subtle, feelable shifts only
export const DYNAMIC_ADJUSTMENTS: DynamicAdjustmentsConfig = {
  acidity: {
    above: {
      rangeShifts: [{ target: 'sweetness', shiftPerUnit: -0.15 }],
      penaltyScales: [
        // High acidity increases penalty on sweetness being high
        { target: 'sweetness', k: 0.20, p: 1.2 }
      ]
    },
    below: {
      // Opposite: low acidity should move sweetness range upward → use same sign, leverage negative normDiff
      rangeShifts: [{ target: 'sweetness', shiftPerUnit: -0.15 }],
      penaltyScales: [
        // Low acidity increases penalty on body when also high
        { target: 'body', k: 0.15, p: 1.2 }
      ]
    }
  },
  body: {
    above: {
      rangeShifts: [
        { target: 'spice', shiftPerUnit: 0.08 },
        { target: 'tannins', shiftPerUnit: 0.08 }
      ],
      penaltyScales: [
        // High body increases penalty on aroma if aroma lags behind
        { target: 'aroma', k: 0.18, p: 1.3 }
      ]
    },
    below: {
      // Follow relation: use same sign so negative normDiff shifts ranges downward
      rangeShifts: [
        { target: 'spice', shiftPerUnit: 0.08 },
        { target: 'tannins', shiftPerUnit: 0.08 }
      ],
      penaltyScales: [
        // Low body increases penalty on tannins when tannins are high
        { target: 'tannins', k: 0.18, p: 1.3 }
      ]
    }
  },
  sweetness: {
    above: { 
      // Inverse relation: keep same sign so above→down, below→up
      rangeShifts: [{ target: 'acidity', shiftPerUnit: -0.10 }],
      penaltyScales: [
        // High sweetness slightly increases penalty on spice
        { target: 'spice', k: 0.10, p: 1.0 }
      ]
    },
    below: { 
      rangeShifts: [{ target: 'acidity', shiftPerUnit: -0.10 }],
      penaltyScales: [
        // Low sweetness slightly increases penalty on acidity when acidity is high
        { target: 'acidity', k: 0.12, p: 1.1 }
      ]
    }
  },
  tannins: {
    above: { 
      rangeShifts: [
        { target: 'body', shiftPerUnit: 0.10 }, 
        { target: 'aroma', shiftPerUnit: 0.08 }, 
        { target: 'sweetness', shiftPerUnit: -0.05 }
      ],
      penaltyScales: [
        // High tannins increases penalty on sweetness and aroma
        { target: 'sweetness', k: 0.25, p: 1.2 },
        { target: 'aroma', k: 0.15, p: 1.1 }
      ]
    },
    below: { 
      // Follow for body/aroma; inverse for sweetness
      rangeShifts: [
        { target: 'body', shiftPerUnit: 0.10 }, 
        { target: 'aroma', shiftPerUnit: 0.08 }, 
        { target: 'sweetness', shiftPerUnit: -0.05 }
      ],
      penaltyScales: [
        // Low tannins increases penalty on body
        { target: 'body', k: 0.20, p: 1.2 }
      ]
    }
  },
  aroma: {
    above: { 
      rangeShifts: [{ target: 'body', shiftPerUnit: 0.06 }],
      penaltyScales: [
        // High aroma increases penalty on body if body lags
        { target: 'body', k: 0.15, p: 1.2 }
      ]
    },
    below: { 
      // Follow relation for body
      rangeShifts: [{ target: 'body', shiftPerUnit: 0.06 }],
      penaltyScales: [
        // Low aroma increases penalty on spice
        { target: 'spice', k: 0.12, p: 1.1 }
      ]
    }
  }
};


