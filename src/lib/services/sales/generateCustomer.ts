// Customer acquisition service - handles company prestige-based customer generation
import { loadWineBatches, loadWineOrders } from '../../database/database';
import { getCurrentPrestige } from '../gameState';
import { PRESTIGE_ORDER_GENERATION } from '../../constants/constants';
import { getAvailableBottledWines } from '../../utils';

/**
 * Generate a customer based on company prestige
 * Uses sophisticated scaling based on company prestige with diminishing returns
 * 
 * Business Logic:
 * - Low prestige (0-100): Linear scaling from 5% to 15% chance
 * - Medium prestige (100-500): Logarithmic scaling from 15% to 35% chance with arctan
 * - High prestige (500+): Diminishing returns, approaches but never exceeds 35%
 * - Pending orders reduce chance to prevent spam
 * 
 * @param options - Configuration options for customer generation
 * @param options.dryRun - If true, returns chance info without rolling (for display purposes)
 * @returns Object with customer acquisition decision and detailed chance information
 */
export async function generateCustomer(options: { dryRun?: boolean } = {}): Promise<{
  customerAcquired: boolean;
  chanceInfo: {
    companyPrestige: number;
    availableWines: number;
    pendingOrders: number;
    baseChance: number;
    pendingPenalty: number;
    finalChance: number;
    randomRoll: number;
  };
}> {
  const { dryRun = false } = options;
  const currentPrestige = await getCurrentPrestige();
  
  // Check if we have bottled wines available
  const allBatches = await loadWineBatches();
  const bottledWines = getAvailableBottledWines(allBatches);
  
  if (bottledWines.length === 0) {
    return {
      customerAcquired: false,
      chanceInfo: {
        companyPrestige: currentPrestige,
        availableWines: 0,
        pendingOrders: 0,
        baseChance: 0,
        pendingPenalty: 1,
        finalChance: 0,
        randomRoll: 0
      }
    };
  }
  
  // Check pending orders count (load only pending orders for efficiency)
  const pendingOrders = await loadWineOrders('pending');
  const pendingCount = pendingOrders.length;
  
  // Calculate base chance from prestige
  let baseChance: number;
  
  if (currentPrestige <= PRESTIGE_ORDER_GENERATION.PRESTIGE_THRESHOLD) {
    // Linear scaling for low prestige (0-100)
    baseChance = PRESTIGE_ORDER_GENERATION.MIN_BASE_CHANCE + 
      (currentPrestige / PRESTIGE_ORDER_GENERATION.PRESTIGE_THRESHOLD) * 
      (PRESTIGE_ORDER_GENERATION.MID_PRESTIGE_CHANCE - PRESTIGE_ORDER_GENERATION.MIN_BASE_CHANCE);
  } else {
    // Logarithmic scaling with diminishing returns for high prestige (100+)
    const excessPrestige = currentPrestige - PRESTIGE_ORDER_GENERATION.PRESTIGE_THRESHOLD;
    const arcTanFactor = Math.atan(excessPrestige / PRESTIGE_ORDER_GENERATION.DIMINISHING_FACTOR) / Math.PI;
    
    baseChance = PRESTIGE_ORDER_GENERATION.MID_PRESTIGE_CHANCE + 
      arcTanFactor * (PRESTIGE_ORDER_GENERATION.MAX_BASE_CHANCE - PRESTIGE_ORDER_GENERATION.MID_PRESTIGE_CHANCE);
  }
  
  // Apply pending order penalty
  const pendingPenalty = Math.pow(PRESTIGE_ORDER_GENERATION.PENDING_ORDER_PENALTY, pendingCount);
  const finalChance = baseChance * pendingPenalty;
  
  // Only roll if not in dry run mode
  const randomRoll = dryRun ? 0 : Math.random();
  const shouldGenerate = dryRun ? false : (randomRoll < finalChance);
  
  return {
    customerAcquired: shouldGenerate,
    chanceInfo: {
      companyPrestige: currentPrestige,
      availableWines: bottledWines.length,
      pendingOrders: pendingCount,
      baseChance,
      pendingPenalty,
      finalChance,
      randomRoll
    }
  };
}
