// Central pricing service - combines vineyard value and wine quality to calculate final wine prices
import { WineBatch, Vineyard } from '../../types/types';
import { SALES_CONSTANTS } from '../../constants/constants';
import { calculateAsymmetricalMultiplier } from '../../utils/calculator';

/**
 * Calculate the final wine price combining vineyard value and wine quality
 * This is the primary pricing function used across the application
 * 
 * @param wineBatch - The wine batch to price
 * @param vineyard - The vineyard where the wine was produced
 * @returns Final price per bottle in euros
 */
export function calculateFinalWinePrice(wineBatch: WineBatch, _vineyard: Vineyard): number {
  // Use wine batch quality (vineyard factors) for pricing
  const qualityIndex = wineBatch.quality;
  
  // Calculate Base Price from Wine Quality
  const basePrice = qualityIndex * SALES_CONSTANTS.BASE_RATE_PER_BOTTLE;
  
  // Calculate Quality Multiplier from Quality Index
  const qualityMultiplier = calculateAsymmetricalMultiplier(qualityIndex);
  
  // Calculate Final Price and round to 2 decimal places
  let finalPrice = basePrice * qualityMultiplier;
  
  // Cap the price to prevent database overflow
  finalPrice = Math.min(finalPrice, SALES_CONSTANTS.MAX_PRICE);
  
  return Math.round(finalPrice * 100) / 100;
}
