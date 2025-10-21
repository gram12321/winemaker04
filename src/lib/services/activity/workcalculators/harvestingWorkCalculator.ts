import { Vineyard, GrapeVariety } from '@/lib/types/types';
import { WorkFactor } from './workCalculator';
import { HARVEST_YIELD_RATE, INITIAL_WORK, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/services/activity';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { getAltitudeRating, calculateVineyardYield } from '@/lib/services';
import { SOIL_DIFFICULTY_MODIFIERS } from '@/lib/constants/vineyardConstants';
import { calculateOvergrowthModifier, combineOvergrowthYears } from './overgrowthUtils';

/**
 * Calculate work required for harvesting vineyards
 */
export function calculateHarvestWork(
  vineyard: Vineyard
): { totalWork: number; expectedYield: number; factors: WorkFactor[] } {
  const expectedYield = calculateVineyardYield(vineyard);
  const grape = vineyard.grape as GrapeVariety; // ensured by caller
  const fragilityModifier = getFragilityModifier(grape);
  const altitudeModifier = getAltitudeModifier(vineyard);
  const soilModifier = getSoilTypeModifier(vineyard.soil);

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
  if (Math.abs(soilModifier) >= 0) { // Show all soil modifiers (including 0%)
    factors.push({ label: 'Soil Type', value: vineyard.soil.join(', '), modifier: soilModifier, modifierLabel: 'soil difficulty' });
  }

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

/**
 * Get fragility modifier for grape variety
 */
function getFragilityModifier(grape: GrapeVariety): number {
  const meta = GRAPE_CONST[grape];
  return meta?.fragile ?? 0; // 0..1, higher means more work
}

/**
 * Get altitude modifier for vineyard
 */
function getAltitudeModifier(vineyard: Vineyard): number {
  // Higher altitude rating should increase work (penalty up to +100%)
  const rating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
  return rating; // 0..1
}

/**
 * Get soil type modifier for vineyard
 */
function getSoilTypeModifier(soil: string[]): number {
  let totalModifier = 0;
  let validSoils = 0;
  
  soil.forEach(soilType => {
    const modifier = SOIL_DIFFICULTY_MODIFIERS[soilType as keyof typeof SOIL_DIFFICULTY_MODIFIERS];
    if (modifier !== undefined) {
      totalModifier += modifier;
      validSoils++;
    }
  });
  
  // Average the modifiers if multiple soil types
  return validSoils > 0 ? totalModifier / validSoils : 0;
}
