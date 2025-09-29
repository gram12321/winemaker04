// Vineyard Manager - Centralized vineyard calculations and operations
import { Vineyard } from '../../types/types';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { calculateGrapeSuitabilityContribution } from './vineyardValueCalc';
import { RIPENESS_INCREASE, ASPECT_RIPENESS_MODIFIERS, SEASONAL_RIPENESS_RANDOMNESS } from '../../constants/vineyardConstants';
import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';

/**
 * Calculate yield for a vineyard based on all factors
 * This is the core yield calculation logic used by both harvest and expected yield
 */
export function calculateVineyardYield(vineyard: Vineyard): number {
  if (!vineyard.grape) {
    return 0;
  }

  // Base yield: ~1.5 kg per vine (simplified calculation)
  const baseYieldPerVine = 1.5; // kg per vine
  const totalVines = vineyard.hectares * vineyard.density;
  
  // Get grape metadata for natural yield and suitability
  const grapeMetadata = GRAPE_CONST[vineyard.grape];
  const naturalYield = grapeMetadata.naturalYield; // 0-1 scale
  const grapeSuitability = calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country);
  
  // Apply multipliers: suitability, natural yield, ripeness, vine yield, and health all affect final yield
  const vineYieldFactor = vineyard.vineYield || 0.02; // Use persistent vine yield factor
  const yieldMultiplier = grapeSuitability * naturalYield * (vineyard.ripeness || 0) * vineYieldFactor * (vineyard.vineyardHealth || 1.0);
  const quantity = Math.round(totalVines * baseYieldPerVine * yieldMultiplier);
  
  return quantity;
}

/**
 * Calculate dynamic ripeness increase for a vineyard based on season, aspect, and randomness
 * @param vineyard The vineyard to calculate ripeness for
 * @param season Current game season
 * @returns The calculated ripeness increase for this week
 */
export function calculateDynamicRipenessIncrease(vineyard: Vineyard, season: string): number {
  // Get base ripeness increase for the season
  const baseIncrease = RIPENESS_INCREASE[season as keyof typeof RIPENESS_INCREASE] || 0;
  
  if (baseIncrease <= 0) {
    return 0; // No ripening in winter or invalid seasons
  }
  
  // Apply seasonal randomness
  const randomnessRange = SEASONAL_RIPENESS_RANDOMNESS[season as keyof typeof SEASONAL_RIPENESS_RANDOMNESS];
  if (!randomnessRange || randomnessRange.min === randomnessRange.max) {
    return baseIncrease; // No randomness for winter
  }
  
  // Generate random multiplier within the seasonal range
  const randomMultiplier = randomnessRange.min + Math.random() * (randomnessRange.max - randomnessRange.min);
  
  // Apply aspect modifier
  const aspectModifier = ASPECT_RIPENESS_MODIFIERS[vineyard.aspect as keyof typeof ASPECT_RIPENESS_MODIFIERS] || 0;
  const aspectMultiplier = 1 + aspectModifier;
  
  // Calculate final ripeness increase
  const finalIncrease = baseIncrease * randomMultiplier * aspectMultiplier;
  
  return Math.max(0, finalIncrease); // Ensure non-negative
}

/**
 * Update vineyard status and ripeness based on seasonal changes
 * @param season Current game season
 * @param week Current week (1-12)
 */
export async function updateVineyardRipeness(season: string, week: number = 1): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    
    for (const vineyard of vineyards) {
      if (!vineyard.grape) continue; // Skip vineyards without grapes
      
      let newStatus = vineyard.status;
      let newRipeness = vineyard.ripeness || 0;
      
      // Handle seasonal status transitions
      if (season === 'Spring' && week === 1) {
        // First week of Spring: Dormant -> Growing, Planted -> Growing
        if (vineyard.status === 'Dormant' || vineyard.status === 'Planted') {
          newStatus = 'Growing';
        }
      } else if (season === 'Winter' && week === 1) {
        // First week of Winter: Growing/Harvested -> Dormant, reset ripeness
        if (vineyard.status === 'Growing' || vineyard.status === 'Harvested') {
          newStatus = 'Dormant';
          newRipeness = 0; // Reset ripeness when going dormant
        }
      }
      
      // Handle ripeness progression for growing vineyards
      if (newStatus === 'Growing' || vineyard.status === 'Growing') {
        const ripenessIncrease = calculateDynamicRipenessIncrease(vineyard, season);
        if (ripenessIncrease > 0) {
          newRipeness = Math.min(1.0, newRipeness + ripenessIncrease);
        }
      }
      
      // Only update if there are changes
      if (newStatus !== vineyard.status || newRipeness !== vineyard.ripeness) {
        const updatedVineyard = {
          ...vineyard,
          status: newStatus,
          ripeness: newRipeness
        };
        
        await saveVineyard(updatedVineyard);
      }
    }
  } catch (error) {
    console.error('Error updating vineyard ripeness:', error);
  }
}

/**
 * Update vineyard ages at the start of a new year
 */
export async function updateVineyardAges(): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    
    for (const vineyard of vineyards) {
      // Only age vines that are planted (have a grape variety) and have a vine age (not null)
      if (vineyard.grape && vineyard.vineAge !== null) {
        const updatedVineyard = {
          ...vineyard,
          vineAge: vineyard.vineAge + 1
        };
        
        await saveVineyard(updatedVineyard);
      }
    }
  } catch (error) {
    console.error('Error updating vineyard ages:', error);
  }
}

/**
 * Calculate the expected vine yield progression for a given age
 * This is the core progression logic used by both the yearly updater and the projection diagram
 */
export function calculateVineYieldProgression(age: number, currentVineYield: number): { expectedDelta: number; targetValue?: number } {
  let expectedDelta = 0;
  let targetValue: number | undefined = undefined;
  
  // Age-based progression matching original function values
  if (age === 0) {
    // Age 0 -> 1: 0.02 -> 0.10 (0.08 delta)
    expectedDelta = 0.08;
  } else if (age === 1) {
    // Age 1 -> 2: 0.10 -> 0.30 (0.20 delta)
    expectedDelta = 0.20;
  } else if (age === 2) {
    // Age 2 -> 3: 0.30 -> 0.60 (0.30 delta)
    expectedDelta = 0.30;
  } else if (age === 3) {
    // Age 3 -> 4: 0.60 -> 0.85 (0.25 delta)
    expectedDelta = 0.25;
  } else if (age === 4) {
    // Age 4 -> 5: 0.85 -> 1.00 (0.15 delta)
    expectedDelta = 0.15;
  } else if (age >= 5 && age < 15) {
    // Peak years: maintain at 1.00 (0 delta with small random variation)
    expectedDelta = 0;
  } else if (age >= 15 && age <= 29) {
    // Linear decline: exactly -0.4 over 15 years = -0.0266667 per year
    expectedDelta = -0.4 / 15; // = -0.0266667
  } else if (age >= 30 && age < 200) {
    // Exponential decay: power function with decay rate
    const startValue = 0.6; // Value at age 29
    const decayRate = 0.85; // Decay factor per year
    const yearsSince29 = age - 29; // Start from age 29, not 30
    targetValue = startValue * Math.pow(decayRate, yearsSince29);
    expectedDelta = targetValue - currentVineYield;
  } else {
    // Very old vines: minimal change
    expectedDelta = 0;
  }
  
  return { expectedDelta, targetValue };
}

/**
 * Update vineyard vine yield factors at the start of a new year
 * Uses piecewise progression with randomness (50-150% of baseline delta)
 */
export async function updateVineyardVineYields(): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    
    for (const vineyard of vineyards) {
      // Only update vine yield for planted vineyards
      if (vineyard.grape && vineyard.vineAge !== null) {
        const age = vineyard.vineAge;
        const currentVineYield = vineyard.vineYield || 0.02;
        
        // Calculate expected yearly delta based on age
        const { expectedDelta } = calculateVineYieldProgression(age, currentVineYield);
        
        // Apply randomness: percentage-based ranges
        let actualDelta;
        if (expectedDelta === 0) {
          // For zero baseline, use absolute ±0.1 range
          const randomOffset = (Math.random() - 0.5) * 0.2; // -0.1 to +0.1
          actualDelta = expectedDelta + randomOffset;
        } else if (age >= 30) {
          // For exponential decay, use smaller percentage-based randomness
          const randomFactor = 0.5 + Math.random() * 1.0; // 0.5 to 1.5 (50% to 150%)
          actualDelta = expectedDelta * randomFactor;
        } else if (expectedDelta > 0) {
          // For positive baseline: 25% to 175% of baseline
          const randomFactor = 0.25 + Math.random() * 1.5; // 0.25 to 1.75
          actualDelta = expectedDelta * randomFactor;
        } else {
          // For negative baseline: 25% to 175% of baseline (maintaining negative)
          const randomFactor = 0.25 + Math.random() * 1.5; // 0.25 to 1.75
          actualDelta = expectedDelta * randomFactor;
        }
        
        // Update vine yield with bounds
        const newVineYield = Math.max(0.01, currentVineYield + actualDelta); // Minimum 0.01, no upper cap
        
        const updatedVineyard = {
          ...vineyard,
          vineYield: newVineYield
        };
        
        await saveVineyard(updatedVineyard);
      }
    }
  } catch (error) {
    console.error('Error updating vineyard vine yields:', error);
  }
}

