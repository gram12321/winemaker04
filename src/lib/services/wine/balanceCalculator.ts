// Phase 1 Balance Calculator - Simple balance calculation with static ranges
import { WineCharacteristics, BalanceResult, GrapeVariety } from '../../types';
import { BASE_BALANCED_RANGES, BASE_GRAPE_CHARACTERISTICS } from '../../constants/constants';

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

// Removed calculateWineBatchBalance - it was just a wrapper function

/**
 * Generate default wine characteristics for a grape variety
 * Phase 1: Use grape-specific base characteristics
 * @param grape - Grape variety
 * @returns WineCharacteristics with grape-specific values
 */
export function generateDefaultCharacteristics(grape: GrapeVariety): WineCharacteristics {
  // Get grape-specific characteristics or fallback to balanced midpoint
  const grapeCharacteristics = BASE_GRAPE_CHARACTERISTICS[grape];
  
  if (grapeCharacteristics) {
    return { ...grapeCharacteristics };
  }
  
  // Fallback to balanced midpoint if grape not found
  return {
    acidity: 0.5,
    aroma: 0.5,
    body: 0.5,
    spice: 0.5,
    sweetness: 0.5,
    tannins: 0.5
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
