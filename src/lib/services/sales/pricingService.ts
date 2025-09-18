// Central pricing service - combines vineyard value and wine quality to calculate final wine prices
import { WineBatch, Vineyard } from '../../types';
import { SALES_CONSTANTS } from '../../constants/constants';
import { calculateAsymmetricalMultiplier } from '../../utils/calculator';
import { calculateWineValueIndex } from './wineValueIndexCalculationService';
import { calculateWineQuality } from './wineQualityIndexCalculationService';

/**
 * Calculate the final wine price combining vineyard value and wine quality
 * This is the primary pricing function used across the application
 * 
 * @param wineBatch - The wine batch to price
 * @param vineyard - The vineyard where the wine was produced
 * @returns Final price per bottle in euros
 */
export function calculateFinalWinePrice(wineBatch: WineBatch, vineyard: Vineyard): number {
  // Calculate Wine Value Index (0-1 scale) - vineyard prestige/land value
  const wineValueIndex = calculateWineValueIndex(vineyard);
  
  // Calculate Quality Index (0-1 scale) - wine quality/balance
  const qualityIndex = calculateWineQuality(wineBatch);
  
  // Calculate Base Price from Wine Value Index
  const basePrice = wineValueIndex * SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  
  // Calculate Quality Multiplier from Quality Index
  const qualityMultiplier = calculateAsymmetricalMultiplier(qualityIndex);
  
  // Calculate Final Price and round to 2 decimal places
  const finalPrice = basePrice * qualityMultiplier;
  return Math.round(finalPrice * 100) / 100;
}
