import { WineCharacteristics } from '@/lib/types/types';
import { BalanceCalculationResult, CharacteristicCalculation } from '../types/balanceCalculationsTypes';
import { CharacteristicKey, RuleConfig } from '../types/balanceRulesTypes';
import { applyDynamicRangeAdjustments } from './rangeCalculator';
import { calculateRules } from './ruleCalculator';
import { RULES } from '../config/rules';

/**
 * Calculate wine balance score using the rule algorithm
 * @param characteristics - Wine characteristics object
 * @param baseRanges - Base balanced ranges for each characteristic
 * @param rangeConfig - Range adjustment configuration (optional, defaults to empty)
 * @param ruleConfig - Rule configuration (optional, defaults to RULES)
 * @returns Complete balance calculation result
 */
export function calculateWineBalance(
  characteristics: WineCharacteristics,
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  rangeConfig: any = {},
  ruleConfig: RuleConfig = RULES
): BalanceCalculationResult {
  // 1) Derive adjusted ranges using config-driven shifts
  const adjustedRanges = applyDynamicRangeAdjustments(characteristics, baseRanges, rangeConfig);

  // 2) Calculate penalty scaling and synergy reductions
  const { penaltyScaling, synergyReductions } = calculateRules(
    characteristics, 
    baseRanges, 
    ruleConfig, 
    false
  );

  // 3) Compute deductions per characteristic (plain average)
  let totalDeduction = 0;
  let count = 0;

  for (const [key, value] of Object.entries(characteristics)) {
    const charKey = key as keyof WineCharacteristics;
    const [min, max] = adjustedRanges[charKey];
    const midpoint = (min + max) / 2;

    // Calculate components
    const distanceInside = Math.abs(value - midpoint);
    const distanceOutside = (value < min) ? (min - value) : (value > max ? (value - max) : 0);
    const penalty = 2 * distanceOutside;
    let totalDistance = distanceInside + penalty;

    // Apply penalty scaling to TotalDistance
    const scale = (penaltyScaling as Record<CharacteristicKey, number>)[charKey as CharacteristicKey] ?? 1;
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
    adjustedRanges: adjustedRanges
  };
}

/**
 * Calculate detailed breakdown for each characteristic using rule system
 * @param characteristics - Wine characteristics object
 * @param baseRanges - Base balanced ranges for each characteristic
 * @param rangeConfig - Range adjustment configuration (optional, defaults to empty)
 * @param ruleConfig - Rule configuration (optional, defaults to RULES)
 * @returns Detailed calculation breakdown for each characteristic
 */
export function calculateCharacteristicBreakdown(
  characteristics: WineCharacteristics,
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  rangeConfig: any = {},
  ruleConfig: RuleConfig = RULES
): Record<keyof WineCharacteristics, CharacteristicCalculation> {
  const adjustedRanges = applyDynamicRangeAdjustments(characteristics, baseRanges, rangeConfig);
  
  // Get penalty scaling and synergy reductions
  const { penaltyScaling: penaltyScalingResult, synergyReductions } = calculateRules(
    characteristics, 
    baseRanges, 
    ruleConfig, 
    true
  );

  const breakdown: Record<keyof WineCharacteristics, CharacteristicCalculation> = {} as any;

  for (const [key, value] of Object.entries(characteristics)) {
    const charKey = key as keyof WineCharacteristics;
    const [min, max] = adjustedRanges[charKey];
    const midpoint = (min + max) / 2;

    // Calculate components
    const distanceInside = Math.abs(value - midpoint);
    const distanceOutside = (value < min) ? (min - value) : (value > max ? (value - max) : 0);
    const penalty = 2 * distanceOutside;
    const baseTotalDistance = distanceInside + penalty;

    // Apply penalty scaling from all sources
    let totalScalingMultiplier = 1;
    if (typeof penaltyScalingResult === 'object' && penaltyScalingResult !== null) {
      // Dry run returns detailed breakdown
      for (const [, targets] of Object.entries(penaltyScalingResult as Record<string, Record<string, number>>)) {
        if (targets && targets[key] !== undefined) {
          totalScalingMultiplier *= targets[key];
        }
      }
    }
    let finalTotalDistance = baseTotalDistance * totalScalingMultiplier;

    // Apply synergy reduction
    const synergyReduction = synergyReductions[charKey];
    if (synergyReduction > 0) {
      finalTotalDistance *= (1 - synergyReduction);
    }

    breakdown[charKey] = {
      distanceInside,
      distanceOutside,
      penalty,
      baseTotalDistance,
      totalScalingMultiplier,
      finalTotalDistance,
      synergyReduction
    };
  }

  return breakdown;
}
