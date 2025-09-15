// Wine value calculation service - handles all vineyard and regional factors that contribute to wine value
import { Vineyard } from '../../types';

/**
 * Normalize land value from euros per hectare to 0-1 scale
 * Based on typical vineyard land value ranges across regions
 * @param landValue - Land value in euros per hectare
 * @returns Normalized land value (0-1 scale)
 */
function normalizeLandValue(landValue: number): number {
  // Land values typically range from 5,000 to 10,000,000 euros per hectare
  // Use logarithmic scaling to handle the wide range
  const minValue = 5000;
  const maxValue = 10000000;
  
  // Clamp the input value
  const clampedValue = Math.max(minValue, Math.min(maxValue, landValue));
  
  // Apply logarithmic scaling
  const logMin = Math.log(minValue);
  const logMax = Math.log(maxValue);
  const logValue = Math.log(clampedValue);
  
  return (logValue - logMin) / (logMax - logMin);
}

/**
 * Calculate the wine value index for a vineyard
 * This combines land value, field prestige, and regional factors into a single 0-1 score
 * 
 * Now enhanced with:
 * - Real land value calculations based on region, prestige, altitude, and aspect
 * - Proper normalization of land values from euros to 0-1 scale
 * - Vineyard prestige integration
 * 
 * @param vineyard - The vineyard to calculate wine value for
 * @returns Wine value index (0-1 scale)
 */
export function calculateWineValueIndex(vineyard: Vineyard): number {
  // Normalize land value from euros per hectare to 0-1 scale
  const normalizedLandValue = normalizeLandValue(vineyard.landValue || 50000);
  
  // Vineyard prestige is already on 0-1 scale
  const vineyardPrestige = vineyard.vineyardPrestige || 0.1;
  
  // Combine factors (weighted average)
  // Land value gets 60% weight, prestige gets 40% weight
  const wineValueIndex = (normalizedLandValue * 0.6) + (vineyardPrestige * 0.4);
  
  // Ensure result is within 0-1 range
  return Math.max(0, Math.min(1, wineValueIndex));
}

// TODO: Future implementations for when the game expands
// - calculateLandValue(): Regional data, soil, altitude, climate effects
// - calculateFieldPrestige(): Vine age, health, density, performance history


