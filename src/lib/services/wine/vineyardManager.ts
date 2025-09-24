// Vineyard Manager - Centralized vineyard calculations and operations
import { Vineyard } from '../../types/types';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { calculateGrapeSuitabilityContribution } from './vineyardValueCalc';
import { RIPENESS_INCREASE, ASPECT_RIPENESS_MODIFIERS, SEASONAL_RIPENESS_RANDOMNESS } from '../../constants/vineyardConstants';
import { loadVineyards, saveVineyard } from '../../database/database';

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
  
  // Apply multipliers: suitability, natural yield, ripeness, and health all affect final yield
  const yieldMultiplier = grapeSuitability * naturalYield * (vineyard.ripeness || 0) * (vineyard.vineyardHealth || 1.0);
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

