// Customer acquisition service - handles company prestige-based customer generation
import { loadWineBatches } from '../../database/activities/inventoryDB';
import { loadWineOrders } from '../../database/customers/salesDB';
import { getCurrentPrestige, getGameState } from '../core/gameState';
import { PRESTIGE_ORDER_GENERATION } from '../../constants/constants';
import { NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { ECONOMY_SALES_MULTIPLIERS } from '../../constants/economyConstants';
import { EconomyPhase } from '../../types/types';

/**
 * Generate a customer based on company prestige
 * Uses normalized prestige scaling for consistent behavior across the app
 * 
 * Business Logic:
 * - Uses NormalizeScrewed1000To01WithTail for consistent prestige scaling
 * - Maps normalized prestige (0-1) to chance range (5%-35%)
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
    economyPhase: EconomyPhase;
    economyFrequencyMultiplier: number;
  };
}> {
  const { dryRun = false } = options;
  const currentPrestige = await getCurrentPrestige();
  
  // Check if we have bottled wines available
  const allBatches = await loadWineBatches();
  const bottledWines = allBatches.filter(batch => batch.state === 'bottled' && batch.quantity > 0);
  
  if (bottledWines.length === 0) {
    const gameState = getGameState();
    const economyPhase = (gameState.economyPhase || 'Stable') as EconomyPhase;
    const frequencyMultiplier = ECONOMY_SALES_MULTIPLIERS[economyPhase].frequencyMultiplier;

    return {
      customerAcquired: false,
      chanceInfo: {
        companyPrestige: currentPrestige,
        availableWines: 0,
        pendingOrders: 0,
        baseChance: 0,
        pendingPenalty: 1,
        finalChance: 0,
        randomRoll: 0,
        economyPhase,
        economyFrequencyMultiplier: frequencyMultiplier
      }
    };
  }
  
  // Check pending orders count (load only pending orders for efficiency)
  const pendingOrders = await loadWineOrders('pending');
  const pendingCount = pendingOrders.length;
  
  // Calculate base chance from normalized prestige
  // Use consistent normalization function for prestige scaling
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(currentPrestige);
  
  // Map normalized prestige (0-1) to chance range (5%-35%)
  // This creates a smooth curve from low to high prestige
  const baseChance = PRESTIGE_ORDER_GENERATION.MIN_BASE_CHANCE + 
    normalizedPrestige * (PRESTIGE_ORDER_GENERATION.MAX_BASE_CHANCE - PRESTIGE_ORDER_GENERATION.MIN_BASE_CHANCE);
  
  // Apply pending order penalty
  const pendingPenalty = Math.pow(PRESTIGE_ORDER_GENERATION.PENDING_ORDER_PENALTY, pendingCount);
  // Apply economy phase frequency multiplier
  const gameState = getGameState();
  const economyPhase = (gameState.economyPhase || 'Stable') as EconomyPhase;
  const frequencyMultiplier = ECONOMY_SALES_MULTIPLIERS[economyPhase].frequencyMultiplier;
  const finalChance = baseChance * pendingPenalty * frequencyMultiplier;
  
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
      randomRoll,
      economyPhase,
      economyFrequencyMultiplier: frequencyMultiplier
    }
  };
}
