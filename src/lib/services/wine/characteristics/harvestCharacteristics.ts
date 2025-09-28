import { WineCharacteristics } from '../../../types/types';

export interface HarvestInputs {
  baseCharacteristics: WineCharacteristics;
  ripeness: number; // 0-1
  qualityFactor: number; // 0-1 (vine/grape quality)
  suitability: number; // 0-1 (region × grape suitability)
  altitude: number; // meters
  medianAltitude: number; // meters
  maxAltitude: number; // meters
  grapeColor: 'red' | 'white';
}

export interface HarvestEffect {
  characteristic: keyof WineCharacteristics;
  modifier: number; // Positive = increase, negative = decrease
  description: string;
}

export interface HarvestBreakdown {
  base: WineCharacteristics;
  effects: HarvestEffect[];
  final: WineCharacteristics;
}


function applyEffects(
  characteristics: WineCharacteristics,
  effects: HarvestEffect[]
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
 * Harvest characteristics modifier
 * Applies vineyard conditions to base grape characteristics
 */
export function modifyHarvestCharacteristics(inputs: HarvestInputs): {
  characteristics: WineCharacteristics;
  breakdown: HarvestBreakdown;
} {
  const { baseCharacteristics, ripeness, qualityFactor, suitability, altitude, medianAltitude, maxAltitude, grapeColor } = inputs;

  // Normalize altitude effect to roughly [-1, 1]
  const denom = Math.max(1, maxAltitude - medianAltitude);
  const altitudeEffect = (altitude - medianAltitude) / denom;

  // Calculate all effects
  const effects: HarvestEffect[] = [];

  // Ripeness effects (late harvest → sweeter, fuller, less acidic; slight tannin increase)
  const ripenessCentered = ripeness - 0.5;
  effects.push(
    { characteristic: 'sweetness', modifier: ripenessCentered * 0.4, description: 'Grape Ripeness' },
    { characteristic: 'acidity', modifier: -ripenessCentered * 0.3, description: 'Grape Ripeness' },
    { characteristic: 'tannins', modifier: ripenessCentered * 0.2, description: 'Grape Ripeness' },
    { characteristic: 'body', modifier: ripenessCentered * 0.1, description: 'Grape Ripeness' },
    { characteristic: 'aroma', modifier: ripenessCentered * 0.05, description: 'Grape Ripeness' }
  );

  // Quality factor effects (color-aware emphasis)
  const q = qualityFactor - 0.5;
  effects.push({ characteristic: 'body', modifier: q * (grapeColor === 'white' ? 0.18 : 0.15), description: 'Grape Quality' });
  effects.push({ characteristic: 'aroma', modifier: q * (grapeColor === 'white' ? 0.22 : 0.18), description: 'Grape Quality' });
  effects.push({ characteristic: 'tannins', modifier: q * (grapeColor === 'red' ? 0.22 : 0.12), description: 'Grape Quality' });

  // Altitude effects
  effects.push(
    { characteristic: 'acidity', modifier: altitudeEffect * 0.2, description: 'Vineyard Altitude' },
    { characteristic: 'aroma', modifier: altitudeEffect * 0.15, description: 'Vineyard Altitude' },
    { characteristic: 'body', modifier: -altitudeEffect * 0.1, description: 'Vineyard Altitude' }
  );

  // Regional suitability effects
  const suit = suitability - 0.5;
  effects.push(
    { characteristic: 'body', modifier: suit * 0.2, description: 'Regional Grape Suitability' },
    { characteristic: 'aroma', modifier: suit * 0.3, description: 'Regional Grape Suitability' }
  );

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


