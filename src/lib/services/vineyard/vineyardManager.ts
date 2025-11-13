import { Vineyard, Activity, GameDate } from '../../types/types';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { calculateGrapeSuitabilityContribution } from './vineyardValueCalc';
import { RIPENESS_INCREASE, ASPECT_RIPENESS_MODIFIERS, SEASONAL_RIPENESS_RANDOMNESS } from '../../constants/vineyardConstants';
import { loadVineyards, saveVineyard, bulkUpdateVineyards } from '../../database/activities/vineyardDB';
import { loadActivitiesFromDb, removeActivityFromDb, updateActivityInDb } from '../../database/activities/activityDB';
import { WorkCategory } from '../../services/activity';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { createWineBatchFromHarvest } from '../wine/winery/inventoryService';
import { calculateAdjustedLandValue } from './vineyardValueCalc';


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
          `Planting terminated due to winter! ${vineyardName} was ${plantingProgress}% planted (${currentDensity}/${targetDensity} vines/ha). The planting activity has been canceled, density will reflect the amount planted; you can start a new planting in Spring.`,
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
  const grapeSuitability = calculateGrapeSuitabilityContribution(
    vineyard.grape,
    vineyard.region,
    vineyard.country,
    vineyard.altitude,
    vineyard.aspect,
    vineyard.soil
  );
  
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
    const activitiesToCancel: string[] = [];
    const cancelledActivityVineyards: string[] = [];
    
    for (const vineyard of vineyards) {
      if (!vineyard.grape) continue; // Skip vineyards without grapes
      
      let newStatus = vineyard.status;
      let newRipeness = vineyard.ripeness || 0;
      let isRipenessDeclining = vineyard.isRipenessDeclining ?? false;
      
      // Handle seasonal status transitions
      if (season === 'Spring' && week === 1) {
        // First week of Spring: Dormant -> Growing, Planted -> Growing, Harvested -> Growing
        // Harvested vineyards from previous season should also transition to Growing
        if (vineyard.status === 'Dormant' || vineyard.status === 'Planted' || vineyard.status === 'Harvested') {
          newStatus = 'Growing';
        }
        // If status is 'Planting', check if there's actually an active planting activity
        if (vineyard.status === 'Planting') {
          const plantingActivity = activities.find(
            (a) => a.category === WorkCategory.PLANTING && 
                   a.status === 'active' && 
                   a.targetId === vineyard.id
          );
          
          if (plantingActivity) {
            // Keep Planting status if there's an active planting activity
            newStatus = 'Planting';
          } else {
            // No active planting activity - transition to Growing if vineyard is planted
            // This handles cases where planting completed but status wasn't updated
            if (vineyard.density > 0 && vineyard.grape) {
              newStatus = 'Growing';
            }
          }
        }
        
        // Spring week 1 reset: Reset ripeness to 0 for any vineyard transitioning to Growing
        // This ensures a clean start for the new vintage, even if winter decay didn't reach 0%
        if (newStatus === 'Growing') {
          newRipeness = 0;
          isRipenessDeclining = false;
          
          // Cancel any remaining harvest activities on this vineyard
          // Harvest activities should not continue into the new vintage
          const harvestingActivity = activities.find(
            (a) => a.category === WorkCategory.HARVESTING && 
                   a.status === 'active' && 
                   a.targetId === vineyard.id
          );
          
          if (harvestingActivity && harvestingActivity.isCancellable !== false) {
            // Collect activity to cancel (will process after loop)
            activitiesToCancel.push(harvestingActivity.id);
            cancelledActivityVineyards.push(vineyard.name);
          }
        }
      } else if (season === 'Winter' && week === 1) {
        // If still planting in winter, terminate planting and finalize density
        // Note: Growing/Harvested vineyards are NOT immediately reset to Dormant here
        // They will naturally become Dormant when ripeness degrades to 0 (handled below)
        if (vineyard.status === 'Planting') {
          await terminatePlantingActivity(vineyard.id, vineyard.name);
          newStatus = 'Dormant'; // Set to Dormant status with current density
        }
      }
      
      // General check: If status is 'Planting' but no active planting activity exists, fix the status
      // This handles edge cases where planting completed but status wasn't properly updated
      if (newStatus === 'Planting' || vineyard.status === 'Planting') {
        const plantingActivity = activities.find(
          (a) => a.category === WorkCategory.PLANTING && 
                 a.status === 'active' && 
                 a.targetId === vineyard.id
        );
        
        if (!plantingActivity && vineyard.density > 0 && vineyard.grape) {
          // No active planting activity but vineyard is planted - determine correct status
          const currentSeason = season;
          const isGrowingSeason = currentSeason === 'Spring' || currentSeason === 'Summer' || currentSeason === 'Fall';
          newStatus = isGrowingSeason ? 'Growing' : 'Planted';
        }
      }
      
      // Handle ripeness progression for growing vineyards (including partial planting)
      if (newStatus === 'Growing' || vineyard.status === 'Growing' || vineyard.status === 'Planting') {
        const ripenessIncrease = calculateDynamicRipenessIncrease(vineyard, season);
        if (ripenessIncrease > 0) {
          isRipenessDeclining = false;
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
      
      // Handle winter ripeness penalties - calibrated exponential-style ramp
      if (season === 'Winter' && newRipeness > 0) {
        isRipenessDeclining = true;
        // Calculate winter ripeness degradation using calibrated base + acceleration factors
        // Base degradation: ~3% per week, increasing by ~1% each week (week 12 ≈ -14%)
        const weeksIntoWinter = week;
        const baseDegradation = 0.03; // 3% base degradation
        const accelerationFactor = 0.01; // Additional 1% per week
        const weeklyDegradation = baseDegradation + (accelerationFactor * (weeksIntoWinter - 1));
        const ripenessLoss = Math.min(newRipeness, weeklyDegradation);
        newRipeness = Math.max(0, newRipeness - ripenessLoss);
        
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
        isRipenessDeclining = false;
        
        // Clear pendingFeatures when vineyard goes dormant (features reset for next season)
        // This ensures features like Noble Rot don't carry over to next season
        if (vineyard.pendingFeatures && vineyard.pendingFeatures.length > 0) {
          const updatedVineyard = {
            ...vineyard,
            status: newStatus,
            ripeness: newRipeness,
            isRipenessDeclining,
            pendingFeatures: [] // Clear all pending features
          };
          vineyardsToUpdate.push(updatedVineyard);
          
          // Cancel any active harvesting activities on this vineyard
          const harvestingActivity = activities.find(
            (a) => a.category === WorkCategory.HARVESTING && 
                   a.status === 'active' && 
                   a.targetId === vineyard.id
          );
          
          if (harvestingActivity && harvestingActivity.isCancellable !== false) {
            activitiesToCancel.push(harvestingActivity.id);
            cancelledActivityVineyards.push(vineyard.name);
          }
          
          continue; // Skip the update below since we already added it
        }
        
        // Cancel any active harvesting activities on this vineyard
        const harvestingActivity = activities.find(
          (a) => a.category === WorkCategory.HARVESTING && 
                 a.status === 'active' && 
                 a.targetId === vineyard.id
        );
        
        if (harvestingActivity && harvestingActivity.isCancellable !== false) {
          // Collect activity to cancel (will process after loop)
          activitiesToCancel.push(harvestingActivity.id);
          cancelledActivityVineyards.push(vineyard.name);
        }
      }
      
      // Also clear pendingFeatures if vineyard is already harvested or dormant (handles edge cases)
      if ((vineyard.status === 'Harvested' || vineyard.status === 'Dormant') && vineyard.pendingFeatures && vineyard.pendingFeatures.length > 0) {
        const updatedVineyard = {
          ...vineyard,
          pendingFeatures: [],
          isRipenessDeclining
        };
        vineyardsToUpdate.push(updatedVineyard);
        continue; // Skip the update below since we already added it
      }
      
      // Only update if there are changes
      if (
        newStatus !== vineyard.status ||
        newRipeness !== vineyard.ripeness ||
        isRipenessDeclining !== vineyard.isRipenessDeclining
      ) {
        const updatedVineyard = {
          ...vineyard,
          status: newStatus,
          ripeness: newRipeness,
          isRipenessDeclining
        };
        
        vineyardsToUpdate.push(updatedVineyard);
      }
    }
    
    // OPTIMIZATION: Bulk update all vineyards at once instead of individual saves
    if (vineyardsToUpdate.length > 0) {
      await bulkUpdateVineyards(vineyardsToUpdate);
    }
    
    // Cancel all harvesting activities for vineyards that went dormant or Spring reset
    if (activitiesToCancel.length > 0) {
      for (let i = 0; i < activitiesToCancel.length; i++) {
        const activityId = activitiesToCancel[i];
        const vineyardName = cancelledActivityVineyards[i];
        
        const success = await updateActivityInDb(activityId, { status: 'cancelled' });
        
        if (success) {
          // Use different messages for Winter vs Spring cancellations
          const message = (season === 'Spring' && week === 1)
            ? `Harvest activity on ${vineyardName} has been cancelled due to Spring reset. The new vintage has started with ripeness reset to zero.`
            : `Harvest activity on ${vineyardName} has been cancelled due to winter dormancy. The vineyard's ripeness has degraded to zero.`;
          
          await notificationService.addMessage(
            message,
            'vineyardManager.harvestCancelled',
            'Harvest Cancelled',
            NotificationCategory.VINEYARD_OPERATIONS
          );
        }
      }
      
      // Update game state once after all cancellations
      const currentActivities = await loadActivitiesFromDb();
      const activeActivities = currentActivities.filter(a => a.status === 'active');
      await updateGameState({ activities: activeActivities });
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
        
        // Update overgrowth for planted vineyards - increment each task type that hasn't been completed this year
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
        // For unplanted vineyards, still increment overgrowth for all task types
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

/**
 * Recalculate vineyard total values annually
 * Applies adjusted per-hectare calculation using planted state, vine age, and prestige
 */
export async function recalculateVineyardValues(): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    if (vineyards.length === 0) return;

    const updated = vineyards.map(v => {
      const adjustedPerHa = calculateAdjustedLandValue(
        v.country,
        v.region,
        v.altitude,
        v.aspect,
        {
          grape: v.grape,
          vineAge: v.vineAge ?? 0,
          vineyardPrestige: v.vineyardPrestige ?? 0,
          soil: v.soil
        }
      );
      const adjustedTotal = Math.round(adjustedPerHa * v.hectares);
      return { ...v, vineyardTotalValue: adjustedTotal } as Vineyard;
    });

    await bulkUpdateVineyards(updated);
  } catch (error) {
    console.error('Failed to recalculate vineyard values:', error);
  }
}

/**
 * Handle partial planting for planting activities
 * Increases vine density incrementally based on work progress
 */
export async function handlePartialPlanting(
  activity: Activity,
  oldCompletedWork: number,
  newCompletedWork: number
): Promise<void> {
  try {
    const workProgress = newCompletedWork / activity.totalWork;
    const oldProgress = oldCompletedWork / activity.totalWork;
    const progressThisTick = workProgress - oldProgress;
    
    if (progressThisTick <= 0) return; // No progress this tick
    
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === activity.targetId);
    
    if (!vineyard) return;
    
    const targetDensity = activity.params.density || 0;
    if (targetDensity <= 0) return;
    
    // Calculate current density based on work progress
    const expectedDensityByNow = Math.round(targetDensity * workProgress);
    const currentDensity = vineyard.density || 0;
    
    // Calculate density increase this tick
    const densityIncrease = expectedDensityByNow - currentDensity;
    
    // Only update if there's a meaningful increase (at least 1 vine/ha)
    if (densityIncrease >= 1) {
      const newDensity = Math.min(targetDensity, currentDensity + densityIncrease);
      
      // Update vineyard density
      const updatedVineyard = {
        ...vineyard,
        density: newDensity
      };
      await saveVineyard(updatedVineyard);
      
      // Update prestige events to reflect new density (affects prestige calculations)
      try {
        const { updateBaseVineyardPrestigeEvent } = await import('../prestige/prestigeService');
        await updateBaseVineyardPrestigeEvent(vineyard.id);
      } catch (error) {
        console.error('Failed to update prestige during partial planting:', error);
      }
    }
  } catch (error) {
    console.error(`Error in partial planting for activity ${activity.id}:`, error);
  }
}

/**
 * Handle partial harvesting for harvesting activities
 * Creates wine batches incrementally based on work progress
 */
export async function handlePartialHarvesting(
  activity: Activity, 
  oldCompletedWork: number, 
  newCompletedWork: number
): Promise<void> {
  try {
    const workProgress = newCompletedWork / activity.totalWork;
    const oldProgress = oldCompletedWork / activity.totalWork;
    const progressThisTick = workProgress - oldProgress;
    
    if (progressThisTick <= 0) return; // No progress this tick
    
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === activity.targetId);
    
    if (!vineyard || !vineyard.grape) return;
    
    // Calculate current total yield based on current ripeness
    const currentTotalYield = calculateVineyardYield(vineyard);
    
    // Get the harvest progress as a percentage (0-1)
    const harvestProgress = workProgress;
    
    // Calculate how much should be harvested by now based on current yield
    const expectedHarvestedByNow = currentTotalYield * harvestProgress;
    const previouslyHarvested = activity.params.harvestedSoFar || 0;
    
    // Calculate how much to harvest this tick
    const yieldThisTick = Math.max(0, expectedHarvestedByNow - previouslyHarvested);
    
    // Only create wine batch if we're harvesting at least 5kg this tick
    if (yieldThisTick >= 5) {
      const gameState = getGameState();
      
      // Create harvest dates: start is activity start, end is current date
      const harvestStartDate: GameDate = {
        week: activity.gameWeek,
        season: activity.gameSeason as any,
        year: activity.gameYear
      };
      
      const harvestEndDate: GameDate = {
        week: gameState.week || 1,
        season: gameState.season || 'Spring',
        year: gameState.currentYear || 2024
      };
      
      // Create wine batch for this tick's harvest
      await createWineBatchFromHarvest(
        vineyard.id,
        vineyard.name,
        vineyard.grape,
        Math.round(yieldThisTick),
        harvestStartDate,
        harvestEndDate
      );
      
      // Update the harvested amount in activity params
      const newHarvestedSoFar = previouslyHarvested + yieldThisTick;
      await updateActivityInDb(activity.id, {
        params: {
          ...activity.params,
          harvestedSoFar: newHarvestedSoFar,
          // Store current total yield for completion handler
          currentTotalYield: currentTotalYield
        }
      });
      
      // Update vineyard status to show progress
      const updatedVineyard = {
        ...vineyard,
        status: 'Growing'
      };
      await saveVineyard(updatedVineyard);
    }
  } catch (error) {
    console.error(`Error in partial harvesting for activity ${activity.id}:`, error);
  }
}

