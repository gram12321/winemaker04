import { WineBatch, Vineyard } from '../../../types/types';
import { SALES_CONSTANTS } from '../../../constants/constants';
import { calculateAsymmetricalMultiplier, NormalizeScrewed1000To01WithTail } from '../../../utils/calculator';
import { calculateEffectiveGrapeQuality } from '../features/featureEffectsService';

export function calculateWineScore(wineBatch: WineBatch): number {
  // Use effective grape quality (applies feature penalties/bonuses)
  const effectiveGrapeQuality = calculateEffectiveGrapeQuality(wineBatch);
  const wineScore = (effectiveGrapeQuality + wineBatch.balance) / 2;
  return wineScore;
}

/**
 * Calculate the estimated price for a wine batch using the wine score and prestige multipliers.
 * Formula: (WineScore × Base Rate) × Asymmetrical Multiplier × Prestige Multipliers
 * 
 * @param wineBatch - The wine batch to price
 * @param vineyard - The vineyard where the wine was produced
 * @param companyPrestige - Optional company prestige (0-1000+ scale, adds 0-25% to price)
 * @param vineyardPrestige - Optional vineyard prestige (0-1000+ scale, adds 0-25% to price)
 */
export function calculateEstimatedPrice(
  wineBatch: WineBatch, 
  _vineyard: Vineyard,
  companyPrestige?: number,
  vineyardPrestige?: number
): number {
  const wineScore = calculateWineScore(wineBatch);
  const basePrice = wineScore * SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  const multiplier = calculateAsymmetricalMultiplier(wineScore);
  let estimatedPrice = basePrice * multiplier;
  
  // Add company prestige multiplier (0-25% bonus)
  if (companyPrestige !== undefined) {
    const normalizedCompanyPrestige = NormalizeScrewed1000To01WithTail(companyPrestige);
    const companyPrestigeMultiplier = 1 + (normalizedCompanyPrestige * 0.25);
    estimatedPrice *= companyPrestigeMultiplier;
  }
  
  // Add vineyard prestige multiplier (0-25% bonus)
  if (vineyardPrestige !== undefined) {
    const normalizedVineyardPrestige = NormalizeScrewed1000To01WithTail(vineyardPrestige);
    const vineyardPrestigeMultiplier = 1 + (normalizedVineyardPrestige * 0.25);
    estimatedPrice *= vineyardPrestigeMultiplier;
  }
  
  estimatedPrice = Math.min(estimatedPrice, SALES_CONSTANTS.MAX_PRICE);
  return Math.round(estimatedPrice * 100) / 100;
}


// TODO: Future implementations for when the game expands
// - getGrapeQualityPotential(): Different grape varieties with specific ranges
// - calculateVintageEffects(): Weather/year effects on grape quality
