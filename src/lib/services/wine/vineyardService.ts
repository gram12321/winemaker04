// Simplified vineyard management service with direct database operations
import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety } from '../../types';
import { saveVineyard, loadVineyards } from '../../database/database';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { updateVineyardPrestigeEvents } from '../../database/prestigeService';
import { createWineBatchFromHarvest } from './wineBatchService';

export const GRAPE_VARIETIES: GrapeVariety[] = [
  'Barbera', 'Chardonnay', 'Pinot Noir', 'Primitivo', 'Sauvignon Blanc'
];

// Create a new vineyard
export async function createVineyard(name: string): Promise<Vineyard> {
  
  const vineyard: Vineyard = {
    id: uuidv4(),
    name,
    country: 'France',
    region: 'Burgundy',
    acres: 1,
    grape: null,
    vineAge: 0, // New vines
    soil: ['Clay', 'Limestone'], // Default soil composition
    altitude: 200, // Default altitude in meters
    aspect: 'South', // Default south-facing aspect
    landValue: 0.5, // Default land value placeholder
    status: 'Barren',
    vineyardPrestige: 0 // Starting prestige
  };

  await saveVineyard(vineyard);
  
  // Update vineyard prestige events
  try {
    await updateVineyardPrestigeEvents();
    // Vineyard prestige events updated - will be reflected in next calculation
  } catch (error) {
    console.error('Failed to update vineyard prestige events:', error);
  }
  
  triggerGameUpdate();
  return vineyard;
}

// Plant a vineyard
export async function plantVineyard(vineyardId: string, grape: GrapeVariety): Promise<boolean> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard) {
    return false;
  }

  const updatedVineyard: Vineyard = {
    ...vineyard,
    grape,
    vineAge: 0, // Reset vine age when planting new vines
    status: 'Planted'
  };

  await saveVineyard(updatedVineyard);
  triggerGameUpdate();
  return true;
}

// Grow vineyard (Planted -> Growing)
export async function growVineyard(vineyardId: string): Promise<boolean> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard || vineyard.status !== 'Planted') {
    return false;
  }

  const updatedVineyard: Vineyard = {
    ...vineyard,
    status: 'Growing'
  };

  await saveVineyard(updatedVineyard);
  triggerGameUpdate();
  return true;
}

// Harvest vineyard
export async function harvestVineyard(vineyardId: string): Promise<{ success: boolean; quantity?: number }> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard || vineyard.status !== 'Growing' || !vineyard.grape) {
    return { success: false };
  }

  // Simple harvest: 1000kg per vineyard
  const quantity = 1000;

  // Create wine batch from harvest
  await createWineBatchFromHarvest(vineyard.id, vineyard.name, vineyard.grape, quantity);

  const updatedVineyard: Vineyard = {
    ...vineyard,
    status: 'Harvested'
  };

  await saveVineyard(updatedVineyard);
  triggerGameUpdate();

  return { success: true, quantity };
}

// Reset vineyard to dormant, then back to growing
export async function resetVineyard(vineyardId: string): Promise<boolean> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard || vineyard.status !== 'Harvested') {
    return false;
  }

  const updatedVineyard: Vineyard = {
    ...vineyard,
    status: 'Growing'
  };

  await saveVineyard(updatedVineyard);
  triggerGameUpdate();
  return true;
}

// Get all vineyards
export async function getAllVineyards(): Promise<Vineyard[]> {
  return await loadVineyards();
}
