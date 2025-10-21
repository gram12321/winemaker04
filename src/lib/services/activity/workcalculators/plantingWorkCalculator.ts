// Planting Work Calculator
// Calculates work required for planting vineyards

import { Vineyard, GrapeVariety } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK, isDensityBased } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/services/activity';
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { getAltitudeRating } from '@/lib/services';
import { SOIL_DIFFICULTY_MODIFIERS } from '@/lib/constants/vineyardConstants';
import { getGameState } from '../../core/gameState';
import { calculateOvergrowthModifier, combineOvergrowthYears } from './overgrowthUtils';

/**
 * Calculate work required for planting vineyards
 */
export function calculatePlantingWork(
  vineyard: Vineyard,
  params: { grape: GrapeVariety; density: number }
): { totalWork: number; factors: WorkFactor[] } {
  const fragilityModifier = getFragilityModifier(params.grape);
  const altitudeModifier = getAltitudeModifier(vineyard);
  const soilModifier = getSoilTypeModifier(vineyard.soil);
  
  // Get current season
  const gameState = getGameState();
  const currentSeason = gameState.season || 'Spring';
  const seasonalModifier = getPlantingSeasonalModifier(currentSeason);

  // Use shared overgrowth util focused on vegetation + debris for planting
  const overgrowth = vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 };
  const combinedYears = combineOvergrowthYears(overgrowth, ['vegetation', 'debris'], { vegetation: 1, debris: 0.5 });
  // Scale result to a reasonable cap for planting (e.g., cap 0.6)
  const maintenancePenalty = Math.min(0.6, calculateOvergrowthModifier(combinedYears, 0.10, 0.5, 2.0));

  const category = WorkCategory.PLANTING;
  const rate = TASK_RATES[category];
  const initialWork = INITIAL_WORK[category];

  const totalWork = calculateTotalWork(vineyard.hectares, {
    rate,
    initialWork,
    density: params.density > 0 ? params.density : undefined,
    useDensityAdjustment: isDensityBased(category),
    workModifiers: [
      fragilityModifier,
      altitudeModifier,
      soilModifier,
      seasonalModifier,
      maintenancePenalty
    ]
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
  if (Math.abs(soilModifier) >= 0) { // Show all soil modifiers (including 0%)
    factors.push({ label: 'Soil Type', value: vineyard.soil.join(', '), modifier: soilModifier, modifierLabel: 'soil difficulty' });
  }
  
  if (seasonalModifier > 0) {
    factors.push({ 
      label: 'Seasonal Effect', 
      value: `${currentSeason} season`, 
      modifier: seasonalModifier, 
      modifierLabel: 'planting difficulty' 
    });
  }

  if (overgrowth.vegetation > 0) {
    factors.push({
      label: 'Vegetation Overgrowth Since Clearing',
      value: `${overgrowth.vegetation} years`,
      modifier: Math.min(0.6, calculateOvergrowthModifier(overgrowth.vegetation, 0.10, 0.5, 2.0)),
      modifierLabel: 'overgrowth effect'
    });
  }

  if (overgrowth.debris > 0) {
    factors.push({
      label: 'Debris Accumulation Since Removal',
      value: `${overgrowth.debris} years`,
      modifier: Math.min(0.6, calculateOvergrowthModifier(overgrowth.debris, 0.10, 0.5, 2.0) * 0.5),
      modifierLabel: 'debris effect'
    });
  }

  return { totalWork, factors };
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

/**
 * Get seasonal work modifier for planting tasks
 */
function getPlantingSeasonalModifier(season: string): number {
  switch (season) {
    case 'Spring':
      return 0; // No penalty - optimal planting season
    case 'Summer':
      return 0.25; // 25% penalty - hot weather makes planting harder
    case 'Fall':
      return 0.35; // 35% penalty - late season, less optimal
    case 'Winter':
      return 0; // No penalty, but planting will be terminated
    default:
      return 0;
  }
}
