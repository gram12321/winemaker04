import { v4 as uuidv4 } from 'uuid';
import { Vineyard, Aspect, ASPECTS } from '../../types/types';
import { calculateLandValue, getAltitudeRating as getAltitudeRatingFromCalc, getAspectRating } from '../vineyard/vineyardValueCalc';
import { VineyardPurchaseOption } from '../vineyard/landSearchService';
import { generateVineyardName } from '../vineyard/vineyardService';
import { supabase } from '../../database/core/supabase';
import { addTransaction, getCurrentPrestige, clearPrestigeCache, generateSophisticatedWineOrders, getGameState, getAllVineyards, purchaseVineyard, highscoreService, initializeCustomers } from '../index';
import { insertPrestigeEvent } from '../../database';
import { calculateAbsoluteWeeks, formatCurrency, getRandomFromArray, getRandomHectares } from '@/lib/utils';
import { COUNTRY_REGION_MAP, REGION_SOIL_TYPES, REGION_ALTITUDE_RANGES } from '../../constants/vineyardConstants';

// Admin Quick Land Buy: constants
export const ADMIN_QUICK_LAND_BUY = {
  NUMBER_OF_OPTIONS: 5, // Number of vineyard options to generate
} as const;

// Admin Quick Land Buy: helper functions (admin-specific, not exported)
function adminGetRandomFromObject<T>(obj: Record<string, T>): string {
  const keys = Object.keys(obj);
  return keys[Math.floor(Math.random() * keys.length)];
}

function adminGetRandomAspect(): Aspect {
  return getRandomFromArray(ASPECTS);
}

function adminGetRandomSoils(country: string, region: string): string[] {
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  const soils = countryData ? (countryData[region as keyof typeof countryData] as readonly string[] || []) : [];
  
  const numberOfSoils = Math.floor(Math.random() * 3) + 1; // 1-3 soil types
  const selectedSoils = new Set<string>();

  while (selectedSoils.size < numberOfSoils && selectedSoils.size < soils.length) {
    selectedSoils.add(getRandomFromArray(soils));
  }

  return Array.from(selectedSoils);
}

function adminGetRandomAltitude(country: string, region: string): number {
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange: [number, number] = countryData ? (countryData[region as keyof typeof countryData] as [number, number] || [0, 100]) : [0, 100];
  const [min, max] = altitudeRange;
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Admin Quick Land Buy: build option list for modal (internal)
 * @param numberOfOptions Number of options to generate (defaults to ADMIN_QUICK_LAND_BUY.NUMBER_OF_OPTIONS)
 * @param existingVineyards Array of existing vineyards to avoid duplicates
 * @returns Array of vineyard purchase options
 */
function adminQuickLandBuyBuildOptions(
  numberOfOptions: number = ADMIN_QUICK_LAND_BUY.NUMBER_OF_OPTIONS,
  existingVineyards: Vineyard[] = []
): VineyardPurchaseOption[] {
  const options: VineyardPurchaseOption[] = [];
  const existingNames = new Set(existingVineyards.map(v => v.name));

  while (options.length < numberOfOptions) {
    const country = adminGetRandomFromObject(COUNTRY_REGION_MAP);
    const countryRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
    const region = countryRegions ? getRandomFromArray(countryRegions) : "Bordeaux";
    const aspect = adminGetRandomAspect();
    const hectares = getRandomHectares();
    const soil = adminGetRandomSoils(country, region);
    const altitude = adminGetRandomAltitude(country, region);
    
    // Generate vineyard name using the function from landSearchService
    const vineyardName = generateVineyardName(country, aspect);
    
    // Skip if name already exists
    if (existingNames.has(vineyardName)) {
      continue;
    }
    
    // Calculate land value
    const landValue = calculateLandValue(country, region, altitude, aspect);
    const totalPrice = landValue * hectares;
    
    // Get ratings for display
    const aspectRating = getAspectRating(country, region, aspect);
    const altitudeRating = getAltitudeRatingFromCalc(country, region, altitude);
    
    const option: VineyardPurchaseOption = {
      id: uuidv4(),
      name: vineyardName,
      country,
      region,
      hectares,
      soil,
      altitude,
      aspect,
      landValue,
      totalPrice,
      aspectRating,
      altitudeRating
    };
    
    options.push(option);
    existingNames.add(vineyardName); // Prevent duplicates in the same generation
  }
  
  return options;
}

// ===== ADMIN BUSINESS LOGIC FUNCTIONS =====

/**
 * Set gold/money for the active company
 */
export async function adminSetGoldToCompany(amount: number): Promise<void> {
  const targetAmount = amount || 10000;
  
  // Get current money from game state
  const gameState = getGameState();
  const currentMoney = gameState.money || 0;
  
  // Calculate the difference needed to reach target amount
  const difference = targetAmount - currentMoney;
  
  // Only add transaction if there's a difference
  if (difference !== 0) {
    await addTransaction(difference, `Admin: Set to ${formatCurrency(targetAmount)} (was ${formatCurrency(currentMoney)})`, 'admin_cheat');
  }
}

/**
 * Add prestige to the active company
 */
export async function adminAddPrestigeToCompany(amount: number): Promise<void> {
  const parsedAmount = amount || 100;
  
  try {
    const gameState = getGameState();
    const currentWeek = calculateAbsoluteWeeks(
      gameState.week!,
      gameState.season!,
      gameState.currentYear!
    );
    
    // Add prestige event using the proper service layer
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'admin_cheat' as any,
      amount_base: parsedAmount,
      created_game_week: currentWeek,
      decay_rate: 0, // Admin prestige doesn't decay
      source_id: null,
      payload: {
        reason: 'Admin cheat',
        addedAmount: parsedAmount
      }
    });
    
    // Clear prestige cache to force recalculation
    clearPrestigeCache();
    await getCurrentPrestige();
    
  } catch (error) {
    console.error('Failed to add prestige event:', error);
    throw error;
  }
}

/**
 * Clear all highscores
 */
export async function adminClearAllHighscores(): Promise<{ success: boolean; message?: string }> {
  return await highscoreService.clearHighscores();
}

/**
 * Clear company value highscores
 */
export async function adminClearCompanyValueHighscores(): Promise<{ success: boolean; message?: string }> {
  return await highscoreService.clearHighscores('company_value');
}

/**
 * Clear company value per week highscores
 */
export async function adminClearCompanyValuePerWeekHighscores(): Promise<{ success: boolean; message?: string }> {
  return await highscoreService.clearHighscores('company_value_per_week');
}

/**
 * Clear all companies from database
 */
export async function adminClearAllCompanies(): Promise<void> {
  const { error } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

/**
 * Clear all users from database
 */
export async function adminClearAllUsers(): Promise<void> {
  const { error } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

/**
 * Clear all companies and users from database
 */
export async function adminClearAllCompaniesAndUsers(): Promise<void> {
  try {
    // Clear companies first (due to foreign key constraints)
    const { error: companiesError } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (companiesError) throw companiesError;
    
    // Then clear users
    const { error: usersError } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (usersError) throw usersError;
  } catch (error) {
    console.error('Error clearing companies and users:', error);
    throw error;
  }
}

/**
 * Recreate all customers
 */
export async function adminRecreateCustomers(): Promise<void> {
  try {
    // First clear all existing customers
    const { error: deleteError } = await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) throw deleteError;
    
    // Then recreate them
    await initializeCustomers(1); // Initialize with base prestige
  } catch (error) {
    console.error('Error recreating customers:', error);
    throw error;
  }
}

/**
 * Generate test orders
 */
export async function adminGenerateTestOrders(): Promise<{ totalOrdersCreated: number; customersGenerated: number }> {
  const result = await generateSophisticatedWineOrders();
  if (result.totalOrdersCreated > 0) {
    console.log(`Generated ${result.totalOrdersCreated} order(s) from ${result.customersGenerated} customer(s)`);
  } else {
    console.log('No orders generated (insufficient prestige or no wines available)');
  }
  return result;
}

/**
 * Admin Quick Land Buy: generate options (public)
 */
export async function adminQuickLandBuyGenerateOptions(numberOfOptions: number = 5): Promise<VineyardPurchaseOption[]> {
  const existingVineyards = await getAllVineyards();
  return adminQuickLandBuyBuildOptions(numberOfOptions, existingVineyards);
}

/**
 * Admin Quick Land Buy: purchase selected option (public)
 */
export async function adminQuickLandBuyPurchase(option: VineyardPurchaseOption): Promise<void> {
  await purchaseVineyard(option);
}

/**
 * Clear all achievements
 */
export async function adminClearAllAchievements(): Promise<void> {
  const { error } = await supabase.from('achievements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

/**
 * Full database reset - clears all tables
 */
export async function adminFullDatabaseReset(): Promise<void> {
  try {
    // Clear all tables in the correct order to respect foreign key constraints
    // Delete child tables first, then parent tables
    const tables = [
      'relationship_boosts',
      'wine_orders', 
      'wine_batches',
      'vineyards',
      'activities',
      'achievements',
      'user_settings',
      'highscores',
      'prestige_events',
      'transactions',
      'company_customers',
      'notifications',  // Clear notifications before companies (it references companies)
      'companies',
      'users',
      'customers',
      'wine_log'
    ];

    const errors: string[] = [];
    
    // Clear all tables - use DELETE with proper ordering for foreign keys
    for (const table of tables) {
      try {
        let deleteQuery;
        
        // Handle different table structures
        if (table === 'company_customers') {
          // company_customers has composite primary key, no single id column
          deleteQuery = supabase.from(table).delete().neq('company_id', '00000000-0000-0000-0000-000000000000');
        } else {
          // All other tables have id columns - delete all records
          deleteQuery = supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
        
        const { error } = await deleteQuery;
        if (error) {
          const errorMsg = `Error clearing table ${table}: ${error.message}`;
          console.error(errorMsg, error);
          errors.push(errorMsg);
        }
      } catch (err) {
        const errorMsg = `Exception clearing table ${table}: ${err}`;
        console.error(errorMsg, err);
        errors.push(errorMsg);
      }
    }

    // Check if there were any errors
    if (errors.length > 0) {
      console.error('Full database reset errors:', errors);
      throw new Error(`Database reset failed with ${errors.length} errors: ${errors.join(', ')}`);
    }
  } catch (error) {
    const errorMessage = `Critical error during full database reset: ${error}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}
