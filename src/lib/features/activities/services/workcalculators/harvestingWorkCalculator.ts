import { Vineyard, GrapeVariety, WorkCategory } from '@/lib/types/types';
import { WorkFactor } from './workCalculator';
import { HARVEST_YIELD_RATE, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/features/activities/constants/activityConstants';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { calculateVineyardYield } from '@/lib/services';
import { calculateOvergrowthModifier, combineOvergrowthYears } from './overgrowthUtils';
import { getGrapeFragilityModifier, getVineyardAltitudeModifier, getVineyardSoilModifier } from './vineyardWorkModifiers';

/**
 * Calculate work required for harvesting vineyards
 */
export function calculateHarvestWork(
  vineyard: Vineyard
): { totalWork: number; expectedYield: number; factors: WorkFactor[] } {
  const expectedYield = calculateVineyardYield(vineyard);
  const grape = vineyard.grape as GrapeVariety; // ensured by caller
  const fragilityModifier = getGrapeFragilityModifier(grape);
  const altitudeModifier = getVineyardAltitudeModifier(vineyard);
  const soilModifier = getVineyardSoilModifier(vineyard.soil);

  // Overgrowth penalty for harvest: vegetation + debris only (weighted)
  const overgrowth = vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 };
  const combinedYears = combineOvergrowthYears(overgrowth, ['vegetation', 'debris'], { vegetation: 1, debris: 0.5 });
  const overgrowthPenalty = Math.min(0.6, calculateOvergrowthModifier(combinedYears, 0.10, 0.5, 2.0));

  const category = WorkCategory.HARVESTING;
  const yieldRate = HARVEST_YIELD_RATE;
  const initialWork = INITIAL_WORK[category];

  // Calculate work units based on yield
  const workWeeks = expectedYield / yieldRate;
  const workUnits = workWeeks * BASE_WORK_UNITS;
  const baseWork = Math.ceil(workUnits);
  
  // Add initial work and apply modifiers
  const workWithInitial = baseWork + initialWork;
  const totalWork = [fragilityModifier, altitudeModifier, soilModifier, overgrowthPenalty].reduce((work, modifier) => 
    work * (1 + modifier), workWithInitial);

  const factors: WorkFactor[] = [
    { label: 'Expected Yield', value: expectedYield, unit: 'kg', isPrimary: true },
    { label: 'Vineyard Area', value: vineyard.hectares, unit: 'hectares', isPrimary: true },
    { label: 'Vine Density', value: vineyard.density > 0 ? vineyard.density : 'Not set', unit: vineyard.density > 0 ? 'vines/ha' : '', isPrimary: true },
    { label: 'Harvest Rate', value: yieldRate, unit: 'kg/week' },
    { label: 'Base Harvest Work', value: baseWork, unit: 'work units' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' },
  ];

  if (fragilityModifier > 0) {
    factors.push({ label: 'Grape Fragility Impact', value: `${Math.round((GRAPE_CONST[grape]?.fragile ?? 0) * 100)}% fragile`, modifier: fragilityModifier, modifierLabel: 'delicate grape handling' });
  }
  if (altitudeModifier > 0) {
    factors.push({ label: 'Altitude Impact', value: 'Difficult conditions', modifier: altitudeModifier, modifierLabel: 'harvest difficulty' });
  }
  factors.push({ label: 'Soil Type', value: vineyard.soil.join(', '), modifier: soilModifier, modifierLabel: 'soil difficulty' });

  if (overgrowth.vegetation > 0 || overgrowth.debris > 0) {
    factors.push({
      label: 'Harvest Overgrowth Penalty',
      value: `${combinedYears.toFixed(1)} years (veg+debris)`,
      modifier: overgrowthPenalty,
      modifierLabel: 'overgrowth effect'
    });
  }

  return { totalWork, expectedYield, factors };
}
