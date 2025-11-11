import { v4 as uuidv4 } from 'uuid';
import { Vineyard, GrapeVariety, Aspect, ASPECTS } from '../../types/types';
import { saveVineyard, loadVineyards } from '../../database/activities/vineyardDB';
import { deleteVineyards } from '../../database/activities/vineyardDB';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { addVineyardAchievementPrestigeEvent, getBaseVineyardPrestige, updateBaseVineyardPrestigeEvent, calculateVineyardPrestigeFromEvents, calculateCurrentPrestige } from '../prestige/prestigeService';
import {
  calculateLandValue,
  calculateGrapeSuitabilityMetrics,
  type GrapeSuitabilityMetrics
} from './vineyardValueCalc';
import { getRandomHectares } from '../../utils/calculator';
import { getRandomFromArray } from '../../utils';
import { formatNumber } from '../../utils/utils';
import { COUNTRY_REGION_MAP, REGION_SOIL_TYPES, REGION_ALTITUDE_RANGES, DEFAULT_VINEYARD_HEALTH, NAMES, DEFAULT_VINE_DENSITY, GRAPE_CONST } from '../../constants';
import { addTransaction, getGameState } from '../index';
import { VineyardPurchaseOption } from './landSearchService';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { TRANSACTION_CATEGORIES } from '../../constants';
import { getActivitiesByTarget, removeActivityFromDb, loadActivitiesFromDb } from '@/lib/database/activities/activityDB';
import { updateGameState } from '@/lib/services/core/gameState';


// Helper functions for random vineyard generation
function getRandomFromObject<T>(obj: Record<string, T>): string {
  const keys = Object.keys(obj);
  return keys[Math.floor(Math.random() * keys.length)];
}

// Convert a vineyard purchase option to a full Vineyard object (domain-level, used by purchase flow)
function convertPurchaseOptionToVineyard(option: VineyardPurchaseOption): Omit<Vineyard, 'id'> {
  // Generate realistic health with some variation (0.4 to 0.8)
  const baseHealth = DEFAULT_VINEYARD_HEALTH;
  const healthVariation = (Math.random() - 0.5) * 0.4; // ±20% variation
  const vineyardHealth = Math.max(0.3, Math.min(0.9, baseHealth + healthVariation));

  return {
    name: option.name,
    country: option.country,
    region: option.region,
    hectares: option.hectares,
    grape: null,
    vineAge: null,
    soil: option.soil,
    altitude: option.altitude,
    aspect: option.aspect,
    density: 0, // No density until planted
    vineyardHealth,
    landValue: option.landValue,
    vineyardTotalValue: option.totalPrice,
    status: 'Barren',
    vineyardPrestige: 0,
    vineYield: 0.02,
    ripeness: 0,
    overgrowth: {
      vegetation: 0,
      debris: 0,
      uproot: 0,
      replant: 0
    }
  };
}

export function getRandomAspect(): Aspect {
  return getRandomFromArray(ASPECTS);
}

export function getRandomSoils(country: string, region: string): string[] {
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  const soils = countryData ? (countryData[region as keyof typeof countryData] as readonly string[] || []) : [];
  
  const numberOfSoils = Math.floor(Math.random() * 3) + 1; // 1-3 soil types
  const selectedSoils = new Set<string>();

  while (selectedSoils.size < numberOfSoils && selectedSoils.size < soils.length) {
    selectedSoils.add(getRandomFromArray(soils));
  }

  return Array.from(selectedSoils);
}

export function getRandomAltitude(country: string, region: string): number {
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
  
  // Generate realistic health with some variation (0.4 to 0.8)
  const baseHealth = DEFAULT_VINEYARD_HEALTH;
  const healthVariation = (Math.random() - 0.5) * 0.4; // ±20% variation
  const vineyardHealth = Math.max(0.3, Math.min(0.9, baseHealth + healthVariation));

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
    vineyardHealth, // Realistic health with variation
    landValue, // Calculated land value in euros per hectare
    vineyardTotalValue: landValue * hectares, // Total vineyard value
    status: 'Barren',
    ripeness: 0, // No ripeness until planted and growing
    vineyardPrestige: 0, // Will be calculated after vineyard is created
    vineYield: 0.02, // Default vine yield factor
    overgrowth: {
      vegetation: Math.floor(Math.random() * 11), // Random vegetation 0-10
      debris: Math.floor(Math.random() * 11),     // Random debris 0-10
      uproot: 0,     // No vines to uproot yet
      replant: 0     // No vines to replant yet
    }
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

// Initialize planting (called when planting activity starts)
export async function initializePlanting(vineyardId: string, grape: GrapeVariety): Promise<boolean> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard) {
    return false;
  }

  // Set initial planting state
  const updatedVineyard: Vineyard = {
    ...vineyard,
    grape, // Set the grape variety
    vineAge: 0, // Newly planted vines
    density: 0, // Start with 0 density, will increase during planting
    vineyardHealth: vineyard.vineyardHealth || DEFAULT_VINEYARD_HEALTH,
    status: 'Planting', // New status for active planting
    ripeness: 0,
    plantingHealthBonus: 0.2 // Start with 20% gradual health improvement over 5 years
  };

  await saveVineyard(updatedVineyard);
  triggerGameUpdate();
  return true;
}

/**
 * Voluntary sale of a single vineyard by the player
 * Applies a smaller penalty than forced seizure (default 10% vs 25%)
 */
export async function sellVineyard(
  vineyardId: string,
  options?: { penaltyRate?: number }
): Promise<{ success: boolean; proceeds?: number; error?: string }> {
  try {
    const penaltyRate = options?.penaltyRate ?? 0.10; // 10% default penalty on voluntary sale

    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === vineyardId);
    if (!vineyard) {
      return { success: false, error: 'Vineyard not found' };
    }

    const grossValue = vineyard.vineyardTotalValue || 0;
    const proceeds = Math.max(0, Math.round(grossValue * (1 - penaltyRate)));

    // Auto-cancel/remove any active activities on this vineyard
    const activeOnTarget = await getActivitiesByTarget(vineyardId);
    if (activeOnTarget.length > 0) {
      for (const act of activeOnTarget) {
        await removeActivityFromDb(act.id);
      }
      // Refresh activities in game state after removals
      const remaining = await loadActivitiesFromDb();
      updateGameState({ activities: remaining.filter(a => a.status === 'active') });
    }

    // Remove vineyard from portfolio
    await deleteVineyards([vineyardId]);

    // Add proceeds to company money
    if (proceeds > 0) {
      await addTransaction(
        proceeds,
        `Voluntary sale of ${vineyard.name} (${formatNumber(grossValue, { currency: true })} value, ${Math.round(penaltyRate * 100)}% fee)`,
        TRANSACTION_CATEGORIES.VINEYARD_SALE,
        false
      );
    }

    await notificationService.addMessage(
      `Sold ${vineyard.name} for ${formatNumber(proceeds, { currency: true })} (after ${Math.round(penaltyRate * 100)}% fee).`,
      'vineyardService.sellVineyard',
      'Vineyard Sale',
      NotificationCategory.FINANCE
    );

    triggerGameUpdate();
    return { success: true, proceeds };
  } catch (error) {
    console.error('Error selling vineyard:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMsg };
  }
}

/**
 * Annual vineyard value refresh
 * Recalculate vineyardTotalValue based on adjusted per-hectare value once per year
 */
// recalculateAnnualVineyardValues moved to vineyardManager

// Complete planting (called when planting activity finishes)
export async function completePlanting(vineyardId: string, targetDensity: number): Promise<boolean> {
  const vineyards = await loadVineyards();
  const vineyard = vineyards.find(v => v.id === vineyardId);
  
  if (!vineyard) {
    return false;
  }

  // Determine final status based on current season
  // If planting completes during a growing season, allow ripening immediately
  const currentSeason = getGameState().season;
  const isGrowingSeason = currentSeason === 'Spring' || currentSeason === 'Summer' || currentSeason === 'Fall';
  const finalStatus = isGrowingSeason ? 'Growing' : 'Planted';

  const updatedVineyard: Vineyard = {
    ...vineyard,
    density: targetDensity, // Ensure final density is set to target
    status: finalStatus
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

// Legacy function for backward compatibility (now calls initializePlanting + completePlanting)
export async function plantVineyard(vineyardId: string, grape: GrapeVariety, density?: number): Promise<boolean> {
  await initializePlanting(vineyardId, grape);
  return await completePlanting(vineyardId, density || DEFAULT_VINE_DENSITY);
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

// ===== EXPECTED YIELD CALCULATION =====

/**
 * Expected yield breakdown interface
 * Used for tooltips and detailed displays in Vineyard and VineyardModal
 */
export interface ExpectedYieldBreakdown {
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

/**
 * Calculate expected yield for a vineyard with detailed breakdown
 * This is the shared calculation used by both Vineyard.tsx and vineyardModal.tsx
 */
export function calculateVineyardExpectedYield(vineyard: Vineyard): ExpectedYieldBreakdown | null {
  if (!vineyard.grape) return null;
  
  // Base yield: ~1.5 kg per vine (realistic baseline for mature vines)
  const baseYieldPerVine = 1.5;
  const totalVines = vineyard.hectares * vineyard.density;
  const baseKg = totalVines * baseYieldPerVine;
  
  // Get grape metadata and suitability
  const grapeMetadata = GRAPE_CONST[vineyard.grape];
  if (!grapeMetadata) return null;
  
  const naturalYield = grapeMetadata.naturalYield;
  const grapeSuitabilityComponents = calculateGrapeSuitabilityMetrics(
    vineyard.grape,
    vineyard.region,
    vineyard.country,
    vineyard.altitude,
    vineyard.aspect,
    vineyard.soil
  );
  const grapeSuitability = grapeSuitabilityComponents.overall;
  
  // Calculate final multipliers
  const finalMultiplier = grapeSuitability * naturalYield * (vineyard.ripeness || 0) * (vineyard.vineYield || 0.02) * (vineyard.vineyardHealth || 1.0);
  const totalYield = Math.round(baseKg * finalMultiplier);
  
  return {
    totalYield,
    baseYieldPerVine,
    totalVines,
    breakdown: {
      baseKg,
      grapeSuitability,
      grapeSuitabilityComponents,
      naturalYield,
      ripeness: vineyard.ripeness || 0,
      vineYield: vineyard.vineYield || 0.02,
      health: vineyard.vineyardHealth || 1.0,
      finalMultiplier
    }
  };
}

// Purchase a vineyard from a purchase option
export async function purchaseVineyard(option: VineyardPurchaseOption): Promise<{ success: boolean; vineyard?: Vineyard; error?: string }> {
  try {
    // Check if user has enough money
    const gameState = getGameState();
    const currentMoney = gameState.money || 0;
    if (currentMoney < option.totalPrice) {
      const errorMsg = `Insufficient funds. You have ${formatNumber(currentMoney, { currency: true })} but need ${formatNumber(option.totalPrice, { currency: true })}.`;
      await notificationService.addMessage(errorMsg, 'vineyardService.purchaseVineyard', 'Insufficient Funds', NotificationCategory.FINANCE);
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
    await notificationService.addMessage(`Successfully purchased ${option.name} for ${formatNumber(option.totalPrice, { currency: true })}!`, 'vineyardService.purchaseVineyard', 'Vineyard Purchase', NotificationCategory.FINANCE);
    
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

