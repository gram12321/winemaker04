// Phase 1 Balance Calculator - Simple balance calculation with static ranges
import { WineCharacteristics, BalanceResult, WineBatch } from '../types';

// Base balanced ranges for all characteristics (Phase 1: Static values)
export const BASE_BALANCED_RANGES: Record<keyof WineCharacteristics, [number, number]> = {
  acidity: [0.4, 0.6],
  aroma: [0.4, 0.6], 
  body: [0.4, 0.6],
  spice: [0.4, 0.6],
  sweetness: [0.4, 0.6],
  tannins: [0.4, 0.6]
};

/**
 * Calculate wine balance score using Phase 1 simple algorithm
 * @param characteristics - Wine characteristics object
 * @returns BalanceResult with score and placeholder data
 */
export function calculateWineBalance(characteristics: WineCharacteristics): BalanceResult {
  let totalDeduction = 0;
  const characteristicCount = Object.keys(characteristics).length;

  // Calculate deductions from ideal midpoint (0.5)
  for (const [key, value] of Object.entries(characteristics)) {
    const charKey = key as keyof WineCharacteristics;
    const [min, max] = BASE_BALANCED_RANGES[charKey];
    const midpoint = (min + max) / 2; // 0.5 for all characteristics in Phase 1
    
    // Calculate distance from midpoint
    const distance = Math.abs(value - midpoint);
    
    // Apply penalty for being outside the balanced range
    let penalty = 0;
    if (value < min || value > max) {
      // Out of range penalty
      const outsideDistance = value < min ? min - value : value - max;
      penalty = distance + (outsideDistance * 2); // Double penalty for being outside range
    } else {
      // In range penalty (distance from midpoint)
      penalty = distance;
    }
    
    totalDeduction += penalty;
  }

  // Calculate balance score (1 = perfect, 0 = terrible)
  const averageDeduction = totalDeduction / characteristicCount;
  const balanceScore = Math.max(0, 1 - (averageDeduction * 2)); // Scale deduction

  return {
    score: balanceScore,
    qualifies: false, // Phase 1: No archetype matching
    dynamicRanges: BASE_BALANCED_RANGES // Phase 1: Static ranges
  };
}

/**
 * Calculate balance for a wine batch
 * @param wineBatch - Wine batch to calculate balance for
 * @returns BalanceResult
 */
export function calculateWineBatchBalance(wineBatch: WineBatch): BalanceResult {
  return calculateWineBalance(wineBatch.characteristics);
}

/**
 * Generate default wine characteristics for a grape variety
 * Phase 1: Use flat values with slight variation
 * @param grape - Grape variety
 * @returns WineCharacteristics with default values
 */
export function generateDefaultCharacteristics(_grape: string): WineCharacteristics {
  // Phase 1: Simple generation with slight random variation
  const baseValue = 0.5; // Midpoint of balanced range
  const variation = 0.1; // Small random variation
  
  return {
    acidity: Math.max(0, Math.min(1, baseValue + (Math.random() - 0.5) * variation)),
    aroma: Math.max(0, Math.min(1, baseValue + (Math.random() - 0.5) * variation)),
    body: Math.max(0, Math.min(1, baseValue + (Math.random() - 0.5) * variation)),
    spice: Math.max(0, Math.min(1, baseValue + (Math.random() - 0.5) * variation)),
    sweetness: Math.max(0, Math.min(1, baseValue + (Math.random() - 0.5) * variation)),
    tannins: Math.max(0, Math.min(1, baseValue + (Math.random() - 0.5) * variation))
  };
}

// Placeholder functions for future phases
export function getArchetypeMatches(_characteristics: WineCharacteristics): any[] {
  return []; // Phase 1: No archetype matching
}

export function getRegionalModifiers(_region: string): Record<string, number> {
  return {}; // Phase 1: No regional modifiers
}

export function getSynergyBonuses(_characteristics: WineCharacteristics): number {
  return 0; // Phase 1: No synergy bonuses
}
