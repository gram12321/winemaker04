import { supabase } from '@/lib/database/core/supabase';
import type { TestLabCleanupReport, TestLabScenarioStatus } from './types';
import { formatTestLabPrefix } from './runId';

type DeleteReport = Record<string, number>;

const addCount = (report: DeleteReport, key: string, count: number | null): void => {
  report[key] = (report[key] || 0) + (count || 0);
};

async function deleteByCompanyIds(
  table: string,
  companyIds: string[],
  report: DeleteReport,
  warnings: string[]
): Promise<void> {
  if (companyIds.length === 0) return;

  const { count, error } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .in('company_id', companyIds);

  if (error) {
    warnings.push(`${table}: ${error.message}`);
    return;
  }

  addCount(report, table, count);
}

async function deleteByIlike(
  table: string,
  column: string,
  pattern: string,
  report: DeleteReport,
  warnings: string[]
): Promise<void> {
  const { count, error } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .ilike(column, pattern);

  if (error) {
    warnings.push(`${table}.${column}: ${error.message}`);
    return;
  }

  addCount(report, table, count);
}

async function deleteByIds(
  table: string,
  ids: string[],
  report: DeleteReport,
  warnings: string[]
): Promise<void> {
  if (ids.length === 0) return;

  const { count, error } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .in('id', ids);

  if (error) {
    warnings.push(`${table}.id: ${error.message}`);
    return;
  }

  addCount(report, table, count);
}

export async function cleanupTestLabRun(runId: string): Promise<TestLabCleanupReport> {
  const prefix = formatTestLabPrefix(runId);
  const report: DeleteReport = {};
  const warnings: string[] = [];

  const { data: companies, error: companyLookupError } = await supabase
    .from('companies')
    .select('id, user_id')
    .ilike('name', `${prefix}%`);

  if (companyLookupError) {
    warnings.push(`companies lookup: ${companyLookupError.message}`);
  }

  const companyIds = (companies || []).map(company => company.id).filter(Boolean);
  const userIds = (companies || []).map(company => company.user_id).filter(Boolean);
  const companyScopedTables = [
    'wine_orders',
    'wine_contracts',
    'wine_log',
    'highscores',
    'wine_batches',
    'activities',
    'vineyards',
    'staff',
    'teams',
    'loans',
    'research_unlocks',
    'transactions',
    'notifications',
    'notification_filters',
    'prestige_events',
    'relationship_boosts',
    'company_customers'
  ];

  for (const table of companyScopedTables) {
    await deleteByCompanyIds(table, companyIds, report, warnings);
  }

  await deleteByIds('game_state', companyIds, report, warnings);

  // Active-company scenarios may create tagged records without creating a tagged company.
  await deleteByIlike('wine_orders', 'wine_name', `%${prefix}%`, report, warnings);
  await deleteByIlike('wine_contracts', 'customer_name', `%${prefix}%`, report, warnings);
  await deleteByIlike('wine_log', 'vineyard_name', `%${prefix}%`, report, warnings);
  await deleteByIlike('highscores', 'company_name', `${prefix}%`, report, warnings);
  await deleteByIlike('wine_batches', 'vineyard_name', `%${prefix}%`, report, warnings);
  await deleteByIlike('activities', 'title', `%${prefix}%`, report, warnings);
  await deleteByIlike('vineyards', 'name', `${prefix}%`, report, warnings);
  await deleteByIlike('transactions', 'description', `%${prefix}%`, report, warnings);
  await deleteByIlike('notifications', 'text', `%${prefix}%`, report, warnings);
  await deleteByIlike('prestige_events', 'description', `%${prefix}%`, report, warnings);
  await deleteByIlike('companies', 'name', `${prefix}%`, report, warnings);
  await deleteByIds('users', userIds, report, warnings);

  const status: TestLabScenarioStatus = warnings.length > 0 ? 'blocked' : 'passed';

  return {
    runId,
    status,
    deletedByEntity: report,
    warnings
  };
}
