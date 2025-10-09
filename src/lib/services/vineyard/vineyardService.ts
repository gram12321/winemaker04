import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety, Aspect, ASPECTS } from '../../types/types';
import { saveVineyard, loadVineyards } from '../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { addVineyardAchievementPrestigeEvent, getBaseVineyardPrestige, updateBaseVineyardPrestigeEvent, calculateVineyardPrestigeFromEvents, calculateCurrentPrestige } from '../prestige/prestigeService';
import { calculateLandValue } from './vineyardValueCalc';
import { getRandomHectares } from '../../utils/calculator';
import { getRandomFromArray } from '../../utils';
import { COUNTRY_REGION_MAP, REGION_SOIL_TYPES, REGION_ALTITUDE_RANGES, DEFAULT_VINEYARD_HEALTH, NAMES, DEFAULT_VINE_DENSITY } from '../../constants';
import { addTransaction } from '../user/financeService';
import { VineyardPurchaseOption, convertPurchaseOptionToVineyard } from './vinyardBuyingService';
import { getGameState } from '../core/gameState';
import { formatCurrency } from '../../utils/utils';
import { notificationService } from '../../../components/layout/NotificationCenter';


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
    density: 0, // No density until planted
    vineyardHealth: DEFAULT_VINEYARD_HEALTH, // Perfect health as placeholder
    landValue, // Calculated land value in euros per hectare
    vineyardTotalValue: landValue * hectares, // Total vineyard value
    status: 'Barren',
    ripeness: 0, // No ripeness until planted and growing
    vineyardPrestige: 0, // Will be calculated after vineyard is created
    vineYield: 0.02 // Default vine yield factor
  };


  await saveVineyard(vineyard);
  
  // Ensure base vineyard prestige events exist immediately upon creation
  try {
    await updateBaseVineyardPrestigeEvent(vineyard.id);
    
    // Calculate prestige for this specific vineyard only (more efficient than full recalculation)
    const vineyardPrestige = await calculateVineyardPrestigeFromEvents(vineyard.id);
    
    // Update the vineyard with the calculated prestige
    const updatedVineyard = { ...vineyard, vineyardPrestige };
    await saveVineyard(updatedVineyard);
  } catch (error) {
    console.error('Failed to initialize base vineyard prestige on creation:', error);
  }
  
  triggerGameUpdate();
  return vineyard;
}

// Plant a vineyard
export async function plantVineyard(vineyardId: string, grape: GrapeVariety, density?: number): Promise<boolean> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard) {
    return false;
  }

  // Determine initial status based on current season
  // If planting completes during a growing season, allow ripening immediately
  const currentSeason = getGameState().season;
  const isGrowingSeason = currentSeason === 'Spring' || currentSeason === 'Summer' || currentSeason === 'Fall';
  const initialStatus = isGrowingSeason ? 'Growing' : 'Planted';
  const initialRipeness = 0;

  const updatedVineyard: Vineyard = {
    ...vineyard,
    grape,
    vineAge: 0, // Newly planted vines
    density: density || DEFAULT_VINE_DENSITY, // Use provided density or default
    vineyardHealth: vineyard.vineyardHealth || DEFAULT_VINEYARD_HEALTH, // Ensure health is set
    status: initialStatus,
    ripeness: initialRipeness
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
      basePrestige
    );
  } catch (error) {
    console.error('Failed to create planting prestige event:', error);
  }
  
  triggerGameUpdate();
  return true;
}

// Get all vineyards with refreshed prestige values
export async function getAllVineyards(): Promise<Vineyard[]> {
  try {
    // First, ensure prestige calculations are up to date
    await calculateCurrentPrestige();
    
    // Then load the vineyards (which should now have updated prestige values)
    return await loadVineyards();
  } catch (error) {
    console.error('Failed to refresh vineyard prestige, loading from cache:', error);
    // Fallback to cached values if prestige calculation fails
    return await loadVineyards();
  }
}

// Purchase a vineyard from a purchase option
export async function purchaseVineyard(option: VineyardPurchaseOption): Promise<{ success: boolean; vineyard?: Vineyard; error?: string }> {
  try {
    // Check if user has enough money
    const gameState = getGameState();
    const currentMoney = gameState.money || 0;
    if (currentMoney < option.totalPrice) {
      const errorMsg = `Insufficient funds. You have ${formatCurrency(currentMoney)} but need ${formatCurrency(option.totalPrice)}.`;
      await notificationService.addMessage(errorMsg, 'vineyardService.purchaseVineyard', 'Insufficient Funds', 'Finance');
      return { 
        success: false, 
        error: errorMsg
      };
    }

    // Convert purchase option to vineyard
    const vineyardData = convertPurchaseOptionToVineyard(option);
    const vineyard: Vineyard = {
      ...vineyardData,
      id: option.id, // Use the option ID as the vineyard ID
      density: 0 // No density until planted
    };

    // Save the vineyard
    await saveVineyard(vineyard);

    // Add transaction for the purchase
    await addTransaction(
      -option.totalPrice, // Negative amount for expense
      `Purchase of ${option.name}`,
      'Vineyard Purchase',
      false
    );

    // Ensure base vineyard prestige events exist immediately upon creation
    try {
      await updateBaseVineyardPrestigeEvent(vineyard.id);
    } catch (error) {
      console.error('Failed to initialize base vineyard prestige on purchase:', error);
    }

    triggerGameUpdate();
    
    // Add success notification
    await notificationService.addMessage(`Successfully purchased ${option.name} for ${formatCurrency(option.totalPrice)}!`, 'vineyardService.purchaseVineyard', 'Vineyard Purchase', 'Finance');
    
    return { success: true, vineyard };
  } catch (error) {
    console.error('Error purchasing vineyard:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return { 
      success: false, 
      error: errorMsg
    };
  }
}

