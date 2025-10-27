import { WineCharacteristics, Vineyard } from '../../../types/types';

export interface HarvestInputs {
  baseCharacteristics: WineCharacteristics;
  ripeness: number; // 0-1
  qualityFactor: number; // 0-1 (vine/grape quality)
  suitability: number; // 0-1 (region × grape suitability)
  altitude: number; // meters
  medianAltitude: number; // meters
  maxAltitude: number; // meters
  grapeColor: 'red' | 'white';
  overgrowth?: Vineyard['overgrowth'];
  density?: number; // Vine density (vines/hectare)
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
  const { baseCharacteristics, ripeness, qualityFactor, suitability, altitude, medianAltitude, maxAltitude, grapeColor, overgrowth, density } = inputs;

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

  // Overgrowth-driven effects (diminishing-returns on years)
  if (overgrowth) {
    const yearsVegetation = Math.max(0, overgrowth.vegetation || 0);
    const yearsDebris = Math.max(0, overgrowth.debris || 0);
    const yearsReplant = Math.max(0, overgrowth.replant || overgrowth.uproot || 0);

    const curve = (years: number, rate = 0.35, scale = 1) => (1 - Math.pow(1 - rate, years)) * scale; // concave

    // Vegetation: +aroma, -body, slight +acidity for whites
    const vegAroma = curve(yearsVegetation, 0.35, grapeColor === 'white' ? 0.06 : 0.04);
    const vegBody = -curve(yearsVegetation, 0.35, 0.04);
    const vegAcid = grapeColor === 'white' ? curve(yearsVegetation, 0.35, 0.02) : 0;
    if (vegAroma) effects.push({ characteristic: 'aroma', modifier: vegAroma, description: 'Vegetation Overgrowth' });
    if (vegBody) effects.push({ characteristic: 'body', modifier: vegBody, description: 'Vegetation Overgrowth' });
    if (vegAcid) effects.push({ characteristic: 'acidity', modifier: vegAcid, description: 'Vegetation Overgrowth' });

    // Debris: -body, +tannins (stronger for reds), small -aroma at high years
    const debBody = -curve(yearsDebris, 0.4, 0.05);
    const debTannins = curve(yearsDebris, 0.4, grapeColor === 'red' ? 0.05 : 0.03);
    const debAroma = yearsDebris >= 3 ? -curve(yearsDebris - 2, 0.4, 0.02) : 0;
    if (debBody) effects.push({ characteristic: 'body', modifier: debBody, description: 'Debris Accumulation' });
    if (debTannins) effects.push({ characteristic: 'tannins', modifier: debTannins, description: 'Debris Accumulation' });
    if (debAroma) effects.push({ characteristic: 'aroma', modifier: debAroma, description: 'Debris Accumulation' });

    // Replant/Uproot axis: early shock then medium-term selection benefits
    if (yearsReplant > 0) {
      if (yearsReplant <= 2) {
        // Short-term shock
        effects.push({ characteristic: 'aroma', modifier: -curve(yearsReplant, 0.6, 0.04), description: 'Replant Shock' });
        effects.push({ characteristic: 'body', modifier: -curve(yearsReplant, 0.6, 0.02), description: 'Replant Shock' });
        effects.push({ characteristic: 'acidity', modifier: curve(yearsReplant, 0.6, 0.015), description: 'Replant Shock' });
      } else if (yearsReplant <= 7) {
        // Medium-term selection benefits
        effects.push({ characteristic: 'body', modifier: curve(yearsReplant - 2, 0.35, 0.04), description: 'Selection Benefits' });
        effects.push({ characteristic: 'tannins', modifier: -curve(yearsReplant - 2, 0.35, grapeColor === 'red' ? 0.035 : 0.02), description: 'Selection Benefits' });
        effects.push({ characteristic: 'aroma', modifier: curve(yearsReplant - 2, 0.35, 0.025), description: 'Selection Benefits' });
      }
      // >7 years: neutral (age/quality systems handle the rest)
    }
  }

  // Density effects: Progressive system - no penalty at 1500, max penalty at 15000
  // High density reduces body, aroma, spice, and sweetness due to competition for resources
  if (density && density > 0) {
    const minDensity = 1500;  // No penalty at this density
    const maxDensity = 15000; // Max penalty at this density
    
    // Clamp density to reasonable range
    const clampedDensity = Math.max(minDensity, Math.min(maxDensity, density));
    
    // Calculate density multiplier: 1.0 at 1500, 0.5 at 15000
    const densityMultiplier = 1.0 - ((clampedDensity - minDensity) / (maxDensity - minDensity)) * 0.5;
    
    // Apply characteristic reductions proportionally
    // At max density (15000), max reduction is about 30% for body
    const maxReduction = 0.3;
    const reductionScale = (1.0 - densityMultiplier) * maxReduction;
    
    effects.push({ characteristic: 'body', modifier: -reductionScale, description: 'Vine Density' });
    effects.push({ characteristic: 'aroma', modifier: -reductionScale * 0.8, description: 'Vine Density' });
    effects.push({ characteristic: 'spice', modifier: -reductionScale * 0.6, description: 'Vine Density' });
    effects.push({ characteristic: 'sweetness', modifier: -reductionScale * 0.5, description: 'Vine Density' });
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


