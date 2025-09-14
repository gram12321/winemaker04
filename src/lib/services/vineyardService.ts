// Simplified vineyard management service with direct database operations
import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety } from '../types';
import { saveVineyard, loadVineyards } from '../database/database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { getGameState } from './gameState';
import { updateVineyardPrestigeEvents } from '../database/prestigeService';
import { createWineBatchFromHarvest } from './wineBatchService';
import { getCurrentCompanyId } from '../utils/companyUtils';

export const GRAPE_VARIETIES: GrapeVariety[] = [
  'Chardonnay', 'Pinot Noir', 'Cabernet Sauvignon', 'Merlot'
];

// Create a new vineyard
export async function createVineyard(name: string): Promise<Vineyard> {
  const companyId = getCurrentCompanyId();
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
    },
    // Pricing factors (using placeholders for now)
    landValue: 0.5, // Default land value placeholder
    fieldPrestige: 1 // Default field prestige placeholder
  };

  await saveVineyard(vineyard, companyId);
  
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
  const companyId = getCurrentCompanyId();
  const vineyards = await loadVineyards(companyId);
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

  await saveVineyard(updatedVineyard, companyId);
  triggerGameUpdate();
  return true;
}

// Grow vineyard (Planted -> Growing)
export async function growVineyard(vineyardId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  const vineyards = await loadVineyards(companyId);
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard || vineyard.status !== 'Planted') {
    return false;
  }

  const updatedVineyard: Vineyard = {
    ...vineyard,
    status: 'Growing'
  };

  await saveVineyard(updatedVineyard, companyId);
  triggerGameUpdate();
  return true;
}

// Harvest vineyard
export async function harvestVineyard(vineyardId: string): Promise<{ success: boolean; quantity?: number }> {
  const companyId = getCurrentCompanyId();
  const vineyards = await loadVineyards(companyId);
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

  await saveVineyard(updatedVineyard, companyId);
  triggerGameUpdate();

  return { success: true, quantity };
}

// Reset vineyard to dormant, then back to growing
export async function resetVineyard(vineyardId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  const vineyards = await loadVineyards(companyId);
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard || vineyard.status !== 'Harvested') {
    return false;
  }

  const updatedVineyard: Vineyard = {
    ...vineyard,
    status: 'Growing'
  };

  await saveVineyard(updatedVineyard, companyId);
  triggerGameUpdate();
  return true;
}

// Get all vineyards
export async function getAllVineyards(): Promise<Vineyard[]> {
  const companyId = getCurrentCompanyId();
  return await loadVineyards(companyId);
}
