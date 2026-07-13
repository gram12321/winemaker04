import { supabase } from '../core/supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { PrestigeEvent, type PrestigePayloadVineyardAchievementUnlock } from '../../types/types';

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

export async function upsertPrestigeEventBySource(type: string, sourceId: string, fields: Partial<PrestigeEventRow>): Promise<void> {
  const companyId = getCurrentCompanyId();
  
  const { data, error } = await supabase
    .from('prestige_events')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', type)
    .eq('source_id', sourceId)
    .limit(1);

  if (error) throw error;

  const eventData = { ...fields, type, source_id: sourceId, company_id: companyId } as any;

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
  companyId?: string
): Promise<void> {
  const { error } = await supabase
    .from('prestige_events')
    .insert([{ ...row, company_id: companyId || getCurrentCompanyId() }]);
  if (error) throw error;
}

/**
 * Insert a source-keyed event once for the active company.
 *
 * The matching unique index makes this safe when two achievement checks overlap.
 */
export async function insertPrestigeEventIfAbsentBySource(
  row: Omit<PrestigeEventRow, 'company_id'> & { source_id: string },
  companyId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('prestige_events')
    .insert([{ ...row, company_id: companyId || getCurrentCompanyId() }]);

  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

/** Insert one vineyard reward per company, vineyard, and achievement. */
export async function insertVineyardAchievementPrestigeEventIfAbsent(
  row: Omit<PrestigeEventRow, 'company_id'> & {
    type: 'vineyard_achievement';
    source_id: string;
    payload: PrestigePayloadVineyardAchievementUnlock;
  },
  companyId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('prestige_events')
    .insert([{ ...row, company_id: companyId || getCurrentCompanyId() }]);

  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

export async function listPrestigeEvents(companyId?: string): Promise<PrestigeEventRow[]> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('*')
    .eq('company_id', companyId || getCurrentCompanyId())
    .order('created_game_week', { ascending: false });
  if (error) throw error;
  return (data as PrestigeEventRow[]) || [];
}

export async function listPrestigeEventsForUI(): Promise<PrestigeEvent[]> {
  const rows = await listPrestigeEvents();
  return rows.map(row => ({
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

export async function listPrestigeEventsForDecay(): Promise<Array<{ id: string; amount_base: number; decay_rate: number }>> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('id, amount_base, decay_rate')
    .eq('company_id', getCurrentCompanyId())
    .gt('decay_rate', 0)
    .lt('decay_rate', 1);
  if (error) throw error;
  return (data as Array<{ id: string; amount_base: number; decay_rate: number }>) || [];
}

export async function updatePrestigeEventAmount(id: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from('prestige_events')
    .update({ amount_base: amount })
    .eq('id', id)
    .eq('company_id', getCurrentCompanyId());
  if (error) throw error;
}

export async function deletePrestigeEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('prestige_events')
    .delete()
    .in('id', ids)
    .eq('company_id', getCurrentCompanyId());
  if (error) throw error;
}


