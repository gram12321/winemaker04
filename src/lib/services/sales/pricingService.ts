import { WineBatch, Vineyard } from '../../types/types';
import { SALES_CONSTANTS } from '../../constants/constants';
import { calculateAsymmetricalMultiplier } from '../../utils/calculator';
import { calculateWineCombinedScore } from '../wine/wineCombinedScoreCalculationService';

export function calculateFinalWinePrice(wineBatch: WineBatch, _vineyard: Vineyard): number {
  const combinedScore = calculateWineCombinedScore(wineBatch);
  const basePrice = combinedScore * SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  const multiplier = calculateAsymmetricalMultiplier(combinedScore);
  let estimatedPrice = basePrice * multiplier; // estimated price before user overrides (asking price may differ)
  
  // Cap the price to prevent database overflow
  estimatedPrice = Math.min(estimatedPrice, SALES_CONSTANTS.MAX_PRICE);
  return Math.round(estimatedPrice * 100) / 100;
}
