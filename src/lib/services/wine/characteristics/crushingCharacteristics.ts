import { WineCharacteristics } from '../../../types/types';

export interface CrushingInputs {
  baseCharacteristics: WineCharacteristics;
  method: 'Hand Press' | 'Mechanical Press' | 'Pneumatic Press';
  destemming: boolean;
  coldSoak: boolean;
  pressingIntensity: number; // 0-1 scale, max depends on method
}

export interface CrushingOptions {
  method: 'Hand Press' | 'Mechanical Press' | 'Pneumatic Press';
  destemming: boolean;
  coldSoak: boolean;
  pressingIntensity: number; // 0-1 scale, max depends on method
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
  yieldMultiplier: number;
  qualityPenalty: number;
} {
  const { baseCharacteristics, method, destemming, coldSoak, pressingIntensity } = inputs;

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

  // Add pressing intensity effects (with method multiplier)
  const intensityEffects = getPressingIntensityEffects(pressingIntensity, method);
  effects.push(...intensityEffects);

  // Apply all effects
  const finalCharacteristics = applyEffects(baseCharacteristics, effects);

  // Calculate yield and quality impacts
  const yieldMultiplier = calculateYieldMultiplier(pressingIntensity);
  const qualityPenalty = calculatePressingQualityPenalty(pressingIntensity);

  return {
    characteristics: finalCharacteristics,
    breakdown: {
      base: baseCharacteristics,
      effects,
      final: finalCharacteristics
    },
    yieldMultiplier,
    qualityPenalty
  };
}

// Note: Special features (like Green Flavors) were removed for this iteration
// They were not fully implemented in v1 and would require additional UI/UX work

/**
 * Get pressing intensity effects based on intensity level (0-1)
 * Higher pressure = more yield but quality tradeoffs
 * Effects start at 10% intensity using power function
 */
function getPressingIntensityEffects(intensity: number, method?: CrushingInputs['method']): CrushingEffect[] {
  if (intensity <= 0.1) {
    // Very gentle pressing - no effects
    return [];
  }
  
  // Power function effects starting at 10% intensity
  const excessPressure = intensity - 0.1;
  const normalizedPressure = excessPressure / 0.9; // Scale to 0-1 for power function
  const powerLevel = Math.pow(normalizedPressure, 2.0); // Power function (2.0 exponent)
  
  // Method multipliers for characteristic effects
  const methodMultipliers: Record<CrushingInputs['method'], number> = {
    'Hand Press': 1.0,      // Baseline - gentle but inefficient
    'Mechanical Press': 1.5, // More efficient extraction
    'Pneumatic Press': 1.9   // Most efficient extraction
  };
  
  const methodMultiplier = method ? methodMultipliers[method] : 1.0;
  
  return [
    { characteristic: 'spice', modifier: -0.15 * powerLevel * methodMultiplier, description: 'Pressure Extraction' },
    { characteristic: 'aroma', modifier: -0.12 * powerLevel * methodMultiplier, description: 'Pressure Extraction' },
    { characteristic: 'tannins', modifier: 0.20 * powerLevel * methodMultiplier, description: 'Pressure Extraction' }
  ];
}

/**
 * Calculate yield multiplier from pressing intensity
 * Higher pressure = more juice extracted
 */
export function calculateYieldMultiplier(intensity: number): number {
  // Base yield at 0.5 intensity (medium pressure)
  // Scale: 0.85x at 0.0 → 1.0x at 0.5 → 1.15x at 1.0
  return 0.85 + (intensity * 0.30);
}

/**
 * Calculate direct quality penalty from pressing intensity
 * Hard pressing damages delicate compounds
 */
export function calculatePressingQualityPenalty(intensity: number): number {
  if (intensity <= 0.1) {
    return 0; // No penalty for very gentle pressing
  }
  
  // Power function penalty starting at 10% intensity
  // Penalty grows exponentially: -0.20 max penalty at 1.0 intensity
  const excessPressure = intensity - 0.1;
  const normalizedPressure = excessPressure / 0.9; // Scale to 0-1 for power function
  const powerPenalty = Math.pow(normalizedPressure, 2.5); // Power function (2.5 exponent)
  
  return -(powerPenalty * 0.20); // Max -20% penalty at 1.0 intensity
}

/**
 * Get pressing intensity characteristic effects for UI badges
 * Returns effects in the same format as feature effects for consistent display
 */
export function getPressingIntensityCharacteristicEffects(intensity: number, method?: CrushingInputs['method']): Array<{
  characteristic: keyof WineCharacteristics;
  modifier: number;
  description: string;
}> {
  if (intensity <= 0.1) {
    return []; // No effects for very gentle pressing
  }
  
  // Power function effects starting at 10% intensity
  const excessPressure = intensity - 0.1;
  const normalizedPressure = excessPressure / 0.9; // Scale to 0-1 for power function
  const powerLevel = Math.pow(normalizedPressure, 2.0); // Power function (2.0 exponent)
  
  // Method multipliers for characteristic effects
  const methodMultipliers: Record<CrushingInputs['method'], number> = {
    'Hand Press': 1.0,      // Baseline - gentle but inefficient
    'Mechanical Press': 1.5, // More efficient extraction
    'Pneumatic Press': 1.9   // Most efficient extraction
  };
  
  const methodMultiplier = method ? methodMultipliers[method] : 1.0;
  
  return [
    { characteristic: 'spice', modifier: -0.15 * powerLevel * methodMultiplier, description: 'Pressure Extraction' },
    { characteristic: 'aroma', modifier: -0.12 * powerLevel * methodMultiplier, description: 'Pressure Extraction' },
    { characteristic: 'tannins', modifier: 0.20 * powerLevel * methodMultiplier, description: 'Pressure Extraction' }
  ];
}

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
      throughput: '1.5 tons/week',
      maxPressure: 0.5 // Limited pressure capability
    },
    'Mechanical Press': {
      description: 'Standard mechanical pressing - balanced approach',
      workMultiplier: 1.0, // Baseline
      costPenalty: 500, // €500 equipment/maintenance cost
      effects: 'Balanced processing with no major modifications',
      throughput: '2.5 tons/week',
      maxPressure: 0.8 // Good pressure range
    },
    'Pneumatic Press': {
      description: 'Modern pneumatic pressing - gentle and efficient',
      workMultiplier: 0.8, // 20% less work
      costPenalty: 1200, // €1200 equipment/maintenance cost
      effects: 'Raises aroma, spice, and body characteristics',
      throughput: '3.2 tons/week',
      maxPressure: 1.0 // Full pressure capability
    }
  };
}
