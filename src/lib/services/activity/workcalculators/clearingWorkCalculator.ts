import { Vineyard } from '@/lib/types/types';
import { CLEARING_TASKS } from '@/lib/constants/activityConstants';
import { calculateTotalWork } from './workCalculator';
import { getAltitudeRating } from '../../vineyard/vineyardValueCalc';
import { SOIL_DIFFICULTY_MODIFIERS } from '@/lib/constants/vineyardConstants';
import { getGameState } from '../../core/gameState';
import { DEFAULT_VINE_DENSITY } from '@/lib/constants/activityConstants';

export interface ClearingWorkCalculationOptions {
  tasks: { [key: string]: boolean };
  replantingIntensity: number;
}

export interface ClearingWorkResult {
  totalWork: number;
  selectedTasks: string[];
  workFactors: Array<{
    label: string;
    value: string | number;
    unit?: string;
    modifier?: number;
    modifierLabel?: string;
    isPrimary?: boolean;
  }>;
}

/**
 * Get soil type modifier for clearing work using the proper soil difficulty system
 * Different soil types affect clearing difficulty based on predefined modifiers
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
 * Get overgrowth modifier based on years since last clearing
 * Uses diminishing returns: 1 year = 10%, 2 years = 15%, 3 years = 17.5%, etc.
 */
function getOvergrowthModifier(yearsSinceLastClearing: number): number {
  if (yearsSinceLastClearing <= 0) return 0;
  
  // Diminishing returns formula: base * (1 - (1 - decay)^years)
  // This gives: 1 year = 10%, 2 years = 15%, 3 years = 17.5%, max ~200%
  const baseIncrease = 0.10; // 10% base increase per year
  const decayRate = 0.5; // Diminishing factor
  
  const maxModifier = baseIncrease / decayRate; // Theoretical maximum
  const actualModifier = maxModifier * (1 - Math.pow(1 - decayRate, yearsSinceLastClearing));
  
  return Math.min(actualModifier, 2.0); // Cap at 200%
}

/**
 * Get vine age modifier for vine removal
 * Older vines are harder to remove, with diminishing returns
 * Theoretical max vine age: 200 years, practical max: 100 years
 */
function getVineAgeModifier(vineAge: number | null): number {
  if (!vineAge || vineAge <= 0) return 0;
  
  // Diminishing returns formula for vine age
  // 10 years = 5%, 25 years = 10%, 50 years = 15%, 100 years = 180%
  const maxAge = 100; // Practical maximum
  const ageRatio = Math.min(vineAge / maxAge, 1); // Normalize to 0-1
  
  // Diminishing returns: more age = more work, but with diminishing effect
  const baseModifier = 1.8; // Maximum 180% work increase
  const actualModifier = baseModifier * (1 - Math.exp(-3 * ageRatio)); // Exponential decay function
  
  return actualModifier;
}

/**
 * Get seasonal work modifier for clearing tasks
 * Summer and Fall have penalties due to active vegetation growth
 * Spring has slight penalty due to new growth
 * Winter has no penalty (vegetation is dormant)
 */
function getSeasonalModifier(season: string, taskId: string): number {
  // Only apply seasonal modifiers to vegetation and debris clearing tasks
  if (taskId !== 'clear-vegetation' && taskId !== 'remove-debris') {
    return 0;
  }
  
  switch (season) {
    case 'Spring':
      return 0.1; // 10% penalty - new growth makes clearing slightly harder
    case 'Summer':
      return 0.25; // 25% penalty - peak growing season, vegetation is dense
    case 'Fall':
      return 0.2; // 20% penalty - vegetation is still active, some growth
    case 'Winter':
      return 0; // No penalty - vegetation is dormant, easier to clear
    default:
      return 0;
  }
}

/**
 * Calculate work for clearing activities on a vineyard
 * @param vineyard - The vineyard to calculate work for
 * @param options - Clearing task options and intensity
 * @returns Work calculation result with total work and factors
 */
export function calculateClearingWork(
  vineyard: Vineyard, 
  options: ClearingWorkCalculationOptions
): ClearingWorkResult {
  // Calculate work modifiers for this vineyard
  const soilModifier = getSoilTypeModifier(vineyard.soil);
  const altitudeRating = getAltitudeRating(vineyard.country, vineyard.region, vineyard.altitude);
  const terrainModifier = altitudeRating * 1.5; // Up to +150% work for very high altitude
  const overgrowthModifier = getOvergrowthModifier(vineyard.yearsSinceLastClearing || 0);
  
  // Get current season for seasonal modifiers
  const gameState = getGameState();
  const currentSeason = gameState.season || 'Spring';
  
  // Initialize work factors
  const workFactors: Array<{
    label: string;
    value: string | number;
    unit?: string;
    modifier?: number;
    modifierLabel?: string;
    isPrimary?: boolean;
  }> = [];
  
  // Add vineyard size factor
  workFactors.push({
    label: 'Vineyard Size',
    value: vineyard.hectares,
    unit: 'hectares',
    isPrimary: true
  });
  
  // Add environmental factors
  if (Math.abs(soilModifier) >= 0) { // Show all soil modifiers (including 0%)
    workFactors.push({
      label: 'Soil Type',
      value: vineyard.soil.join(', '),
      modifier: soilModifier,
      modifierLabel: 'soil difficulty'
    });
  }
  
  if (Math.abs(terrainModifier) > 0.01) {
    workFactors.push({
      label: 'Terrain Difficulty',
      value: `${vineyard.altitude}m altitude`,
      modifier: terrainModifier,
      modifierLabel: 'altitude effect'
    });
  }
  
  if (Math.abs(overgrowthModifier) > 0.01) {
    workFactors.push({
      label: 'Overgrowth',
      value: `${vineyard.yearsSinceLastClearing || 0} years since last clearing`,
      modifier: overgrowthModifier,
      modifierLabel: 'overgrowth effect'
    });
  }
  
  // Calculate total work for all selected tasks
  let totalWork = 0;
  const selectedTasks: string[] = [];
  
  Object.entries(options.tasks).forEach(([taskId, isSelected]) => {
    if (!isSelected) return;
    
    const task = Object.values(CLEARING_TASKS).find(t => t.id === taskId);
    if (!task) return;
    
    selectedTasks.push(task.name);
    
    // Calculate work for this task using the proper work calculator
    let taskAmount = vineyard.hectares;
    
    // Handle uprooting and replanting with intensity scaling
    if (taskId === 'uproot-vines' || taskId === 'replant-vines') {
      taskAmount *= (options.replantingIntensity / 100);
      
      // Add replanting intensity factor
      workFactors.push({
        label: 'Replanting Intensity',
        value: `${options.replantingIntensity}%`,
        modifier: (options.replantingIntensity / 100) - 1, // -1 to 0 range
        modifierLabel: 'work scaling'
      });
    }
    
    if (taskAmount <= 0) return;
    
    // Get task-specific modifiers
    let taskModifiers = [soilModifier, terrainModifier, overgrowthModifier];
    
    // Add seasonal modifier for vegetation and debris clearing tasks
    const seasonalModifier = getSeasonalModifier(currentSeason, taskId);
    if (seasonalModifier > 0) {
      taskModifiers.push(seasonalModifier);
      
      workFactors.push({
        label: 'Seasonal Effect',
        value: `${currentSeason} season`,
        modifier: seasonalModifier,
        modifierLabel: 'vegetation growth'
      });
    }
    
    // Add vine age modifier for vine uprooting and replanting tasks
    if (taskId === 'uproot-vines' || taskId === 'replant-vines') {
      const vineAgeModifier = getVineAgeModifier(vineyard.vineAge);
      taskModifiers.push(vineAgeModifier);
      
      if (Math.abs(vineAgeModifier) > 0.01) {
        workFactors.push({
          label: 'Vine Age',
          value: `${vineyard.vineAge || 0} years`,
          modifier: vineAgeModifier,
          modifierLabel: 'removal difficulty'
        });
      }
    }
    
    // Use the proper work calculator
    const taskWork = calculateTotalWork(taskAmount, {
      rate: task.rate,
      initialWork: task.initialWork,
      useDensityAdjustment: taskId === 'uproot-vines' || taskId === 'replant-vines', // Vine uprooting and replanting use density adjustment
      density: vineyard.density,
      workModifiers: taskModifiers
    });
    
    totalWork += taskWork;
    
    // Add task-specific factor
    workFactors.push({
      label: task.name,
      value: taskAmount,
      unit: 'hectares',
      modifier: task.initialWork / (taskAmount * task.rate * 25), // Initial work as modifier
      modifierLabel: 'setup work'
    });
    
    // Add density factor for vine uprooting and replanting
    if ((taskId === 'uproot-vines' || taskId === 'replant-vines') && vineyard.density > 0) {
      const densityModifier = (vineyard.density / DEFAULT_VINE_DENSITY) - 1; // Use correct constant
      if (Math.abs(densityModifier) > 0.05) { // Only show if significant (>5%)
        workFactors.push({
          label: 'Vine Density',
          value: `${vineyard.density.toFixed(0)} vines/ha`,
          modifier: densityModifier,
          modifierLabel: 'density effect'
        });
      }
    }
  });
  
  // Add total tasks factor
  const selectedTaskCount = Object.values(options.tasks).filter(Boolean).length;
  if (selectedTaskCount > 0) {
    workFactors.push({
      label: 'Selected Tasks',
      value: selectedTaskCount,
      modifier: selectedTaskCount > 1 ? 0.1 : 0, // 10% efficiency bonus for multiple tasks
      modifierLabel: 'task coordination'
    });
  }
  
  return {
    totalWork: Math.round(totalWork),
    selectedTasks,
    workFactors
  };
}
