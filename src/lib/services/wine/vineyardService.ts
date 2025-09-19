// Simplified vineyard management service with direct database operations
import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety } from '../../types';
import { saveVineyard, loadVineyards } from '../../database/database';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { addVineyardAchievementPrestigeEvent, getBaseVineyardPrestige, updateBaseVineyardPrestigeEvent } from '../../database/prestigeService';
import { createWineBatchFromHarvest } from './wineBatchService';
import { calculateLandValue } from './vineyardValueCalc';
import { getRandomHectares } from '../../utils/calculator';
import { getRandomFromArray } from '../../utils';
import {   COUNTRY_REGION_MAP,   REGION_SOIL_TYPES,   REGION_ALTITUDE_RANGES } from '../../constants/vineyardConstants';
import { NAMES } from '../../constants/names';
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

// Generate a vineyard name based on country and aspect
export function generateVineyardName(country: string, aspect: Aspect): string {
  const isFemaleAspect = ["East", "Southeast", "South", "Southwest"].includes(aspect);
  const nameData = NAMES[country as keyof typeof NAMES];
  
  if (!nameData) {
    console.error(`No name data found for country: ${country}. Cannot generate vineyard name.`);
    throw new Error(`No name data found for country: ${country}. Cannot generate vineyard name.`);
  }
  
  // Select appropriate name list based on aspect gender
  const names = isFemaleAspect ? nameData.firstNames.female : nameData.firstNames.male;
  
  // Select a random name
  const randomIndex = Math.floor(Math.random() * names.length);
  const selectedName = names[randomIndex];
  
  // Construct the name like "[Random Name]'s [Aspect] Vineyard"
  return `${selectedName}'s ${aspect} Vineyard`;
}

// Create a new vineyard with auto-generated name by default
export async function createVineyard(name?: string): Promise<Vineyard> {
  const country = getRandomFromObject(COUNTRY_REGION_MAP);
  const countryRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
  const region = countryRegions ? getRandomFromArray(countryRegions) : "Bordeaux";
  const aspect = getRandomAspect();
  const hectares = getRandomHectares();
  const soil = getRandomSoils(country, region);
  const altitude = getRandomAltitude(country, region);
  
  // Generate vineyard name if not provided
  const vineyardName = name || generateVineyardName(country, aspect);
  
  // Calculate land value using new calculation service
  const landValue = calculateLandValue(country, region, altitude, aspect);
  
  const vineyard: Vineyard = {
    id: uuidv4(),
    name: vineyardName,
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


  await saveVineyard(vineyard);
  
  // Ensure base vineyard prestige events exist immediately upon creation
  try {
    await updateBaseVineyardPrestigeEvent(vineyard.id);
  } catch (error) {
    console.warn('Failed to initialize base vineyard prestige on creation:', error);
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


  await saveVineyard(updatedVineyard);
  
  // Add achievement prestige event for planting (uses base vineyard prestige as multiplier)
  try {
    // Ensure base vineyard prestige events exist/are up to date first
    await updateBaseVineyardPrestigeEvent(vineyardId);
    // Then read the base prestige as multiplier
    const basePrestige = await getBaseVineyardPrestige(vineyardId);
    await addVineyardAchievementPrestigeEvent(
      'planting',
      vineyardId,
      basePrestige,
      `Planted ${grape} vines`
    );
  } catch (error) {
    console.error('Failed to create planting prestige event:', error);
  }
  
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
  
  // Add achievement prestige event for harvesting (uses base vineyard prestige as multiplier)
  try {
    const basePrestige = await getBaseVineyardPrestige(vineyardId);
    await addVineyardAchievementPrestigeEvent(
      'harvest',
      vineyardId,
      basePrestige,
      `Harvested ${quantity}kg`
    );
  } catch (error) {
    console.error('Failed to create harvest prestige event:', error);
  }
  
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

