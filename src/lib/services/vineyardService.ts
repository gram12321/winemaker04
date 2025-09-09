// Simplified vineyard management service with direct database operations
import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety } from '../types';
import { saveVineyard, loadVineyards } from '../database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { getGameState } from '../gameState';

export const GRAPE_VARIETIES: GrapeVariety[] = [
  'Chardonnay', 'Pinot Noir', 'Cabernet Sauvignon', 'Merlot'
];

// Create a new vineyard
export async function createVineyard(name: string): Promise<Vineyard> {
  const gameState = getGameState();
  const vineyard: Vineyard = {
    id: uuidv4(),
    name,
    country: 'France',
    region: 'Burgundy',
    acres: 1,
    grape: null,
    isPlanted: false,
    status: 'Barren',
    createdAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    }
  };

  await saveVineyard(vineyard);
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
    isPlanted: true,
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
  
  if (!vineyard || vineyard.status !== 'Growing') {
    return { success: false };
  }

  // Simple harvest: 1000kg per vineyard
  const quantity = 1000;

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
