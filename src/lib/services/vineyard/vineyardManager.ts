import { Vineyard, Activity, GameDate, Season } from '../../types/types';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { calculateGrapeSuitabilityMetrics, type GrapeSuitabilityMetrics, calculateAdjustedLandValue, calculateLandValue } from './vineyardValueCalc';
import { loadVineyards, saveVineyard, bulkUpdateVineyards } from '../../database/activities/vineyardDB';
import { activitiesFeature } from '@/lib/features/activities';
import { WorkCategory } from '@/lib/types/types';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { createWineBatchFromHarvest } from '../wine/winery/inventoryService';
import { canStoragePlanHoldVolume, getStoragePlanCapacityLitres, initializeHarvestVolumeLitres } from '../wine/winery/storageVesselAllocationService';
import { STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG } from '@/lib/constants';
import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import {
  isRipenessGrowthActiveForWeek,
  calculateWinterRipenessDegradation
} from './vineyardProgressionService';
import { createWeatherWeekContext, projectVineyardWeek, type WeatherWeekContext } from '@/lib/features/weather';

export {
  calculateDynamicRipenessIncrease,
  calculateWeeklyBaselineHealthDelta,
  calculateWeeklyBaselineRipenessDelta,
  calculateWinterRipenessDegradation,
  getSeasonalWeeklyHealthDegradation
} from './vineyardProgressionService';
 
 
/**
 * Terminate a planting activity due to winter and finalize vineyard with current density
 */
async function terminatePlantingActivity(vineyardId: string, vineyardName: string): Promise<void> {
  try {
    // Find the active planting activity
    const activities = await activitiesFeature.reads.getAll();
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
        await activitiesFeature.lifecycle.remove(plantingActivity.id);
        
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
  return calculateVineyardYieldBreakdown(vineyard)?.totalYield ?? 0;
}

export interface VineyardYieldBreakdown {
  totalYield: number;
  baseYieldPerVine: number;
  totalVines: number;
  breakdown: {
    baseKg: number;
    grapeSuitability: number;
    grapeSuitabilityComponents: GrapeSuitabilityMetrics;
    naturalYield: number;
    ripeness: number;
    vineYield: number;
    health: number;
    finalMultiplier: number;
  };
}

export function calculateVineyardYieldBreakdown(vineyard: Vineyard): VineyardYieldBreakdown | null {
  if (!vineyard.grape) {
    return null;
  }

  // Base yield: ~1.5 kg per vine (realistic baseline for mature vines)
  const baseYieldPerVine = 1.5; // kg per vine
  const totalVines = vineyard.hectares * vineyard.density;
  
  // Get grape metadata for natural yield and suitability
  const grapeMetadata = GRAPE_CONST[vineyard.grape];
  if (!grapeMetadata) return null;
  const naturalYield = grapeMetadata.naturalYield; // 0-1 scale
  const grapeSuitabilityComponents = calculateGrapeSuitabilityMetrics(
    vineyard.grape,
    vineyard.region,
    vineyard.country,
    vineyard.altitude,
    vineyard.aspect,
    vineyard.soil
  );
  const grapeSuitability = grapeSuitabilityComponents.overall;
  
  // Apply multipliers: suitability, natural yield, ripeness, vine yield, and health all affect final yield
  const vineYieldFactor = vineyard.vineYield || 0.02; // Use persistent vine yield factor
  const yieldMultiplier = grapeSuitability * naturalYield * (vineyard.ripeness || 0) * vineYieldFactor * (vineyard.vineyardHealth || 1.0);
  const baseKg = totalVines * baseYieldPerVine;
  return {
    totalYield: Math.round(baseKg * yieldMultiplier),
    baseYieldPerVine,
    totalVines,
    breakdown: {
      baseKg,
      grapeSuitability,
      grapeSuitabilityComponents,
      naturalYield,
      ripeness: vineyard.ripeness || 0,
      vineYield: vineYieldFactor,
      health: vineyard.vineyardHealth || 1.0,
      finalMultiplier: yieldMultiplier,
    },
  };
}

/**
 * Update vineyard status and ripeness based on seasonal changes
 * @param season Current game season
 * @param week Current week (1-12)
 */
export async function updateVineyardRipeness(
  season: string,
  week: number = 1,
  weatherContext?: WeatherWeekContext
): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    const activities = await activitiesFeature.reads.getAll();
    const currentState = getGameState();
    const currentYear = weatherContext?.date.year || currentState.currentYear || 1;
    const companyId = getCurrentCompanyId() || 'default-company';
    const permanentEffects = await researchUpgradeFeature.effects.getPermanentEffects(companyId);
    const effectiveWeather = weatherContext ?? createWeatherWeekContext({
      ...currentState,
      currentYear,
      season: season as Season,
      week,
    });
    const vineyardsToUpdate: Vineyard[] = [];
    const activitiesToCancel: string[] = [];
    const cancelledActivityVineyards: string[] = [];
    
    for (const vineyard of vineyards) {
      if (!vineyard.grape) continue; // Skip vineyards without grapes
      
      let newStatus = vineyard.status;
      let newRipeness = vineyard.ripeness || 0;
      let isRipenessDeclining = vineyard.isRipenessDeclining ?? false;
      const plantingActivity = activities.find(
        (activity) => activity.category === WorkCategory.PLANTING &&
          activity.status === 'active' &&
          activity.targetId === vineyard.id,
      );
      const targetDensity = plantingActivity?.params.density || 0;
      const plantingProgressRatio = targetDensity > 0
        ? Math.min(1, (vineyard.density || 0) / targetDensity)
        : 1;
      
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
        const ripenessProjection = projectVineyardWeek({
          companyId,
          vineyard: { ...vineyard, status: newStatus, ripeness: newRipeness },
          weather: effectiveWeather,
          plantingProgressRatio,
          healthDecayMultiplier: permanentEffects.vineyardHealthDecayMultiplier,
          ripenessGrowthActive: isRipenessGrowthActiveForWeek(newStatus, season as Season, week),
        });

        if (ripenessProjection.ripeness.finalDelta > 0) {
          isRipenessDeclining = false;
          newRipeness = ripenessProjection.ripeness.projected;
        }
      }
      
      // Handle winter ripeness penalties - calibrated exponential-style ramp
      if (season === 'Winter' && newRipeness > 0) {
        isRipenessDeclining = true;
        // Calculate winter ripeness degradation using calibrated base + acceleration factors
        // Base degradation: ~3% per week, increasing by ~1% each week (week 12 ≈ -14%)
        const ripenessProjection = projectVineyardWeek({
          companyId,
          vineyard: { ...vineyard, status: newStatus, ripeness: newRipeness },
          weather: effectiveWeather,
          plantingProgressRatio,
          healthDecayMultiplier: permanentEffects.vineyardHealthDecayMultiplier,
          ripenessGrowthActive: false,
        });
        const weeklyDegradation = calculateWinterRipenessDegradation(week);
        const ripenessLoss = newRipeness - ripenessProjection.ripeness.projected;
        newRipeness = ripenessProjection.ripeness.projected;
        
        // Add notification for significant ripeness loss
        if (weeklyDegradation > 0.1 && newRipeness < vineyard.ripeness) {
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
        
        const success = await activitiesFeature.lifecycle.update(activityId, { status: 'cancelled' });
        
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
        const currentActivities = await activitiesFeature.reads.getAll();
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
        try {
          const { prestigeFeature } = await import('@/lib/features/prestige');
          await prestigeFeature.lifecycle.updateVineyard(vineyard.id);
        } catch (error) {
          console.error('Failed to update prestige after annual vine aging:', error);
        }
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
export async function updateVineyardHealthDegradation(
  season: string,
  _week: number,
  weatherContext?: WeatherWeekContext
): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    const activities = await activitiesFeature.reads.getAll();
    const companyId = getCurrentCompanyId();
    const currentState = getGameState();
    const contextYear = weatherContext?.date.year || currentState.currentYear || 1;
    const effectiveWeather = weatherContext ?? createWeatherWeekContext({
      ...currentState,
      currentYear: contextYear,
      season: season as Season,
      week: _week,
    });
    const permanentEffects = await researchUpgradeFeature.effects.getPermanentEffects(companyId || undefined);
    const vineyardsToUpdate: Vineyard[] = [];
    
    for (const vineyard of vineyards) {
      // Skip vineyards that are already at minimum health (0.1 = 10%)
      if (vineyard.vineyardHealth <= 0.1) continue;

      // Calculate new health
      const oldHealth = vineyard.vineyardHealth;
      const plantingActivity = activities.find(
        (activity) => activity.category === WorkCategory.PLANTING &&
          activity.status === 'active' &&
          activity.targetId === vineyard.id,
      );
      const targetDensity = plantingActivity?.params.density || 0;
      const plantingProgressRatio = targetDensity > 0
        ? Math.min(1, (vineyard.density || 0) / targetDensity)
        : 1;
      const healthProjection = projectVineyardWeek({
        companyId: companyId || 'default-company',
        vineyard,
        weather: effectiveWeather,
        plantingProgressRatio,
        healthDecayMultiplier: permanentEffects.vineyardHealthDecayMultiplier,
      });
      const newHealth = healthProjection.health.projected;
      const healthChange = newHealth - oldHealth;
      const actualDegradation = Math.max(0, oldHealth - newHealth);
      
      if (Math.abs(healthChange) > 0.001) { // Only update if significant change (>0.1%)
        // Update health trend with seasonal decay
        const currentTrend = vineyard.healthTrend || { seasonalDecay: 0, plantingImprovement: 0, netChange: 0 };
        const updatedSeasonalDecay = currentTrend.seasonalDecay + actualDegradation;
        const weatherRecovery = Math.max(0, healthChange);
        const updatedTrend = {
          ...currentTrend,
          seasonalDecay: updatedSeasonalDecay,
          netChange: currentTrend.plantingImprovement - updatedSeasonalDecay + weatherRecovery
        };
        
        const updatedVineyard = {
          ...vineyard,
          vineyardHealth: newHealth,
          healthTrend: updatedTrend
        };
        
        vineyardsToUpdate.push(updatedVineyard);
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
 * Calculate deterministic baseline vine yield for a given vine age.
 * Uses yearly expected deltas without randomness and mirrors progression charts.
 */
export function calculateBaselineVineYieldForAge(vineAge: number): number {
  let currentYield = 0.02;
  const normalizedAge = Math.max(0, Math.floor(vineAge));

  for (let age = 0; age < normalizedAge; age++) {
    const { expectedDelta, targetValue } = calculateVineYieldProgression(age, currentYield);

    if (targetValue !== undefined) {
      currentYield = Math.max(0.01, targetValue);
    } else {
      currentYield = Math.max(0.01, currentYield + expectedDelta);
    }
  }

  return currentYield;
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
      const baselinePerHa = calculateLandValue(
        v.country,
        v.region,
        v.altitude,
        v.aspect
      );
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
      return { ...v, landValue: baselinePerHa, vineyardTotalValue: adjustedTotal } as Vineyard;
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
          const { prestigeFeature } = await import('@/lib/features/prestige');
          await prestigeFeature.lifecycle.updateVineyard(vineyard.id);
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
): Promise<{ storageCapacityBlocked: boolean; completedWork: number; params?: Activity['params']; status?: Activity['status'] }> {
  let updatedParams: Activity['params'] | undefined;
  try {
    const workProgress = newCompletedWork / activity.totalWork;
    const oldProgress = oldCompletedWork / activity.totalWork;
    const progressThisTick = workProgress - oldProgress;
    
    if (progressThisTick <= 0) return { storageCapacityBlocked: false, completedWork: oldCompletedWork }; // No progress this tick
    
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === activity.targetId);
    
    if (!vineyard || !vineyard.grape) return { storageCapacityBlocked: false, completedWork: newCompletedWork };
    
    // Calculate current total yield based on current ripeness
    const currentTotalYield = calculateVineyardYield(vineyard);
    
    // Get the harvest progress as a percentage (0-1)
    const harvestProgress = workProgress;
    
    const harvestBaseline = activity.params.harvestBaseline || 0;
    const expectedHarvestedByNow = calculateHarvestedByProgress(currentTotalYield, harvestBaseline, harvestProgress);
    const previouslyHarvested = activity.params.harvestedSoFar || 0;
    
    // Calculate how much to harvest this tick
    const yieldThisTick = Math.max(0, expectedHarvestedByNow - previouslyHarvested);

    // Activity progress is only real once it can create a persisted harvest
    // portion. Never award work/XP for a storage-less or sub-minimum portion.
    if (!activity.params.storagePlanId) {
      return {
        storageCapacityBlocked: true,
        completedWork: oldCompletedWork,
        status: 'paused',
        params: { ...activity.params, storageCapacityBlocked: true },
      };
    }
    if (yieldThisTick < 0.1) {
      return {
        storageCapacityBlocked: true,
        completedWork: oldCompletedWork,
        status: 'paused',
        params: { ...activity.params, storageCapacityBlocked: true },
      };
    }
    
    // Only create wine batch if we're harvesting at least 0.1kg this tick (allow small batches)
    if (yieldThisTick >= 0.1) {
      let harvestQuantityThisTick = yieldThisTick;
      let capacityBlocked = false;
      const plannedVolume = initializeHarvestVolumeLitres(previouslyHarvested + harvestQuantityThisTick);
      if (!(await canStoragePlanHoldVolume(activity.params.storagePlanId, plannedVolume))) {
        const capacityLitres = await getStoragePlanCapacityLitres(activity.params.storagePlanId);
        const usedLitres = initializeHarvestVolumeLitres(previouslyHarvested);
        const remainingLitres = Math.max(0, capacityLitres - usedLitres);
        const capacityLimitedKg = Math.floor((remainingLitres / STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG) * 100) / 100;
        harvestQuantityThisTick = Math.min(yieldThisTick, capacityLimitedKg);
        capacityBlocked = true;
        if (harvestQuantityThisTick < 0.1) {
          return {
            storageCapacityBlocked: true,
            completedWork: oldCompletedWork,
            status: 'paused',
            params: { ...activity.params, storageCapacityBlocked: true },
          };
        }
      }
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
      // Round to 2 decimal places to preserve small batches
      const roundedYield = Math.round(harvestQuantityThisTick * 100) / 100;
      await createWineBatchFromHarvest(
        vineyard.id,
        vineyard.name,
        vineyard.grape,
        roundedYield,
        harvestStartDate,
        harvestEndDate,
        activity.params.storagePlanId,
        activity.params.outputBatchId
      );
      
      // Update the harvested amount in activity params
      const newHarvestedSoFar = previouslyHarvested + harvestQuantityThisTick;
      const completedWork = capacityBlocked
        ? Math.max(
          oldCompletedWork,
          Math.min(
            newCompletedWork,
            activity.totalWork * ((newHarvestedSoFar - harvestBaseline) / Math.max(Number.EPSILON, currentTotalYield - harvestBaseline)),
          ),
        )
        : newCompletedWork;
      const { storageCapacityBlocked: _previousBlock, ...baseParams } = activity.params;
      updatedParams = {
        ...baseParams,
        harvestedSoFar: newHarvestedSoFar,
        ...(capacityBlocked ? { storageCapacityBlocked: true } : {}),
        // Store current total yield for completion handler
        currentTotalYield: currentTotalYield
      };
      // Update vineyard status to show progress
      const updatedVineyard = {
        ...vineyard,
        status: 'Growing'
      };
      await saveVineyard(updatedVineyard);
      return {
        storageCapacityBlocked: capacityBlocked,
        completedWork,
        params: updatedParams,
        ...(capacityBlocked ? { status: 'paused' as const } : {}),
      };
    }
  } catch (error) {
    console.error(`Error in partial harvesting for activity ${activity.id}:`, error);
  }
  return { storageCapacityBlocked: false, completedWork: newCompletedWork, ...(updatedParams ? { params: updatedParams } : {}) };
}

export function calculateHarvestedByProgress(totalYield: number, harvestBaseline: number, progress: number): number {
  return harvestBaseline + Math.max(0, totalYield - harvestBaseline) * Math.max(0, Math.min(1, progress));
}

