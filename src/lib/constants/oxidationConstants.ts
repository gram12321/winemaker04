// Oxidation system constants
// Implements Approach 3: State-based multipliers + Compound effect

import { WineBatchState } from '../types/types';

/**
 * Base oxidation rate per game tick (week)
 * This is the baseline 2% rate from v1, applied before any multipliers
 */
export const BASE_OXIDATION_RATE = 0.02;

/**
 * State-based oxidation multipliers
 * Different processing stages have different oxidation risks
 * 
 * - grapes: 3.0x - Fresh grapes are highly exposed to air, oxidize rapidly
 * - must_ready: 1.5x - Must waiting to ferment has moderate risk
 * - must_fermenting: 0.8x - Active fermentation creates CO2 barrier (protective!)
 * - bottled: 0.3x - Sealed bottle greatly reduces oxidation
 */
export const OXIDATION_STATE_MULTIPLIERS: Record<WineBatchState, number> = {
  'grapes': 3.0,          // Highest risk - uncrushed grapes oxidize fast
  'must_ready': 1.5,      // Moderate risk - exposed must
  'must_fermenting': 0.8, // Protected by fermentation CO2
  'bottled': 0.3          // Lowest risk - sealed environment
};

/**
 * Compound effect: Current oxidation risk accelerates future risk
 * The oxidation value itself acts as the compound multiplier
 * 
 * Formula: rate × stateMultiplier × (1 + currentOxidation)
 * 
 * Examples:
 * - At 0% oxidation risk: no additional effect (1.0x)
 * - At 10% oxidation risk: grows 10% faster (1.10x)
 * - At 20% oxidation risk: grows 20% faster (1.20x)
 * - At 50% oxidation risk: grows 50% faster (1.50x)
 * 
 * This creates exponential risk growth until the oxidation event occurs
 */

/**
 * Notification thresholds for oxidation risk warnings
 * Players get notifications when oxidation RISK crosses these thresholds
 */
export const OXIDATION_WARNING_THRESHOLDS = {
  LOW: 0.05,      // 5% risk per week - First warning
  MODERATE: 0.10, // 10% risk per week - Moderate concern
  HIGH: 0.20,     // 20% risk per week - High risk
  CRITICAL: 0.40  // 40% risk per week - Critical risk, oxidation likely imminent
} as const;

/**
 * Get oxidation risk label for UI display
 * @param oxidationRisk - Current oxidation risk value (0-1)
 * @returns Risk label string
 */
export function getOxidationRiskLabel(oxidationRisk: number): string {
  if (oxidationRisk <= 0.05) return 'Minimal Risk';
  if (oxidationRisk <= 0.10) return 'Low Risk';
  if (oxidationRisk <= 0.20) return 'Moderate Risk';
  if (oxidationRisk <= 0.40) return 'High Risk';
  return 'Critical Risk';
}

