// Phase 1 Balance Calculator - Simple balance calculation with static ranges
import { WineCharacteristics, BalanceResult, GrapeVariety } from '../../types/types';
import { BASE_BALANCED_RANGES, GRAPE_CONST } from '../../constants/grapeConstants';
import { DYNAMIC_ADJUSTMENTS, DynamicAdjustmentsConfig, CharacteristicKey, SYNERGY_RULES } from '../../constants/balanceAdjustments';

/**
 * Calculate wine balance score using Phase 1 simple algorithm
 * @param characteristics - Wine characteristics object
 * @returns BalanceResult with score and placeholder data
 */
export function calculateWineBalance(characteristics: WineCharacteristics): BalanceResult {
  // 1) Derive adjusted ranges using config-driven shifts
  const adjustedRanges = applyDynamicRangeAdjustments(characteristics, BASE_BALANCED_RANGES, DYNAMIC_ADJUSTMENTS);

  // 2) Build cross-trait penalty scale multipliers from deviations
  const penaltyScales = buildPenaltyScaleMap(characteristics, BASE_BALANCED_RANGES, DYNAMIC_ADJUSTMENTS);

  // 3) Calculate synergy reductions for each characteristic
  const synergyReductions = getSynergyReductions(characteristics);

  // 4) Compute deductions per characteristic (plain average)
  let totalDeduction = 0;
  let count = 0;

  for (const [key, value] of Object.entries(characteristics)) {
    const charKey = key as keyof WineCharacteristics;
    const [min, max] = adjustedRanges[charKey];
    const midpoint = (min + max) / 2;

    // New terminology:
    // DistanceInside: always the absolute distance to midpoint
    const distanceInside = Math.abs(value - midpoint);
    // DistanceOutside: zero when within range; otherwise distance beyond nearest bound
    const distanceOutside = (value < min) ? (min - value) : (value > max ? (value - max) : 0);
    // Penalty: 2 × DistanceOutside
    const penalty = 2 * distanceOutside;
    // TotalDistance: DistanceInside + Penalty
    let totalDistance = distanceInside + penalty;

    // Apply cross-trait scaling to TotalDistance
    const scale = penaltyScales[charKey as CharacteristicKey] ?? 1;
    totalDistance *= scale;

    // Apply synergy reduction to TotalDistance (only for involved characteristics)
    const synergyReduction = synergyReductions[charKey];
    if (synergyReduction > 0) {
      totalDistance *= (1 - synergyReduction); // Reduce penalty by synergy factor
    }

    totalDeduction += totalDistance;
    count += 1;
  }

  const averageDeduction = count > 0 ? (totalDeduction / count) : 0;

  // 5) Map to score
  const balanceScore = Math.max(0, 1 - (averageDeduction * 2));

  return {
    score: balanceScore,
    qualifies: false,
    dynamicRanges: adjustedRanges
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

/**
 * Calculate synergy reductions for specific characteristics
 * @param characteristics - Wine characteristics object
 * @returns Object mapping characteristic keys to their synergy reduction factors
 */
export function getSynergyReductions(characteristics: WineCharacteristics): Record<CharacteristicKey, number> {
  const reductions: Record<CharacteristicKey, number> = {
    acidity: 0,
    aroma: 0,
    body: 0,
    spice: 0,
    sweetness: 0,
    tannins: 0
  };

  // Apply each synergy rule
  for (const rule of SYNERGY_RULES) {
    if (rule.condition(characteristics)) {
      const reduction = rule.reduction(characteristics);
      
      // Apply reduction to all characteristics involved in this synergy
      for (const char of rule.characteristics) {
        reductions[char] = Math.max(reductions[char], reduction); // Take the highest reduction
      }
    }
  }

  return reductions;
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
    const fullRange = Math.max(0.0001, max - min);
    const deviationPct = (v - midpoint) / fullRange; // -0.5..+0.5 within range
    if (Math.abs(deviationPct) < 1e-6) continue;

    const direction = deviationPct > 0 ? 'above' : 'below';
    const rules = cfg[direction];
    if (!rules || !rules.rangeShifts) continue;

    for (const rule of rules.rangeShifts) {
      const target = rule.target;
      const [tmin, tmax] = adjusted[target];
      const targetWidth = Math.max(0.0001, tmax - tmin);
      const delta = rule.shiftPerUnit * deviationPct * targetWidth;
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

// Build per-target penalty scale multipliers from current deviations
function buildPenaltyScaleMap(
  characteristics: WineCharacteristics,
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  config: DynamicAdjustmentsConfig
): Record<CharacteristicKey, number> {
  const result: Record<CharacteristicKey, number> = {
    acidity: 1,
    aroma: 1,
    body: 1,
    spice: 1,
    sweetness: 1,
    tannins: 1
  };

  for (const [k, v] of Object.entries(characteristics)) {
    const source = k as keyof WineCharacteristics;
    const rulesByDir = config[source];
    if (!rulesByDir) continue;

    const [min, max] = baseRanges[source];
    const midpoint = (min + max) / 2;
    const halfWidth = (max - min) / 2 || 0.0001;
    const normDiff = (v - midpoint) / halfWidth;
    if (Math.abs(normDiff) < 1e-6) continue;

    const direction = normDiff > 0 ? 'above' : 'below';
    const set = rulesByDir[direction];
    const penaltyRules = set?.penaltyScales;
    if (!penaltyRules || penaltyRules.length === 0) continue;

    for (const rule of penaltyRules) {
      const p = rule.p ?? 1;
      const raw = 1 + (rule.k * Math.pow(Math.abs(normDiff), p));
      let scaled = raw;
      if (rule.cap) {
        scaled = Math.max(rule.cap[0], Math.min(rule.cap[1], scaled));
      }
      const target = rule.target as CharacteristicKey;
      result[target] = (result[target] ?? 1) * scaled;
    }
  }

  return result;
}

// (Synergy intentionally omitted per current design)
