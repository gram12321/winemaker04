import { WineCharacteristics } from '@/lib/types/types';
import { RangeAdjustmentConfig, Direction } from '../types/balanceRulesTypes';

/**
 * Apply dynamic range adjustments based on wine characteristics
 * @param characteristics - Current wine characteristics
 * @param baseRanges - Base balanced ranges for each characteristic
 * @param config - Range adjustment configuration
 * @returns Adjusted ranges for each characteristic
 */
export function applyDynamicRangeAdjustments(
  characteristics: WineCharacteristics,
  baseRanges: Record<keyof WineCharacteristics, readonly [number, number]>,
  config: RangeAdjustmentConfig
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

  for (const [source, value] of Object.entries(characteristics)) {
    const sourceKey = source as keyof WineCharacteristics;
    const sourceConfig = config[source];
    if (!sourceConfig) continue;

    const [min, max] = baseRanges[sourceKey];
    const midpoint = (min + max) / 2;
    const fullRange = Math.max(0.0001, max - min);
    const deviationPct = (value - midpoint) / fullRange; // -0.5..+0.5 within range
    
    if (Math.abs(deviationPct) < 1e-6) continue;

    const direction: Direction = deviationPct > 0 ? 'above' : 'below';
    const directionConfig = sourceConfig[direction];
    if (!directionConfig?.rangeShifts) continue;

    for (const rule of directionConfig.rangeShifts) {
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
