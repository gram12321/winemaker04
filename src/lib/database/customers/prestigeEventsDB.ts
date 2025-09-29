import { supabase } from '../core/supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';

export interface PrestigeEventRow {
  id: string;
  type: string;
  amount: number;
  created_game_week: number | null;
  decay_rate: number;
  description: string;
  source_id: string | null;
  company_id: string;
  timestamp?: number;
}

export async function upsertPrestigeEventBySource(type: string, sourceId: string, fields: Partial<PrestigeEventRow>): Promise<void> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('id')
    .eq('company_id', getCurrentCompanyId())
    .eq('type', type)
    .eq('source_id', sourceId)
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) {
    const { error: updateError } = await supabase
      .from('prestige_events')
      .update(fields)
      .eq('id', data[0].id)
      .eq('company_id', getCurrentCompanyId());
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('prestige_events')
      .insert([{ ...fields, type, source_id: sourceId, company_id: getCurrentCompanyId() }]);
    if (insertError) throw insertError;
  }
}

export async function insertPrestigeEvent(row: Omit<PrestigeEventRow, 'company_id'>): Promise<void> {
  const { error } = await supabase
    .from('prestige_events')
    .insert([{ ...row, company_id: getCurrentCompanyId() }]);
  if (error) throw error;
}

export async function listPrestigeEvents(): Promise<PrestigeEventRow[]> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('*')
    .eq('company_id', getCurrentCompanyId())
    .order('created_game_week', { ascending: false });
  if (error) throw error;
  return (data as PrestigeEventRow[]) || [];
}

export async function listPrestigeEventsForDecay(): Promise<Array<{ id: string; amount: number; decay_rate: number }>> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('id, amount, decay_rate')
    .eq('company_id', getCurrentCompanyId())
    .gt('decay_rate', 0)
    .lt('decay_rate', 1);
  if (error) throw error;
  return (data as any[]) || [];
}

export async function updatePrestigeEventAmount(id: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from('prestige_events')
    .update({ amount })
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


