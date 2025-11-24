import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../database/core/supabase';
import { addTransaction, getCurrentPrestige, clearPrestigeCache, getGameState, highscoreService, initializeCustomers, updateGameState } from '../index';
import { insertPrestigeEvent } from '../../database';
import { calculateAbsoluteWeeks, formatNumber } from '@/lib/utils';
import { GAME_INITIALIZATION, SEASONS, WEEKS_PER_SEASON } from '@/lib/constants';
import type { Season } from '@/lib/types/types';
import { RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';
import { unlockResearch, getAllResearchUnlocks } from '@/lib/database';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { GameDate } from '@/lib/types/types';
import { setPlayerBalance } from '../user/userBalanceService';
import { getCurrentCompany } from '../core/gameState';
import { companyService } from '../user/companyService';


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
    await addTransaction(difference, `Admin: Set to ${formatNumber(targetAmount, { currency: true })} (was ${formatNumber(currentMoney, { currency: true })})`, 'admin_cheat');
  }
}

/**
 * Set player cash balance for the user associated with the active company
 */
export async function adminSetPlayerBalance(amount: number): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const targetAmount = amount || 10000;
    
    // Get current company to find associated user
    const currentCompany = getCurrentCompany();
    if (!currentCompany) {
      return { success: false, error: 'No active company found' };
    }
    
    // Get full company data to access userId
    const company = await companyService.getCompany(currentCompany.id);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }
    
    if (!company.userId) {
      return { success: false, error: 'Company is not associated with a user' };
    }
    
    // Set the player balance
    const result = await setPlayerBalance(targetAmount, company.userId);
    
    if (result.success) {
      return {
        success: true,
        message: `Player balance set to ${formatNumber(targetAmount, { currency: true })} for user ${company.userId}`
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to set player balance'
      };
    }
  } catch (error) {
    console.error('Error setting player balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set player balance'
    };
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
 * Admin force: Generate test orders bypassing prestige checks
 * Uses the real sophisticated order generation logic with full wine evaluation
 */
export async function adminGenerateTestOrders(): Promise<{ totalOrdersCreated: number; customersGenerated: number }> {
  // Import needed functions
  const { generateOrder } = await import('../sales/generateOrder');
  const { getAllCustomers } = await import('../sales/createCustomer');
  const { getAllWineBatches } = await import('../wine/winery/inventoryService');
  const { loadVineyards } = await import('../../database/activities/vineyardDB');
  const { getCurrentPrestige } = await import('../core/gameState');
  const { SALES_CONSTANTS } = await import('../../constants/constants');
  
  // Get or create customers
  let allCustomers = await getAllCustomers();
  if (allCustomers.length === 0) {
    console.log('No customers found, creating them...');
    await initializeCustomers();
    allCustomers = await getAllCustomers();
  }
  
  if (allCustomers.length === 0) {
    console.log('❌ Failed to create customers');
    return { totalOrdersCreated: 0, customersGenerated: 0 };
  }
  
  // Select random customer
  const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
  const customerTypeConfig = SALES_CONSTANTS.CUSTOMER_TYPES[customer.customerType];
  
  // Load all available wines and vineyards (like real order generation)
  const [allBatches, allVineyards] = await Promise.all([
    getAllWineBatches(),
    loadVineyards()
  ]);
  const availableWines = allBatches.filter((batch: any) => batch.state === 'bottled' && batch.quantity > 0);
  
  if (availableWines.length === 0) {
    console.log('❌ No bottled wines available for orders');
    return { totalOrdersCreated: 0, customersGenerated: 0 };
  }
  
  // Get current prestige for realistic order evaluation
  const currentPrestige = await getCurrentPrestige();
  
  // Try to generate orders using the sophisticated flow (with diminishing returns)
  const orders = [];
  
  for (let i = 0; i < availableWines.length && orders.length < 3; i++) {
    const wineBatch = availableWines[i];
    const ordersPlaced = orders.length;
    
    // Calculate diminishing returns (same as real flow)
    const gameState = getGameState();
    const economyPhase = (gameState.economyPhase || 'Stable');
    const ECONOMY_SALES_MULTIPLIERS: Record<string, { multipleOrderPenaltyMultiplier: number }> = {
      Crash: { multipleOrderPenaltyMultiplier: 0.5 },
      Recession: { multipleOrderPenaltyMultiplier: 0.7 },
      Stable: { multipleOrderPenaltyMultiplier: 1.0 },
      Expansion: { multipleOrderPenaltyMultiplier: 1.2 },
      Boom: { multipleOrderPenaltyMultiplier: 1.5 }
    };
    const multiplePenaltyBoost = ECONOMY_SALES_MULTIPLIERS[economyPhase]?.multipleOrderPenaltyMultiplier || 1.0;
    const effectivePenalty = customerTypeConfig.multipleOrderPenalty * multiplePenaltyBoost;
    const multipleOrderModifier = Math.pow(effectivePenalty, ordersPlaced);
    
    // Find vineyard
    const vineyard = allVineyards.find((v: any) => v.id === wineBatch.vineyardId);
    if (!vineyard) continue;
    
    // Generate order using real logic (includes rejection probability, pricing, etc.)
    const order = await generateOrder(customer, wineBatch, multipleOrderModifier, vineyard, currentPrestige);
    
    if (order) {
      orders.push(order);
    }
  }
  
  if (orders.length > 0) {
    console.log('✅ Admin orders generated:', {
      customer: customer.name,
      customerType: customer.customerType,
      ordersCreated: orders.length,
      totalValue: orders.reduce((sum, o) => sum + o.totalValue, 0).toFixed(2),
      wines: orders.map(o => o.wineName)
    });
  } else {
    console.log('❌ No orders generated (all wines rejected by customer)');
  }
  
  return { 
    totalOrdersCreated: orders.length, 
    customersGenerated: 0 
  };
}

/**
 * Admin force: Generate test contract bypassing all checks
 * Uses the EXACT SAME contract generation logic as normal gameplay:
 * - Quantity calculation based on customer market share and type
 * - Requirement generation based on customer type and relationship
 * - Pricing based on difficulty and customer purchasing power
 * Only difference: bypasses eligibility and chance checks
 */
export async function adminGenerateTestContract(): Promise<{ success: boolean; message: string }> {
  const { getAllCustomers } = await import('../sales/createCustomer');
  const { generateContractForCustomer } = await import('../sales/contractGenerationService');
  const { saveWineContract } = await import('../../database/sales/contractDB');
  
  // Get or create customers
  let allCustomers = await getAllCustomers();
  if (allCustomers.length === 0) {
    console.log('No customers found, creating them...');
    await initializeCustomers();
    allCustomers = await getAllCustomers();
  }
  
  if (allCustomers.length === 0) {
    return { success: false, message: 'No customers available' };
  }
  
  // Select a random customer
  const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
  
  // Use the real contract generation logic (same quantity/pricing as normal contracts)
  // This shares the exact same calculateContractPricing function as normal gameplay
  const contract = await generateContractForCustomer(customer);
  
  // Save to database
  await saveWineContract(contract);
  
  console.log('✅ Admin contract generated:', {
    customer: customer.name,
    type: customer.customerType,
    requirements: contract.requirements.map(r => `${r.type}: ${r.value}`),
    quantity: contract.requestedQuantity,
    value: contract.totalValue.toFixed(2),
    multiYear: contract.terms ? `${contract.terms.durationYears} years` : 'single'
  });
  
  return { 
    success: true, 
    message: `Contract generated for ${customer.name}: ${contract.requestedQuantity} bottles @ $${contract.offeredPrice.toFixed(2)}/bottle` 
  };
}


/**
 * Clear all achievements
 */
export async function adminClearAllAchievements(): Promise<void> {
  const { error } = await supabase.from('achievements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

interface AdminGameDatePayload {
  week: number;
  season: Season;
  year: number;
}

/**
 * Set the game date (week, season, year) for the active company
 */
export async function adminSetGameDate({ week, season, year }: AdminGameDatePayload): Promise<void> {
  const normalizedWeek = Number.isFinite(week)
    ? Math.min(Math.max(Math.floor(week), 1), WEEKS_PER_SEASON)
    : GAME_INITIALIZATION.STARTING_WEEK;

  const normalizedSeason = SEASONS.includes(season) ? season : GAME_INITIALIZATION.STARTING_SEASON;

  const normalizedYear = Number.isFinite(year)
    ? Math.max(Math.floor(year), GAME_INITIALIZATION.STARTING_YEAR)
    : GAME_INITIALIZATION.STARTING_YEAR;

  await updateGameState({
    week: normalizedWeek,
    season: normalizedSeason,
    currentYear: normalizedYear
  });
}

/**
 * Grant all research projects to the active company
 */
export async function adminGrantAllResearch(): Promise<{ success: boolean; unlocked: number; alreadyUnlocked: number }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No active company found');
    }

    const gameState = getGameState();
    const gameDate: GameDate = {
      week: gameState.week || GAME_INITIALIZATION.STARTING_WEEK,
      season: (gameState.season || GAME_INITIALIZATION.STARTING_SEASON) as any,
      year: gameState.currentYear || GAME_INITIALIZATION.STARTING_YEAR
    };

    const absoluteWeeks = calculateAbsoluteWeeks(
      gameDate.week,
      gameDate.season,
      gameDate.year
    );

    // Get currently unlocked research IDs
    const existingUnlocks = await getAllResearchUnlocks(companyId);
    const unlockedIds = new Set(existingUnlocks.map(u => u.researchId));

    let unlocked = 0;
    let alreadyUnlocked = 0;

    // Unlock all research projects
    for (const project of RESEARCH_PROJECTS) {
      if (unlockedIds.has(project.id)) {
        alreadyUnlocked++;
        continue;
      }

      try {
        await unlockResearch({
          researchId: project.id,
          companyId,
          unlockedAt: gameDate,
          unlockedAtTimestamp: absoluteWeeks,
          metadata: {
            unlocks: project.unlocks || [],
            adminGranted: true
          }
        });
        unlocked++;
      } catch (error) {
        // If it's a duplicate error, count as already unlocked
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          alreadyUnlocked++;
        } else {
          console.error(`Error unlocking research ${project.id}:`, error);
        }
      }
    }

    console.log(`✅ Admin granted all research: ${unlocked} unlocked, ${alreadyUnlocked} already unlocked`);

    return {
      success: true,
      unlocked,
      alreadyUnlocked
    };
  } catch (error) {
    console.error('Error granting all research:', error);
    throw error;
  }
}

/**
 * Remove all research unlocks from the active company
 */
export async function adminRemoveAllResearch(): Promise<{ success: boolean; removed: number }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No active company found');
    }

    // Get all research unlocks for the company
    const unlocks = await getAllResearchUnlocks(companyId);
    const unlockIds = unlocks.map(u => u.id);

    if (unlockIds.length === 0) {
      return { success: true, removed: 0 };
    }

    // Delete all research unlocks
    const { error } = await supabase
      .from('research_unlocks')
      .delete()
      .in('id', unlockIds);

    if (error) {
      throw error;
    }

    console.log(`✅ Admin removed all research: ${unlockIds.length} unlocks removed`);

    return {
      success: true,
      removed: unlockIds.length
    };
  } catch (error) {
    console.error('Error removing all research:', error);
    throw error;
  }
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
