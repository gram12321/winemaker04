import { getCurrentCompany } from '../services/core/gameState';
import { supabase } from '../database/core/supabase';

// ===== COMPANY UTILITIES =====

/**
 * Get current company ID - fails fast if no company is active
 * This prevents silent failures when operations run against non-existent companies
 * 
 * Used in 85+ locations across database operations
 */
export function getCurrentCompanyId(): string {
  const currentCompany = getCurrentCompany();
  if (!currentCompany?.id) {
    throw new Error('No active company found. Please select or create a company before performing this action.');
  }
  return currentCompany.id;
}

// ===== DATABASE UTILITIES =====

/**
 * Get a query builder with company_id filter applied
 * Reduces duplication for SELECT operations across database layer
 * 
 * @example
 * const query = getCompanyQuery('wine_batches')
 *   .eq('state', 'bottled')
 *   .order('created_at', { ascending: false });
 */
export function getCompanyQuery(table: string) {
  const companyId = getCurrentCompanyId();
  return supabase.from(table).select().eq('company_id', companyId);
}
