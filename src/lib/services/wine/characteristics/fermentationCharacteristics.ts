import { WineCharacteristics } from '../../../types/types';

export interface FermentationInputs {
  baseCharacteristics: WineCharacteristics;
  method: 'Basic' | 'Temperature Controlled' | 'Extended Maceration';
  temperature: 'Ambient' | 'Cool' | 'Warm';
}

export interface FermentationOptions {
  method: 'Basic' | 'Temperature Controlled' | 'Extended Maceration';
  temperature: 'Ambient' | 'Cool' | 'Warm';
}

export interface FermentationEffect {
  characteristic: keyof WineCharacteristics;
  modifier: number; // Per week modifier
  description: string;
}

export interface FermentationBreakdown {
  base: WineCharacteristics;
  effects: FermentationEffect[];
  final: WineCharacteristics;
}

/**
 * Fermentation method effects configuration
 * These are applied each week during fermentation
 */
const FERMENTATION_METHOD_EFFECTS: Record<FermentationInputs['method'], FermentationEffect[]> = {
  'Basic': [
    { characteristic: 'aroma', modifier: 0.005, description: 'Basic Fermentation' },
    { characteristic: 'body', modifier: 0.003, description: 'Basic Fermentation' }
  ],
  'Temperature Controlled': [
    { characteristic: 'aroma', modifier: 0.008, description: 'Temperature Controlled Fermentation' },
    { characteristic: 'body', modifier: 0.005, description: 'Temperature Controlled Fermentation' },
    { characteristic: 'acidity', modifier: 0.002, description: 'Temperature Controlled Fermentation' }
  ],
  'Extended Maceration': [
    { characteristic: 'tannins', modifier: 0.008, description: 'Extended Maceration' },
    { characteristic: 'body', modifier: 0.01, description: 'Extended Maceration' },
    { characteristic: 'spice', modifier: 0.006, description: 'Extended Maceration' },
    { characteristic: 'aroma', modifier: 0.007, description: 'Extended Maceration' }
  ]
};

/**
 * Temperature effects configuration
 * These are applied each week during fermentation
 */
const FERMENTATION_TEMPERATURE_EFFECTS: Record<FermentationInputs['temperature'], FermentationEffect[]> = {
  'Ambient': [
    // No specific effects - baseline
  ],
  'Cool': [
    { characteristic: 'acidity', modifier: 0.003, description: 'Cool Fermentation' },
    { characteristic: 'aroma', modifier: 0.004, description: 'Cool Fermentation' },
    { characteristic: 'sweetness', modifier: 0.002, description: 'Cool Fermentation' }
  ],
  'Warm': [
    { characteristic: 'body', modifier: 0.006, description: 'Warm Fermentation' },
    { characteristic: 'tannins', modifier: 0.004, description: 'Warm Fermentation' },
    { characteristic: 'acidity', modifier: -0.002, description: 'Warm Fermentation' }
  ]
};

function applyEffects(
  characteristics: WineCharacteristics,
  effects: FermentationEffect[]
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
 * Get combined fermentation effects without applying them
 * Used for displaying expected changes in UI
 */
export function getCombinedFermentationEffects(method: FermentationInputs['method'], temperature: FermentationInputs['temperature']): FermentationEffect[] {
  const effects: FermentationEffect[] = [];

  // Add fermentation method effects
  effects.push(...FERMENTATION_METHOD_EFFECTS[method]);

  // Add temperature effects
  effects.push(...FERMENTATION_TEMPERATURE_EFFECTS[temperature]);

  return effects;
}

/**
 * Apply weekly fermentation effects to wine characteristics
 * Called each game tick for fermenting batches
 */
export function applyWeeklyFermentationEffects(inputs: FermentationInputs): {
  characteristics: WineCharacteristics;
  breakdown: FermentationBreakdown;
} {
  const { baseCharacteristics, method, temperature } = inputs;

  // Get combined effects
  const effects = getCombinedFermentationEffects(method, temperature);

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

/**
 * Get fermentation method information for UI display
 */
export function getFermentationMethodInfo() {
  return {
    'Basic': {
      description: 'Standard fermentation process - simple and reliable',
      workMultiplier: 1.0, // Baseline
      costPenalty: 0, // No extra cost
      effects: 'Slight aroma and body development',
      weeklyEffects: 'Weekly: +0.5% aroma, +0.3% body per week'
    },
    'Temperature Controlled': {
      description: 'Controlled temperature fermentation - consistent results',
      workMultiplier: 1.3, // 30% more work for setup
      costPenalty: 800, // €800 equipment/monitoring cost
      effects: 'Better aroma preservation and controlled development',
      weeklyEffects: 'Weekly: +0.8% aroma, +0.5% body, +0.2% acidity per week'
    },
    'Extended Maceration': {
      description: 'Extended skin contact - complex wines',
      workMultiplier: 1.5, // 50% more work for monitoring
      costPenalty: 400, // €400 additional labor cost
      effects: 'Higher tannins, body, and complexity',
      weeklyEffects: 'Weekly: +0.8% tannins, +1.0% body, +0.6% spice, +0.7% aroma per week'
    }
  };
}

/**
 * Get temperature control information for UI display
 */
export function getFermentationTemperatureInfo() {
  return {
    'Ambient': {
      description: 'Natural temperature - no climate control',
      costModifier: 0, // No extra cost
      effects: 'Standard fermentation progression',
      weeklyEffects: 'No additional weekly effects'
    },
    'Cool': {
      description: 'Cool fermentation (12-16°C) - preserves delicate flavors',
      costModifier: 200, // €200 cooling cost
      effects: 'Preserves acidity and enhances aroma',
      weeklyEffects: 'Weekly: +0.3% acidity, +0.4% aroma, +0.2% sweetness per week'
    },
    'Warm': {
      description: 'Warm fermentation (24-28°C) - robust development',
      costModifier: 150, // €150 heating cost
      effects: 'Enhances body and tannins, reduces acidity',
      weeklyEffects: 'Weekly: +0.6% body, +0.4% tannins, -0.2% acidity per week'
    }
  };
}
