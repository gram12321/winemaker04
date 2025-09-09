import { v4 as uuidv4 } from 'uuid';
import { Vineyard, createVineyard } from '@/lib/game/vineyard';
import { getGameState } from '@/gameState';
import { GrapeVariety, CLEARING_SUBTASK_RATES, CLEARING_SUBTASK_INITIAL_WORK, getResourceByGrapeVariety, REGION_ALTITUDE_RANGES } from '@/lib/core/constants/vineyardConstants';
import { addWineBatch } from './wineBatchService';
import { BASE_YIELD_PER_ACRE, BASELINE_VINE_DENSITY, CONVENTIONAL_YIELD_BONUS } from '@/lib/core/constants/gameConstants';
import { getVineyard, saveVineyard, removeVineyard, getAllVineyards } from '@/lib/database/vineyardDB';
import { WorkCategory } from '@/lib/game/workCalculator';
import { setActivityCompletionCallback, startActivityWithDisplayState, getActivityById } from '@/lib/game/activityManager';
import { toast } from '@/lib/ui/toast';

export async function addVineyard(vineyardData: Partial<Vineyard> = {}): Promise<Vineyard | null> {
    const id = vineyardData.id || uuidv4();
    const vineyard = createVineyard(id, vineyardData);
    return await saveVineyard(vineyard);
}
export async function updateVineyard(id: string, updates: Partial<Vineyard>): Promise<Vineyard | null> {
    // Get the existing vineyard
    const vineyard = getVineyard(id);
    if (!vineyard) return null;
    
    // Update and save the vineyard
    const updatedVineyard = { ...vineyard, ...updates };
    return await saveVineyard(updatedVineyard);
}

export function getVineyardById(id: string): Vineyard | null {
  return getVineyard(id);
}

export function getVineyards(): Vineyard[] {
  return getAllVineyards();
}

export async function deleteVineyard(id: string): Promise<boolean> {
  return await removeVineyard(id);
}

/**
 * Calculate the yield for a vineyard
 * @param vineyard The vineyard to calculate yield for
 * @returns The expected yield in kg
 */
export function calculateVineyardYield(vineyard: Vineyard): number {
  if (!vineyard.grape || vineyard.annualYieldFactor === 0 || vineyard.status === 'Harvested') {
    return 0;
  }

  const densityModifier = vineyard.density / BASELINE_VINE_DENSITY;
  const qualityMultiplier = (vineyard.ripeness + vineyard.vineyardHealth) / 2;
  let expectedYield = BASE_YIELD_PER_ACRE * vineyard.acres * qualityMultiplier * 
                      vineyard.annualYieldFactor * densityModifier;
  
  // Apply bonus multiplier if conventional
  if (vineyard.farmingMethod === 'Conventional') {
    expectedYield *= CONVENTIONAL_YIELD_BONUS;
  }

  return Math.round(expectedYield);
}

/**
 * Plants a vineyard with a specific grape variety
 * @param id ID of the vineyard to plant
 * @param grape Type of grape to plant
 * @param density Density of vines per acre (defaults to baseline density)
 * @returns The updated vineyard or null if not found
 */
export async function plantVineyard(id: string, grape: GrapeVariety, density: number = BASELINE_VINE_DENSITY): Promise<Vineyard | null> {
  try {
    const vineyard = getVineyard(id);
    if (!vineyard) {
      console.error(`Vineyard with ID ${id} not found`);
      return null;
    }

    // Initialize the vineyard for planting
    await updateVineyard(id, {
      status: 'Planting in progress',
    });

    // Import the activity manager and work calculator
    const { createActivityProgress } = await import('@/lib/game/workCalculator');
    const { addActivity, updateActivity } = await import('@/lib/game/activityManager');
    const { WorkCategory } = await import('@/lib/game/workCalculator');

    // Create and add the planting activity
    const plantingActivity = createActivityProgress(
      WorkCategory.PLANTING,
      vineyard.acres,
      {
        density: density,
        targetId: id,
        additionalParams: { 
          grape, 
          density,
          altitude: vineyard.altitude,
          country: vineyard.country,
          region: vineyard.region,
          resourceName: grape,
        },
        // Pass work modifiers for accurate work calculation
        workModifiers: (() => {
          // Calculate grape fragility modifier
          const grapeResource = getResourceByGrapeVariety(grape);
          const fragility = grapeResource?.fragile ?? 0; // Get fragility (0 = robust, 1 = fragile)
          const fragilityModifier = fragility; // Modifier increases work for fragile grapes
          
          // Calculate altitude modifier
          let altitudeModifier = 0;
          // Safely access the data with type assertions
          const countryData = REGION_ALTITUDE_RANGES[vineyard.country as keyof typeof REGION_ALTITUDE_RANGES];
          let altitudeRange: number[] | null = null;
          
          if (countryData && vineyard.region in countryData) {
            altitudeRange = countryData[vineyard.region as keyof typeof countryData] as unknown as number[];
          }
          
          if (altitudeRange && Array.isArray(altitudeRange) && altitudeRange.length >= 2) {
            const minAltitude = altitudeRange[0];
            const maxAltitude = altitudeRange[1];
            if (maxAltitude > minAltitude) {
              const medianAltitude = (minAltitude + maxAltitude) / 2;
              // Calculate deviation from median, positive for high altitude, negative for low
              // Modifier increases work for altitudes further from the median (0.5x deviation)
              const altitudeDeviation = Math.abs(vineyard.altitude - medianAltitude) / ((maxAltitude - minAltitude) / 2); // Normalize deviation 0 to 1+
              altitudeModifier = altitudeDeviation * 0.5; // Apply 0.5 factor to deviation
            }
          }
          
          return [fragilityModifier, altitudeModifier];
        })(),
        // Callback when planting is complete
        completionCallback: async () => {
          const gameState = getGameState();
          const { season } = gameState;
          
          // Determine initial status based on season
          let initialStatus = 'Growing';
          if (season === 'Winter') {
            initialStatus = 'No yield in first season';
          } else if (season === 'Summer') {
            initialStatus = 'Ripening';
          } else if (season === 'Fall') {
            initialStatus = 'Ready for Harvest';
          }
          
          // Update vineyard with new grape and density
          await updateVineyard(id, {
            grape,
            density,
            status: initialStatus,
            ripeness: season === 'Summer' || season === 'Fall' ? 0.1 : 0, // Start with some ripeness if in growing season
            vineyardHealth: 0.8, // Start with 80% health
            vineAge: 0,
          });
          // consoleService.success(`${grape} planted in ${vineyard.name} with a density of ${density} vines per acre.`);
        },
        // Progress callback for partial updates
        progressCallback: async (progress) => {
          // Calculate the applied work amount
          const totalWork = plantingActivity.totalWork;
          const appliedWork = Math.round(totalWork * progress);
          
          // Update the activity object in the global state
          updateActivity(plantingActivity.id, { appliedWork });
          
          // Update the vineyard status with raw work values
          if (progress > 0 && progress < 1) {
            await updateVineyard(id, {
              status: `Planting: ${appliedWork}/${totalWork}`,
            });
          }
        }
      }
    );

    // Add the activity to the game state
    addActivity(plantingActivity);

    // No need to call updateActivity here again, just add it
    /*
    const { updateActivity: initialUpdate } = await import('@/lib/game/activityManager');
    initialUpdate(plantingActivity.id, {
      appliedWork: 0 // Start with 0% progress
    });
    */

    // consoleService.info(`Started planting ${grape} in ${vineyard.name}.`);
    return vineyard;
  } catch (error) {
    console.error('Error planting vineyard:', error);
    return null;
  }
}

/**
 * Harvests grapes from a vineyard
 * @param id ID of the vineyard to harvest
 * @param amount Amount of grapes to harvest (kg). Use Infinity to harvest all.
 * @param storageLocations Array of storage locations and their quantities
 * @returns Object containing the updated vineyard and amount harvested, or null if failed
 */
export async function harvestVineyard(
  id: string, 
  amount: number, 
  storageLocations: { locationId: string; quantity: number }[] = []
): Promise<{ vineyard: Vineyard; harvestedAmount: number } | null> {
  try {
    const gameState = getGameState();
    const vineyard = gameState.vineyards.find(v => v.id === id);
    
    if (!vineyard) {
      throw new Error(`Vineyard ${id} not found`);
    }
    
    // Check if it's winter - don't allow harvest to start
    if (gameState.season === 'Winter') {
      console.error(`Cannot harvest during Winter - vines are dormant`);
      return null;
    }
    
    // Check if status is dormancy
    if (vineyard.status === 'Dormancy') {
      console.error(`Cannot harvest during dormancy period`);
      return null;
    }

    // Calculate remaining yield
    const remainingYield = vineyard.remainingYield === null
      ? calculateVineyardYield(vineyard)
      : vineyard.remainingYield;

    // Calculate total available storage space
    const totalStorageQuantity = storageLocations.reduce((sum, loc) => sum + loc.quantity, 0);
    
    // Calculate how much we can actually harvest based on storage constraints
    const harvestableAmount = Math.min(
      amount, // Requested amount
      remainingYield, // Available yield
      totalStorageQuantity // Available storage space
    );

    // If no storage is allocated, we can't harvest
    if (totalStorageQuantity <= 0) {
      throw new Error('No storage space allocated for harvest');
    }

    // Initialize the vineyard for harvesting
    await updateVineyard(id, {
      status: 'Harvesting in progress',
      remainingYield // Set the initial remaining yield
    });

    // Import the activity manager and work calculator
    const { createActivityProgress } = await import('@/lib/game/workCalculator');
    const { addActivity } = await import('@/lib/game/activityManager');
    const { WorkCategory } = await import('@/lib/game/workCalculator');

    // Use a different name for the imported function to avoid redeclaration
    const { updateActivity: updateActivityFn } = await import('@/lib/game/activityManager');

    // Format storage locations for display
    const storageNames = storageLocations.map(loc => {
      // In a real implementation, you would look up the storage location name
      return `Storage #${loc.locationId.slice(0, 4)}`;
    }).join(', ');

    // Create and add the harvesting activity
    const harvestingActivity = createActivityProgress(
      WorkCategory.HARVESTING,
      vineyard.acres, // Base work on vineyard size
      {
        targetId: id,
        additionalParams: { 
          totalAmount: harvestableAmount,
          harvestedSoFar: 0,
          storageLocations,
          grape: vineyard.grape,
          quality: vineyard.annualQualityFactor * vineyard.ripeness
        },
        // Callback when harvesting is complete
        completionCallback: async () => {
          // Get the current game state to check the season
          const currentGameState = getGameState();
          const { season } = currentGameState;

          // --- Process the final harvest amount --- 
          const harvestedSoFar = harvestingActivity.params?.harvestedSoFar || 0;
          const totalHarvestable = harvestingActivity.params?.totalAmount || 0;
          const finalHarvestAmount = totalHarvestable - harvestedSoFar;

          if (finalHarvestAmount > 0) {
            // Get the latest vineyard state for ripeness calculation
            const finalVineyardState = getVineyardById(id);
            const finalRipeness = finalVineyardState?.ripeness || vineyard.ripeness;

            await addWineBatch(
              id,
              vineyard.grape as GrapeVariety,
              finalHarvestAmount,
              vineyard.annualQualityFactor * finalRipeness, // Use final ripeness
              storageLocations,
              false, // Don't save game state yet
              finalRipeness // Pass final ripeness
            );
            // consoleService.info(`Harvested final ${Math.round(finalHarvestAmount).toLocaleString()} kg of ${vineyard.grape}.`);
          }
          // --- End final harvest processing ---
          
          // Calculate new remaining yield after harvest
          const newRemainingYield = remainingYield - harvestableAmount;

          // Determine the new status based on season and remaining yield
          let newStatus = 'Dormancy';
          
          if (season !== 'Winter' && newRemainingYield > 0) {
            // If it's not winter and there's still yield, keep it ready for harvest
            newStatus = 'Ready for Harvest';
          } else if (season === 'Winter' || newRemainingYield <= 0) {
            // If it's winter or no yield remains, go to dormancy
            newStatus = 'Dormancy';
          }
          
          // Update the vineyard with new status and remaining yield
          await updateVineyard(id, {
            remainingYield: newRemainingYield,
            status: newStatus,
            // Only reset ripeness if fully harvested or it's winter
            ...(newRemainingYield <= 0 || season === 'Winter' ? { ripeness: 0 } : {})
          });

          // consoleService.success(`Completed harvesting ${Math.round(harvestableAmount).toLocaleString()} kg of ${vineyard.grape} from ${vineyard.name}.`);
        },
        // Progress callback for partial updates
        progressCallback: async (progress) => {
          try {
            // Get current game state and vineyard
            const currentGameState = getGameState();
            const currentVineyard = currentGameState.vineyards.find(v => v.id === id);
            
            // Stop harvesting if it's now winter or vineyard is dormant
            if (currentGameState.season === 'Winter' || currentVineyard?.status === 'Dormancy') {
              // Mark activity as complete instead of using isComplete property
              await updateActivityFn(harvestingActivity.id, { 
                appliedWork: harvestingActivity.totalWork  // Set applied work to total work to mark as complete
              });
              // consoleService.info(`Harvesting of ${vineyard.grape} stopped: vineyard is now dormant`);
              return;
            }
            
            // Only process if we harvested at least 10kg
            const partialHarvestAmount = (harvestingActivity.params?.totalAmount || 0) * progress * 0.1; // 10% of work = 10% of grapes
            if (partialHarvestAmount < 10) return;
            
            // Calculate how much was harvested in this update
            const previousHarvested = harvestingActivity.params?.harvestedSoFar || 0;
            const totalHarvestable = harvestingActivity.params?.totalAmount || 0;
            const currentProgress = progress;
            // Ensure previousProgress is calculated correctly even if harvestedSoFar is 0
            const previousProgress = totalHarvestable > 0 ? (previousHarvested / totalHarvestable) : 0;
            
            // Calculate amount harvested in this tick
            const harvestedThisTick = totalHarvestable * (currentProgress - previousProgress);
            
            if (harvestedThisTick > 10) { // Only process if at least 10kg
              // Get current vineyard ripeness (may have increased during harvest)
              const currentRipeness = currentVineyard?.ripeness || vineyard.ripeness;
              
              // Create wine batch for this harvest increment
              const wineBatch = await addWineBatch(
                id,
                vineyard.grape as GrapeVariety,
                harvestedThisTick,
                vineyard.annualQualityFactor * currentRipeness,
                storageLocations,
                false, // Don't save to DB yet
                currentRipeness // Pass current ripeness value
              );
              
              if (wineBatch) {
                // Update the total harvested so far
                harvestingActivity.params!.harvestedSoFar = previousHarvested + harvestedThisTick;
                
                // consoleService.info(`Harvested ${Math.round(harvestedThisTick).toLocaleString()} kg of ${vineyard.grape} (${Math.round(progress * 100)}% complete).`);
              }
            }
            
            // Calculate the applied work amount for status
            const appliedWork = Math.round(harvestingActivity.totalWork * progress);
            const totalWork = harvestingActivity.totalWork;
            
            // Update the activity's appliedWork field
            harvestingActivity.appliedWork = appliedWork;

            // console.log(`[VineyardService] Updating activity ${harvestingActivity.id} progress: ${appliedWork}/${totalWork} (${Math.round(progress * 100)}%)`);

            // Update vineyard status with raw work values
            await updateVineyard(id, {
              status: `Harvesting: ${appliedWork}/${totalWork}`,
              // Don't update ripeness here - let the game tick system handle that
            });
          } catch (error) {
            console.error('Error in harvest progress callback:', error);
          }
        }
      }
    );

    // Add the activity to the game state
    addActivity(harvestingActivity);

    // For now, since we don't have staff, initialize with 0% progress
    const { updateActivity } = await import('@/lib/game/activityManager');
    updateActivity(harvestingActivity.id, {
      appliedWork: 0 // Start with 0% progress
    });

    // consoleService.info(`Started harvesting ${vineyard.grape} from ${vineyard.name}. Grapes will be stored in ${storageNames}.`);
    return {
      vineyard,
      harvestedAmount: 0 // Initial harvested amount is 0
    };
  } catch (error) {
    console.error('Error harvesting vineyard:', error);
    throw error;
  }
}

/**
 * Clear a vineyard to improve its health
 * @param id Vineyard ID to clear
 * @param options Clearing options including tasks, replanting intensity, and amendment method
 * @returns Updated vineyard or null if failed
 */
export async function clearVineyard(
  id: string, 
  options: { 
    tasks: { [key: string]: boolean };
    replantingIntensity: number;
    isOrganicAmendment: boolean;
  }
): Promise<Vineyard | null> {
  try {
    const initialVineyardState = getVineyardById(id);
    if (!initialVineyardState) {
      console.error('Vineyard not found for clearing', id);
      return null;
    }

    const selectedTasks = Object.entries(options.tasks)
      .filter(([_, selected]) => selected)
      .map(([taskId]) => taskId);

    if (selectedTasks.length === 0) {
      console.error('No clearing tasks selected');
      return null;
    }

    // Store the original health value to use later
    const originalHealth = initialVineyardState.vineyardHealth;

    // Update the vineyard but DON'T reset health
    const updatedVineyard = await updateVineyard(id, {
      status: 'Clearing in Progress',
      grape: null,
      vineAge: 0,
      ripeness: 0,
      remainingYield: null,
      // Don't reset vineyard health here
    });

    if (!updatedVineyard) {
      console.error('Failed to update vineyard for clearing', id);
      return null;
    }

    // Create activities for each selected task
    const createdActivityIds: string[] = [];
    for (const taskId of selectedTasks) {
      if (!Object.keys(CLEARING_SUBTASK_RATES).includes(taskId)) {
        console.warn(`Invalid clearing task: ${taskId}`);
        continue;
      }

      const rate = CLEARING_SUBTASK_RATES[taskId as keyof typeof CLEARING_SUBTASK_RATES];
      const initialWork = CLEARING_SUBTASK_INITIAL_WORK[taskId as keyof typeof CLEARING_SUBTASK_INITIAL_WORK];
      const taskTitle = getTaskTitle(taskId);

      const activityId = startActivityWithDisplayState(`clearingProgressState_${id}_${taskId}`, {
        category: WorkCategory.CLEARING,
        amount: initialVineyardState.acres,
        title: taskTitle,
        targetId: id,
        additionalParams: {
          taskId,
          isOrganic: options.isOrganicAmendment,
          taskRate: rate,
          taskInitialWork: initialWork,
          originalHealth: originalHealth // Store the original health value
        }
      });
      if (activityId) {
        createdActivityIds.push(activityId);
      }
    }

    // Check if any activities were actually created
    if (createdActivityIds.length === 0) {
      console.error('Failed to create any clearing activities');
      return updatedVineyard;
    }

    // --- Completion callback setup --- 
    // Use a counter for simplicity instead of complex filtering
    let completedTaskCount = 0;
    const totalTasks = createdActivityIds.length;
    const completedTasksSet = new Set<string>(); // Track completed task IDs

    createdActivityIds.forEach(activityId => {
      // Get the taskId associated with this activity
      const activity = getActivityById(activityId);
      const taskId = activity?.params?.taskId;

      setActivityCompletionCallback(activityId, async () => {
        if (!taskId) return; // Should not happen
        
        completedTaskCount++;
        completedTasksSet.add(taskId);

        // Update the vineyard's completed tasks list immediately when a task finishes
        const currentVineyard = getVineyardById(id);
        if (currentVineyard) {
          const updatedCompletedTasks = Array.from(new Set([...currentVineyard.completedClearingTasks, taskId]));
          await updateVineyard(id, { completedClearingTasks: updatedCompletedTasks });
        }

        // If this is the last task to complete
        if (completedTaskCount >= totalTasks) {
          // Calculate health improvement based on the ORIGINAL options
          let healthImprovement = 0;
          if (options.tasks['clear-vegetation']) healthImprovement += 0.10;
          if (options.tasks['remove-debris']) healthImprovement += 0.05;
          if (options.tasks['soil-amendment']) healthImprovement += 0.15;
          // Add bonus from replanting intensity if 'remove-vines' was selected
          if (options.tasks['remove-vines']) { 
            healthImprovement += (options.replantingIntensity / 100) * 0.20; // 20% max bonus from intensity
          }

          // Use the original health value as the base for improvement
          const newHealth = Math.min(1.0, originalHealth + healthImprovement);

          // Update vineyard with final status and calculated health
          await updateVineyard(id, {
            status: 'Cleared',
            vineyardHealth: newHealth,
            // Ensure completedClearingTasks reflects all tasks run
            completedClearingTasks: Array.from(completedTasksSet)
          });

          toast({ title: "Clearing Complete", description: `${initialVineyardState.name} has been cleared. Health improved to ${(newHealth * 100).toFixed(0)}%.` });
        }
      });
    });

    return updatedVineyard;
  } catch (error) {
    console.error('Error clearing vineyard:', error);
    toast({ title: "Error", description: "Failed to start clearing process.", variant: "destructive" });
    return null;
  }
}

// Helper function to get human-readable task titles
function getTaskTitle(taskId: string): string {
  const taskTitles: Record<string, string> = {
    'clear-vegetation': 'Clear Vegetation',
    'remove-debris': 'Remove Debris',
    'soil-amendment': 'Soil Amendment'
  };
  
  return taskTitles[taskId] || `Task: ${taskId}`;
}

/**
 * Uproot a vineyard, removing all planted grapes and resetting health
 * @param id Vineyard ID to uproot
 * @returns Updated vineyard or null if failed
 */
export async function uprootVineyard(
  id: string
): Promise<Vineyard | null> {
  try {
    const vineyard = getVineyardById(id);
    if (!vineyard) {
      throw new Error(`Vineyard with ID ${id} not found`);
    }

    // FIX: Import only the needed function
    const {
      startActivityWithDisplayState
    } = await import('@/lib/game/activityManager');

    const title = `Uprooting ${vineyard.name}`;
    const activityId = startActivityWithDisplayState('vineyardView', {
      category: WorkCategory.UPROOTING,
      amount: vineyard.acres,
      title,
      targetId: id,
      density: vineyard.density || 0,
      additionalParams: {
        altitude: vineyard.altitude,
        country: vineyard.country,
        region: vineyard.region,
      }
    });

    if (!activityId) {
      throw new Error('Failed to start uprooting activity');
    }

    const displayManager = (await import('@/lib/game/displayManager')).default;
    displayManager.updateDisplayState('vineyardView', {
      currentActivityId: activityId,
    });

    const { setActivityCompletionCallback } = await import('@/lib/game/activityManager');
    setActivityCompletionCallback(activityId, async () => {
      try {
        const { DEFAULT_VINEYARD_HEALTH } = await import('@/lib/core/constants/gameConstants');

        await updateVineyard(id, {
          grape: null,                // Remove grape
          vineAge: 0,                 // Reset vine age
          density: 0,                 // Reset density
          vineyardHealth: DEFAULT_VINEYARD_HEALTH, // Reset health to default
          status: 'Ready to be planted', // Set status
          ripeness: 0,                // Reset ripeness
          organicYears: 0,            // Reset organic years
          remainingYield: null,         // Clear remaining yield
          completedClearingTasks: [],   // Reset completed clearing tasks as well
        });

        const { consoleService } = await import('@/components/layout/Console');
        consoleService.success(`Uprooting of ${vineyard.name} complete! The vineyard is now ready for planting.`);

        displayManager.updateDisplayState('vineyardView', {
          currentActivityId: null,
        });

        const { toast } = await import('@/lib/ui/toast');
        toast({
          title: "Uprooting Complete",
          description: `The vineyard ${vineyard.name} is now ready for planting with new grape varieties.`
        });
      } catch (error) {
        console.error('Error in uprooting completion callback:', error);
        toast({ title: "Error", description: "Failed to complete uprooting.", variant: "destructive" });
      }
    });

    return vineyard; // Return the initial vineyard state (before activity completion)
  } catch (error) {
    console.error('Error uprooting vineyard:', error);
    toast({ title: "Error", description: "Failed to start uprooting process.", variant: "destructive" });
    return null;
  }
} 