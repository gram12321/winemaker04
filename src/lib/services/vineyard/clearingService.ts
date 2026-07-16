import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateClearingHealth } from './clearingRules';

/**
 * Update vineyard health by applying health improvements from clearing activities
 * @param vineyardId - The vineyard ID
 * @param tasks - The clearing tasks that were completed
 * @param replantingIntensity - The intensity of replanting (0-100%)
 */
export async function updateVineyardHealth(
  vineyardId: string, 
  tasks: { [key: string]: boolean }, 
  replantingIntensity: number = 100
): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === vineyardId);
    
    if (!vineyard) {
      throw new Error(`Vineyard with ID ${vineyardId} not found`);
    }

    const intensity = replantingIntensity / 100;
    const newHealth = calculateClearingHealth(vineyard.vineyardHealth, tasks, replantingIntensity);
    
    
    // Handle vine age reduction for replanting and status reset for uprooting
    let newVineAge = vineyard.vineAge;
    let newVineYield = vineyard.vineYield;
    let newStatus = vineyard.status;
    let newGrape = vineyard.grape;
    let newDensity = vineyard.density;
    
    // Handle uprooting: reduce density (mutually exclusive with replanting)
    if (tasks['uproot-vines']) {
      const uprootIntensity = intensity;
      
      if (uprootIntensity >= 1.0) {
        // Full uprooting - reset to barren
        newStatus = 'Barren';
        newGrape = null;
        newDensity = 0;
        newVineAge = null;
        newVineYield = 0.02; // Reset to default yield
      } else {
        // Partial uprooting - reduce vine age and density proportionally
        if (vineyard.vineAge !== null) {
          newVineAge = Math.max(0, vineyard.vineAge * (1 - uprootIntensity));
          newDensity = Math.max(0, vineyard.density * (1 - uprootIntensity));
          
          // If all vines removed, reset to barren
          if (newVineAge <= 0) {
            newStatus = 'Barren';
            newGrape = null;
            newDensity = 0;
            newVineAge = null;
          }
        }
      }
    }
    
    // Handle replanting: reduce vine age and yield (keep same density, mutually exclusive with uprooting)
    let newPlantingHealthBonus = vineyard.plantingHealthBonus || 0;
    if (tasks['replant-vines'] && vineyard.vineAge !== null) {
      // Reduce vine age based on replanting intensity (density stays the same)
      newVineAge = Math.max(0, vineyard.vineAge * (1 - intensity));
      
      // Reduce vine yield temporarily for newly replanted vines
      // New vines start at low yield and gradually improve over ~5 years
      if (newVineAge < 5) {
        // Scale yield down for young vines (0-5 years)
        const yieldReduction = (5 - newVineAge) / 5; // 0-100% reduction for 0-5 year vines
        newVineYield = Math.max(0.02, vineyard.vineYield * (1 - yieldReduction * 0.5)); // Max 50% yield reduction
      }
      
      // Set planting health bonus for gradual improvement (scaled by intensity)
      // 100% replanting = 20% improvement over 5 years, 50% replanting = 10% improvement over 5 years
      const maxHealthImprovement = 0.2; // 20% maximum improvement
      newPlantingHealthBonus = maxHealthImprovement * intensity;
      
      // Replanting never resets to barren - it keeps the same grape variety
      // 100% replanting just means all vines are replaced with new ones of the same variety
    }
    
    // Update overgrowth object - reset specific task types to 0
    const currentOvergrowth = vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 };
    const updatedOvergrowth = { ...currentOvergrowth };
    
    // Reset specific task types to 0 when completed
    if (tasks['clear-vegetation']) updatedOvergrowth.vegetation = 0;
    if (tasks['remove-debris']) updatedOvergrowth.debris = 0;
    if (tasks['uproot-vines']) updatedOvergrowth.uproot = 0;
    if (tasks['replant-vines']) updatedOvergrowth.replant = 0;

    const updatedVineyard = {
      ...vineyard,
      vineyardHealth: newHealth,
      vineAge: newVineAge,
      vineYield: newVineYield,
      status: newStatus,
      grape: newGrape,
      density: newDensity,
      overgrowth: updatedOvergrowth,
      plantingHealthBonus: newPlantingHealthBonus // Set gradual health improvement for replanting
    };

    await saveVineyard(updatedVineyard);
    triggerGameUpdate();
  } catch (error) {
    console.error('Error updating vineyard health:', error);
    throw error;
  }
}
