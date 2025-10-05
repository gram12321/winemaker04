import { Vineyard, GrapeVariety } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from '@/lib/services/activity/workcalculators/workCalculator';
import { TASK_RATES, HARVEST_YIELD_RATE, INITIAL_WORK, DENSITY_BASED_TASKS, BASE_WORK_UNITS } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/services/activity';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { getAltitudeRating } from '@/lib/services/vineyard/vineyardValueCalc';
import { calculateVineyardYield } from '@/lib/services/vineyard/vineyardManager';

/**
 * Vineyard Work Calculator
 * Calculates work required for vineyard activities (planting, harvesting)
 */

export function getFragilityModifier(grape: GrapeVariety): number {
  const meta = GRAPE_CONST[grape];
  return meta?.fragile ?? 0; // 0..1, higher means more work
}

export function getAltitudeModifier(vineyard: Vineyard): number {
  // Higher altitude rating should increase work (penalty up to +100%)
  const rating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
  return rating; // 0..1
}

export function calculatePlantingWork(
  vineyard: Vineyard,
  params: { grape: GrapeVariety; density: number }
): { totalWork: number; factors: WorkFactor[] } {
  const fragilityModifier = getFragilityModifier(params.grape);
  const altitudeModifier = getAltitudeModifier(vineyard);

  const category = WorkCategory.PLANTING;
  const rate = TASK_RATES[category];
  const initialWork = INITIAL_WORK[category];

  const totalWork = calculateTotalWork(vineyard.hectares, {
    rate,
    initialWork,
    density: params.density > 0 ? params.density : undefined,
    useDensityAdjustment: DENSITY_BASED_TASKS.includes(category),
    workModifiers: [fragilityModifier, altitudeModifier]
  });

  const factors: WorkFactor[] = [
    { label: 'Area to Plant', value: vineyard.hectares, unit: 'hectares', isPrimary: true },
    { label: 'Vine Density', value: params.density > 0 ? params.density : 'Not set', unit: params.density > 0 ? 'vines/ha' : '', isPrimary: true },
    { label: 'Base Rate', value: rate, unit: 'ha/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];

  if (fragilityModifier > 0) {
    const fragile = GRAPE_CONST[params.grape]?.fragile ?? 0;
    factors.push({ label: 'Grape Fragility Impact', value: `${Math.round(fragile * 100)}% fragile`, modifier: fragilityModifier, modifierLabel: 'grape fragility' });
  }
  if (altitudeModifier > 0) {
    factors.push({ label: 'Altitude Impact', value: 'Difficult conditions', modifier: altitudeModifier, modifierLabel: 'planting difficulty' });
  }

  return { totalWork, factors };
}

export function calculateHarvestWork(
  vineyard: Vineyard
): { totalWork: number; expectedYield: number; factors: WorkFactor[] } {
  const expectedYield = calculateVineyardYield(vineyard);
  const grape = vineyard.grape as GrapeVariety; // ensured by caller
  const fragilityModifier = getFragilityModifier(grape);
  const altitudeModifier = getAltitudeModifier(vineyard);

  const category = WorkCategory.HARVESTING;
  const yieldRate = HARVEST_YIELD_RATE;
  const initialWork = INITIAL_WORK[category];

  // Calculate work units based on yield
  const workWeeks = expectedYield / yieldRate;
  const workUnits = workWeeks * BASE_WORK_UNITS;
  const baseWork = Math.ceil(workUnits);
  
  // Add initial work and apply modifiers
  const workWithInitial = baseWork + initialWork;
  const totalWork = [fragilityModifier, altitudeModifier].reduce((work, modifier) => 
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

  return { totalWork, expectedYield, factors };
}


