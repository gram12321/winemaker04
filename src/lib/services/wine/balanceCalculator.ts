// Phase 1 Balance Calculator - Simple balance calculation with static ranges
import { WineCharacteristics, BalanceResult, GrapeVariety } from '../../types/types';
import { BASE_BALANCED_RANGES, GRAPE_CONST } from '../../constants/grapeConstants';
import { DYNAMIC_ADJUSTMENTS, DynamicAdjustmentsConfig } from '../../constants/balanceAdjustments';

/**
 * Calculate wine balance score using Phase 1 simple algorithm
 * @param characteristics - Wine characteristics object
 * @returns BalanceResult with score and placeholder data
 */
export function calculateWineBalance(characteristics: WineCharacteristics): BalanceResult {
  let totalDeduction = 0;
  const characteristicCount = Object.keys(characteristics).length;

  // Derive adjusted ranges using config-driven shifts (no cross-trait penalties yet)
  const adjustedRanges = applyDynamicRangeAdjustments(characteristics, BASE_BALANCED_RANGES, DYNAMIC_ADJUSTMENTS);

  // Calculate deductions from ideal midpoint (using adjusted ranges)
  for (const [key, value] of Object.entries(characteristics)) {
    const charKey = key as keyof WineCharacteristics;
    const [min, max] = adjustedRanges[charKey];
    const midpoint = (min + max) / 2; 
    
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
    dynamicRanges: adjustedRanges // Expose adjusted ranges for UI/analysis
  };
}


/**
 * Generate default wine characteristics for a grape variety
 * Phase 1: Use grape-specific base characteristics
 * @param grape - Grape variety
 * @returns WineCharacteristics with grape-specific values
 */
export function generateDefaultCharacteristics(grape: GrapeVariety): WineCharacteristics {
  // Get grape-specific characteristics or fallback to balanced midpoint
  const grapeMetadata = GRAPE_CONST[grape];
  
  if (grapeMetadata) {
    return { ...grapeMetadata.baseCharacteristics };
  }
  
  // Fallback to balanced midpoint if grape not found
  return {
    acidity: (BASE_BALANCED_RANGES.acidity[0] + BASE_BALANCED_RANGES.acidity[1]) / 2,
    aroma: (BASE_BALANCED_RANGES.aroma[0] + BASE_BALANCED_RANGES.aroma[1]) / 2,
    body: (BASE_BALANCED_RANGES.body[0] + BASE_BALANCED_RANGES.body[1]) / 2,
    spice: (BASE_BALANCED_RANGES.spice[0] + BASE_BALANCED_RANGES.spice[1]) / 2,
    sweetness: (BASE_BALANCED_RANGES.sweetness[0] + BASE_BALANCED_RANGES.sweetness[1]) / 2,
    tannins: (BASE_BALANCED_RANGES.tannins[0] + BASE_BALANCED_RANGES.tannins[1]) / 2
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

// ===== Dynamic range adjustment helper (config-driven) =====
// Applies only range shifts. Cross-trait penalty scaling is NOT applied yet.
function applyDynamicRangeAdjustments(
  characteristics: WineCharacteristics,
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  config: DynamicAdjustmentsConfig
): Record<keyof WineCharacteristics, [number, number]> {
  const adjusted: Record<keyof WineCharacteristics, [number, number]> = {
    acidity: [...baseRanges.acidity] as [number, number],
    aroma: [...baseRanges.aroma] as [number, number],
    body: [...baseRanges.body] as [number, number],
    spice: [...baseRanges.spice] as [number, number],
    sweetness: [...baseRanges.sweetness] as [number, number],
    tannins: [...baseRanges.tannins] as [number, number]
  };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  for (const [k, v] of Object.entries(characteristics)) {
    const source = k as keyof WineCharacteristics;
    const cfg = config[source];
    if (!cfg) continue;

    const [min, max] = baseRanges[source];
    const midpoint = (min + max) / 2;
    const halfWidth = (max - min) / 2 || 0.0001; // avoid division by zero
    const normDiff = (v - midpoint) / halfWidth;
    if (Math.abs(normDiff) < 1e-6) continue;

    const direction = normDiff > 0 ? 'above' : 'below';
    const rules = cfg[direction];
    if (!rules || !rules.rangeShifts) continue;

    for (const rule of rules.rangeShifts) {
      const target = rule.target;
      const [tmin, tmax] = adjusted[target];
      const targetWidth = Math.max(0.0001, tmax - tmin);
      const delta = rule.shiftPerUnit * normDiff * targetWidth;
      let newMin = tmin + delta;
      let newMax = tmax + delta;

      if (rule.clamp) {
        newMin = Math.max(rule.clamp[0], newMin);
        newMax = Math.min(rule.clamp[1], newMax);
      }

      newMin = clamp01(newMin);
      newMax = clamp01(newMax);
      if (newMax - newMin < 0.02) {
        const center = (newMin + newMax) / 2;
        newMin = clamp01(center - 0.01);
        newMax = clamp01(center + 0.01);
      }

      adjusted[target] = [newMin, newMax];
    }
  }

  return adjusted;
}
