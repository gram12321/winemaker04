import { Vineyard } from '../../types/types';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { calculateGrapeSuitabilityContribution } from './vineyardValueCalc';
import { RIPENESS_INCREASE, ASPECT_RIPENESS_MODIFIERS, SEASONAL_RIPENESS_RANDOMNESS } from '../../constants/vineyardConstants';
import { loadVineyards, saveVineyard, bulkUpdateVineyards } from '../../database/activities/vineyardDB';
import { loadActivitiesFromDb, removeActivityFromDb } from '../../database/activities/activityDB';
import { WorkCategory } from '../../services/activity';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';


/**
 * Terminate a planting activity due to winter and finalize vineyard with current density
 */
async function terminatePlantingActivity(vineyardId: string, vineyardName: string): Promise<void> {
  try {
    // Find the active planting activity
    const activities = await loadActivitiesFromDb();
    const plantingActivity = activities.find(
      (a) => a.category === WorkCategory.PLANTING && 
             a.status === 'active' && 
             a.targetId === vineyardId
    );
    
    if (plantingActivity) {
      // Get current vineyard to get current density
      const vineyards = await loadVineyards();
      const vineyard = vineyards.find(v => v.id === vineyardId);
      
      if (vineyard) {
        // Calculate planting progress
        const targetDensity = plantingActivity.params.density || 0;
        const currentDensity = vineyard.density || 0;
        const plantingProgress = targetDensity > 0 ? Math.round((currentDensity / targetDensity) * 100) : 0;
        
        // Remove the planting activity
        await removeActivityFromDb(plantingActivity.id);
        
        // Add notification about terminated planting
        await notificationService.addMessage(
          `Planting terminated due to winter! ${vineyardName} was ${plantingProgress}% planted (${currentDensity}/${targetDensity} vines/ha). Planting will resume in Spring.`,
          'vineyardManager.terminatePlantingActivity',
          'Planting Terminated',
          NotificationCategory.VINEYARD_OPERATIONS
        );
      }
    }
  } catch (error) {
    console.error('Error terminating planting activity:', error);
  }
}

/**
 * Calculate yield for a vineyard based on all factors
 * This is the core yield calculation logic used by both harvest and expected yield
 */
export function calculateVineyardYield(vineyard: Vineyard): number {
  if (!vineyard.grape) {
    return 0;
  }

  // Base yield: ~1.5 kg per vine (realistic baseline for mature vines)
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
    const activities = await loadActivitiesFromDb();
    const vineyardsToUpdate: Vineyard[] = [];
    
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
        // If currently planting, keep Planting status but allow ripeness for planted portion
        if (vineyard.status === 'Planting') {
          newStatus = 'Planting'; // Keep planting status
        }
      } else if (season === 'Winter' && week === 1) {
        // First week of Winter: Growing/Harvested -> Dormant, reset ripeness
        if (vineyard.status === 'Growing' || vineyard.status === 'Harvested') {
          newStatus = 'Dormant';
          newRipeness = 0; // Reset ripeness when going dormant
        }
        // If still planting in winter, terminate planting and finalize density
        if (vineyard.status === 'Planting') {
          await terminatePlantingActivity(vineyard.id, vineyard.name);
          newStatus = 'Dormant'; // Set to Dormant status with current density
        }
      }
      
      // Handle ripeness progression for growing vineyards (including partial planting)
      if (newStatus === 'Growing' || vineyard.status === 'Growing' || vineyard.status === 'Planting') {
        const ripenessIncrease = calculateDynamicRipenessIncrease(vineyard, season);
        if (ripenessIncrease > 0) {
          // Check if vineyard is currently being planted (partial planting)
          const plantingActivity = activities.find(
            (a) => a.category === WorkCategory.PLANTING && 
                   a.status === 'active' && 
                   a.targetId === vineyard.id
          );
          
          let plantingProgressRatio = 1.0; // Default: fully planted
          
          if (plantingActivity && plantingActivity.params.density) {
            // Calculate planting progress: current density / target density
            const targetDensity = plantingActivity.params.density;
            const currentDensity = vineyard.density || 0;
            plantingProgressRatio = Math.min(1.0, currentDensity / targetDensity);
          }
          
          // Scale ripeness increase by planting progress
          // If only 50% planted, only 50% of the vineyard should ripen
          const scaledRipenessIncrease = ripenessIncrease * plantingProgressRatio;
          newRipeness = Math.min(1.0, newRipeness + scaledRipenessIncrease);
        }
      }
      
      // Handle winter ripeness penalties - drastic degradation with increasing speed
      if (season === 'Winter' && newRipeness > 0) {
        // Calculate winter ripeness degradation
        // Base degradation: 15% per week, increasing by 5% each week
        const weeksIntoWinter = week;
        const baseDegradation = 0.15; // 15% base degradation
        const accelerationFactor = 0.05; // 5% additional degradation per week
        const weeklyDegradation = baseDegradation + (accelerationFactor * (weeksIntoWinter - 1));
        
        // Apply degradation (more severe as winter progresses)
        newRipeness = Math.max(0, newRipeness - weeklyDegradation);
        
        // Add notification for significant ripeness loss
        if (weeklyDegradation > 0.1 && newRipeness < vineyard.ripeness) {
          const ripenessLoss = vineyard.ripeness - newRipeness;
          if (ripenessLoss > 0.05) { // Only notify for significant loss
            await notificationService.addMessage(
              `Winter is taking its toll! ${vineyard.name} lost ${Math.round(ripenessLoss * 100)}% ripeness due to winter conditions.`,
              'vineyardManager.winterRipenessLoss',
              'Winter Ripeness Loss',
              NotificationCategory.VINEYARD_OPERATIONS
            );
          }
        }
      }
      
      // Rule: When ripeness reaches 0 and season is winter, set status to dormant
      if (season === 'Winter' && newRipeness <= 0 && vineyard.status !== 'Dormant') {
        newStatus = 'Dormant';
        newRipeness = 0; // Ensure ripeness is exactly 0

      }
      
      // Only update if there are changes
      if (newStatus !== vineyard.status || newRipeness !== vineyard.ripeness) {
        const updatedVineyard = {
          ...vineyard,
          status: newStatus,
          ripeness: newRipeness
        };
        
        vineyardsToUpdate.push(updatedVineyard);
      }
    }
    
    // OPTIMIZATION: Bulk update all vineyards at once instead of individual saves
    if (vineyardsToUpdate.length > 0) {
      await bulkUpdateVineyards(vineyardsToUpdate);
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
        // Calculate gradual health improvement from planting/replanting
        let newHealth = vineyard.vineyardHealth;
        let newPlantingHealthBonus = vineyard.plantingHealthBonus || 0;
        
        // Apply gradual health improvement for young vines (0-5 years old)
        let plantingImprovement = 0;
        if (vineyard.vineAge < 5 && newPlantingHealthBonus > 0) {
          const annualImprovement = newPlantingHealthBonus / 5; // Linear improvement over 5 years
          
          // Apply this year's improvement
          plantingImprovement = annualImprovement;
          newHealth = Math.min(1.0, newHealth + annualImprovement);
          newPlantingHealthBonus = Math.max(0, newPlantingHealthBonus - annualImprovement);
        }
        
        // Calculate health trend for this year
        const seasonalDecay = vineyard.healthTrend?.seasonalDecay || 0; // Will be set by health degradation function
        const netChange = plantingImprovement - seasonalDecay;
        
        // Update overgrowth for planted vineyards - increment each task type
        const currentOvergrowth = vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 };
        const updatedOvergrowth = {
          vegetation: currentOvergrowth.vegetation + 1,
          debris: currentOvergrowth.debris + 1,
          uproot: currentOvergrowth.uproot + 1,
          replant: currentOvergrowth.replant + 1
        };

        const updatedVineyard = {
          ...vineyard,
          vineAge: vineyard.vineAge + 1,
          overgrowth: updatedOvergrowth,
          vineyardHealth: newHealth,
          plantingHealthBonus: newPlantingHealthBonus,
          healthTrend: {
            seasonalDecay,
            plantingImprovement,
            netChange
          }
        };
        
        await saveVineyard(updatedVineyard);
      } else {
        // For unplanted vineyards, still increment overgrowth
        const currentOvergrowth = vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 };
        const updatedOvergrowth = {
          vegetation: currentOvergrowth.vegetation + 1,
          debris: currentOvergrowth.debris + 1,
          uproot: currentOvergrowth.uproot + 1,
          replant: currentOvergrowth.replant + 1
        };

        const updatedVineyard = {
          ...vineyard,
          overgrowth: updatedOvergrowth
        };
        
        await saveVineyard(updatedVineyard);
      }
    }
  } catch (error) {
    console.error('Error updating vineyard ages:', error);
  }
}

/**
 * Apply health degradation to vineyards based on v1 system
 * Health degrades over time naturally - clearing activities are the primary maintenance method
 */
export async function updateVineyardHealthDegradation(season: string, _week: number): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    const healthDegradations: Array<{ vineyard: string; oldHealth: number; newHealth: number; degradation: number }> = [];
    const vineyardsToUpdate: Vineyard[] = [];
    
    for (const vineyard of vineyards) {
      // Skip vineyards that are already at minimum health (0.1 = 10%)
      if (vineyard.vineyardHealth <= 0.1) continue;
      
      // Base degradation rate per week (from v1 system)
      let weeklyDegradation = 0;
      
      // Seasonal degradation rates (from v1 endDay.js)
      switch (season) {
        case 'Spring':
          weeklyDegradation = 0.002; // 0.2% per week
          break;
        case 'Summer':
          weeklyDegradation = 0.006; // 0.6% per week
          break;
        case 'Fall':
          weeklyDegradation = 0.01; // 1.0% per week
          break;
        case 'Winter':
          weeklyDegradation = 0.001; // 0.1% per week (reduced degradation in winter)
          break;
        default:
          weeklyDegradation = 0.005; // 0.5% per week default
      }
      
      // Apply small random variation (±20%)
      const variation = (Math.random() - 0.5) * 0.4; // -20% to +20%
      weeklyDegradation *= (1 + variation);
      
      // Calculate new health
      const oldHealth = vineyard.vineyardHealth;
      const newHealth = Math.max(0.1, oldHealth - weeklyDegradation); // Minimum 10% health
      const actualDegradation = oldHealth - newHealth;
      
      if (actualDegradation > 0.001) { // Only update if significant degradation (>0.1%)
        // Update health trend with seasonal decay
        const currentTrend = vineyard.healthTrend || { seasonalDecay: 0, plantingImprovement: 0, netChange: 0 };
        const updatedTrend = {
          ...currentTrend,
          seasonalDecay: currentTrend.seasonalDecay + actualDegradation,
          netChange: currentTrend.plantingImprovement - (currentTrend.seasonalDecay + actualDegradation)
        };
        
        const updatedVineyard = {
          ...vineyard,
          vineyardHealth: newHealth,
          healthTrend: updatedTrend
        };
        
        vineyardsToUpdate.push(updatedVineyard);
        
        healthDegradations.push({
          vineyard: vineyard.name,
          oldHealth,
          newHealth,
          degradation: actualDegradation
        });
      }
    }
    
    // OPTIMIZATION: Bulk update all vineyards at once instead of individual saves
    if (vineyardsToUpdate.length > 0) {
      await bulkUpdateVineyards(vineyardsToUpdate);
    }
    

    
  } catch (error) {
    console.error('Error updating vineyard health degradation:', error);
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

