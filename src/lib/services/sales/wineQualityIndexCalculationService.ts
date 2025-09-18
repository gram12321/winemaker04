// Quality calculation service - handles all wine characteristics that contribute to quality and balance
import { WineBatch, GrapeVariety } from '../../types';
import { WINE_QUALITY_CONSTANTS } from '../../constants/constants';
import { calculateSkewedMultiplier } from '../../utils/calculator';

/**
 * Calculate the quality index for a wine batch
 * This combines quality and balance into a single 0-1 score that will be used for price multipliers
 * 
 * Current implementation uses random generation - will be enhanced with:
 * - Grape variety characteristics (acidity, tannins, body, etc.)
 * - Fermentation process effects (temperature, duration, yeast selection)
 * - Aging effects (time, vessel type, storage conditions)
 * - Weather/vintage effects during grape growing
 * - Winemaking technique quality
 * 
 * @param wineBatch - The wine batch to calculate quality for
 * @returns Quality index (0-1 scale)
 */
export function calculateWineQuality(wineBatch: WineBatch): number {
  // Current implementation: simple average of quality and balance
  const combinedScore = (wineBatch.quality + wineBatch.balance) / 2;
  
  // Apply skewed multiplier scaling for more realistic distribution
  return calculateSkewedMultiplier(combinedScore);
}

/**
 * Generate initial wine quality characteristics
 * This creates the base quality and balance values for a new wine batch
 * 
 * @param grape - The grape variety
 * @param vineyardId - The vineyard the grapes came from (for future terroir effects)
 * @returns Object with quality and balance values
 */
export function generateWineCharacteristics(_grape: GrapeVariety, _vineyardId: string): {
  quality: number;
  balance: number;
} {
  // TODO: Implement grape variety-specific characteristics
  // - Different grape varieties have different potential quality ranges
  // - Some grapes are naturally more balanced than others
  // - Vineyard terroir should influence the characteristics
  
  // Current implementation: random generation with variation
  const baseQuality = WINE_QUALITY_CONSTANTS.BASE_QUALITY;
  const baseBalance = WINE_QUALITY_CONSTANTS.BASE_BALANCE;
  
  // Add random variation
  const quality = Math.max(0, Math.min(1, 
    baseQuality + (Math.random() - 0.5) * WINE_QUALITY_CONSTANTS.QUALITY_VARIATION
  ));
  const balance = Math.max(0, Math.min(1, 
    baseBalance + (Math.random() - 0.5) * WINE_QUALITY_CONSTANTS.QUALITY_VARIATION
  ));
  
  return { quality, balance };
}

// TODO: Future implementations for when the game expands
// - applyFermentationEffects(): Modify quality during fermentation
// - applyAgingEffects(): Modify quality during aging  
// - getGrapeQualityPotential(): Different grape varieties with specific ranges
// - calculateVintageEffects(): Weather/year effects on wine quality
