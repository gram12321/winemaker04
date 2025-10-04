// Wine combined score calculation service - combines vineyard quality and wine balance into a single score
import { WineBatch } from '../../types/types';
import { calculateSkewedMultiplier } from '../../utils/calculator';

/**
 * Calculate the combined wine score for a wine batch
 * This combines vineyard quality (land value, prestige, altitude, etc.) and wine balance (characteristics)
 * into a single 0-1 score that will be used for price multipliers
 * 
 * @param wineBatch - The wine batch to calculate combined score for
 * @returns Combined wine score (0-1 scale)
 */
export function calculateWineCombinedScore(wineBatch: WineBatch): number {
  const combinedScore = (wineBatch.quality + wineBatch.balance) / 2;

  return calculateSkewedMultiplier(combinedScore);
}


// TODO: Future implementations for when the game expands
// - applyFermentationEffects(): Modify quality during fermentation
// - applyAgingEffects(): Modify quality during aging  
// - getGrapeQualityPotential(): Different grape varieties with specific ranges
// - calculateVintageEffects(): Weather/year effects on wine quality
