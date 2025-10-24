import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../database/core/supabase';
import { addTransaction, getCurrentPrestige, clearPrestigeCache, generateSophisticatedWineOrders, getGameState, highscoreService, initializeCustomers } from '../index';
import { insertPrestigeEvent } from '../../database';
import { calculateAbsoluteWeeks, formatCurrency } from '@/lib/utils';


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
