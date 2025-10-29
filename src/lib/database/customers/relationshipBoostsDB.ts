// CRUD for relationship_boosts table (no business logic)
import { supabase } from '../core/supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';

export interface RelationshipBoostRow {
  id: string;
  customer_id: string;
  amount: number;
  created_game_week: number;
  decay_rate: number;
  description: string;
  company_id: string;
}

export async function insertRelationshipBoost(row: Omit<RelationshipBoostRow, 'company_id'>): Promise<void> {
  const { error } = await supabase
    .from('relationship_boosts')
    .insert([{ ...row, company_id: getCurrentCompanyId() }]);

  if (error) {
    throw error;
  }
}

export async function getRelationshipBoostsByCustomer(customerId: string): Promise<RelationshipBoostRow[]> {
  const { data, error } = await supabase
    .from('relationship_boosts')
    .select('*')
    .eq('company_id', getCurrentCompanyId())
    .eq('customer_id', customerId)
    .order('created_game_week', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as RelationshipBoostRow[]) || [];
}

export async function listRelationshipBoostsForDecay(): Promise<Array<{ id: string; amount: number; decay_rate: number }>> {
  const { data, error } = await supabase
    .from('relationship_boosts')
    .select('id, amount, decay_rate')
    .eq('company_id', getCurrentCompanyId())
    .gt('decay_rate', 0)
    .lt('decay_rate', 1);

  if (error) {
    throw error;
  }
  return (data as any[]) || [];
}

export async function updateRelationshipBoostAmount(id: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from('relationship_boosts')
    .update({ amount })
    .eq('id', id)
    .eq('company_id', getCurrentCompanyId());

  if (error) {
    throw error;
  }
}

export async function deleteRelationshipBoosts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('relationship_boosts')
    .delete()
    .in('id', ids)
    .eq('company_id', getCurrentCompanyId());

  if (error) {
    throw error;
  }
}

/**
 * Batch load relationship boosts for multiple customers efficiently
 */
export async function getRelationshipBoostsByCustomerBatch(customerIds: string[]): Promise<Map<string, RelationshipBoostRow[]>> {
  if (customerIds.length === 0) return new Map();
  
  const { data, error } = await supabase
    .from('relationship_boosts')
    .select('*')
    .eq('company_id', getCurrentCompanyId())
    .in('customer_id', customerIds);
  
  if (error) {
    throw error;
  }
  
  // Group by customer ID
  const result = new Map<string, RelationshipBoostRow[]>();
  for (const boost of data || []) {
    if (!result.has(boost.customer_id)) {
      result.set(boost.customer_id, []);
    }
    result.get(boost.customer_id)!.push(boost as RelationshipBoostRow);
  }
  
  return result;
}


