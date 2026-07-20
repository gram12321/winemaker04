import { supabase } from '../core/supabase';

const SENTINEL_ID = '00000000-0000-0000-0000-000000000000';

export async function clearAllCompanies(): Promise<void> {
  const { error } = await supabase.from('companies').delete().neq('id', SENTINEL_ID);
  if (error) throw error;
}

export async function clearAllUsers(): Promise<void> {
  const { error } = await supabase.from('users').delete().neq('id', SENTINEL_ID);
  if (error) throw error;
}

export async function clearAllCompaniesAndUsers(): Promise<void> {
  await clearAllCompanies();
  await clearAllUsers();
}

export async function clearAllCustomers(): Promise<void> {
  const { error } = await supabase.from('customers').delete().neq('id', SENTINEL_ID);
  if (error) throw error;
}

export async function clearAllAchievements(): Promise<void> {
  const { error } = await supabase.from('achievements').delete().neq('id', SENTINEL_ID);
  if (error) throw error;
}

export async function clearGlobalMarketGoods(goods: 'grapes' | 'storage_vessels'): Promise<void> {
  const { error } = await supabase.rpc('admin_clear_global_market', { p_ware_group: goods });
  if (error) throw error;
}

export async function clearGlobalMarket(): Promise<void> {
  const { error } = await supabase.rpc('admin_clear_global_market', { p_ware_group: null });
  if (error) throw error;
}

export async function fullDatabaseReset(): Promise<void> {
  // Global listings retain seller provenance and therefore can violate their
  // seller constraint when the referenced companies are deleted. Clear the
  // global market assets first; this is a deliberate development reset.
  await clearGlobalMarket();

  const tables = [
    'relationship_boosts', 'wine_orders', 'wine_batches', 'vineyards', 'activities',
    'achievements', 'highscores', 'prestige_events', 'transactions',
    'company_customers', 'notifications', 'companies', 'users', 'customers', 'wine_log'
  ];
  const errors: string[] = [];

  for (const table of tables) {
    try {
      const query = table === 'company_customers'
        ? supabase.from(table).delete().neq('company_id', SENTINEL_ID)
        : supabase.from(table).delete().neq('id', SENTINEL_ID);
      const { error } = await query;
      if (error) errors.push(`Error clearing table ${table}: ${error.message}`);
    } catch (error) {
      errors.push(`Exception clearing table ${table}: ${String(error)}`);
    }
  }

  if (errors.length > 0) throw new Error(`Database reset failed with ${errors.length} errors: ${errors.join(', ')}`);
}
