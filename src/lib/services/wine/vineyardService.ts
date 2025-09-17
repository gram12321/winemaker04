// Simplified vineyard management service with direct database operations
import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety } from '../../types';
import { saveVineyard, loadVineyards } from '../../database/database';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { updateVineyardPrestigeEvents } from '../../database/prestigeService';
import { createWineBatchFromHarvest } from './wineBatchService';
import { calculateLandValue, calculateVineyardPrestige } from './vineyardValueCalc';
import { getRandomHectares } from '../../utils/calculator';
import { getRandomFromArray } from '../../utils';
import {   COUNTRY_REGION_MAP,   REGION_SOIL_TYPES,   REGION_ALTITUDE_RANGES } from '../../constants/vineyardConstants';
import { Aspect, ASPECTS } from '../../types';


// Helper functions for random vineyard generation
function getRandomFromObject<T>(obj: Record<string, T>): string {
  const keys = Object.keys(obj);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getRandomAspect(): Aspect {
  return getRandomFromArray(ASPECTS);
}

function getRandomSoils(country: string, region: string): string[] {
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  const soils = countryData ? (countryData[region as keyof typeof countryData] as readonly string[] || []) : [];
  
  const numberOfSoils = Math.floor(Math.random() * 3) + 1; // 1-3 soil types
  const selectedSoils = new Set<string>();

  while (selectedSoils.size < numberOfSoils && selectedSoils.size < soils.length) {
    selectedSoils.add(getRandomFromArray(soils));
  }

  return Array.from(selectedSoils);
}

function getRandomAltitude(country: string, region: string): number {
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange: [number, number] = countryData ? (countryData[region as keyof typeof countryData] as [number, number] || [0, 100]) : [0, 100];
  const [min, max] = altitudeRange;
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Create a new vineyard
export async function createVineyard(name: string): Promise<Vineyard> {
  // Generate random vineyard characteristics
  const country = getRandomFromObject(COUNTRY_REGION_MAP);
  const countryRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
  const region = countryRegions ? getRandomFromArray(countryRegions) : "Bordeaux";
  const aspect = getRandomAspect();
  const hectares = getRandomHectares();
  const soil = getRandomSoils(country, region);
  const altitude = getRandomAltitude(country, region);
  
  // Calculate land value using new calculation service
  const landValue = calculateLandValue(country, region, altitude, aspect);
  
  const vineyard: Vineyard = {
    id: uuidv4(),
    name,
    country,
    region,
    hectares,
    grape: null,
    vineAge: null, // Not planted yet
    soil,
    altitude,
    aspect,
    landValue, // Calculated land value in euros per hectare
    vineyardTotalValue: landValue * hectares, // Total vineyard value
    status: 'Barren',
    vineyardPrestige: 0 // Will be calculated after vineyard is created
  };

  // Calculate prestige after other properties are set
  vineyard.vineyardPrestige = calculateVineyardPrestige(vineyard);

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
    vineAge: 0, // Newly planted vines
    status: 'Planted'
  };

  // Recalculate prestige since grape variety affects it
  updatedVineyard.vineyardPrestige = calculateVineyardPrestige(updatedVineyard);

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

