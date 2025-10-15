import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { CLEARING_TASKS } from '../../constants/activityConstants';

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

    let newHealth = vineyard.vineyardHealth;
    const intensity = replantingIntensity / 100;
    
    // Apply additive health improvements first
    if (tasks['clear-vegetation']) {
      const task = Object.values(CLEARING_TASKS).find(t => t.id === 'clear-vegetation');
      if (task && 'healthImprovement' in task && task.healthImprovement) {
        newHealth = Math.min(1.0, newHealth + task.healthImprovement);
      }
    }
    if (tasks['remove-debris']) {
      const task = Object.values(CLEARING_TASKS).find(t => t.id === 'remove-debris');
      if (task && 'healthImprovement' in task && task.healthImprovement) {
        newHealth = Math.min(1.0, newHealth + task.healthImprovement);
      }
    }
    
    // Handle setHealth tasks (uproot and replant) - these set absolute values
    if (tasks['uproot-vines']) {
      const uprootTask = Object.values(CLEARING_TASKS).find(t => t.id === 'uproot-vines');
      if (uprootTask && 'setHealth' in uprootTask && uprootTask.setHealth !== undefined) {
        // Blend current health with set health based on intensity
        newHealth = newHealth * (1 - intensity) + uprootTask.setHealth * intensity;
      }
    }
    
    if (tasks['replant-vines']) {
      const replantTask = Object.values(CLEARING_TASKS).find(t => t.id === 'replant-vines');
      if (replantTask && 'setHealth' in replantTask && replantTask.setHealth !== undefined) {
        // Blend current health with set health based on intensity
        newHealth = newHealth * (1 - intensity) + replantTask.setHealth * intensity;
      }
    }
    
    // Ensure health stays within bounds
    newHealth = Math.max(0.1, Math.min(1.0, newHealth));
    
    // Calculate health change for logging
    const healthChange = newHealth - vineyard.vineyardHealth;
    
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
    
    // Update vineyard with new health and adjusted vine properties
    const updatedVineyard = {
      ...vineyard,
      vineyardHealth: newHealth,
      vineAge: newVineAge,
      vineYield: newVineYield,
      status: newStatus,
      grape: newGrape,
      density: newDensity,
      yearsSinceLastClearing: 0, // Reset to 0 since clearing was just completed
      plantingHealthBonus: newPlantingHealthBonus // Set gradual health improvement for replanting
    };

    await saveVineyard(updatedVineyard);
    triggerGameUpdate();
    
    const changeSign = healthChange >= 0 ? '+' : '';
    let logMessage = `Updated vineyard ${vineyard.name}: health ${(vineyard.vineyardHealth * 100).toFixed(0)}% → ${(newHealth * 100).toFixed(0)}% (${changeSign}${(healthChange * 100).toFixed(0)}%)`;
    
    // Log status changes if uprooting occurred
    if (tasks['uproot-vines'] && newStatus !== vineyard.status) {
      logMessage += `, status ${vineyard.status} → ${newStatus}`;
      if (newGrape !== vineyard.grape) {
        logMessage += `, grape ${vineyard.grape || 'none'} → ${newGrape || 'none'}`;
      }
    }
    
    // Log vine age and yield changes if replanting occurred
    if (tasks['replant-vines'] && (newVineAge !== vineyard.vineAge || newVineYield !== vineyard.vineYield)) {
      logMessage += `, vine age ${vineyard.vineAge} → ${newVineAge} years, yield ${(vineyard.vineYield * 100).toFixed(1)}% → ${(newVineYield * 100).toFixed(1)}%`;
    }
    
    console.log(logMessage);
    
  } catch (error) {
    console.error('Error updating vineyard health:', error);
    throw error;
  }
}

/**
 * Get all vineyards that can be cleared (have some health below 100%)
 */
export async function getClearableVineyards(): Promise<Array<{ id: string; name: string; health: number; canImprove: boolean }>> {
  try {
    const vineyards = await loadVineyards();
    
    return vineyards.map(vineyard => ({
      id: vineyard.id,
      name: vineyard.name,
      health: vineyard.vineyardHealth,
      canImprove: vineyard.vineyardHealth < 1.0
    }));
  } catch (error) {
    console.error('Error getting clearable vineyards:', error);
    return [];
  }
}
