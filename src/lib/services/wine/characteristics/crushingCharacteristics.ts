import { WineCharacteristics } from '../../../types/types';

export interface CrushingInputs {
  baseCharacteristics: WineCharacteristics;
  method: 'Hand Press' | 'Mechanical Press' | 'Pneumatic Press';
  destemming: boolean;
  coldSoak: boolean;
}

export interface CrushingOptions {
  method: 'Hand Press' | 'Mechanical Press' | 'Pneumatic Press';
  destemming: boolean;
  coldSoak: boolean;
}

export interface CrushingEffect {
  characteristic: keyof WineCharacteristics;
  modifier: number; // Positive = increase, negative = decrease
  description: string;
}

export interface CrushingBreakdown {
  base: WineCharacteristics;
  effects: CrushingEffect[];
  final: WineCharacteristics;
}

function applyEffects(
  characteristics: WineCharacteristics,
  effects: CrushingEffect[]
): WineCharacteristics {
  const modified = { ...characteristics };
  
  for (const effect of effects) {
    const currentValue = modified[effect.characteristic];
    const newValue = Math.max(0, Math.min(1, currentValue + effect.modifier));
    modified[effect.characteristic] = newValue;
  }
  
  return modified;
}

/**
 * Crushing method effects configuration
 */
const CRUSHING_METHOD_EFFECTS: Record<CrushingInputs['method'], CrushingEffect[]> = {
  'Hand Press': [
    { characteristic: 'aroma', modifier: 0.05, description: 'Hand Pressing' },
    { characteristic: 'body', modifier: 0.03, description: 'Hand Pressing' },
    { characteristic: 'tannins', modifier: -0.02, description: 'Hand Pressing' }
  ],
  'Mechanical Press': [
    // Standard method - no significant modifications
  ],
  'Pneumatic Press': [
    { characteristic: 'aroma', modifier: 0.08, description: 'Pneumatic Pressing' },
    { characteristic: 'spice', modifier: 0.05, description: 'Pneumatic Pressing' },
    { characteristic: 'body', modifier: 0.05, description: 'Pneumatic Pressing' }
  ]
};

/**
 * Destemming effects configuration
 */
const DESTEMMING_EFFECTS: CrushingEffect[] = [
  { characteristic: 'body', modifier: 0.1, description: 'Removing Stems' },
  { characteristic: 'tannins', modifier: 0.15, description: 'Removing Stems' },
  { characteristic: 'spice', modifier: 0.1, description: 'Removing Stems' },
  { characteristic: 'aroma', modifier: 0.05, description: 'Removing Stems' }
];

const NO_DESTEMMING_EFFECTS: CrushingEffect[] = [
  { characteristic: 'aroma', modifier: -0.15, description: 'Stem Inclusion' },
  { characteristic: 'tannins', modifier: -0.1, description: 'Stem Inclusion' }
];

/**
 * Cold soak effects configuration
 */
const COLD_SOAK_EFFECTS: CrushingEffect[] = [
  { characteristic: 'aroma', modifier: 0.12, description: 'Cold Soak Pressing' },
  { characteristic: 'body', modifier: 0.08, description: 'Cold Soak Pressing' },
  { characteristic: 'tannins', modifier: 0.1, description: 'Cold Soak Pressing' },
  { characteristic: 'spice', modifier: 0.06, description: 'Cold Soak Pressing' }
];

/**
 * Crushing characteristics modifier
 * Applies crushing process options to base characteristics
 */
export function modifyCrushingCharacteristics(inputs: CrushingInputs): {
  characteristics: WineCharacteristics;
  breakdown: CrushingBreakdown;
} {
  const { baseCharacteristics, method, destemming, coldSoak } = inputs;

  // Collect all effects based on options
  const effects: CrushingEffect[] = [];

  // Add crushing method effects
  effects.push(...CRUSHING_METHOD_EFFECTS[method]);

  // Add destemming effects
  if (destemming) {
    effects.push(...DESTEMMING_EFFECTS);
  } else {
    effects.push(...NO_DESTEMMING_EFFECTS);
  }

  // Add cold soak effects
  if (coldSoak) {
    effects.push(...COLD_SOAK_EFFECTS);
  }

  // Apply all effects
  const finalCharacteristics = applyEffects(baseCharacteristics, effects);

  return {
    characteristics: finalCharacteristics,
    breakdown: {
      base: baseCharacteristics,
      effects,
      final: finalCharacteristics
    }
  };
}

// Note: Special features (like Green Flavors) were removed for this iteration
// They were not fully implemented in v1 and would require additional UI/UX work

/**
 * Get crushing method information for UI display
 */
export function getCrushingMethodInfo() {
  return {
    'Hand Press': {
      description: 'Traditional hand pressing - gentle but slow',
      workMultiplier: 1.5, // 50% more work
      costPenalty: 0, // No extra cost
      effects: 'Raises aroma and body, lowers tannins slightly',
      throughput: '1.5 tons/week'
    },
    'Mechanical Press': {
      description: 'Standard mechanical pressing - balanced approach',
      workMultiplier: 1.0, // Baseline
      costPenalty: 500, // €500 equipment/maintenance cost
      effects: 'Balanced processing with no major modifications',
      throughput: '2.5 tons/week'
    },
    'Pneumatic Press': {
      description: 'Modern pneumatic pressing - gentle and efficient',
      workMultiplier: 0.8, // 20% less work
      costPenalty: 1200, // €1200 equipment/maintenance cost
      effects: 'Raises aroma, spice, and body characteristics',
      throughput: '3.2 tons/week'
    }
  };
}
