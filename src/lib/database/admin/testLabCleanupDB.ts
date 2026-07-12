import { supabase } from '../core/supabase';

export interface TestLabCleanupData {
  deletedByEntity: Record<string, number>;
  warnings: string[];
}

export async function cleanupTestLabRecords(prefix: string): Promise<TestLabCleanupData> {
  const deletedByEntity: Record<string, number> = {};
  const warnings: string[] = [];
  const addCount = (table: string, count: number | null) => {
    deletedByEntity[table] = (deletedByEntity[table] || 0) + (count || 0);
  };
  const deleteByCompanyIds = async (table: string, companyIds: string[]) => {
    if (companyIds.length === 0) return;
    const { count, error } = await supabase.from(table).delete({ count: 'exact' }).in('company_id', companyIds);
    if (error) warnings.push(`${table}: ${error.message}`); else addCount(table, count);
  };
  const deleteByIlike = async (table: string, column: string, pattern: string) => {
    const { count, error } = await supabase.from(table).delete({ count: 'exact' }).ilike(column, pattern);
    if (error) warnings.push(`${table}.${column}: ${error.message}`); else addCount(table, count);
  };
  const deleteByIds = async (table: string, ids: string[]) => {
    if (ids.length === 0) return;
    const { count, error } = await supabase.from(table).delete({ count: 'exact' }).in('id', ids);
    if (error) warnings.push(`${table}.id: ${error.message}`); else addCount(table, count);
  };

  const { data: companies, error: companyLookupError } = await supabase
    .from('companies').select('id, user_id').ilike('name', `${prefix}%`);
  if (companyLookupError) warnings.push(`companies lookup: ${companyLookupError.message}`);
  const companyIds = (companies || []).map(company => company.id).filter(Boolean);
  const userIds = (companies || []).map(company => company.user_id).filter(Boolean);

  for (const table of ['wine_orders', 'wine_contracts', 'wine_log', 'highscores', 'wine_batches', 'activities', 'vineyards', 'staff', 'teams', 'loans', 'research_unlocks', 'transactions', 'notifications', 'notification_filters', 'prestige_events', 'relationship_boosts', 'company_customers']) {
    await deleteByCompanyIds(table, companyIds);
  }
  await deleteByIds('game_state', companyIds);
  for (const [table, column, pattern] of [
    ['wine_orders', 'wine_name', `%${prefix}%`], ['wine_contracts', 'customer_name', `%${prefix}%`],
    ['wine_log', 'vineyard_name', `%${prefix}%`], ['highscores', 'company_name', `${prefix}%`],
    ['wine_batches', 'vineyard_name', `%${prefix}%`], ['activities', 'title', `%${prefix}%`],
    ['vineyards', 'name', `${prefix}%`], ['transactions', 'description', `%${prefix}%`],
    ['notifications', 'text', `%${prefix}%`], ['prestige_events', 'description', `%${prefix}%`],
    ['companies', 'name', `${prefix}%`]
  ] as const) await deleteByIlike(table, column, pattern);
  await deleteByIds('users', userIds);
  return { deletedByEntity, warnings };
}
