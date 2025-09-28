import { WineCharacteristics } from '@/lib/types/types';
import { Rule, RuleConfig, CharacteristicKey } from '../types/balanceRulesTypes';
import { PenaltyScalingResult, SynergyReductionResult } from '../types/balanceCalculationsTypes';

/**
 * Calculator for both penalties and synergies using the same mathematical approach
 * @param characteristics - Current wine characteristics
 * @param baseRanges - Base balanced ranges for each characteristic
 * @param config - Rule configuration
 * @param dryRun - If true, returns detailed scaling matrix for UI display
 * @returns Object with penalty scaling and synergy reductions
 */
export function calculateRules(
  characteristics: WineCharacteristics,
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  config: RuleConfig,
  dryRun: boolean = false,
  returnDetailedBreakdown: boolean = false
): {
  penaltyScaling: Record<CharacteristicKey, number> | PenaltyScalingResult;
  synergyReductions: SynergyReductionResult;
  detailedBreakdown?: Record<string, any>;
  synergyBreakdown?: Record<string, any>;
} {
  // Initialize results
  const penaltyResults: Record<CharacteristicKey, number> = {
    acidity: 1,
    aroma: 1,
    body: 1,
    spice: 1,
    sweetness: 1,
    tannins: 1
  };

  const synergyResults: SynergyReductionResult = {
    acidity: 0,
    aroma: 0,
    body: 0,
    spice: 0,
    sweetness: 0,
    tannins: 0
  };

  const penaltyScaling: PenaltyScalingResult = {};
  const detailedBreakdown: Record<string, any> = {};
  const synergyBreakdown: Record<string, any> = {};

  /**
   * Calculate scaling for a rule
   * @param rule - The rule to process
   * @param isPenalty - Whether this is a penalty (true) or synergy (false)
   */
  function processRule(rule: Rule, isPenalty: boolean) {
    if (!rule.condition(characteristics)) return;

    // Calculate average deviation from midpoint for all source characteristics
    let totalDeviation = 0;
    let charCount = 0;

    rule.sources.forEach(sourceChar => {
      const charValue = characteristics[sourceChar];
      const [min, max] = baseRanges[sourceChar];
      const midpoint = (min + max) / 2;
      const halfWidth = Math.max(0.0001, (max - min) / 2);
      const normDiff = Math.abs((charValue - midpoint) / halfWidth);
      totalDeviation += normDiff;
      charCount++;
    });

    const avgDeviation = charCount > 0 ? totalDeviation / charCount : 0;

    // Mathematical scaling with configurable parameters
    const k = rule.k ?? 0.2; // Default scaling factor
    const p = rule.p ?? 1.2; // Default power factor
    const cap = rule.cap ?? (isPenalty ? 2.0 : 0.75); // Default cap (penalties vs synergies)
    
    const rawEffect = k * Math.pow(avgDeviation, p);
    const cappedEffect = Math.min(cap, rawEffect);

    // Store detailed breakdown if requested
    if (returnDetailedBreakdown) {
      const sourceKey = rule.sources.join('+');
      if (isPenalty) {
        detailedBreakdown[sourceKey] = {
          ruleName: rule.name,
          sources: rule.sources,
          targets: rule.targets,
          avgDeviation,
          k,
          p,
          cap,
          rawEffect,
          cappedEffect,
          hitsCap: rawEffect >= cap,
          penaltyPercentage: cappedEffect * 100
        };
      } else {
        synergyBreakdown[sourceKey] = {
          ruleName: rule.name,
          sources: rule.sources,
          targets: rule.targets,
          avgDeviation,
          k,
          p,
          cap,
          rawEffect,
          cappedEffect,
          hitsCap: rawEffect >= cap,
          synergyPercentage: cappedEffect * 100
        };
      }
    }

    // Apply to all target characteristics
    rule.targets.forEach(targetChar => {
      if (isPenalty) {
        // Penalties increase multipliers (1 + effect)
        const multiplier = 1 + cappedEffect;
        
        if (dryRun) {
          // For dry run, we need to track which source triggered this
          const sourceKey = rule.sources.join('+');
          if (!penaltyScaling[sourceKey]) {
            penaltyScaling[sourceKey] = {};
          }
          penaltyScaling[sourceKey][targetChar] = multiplier;
        } else {
          penaltyResults[targetChar] = Math.max(penaltyResults[targetChar], multiplier);
        }
      } else {
        // Synergies reduce penalties (effect is the reduction factor)
        synergyResults[targetChar] = Math.max(synergyResults[targetChar], cappedEffect);
      }
    });
  }

  // Process all penalty rules
  config.penalties.forEach(rule => processRule(rule, true));

  // Process all synergy rules
  config.synergies.forEach(rule => processRule(rule, false));

  return {
    penaltyScaling: dryRun ? penaltyScaling : penaltyResults,
    synergyReductions: synergyResults,
    ...(returnDetailedBreakdown && { detailedBreakdown, synergyBreakdown })
  };
}


