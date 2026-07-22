import { supabase } from '@/lib/database/core/supabase';
import {
  PrestigeEvent,
  type PrestigePayloadVineyardAchievementUnlock,
} from '@/lib/types/types';

export interface PrestigeEventRow {
  id: string;
  type: string;
  amount_base: number;
  created_game_week: number | null;
  decay_rate: number;
  description?: string;
  source_id: string | null;
  company_id: string;
  timestamp?: number;
  payload?: any; // New structured payload
}

export async function upsertPrestigeEventBySource(
  type: string,
  sourceId: string,
  fields: Partial<PrestigeEventRow>,
  companyId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', type)
    .eq('source_id', sourceId)
    .limit(1);

  if (error) throw error;

  const eventData = {
    ...fields,
    type,
    source_id: sourceId,
    company_id: companyId,
  } as any;

  if (data && data.length > 0) {
    const { error: updateError } = await supabase
      .from('prestige_events')
      .update(fields as any)
      .eq('id', data[0].id)
      .eq('company_id', companyId);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('prestige_events')
      .insert([eventData]);
    if (insertError) throw insertError;
  }
}

export async function insertPrestigeEvent(
  row: Omit<PrestigeEventRow, 'company_id'>,
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from('prestige_events')
    .insert([{ ...row, company_id: companyId }]);
  if (error) throw error;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

async function insertPrestigeEventIfMissing(
  row: Omit<PrestigeEventRow, 'company_id'> & { source_id: string },
  companyId: string,
  payloadMatch?: Record<string, unknown>,
): Promise<boolean> {
  let query = supabase
    .from('prestige_events')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', row.type)
    .eq('source_id', row.source_id);

  if (payloadMatch) {
    query = query.contains('payload', payloadMatch);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  if (data && data.length > 0) return false;

  const { error: insertError } = await supabase
    .from('prestige_events')
    .insert([{ ...row, company_id: companyId }]);

  if (insertError && !isUniqueViolation(insertError)) throw insertError;
  return !insertError;
}

/**
 * Insert a source-keyed event once for one explicit company.
 *
 * The matching unique index makes this safe when two achievement checks overlap.
 */
export async function insertPrestigeEventIfAbsentBySource(
  row: Omit<PrestigeEventRow, 'company_id'> & { source_id: string },
  companyId: string,
): Promise<boolean> {
  return insertPrestigeEventIfMissing(row, companyId);
}

/** Insert one vineyard reward per company, vineyard, and achievement. */
export async function insertVineyardAchievementPrestigeEventIfAbsent(
  row: Omit<PrestigeEventRow, 'company_id'> & {
    type: 'vineyard_achievement';
    source_id: string;
    payload: PrestigePayloadVineyardAchievementUnlock;
  },
  companyId: string,
): Promise<boolean> {
  return insertPrestigeEventIfMissing(row, companyId, {
    event: row.payload.event,
    achievementId: row.payload.achievementId,
  });
}

export async function listPrestigeEvents(
  companyId: string,
): Promise<PrestigeEventRow[]> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('*')
    .eq('company_id', companyId)
    .order('created_game_week', { ascending: false });
  if (error) throw error;
  return (data as PrestigeEventRow[]) || [];
}

export async function listPrestigeEventsForUI(companyId: string): Promise<PrestigeEvent[]> {
  const rows = await listPrestigeEvents(companyId);
  return rows.map((row) => ({
    id: row.id,
    type: row.type as PrestigeEvent['type'],
    amount: row.amount_base,
    timestamp: row.timestamp || Date.now(),
    decayRate: row.decay_rate,
    description: row.description,
    sourceId: row.source_id || undefined,
    created_at: undefined,
    updated_at: undefined,
    metadata: row.payload,
  }));
}

export async function listPrestigeEventsForDecay(companyId: string): Promise<
  Array<{ id: string; amount_base: number; decay_rate: number }>
> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('id, amount_base, decay_rate')
    .eq('company_id', companyId)
    .gt('decay_rate', 0)
    .lt('decay_rate', 1);
  if (error) throw error;
  return (
    (data as Array<{ id: string; amount_base: number; decay_rate: number }>) ||
    []
  );
}

export async function updatePrestigeEventAmount(
  id: string,
  amount: number,
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from('prestige_events')
    .update({ amount_base: amount })
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw error;
}

export async function deletePrestigeEvents(ids: string[], companyId: string): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('prestige_events')
    .delete()
    .in('id', ids)
    .eq('company_id', companyId);
  if (error) throw error;
}
