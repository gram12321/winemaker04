import { WineBatch, Vineyard } from '../../../types/types';
import { SALES_CONSTANTS } from '../../../constants/constants';
import { calculateAsymmetricalMultiplier } from '../../../utils/calculator';
import { calculateEffectiveQuality } from '../features/featureEffectsService';

export function calculateWineScore(wineBatch: WineBatch): number {
  // Use effective quality (applies feature penalties/bonuses)
  const effectiveQuality = calculateEffectiveQuality(wineBatch);
  const wineScore = (effectiveQuality + wineBatch.balance) / 2;
  return wineScore;
}

/**
 * Calculate the estimated price for a wine batch using the wine score.
 * Formula: (WineScore × Base Rate) × Asymmetrical Multiplier
 */
export function calculateEstimatedPrice(wineBatch: WineBatch, _vineyard: Vineyard): number {
  const wineScore = calculateWineScore(wineBatch);
  const basePrice = wineScore * SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  const multiplier = calculateAsymmetricalMultiplier(wineScore);
  let estimatedPrice = basePrice * multiplier;
  estimatedPrice = Math.min(estimatedPrice, SALES_CONSTANTS.MAX_PRICE);
  return Math.round(estimatedPrice * 100) / 100;
}


// TODO: Future implementations for when the game expands
// - applyAgingEffects(): Modify quality during aging  
// - getGrapeQualityPotential(): Different grape varieties with specific ranges
// - calculateVintageEffects(): Weather/year effects on wine quality
