import { supabase } from '../core/supabase';

const TABLE = 'grape_buyer_loyalty';

export async function getBuyerLoyaltyRow(companyId: string, buyerId: string) {
  return supabase
    .from(TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
}

export async function getBuyerLoyaltyRows(companyId: string, buyerIds: string[]) {
  return supabase
    .from(TABLE)
    .select('*')
    .eq('company_id', companyId)
    .in('buyer_id', buyerIds);
}

export async function getMaxBuyerLoyaltyLevelRow(companyId: string) {
  return supabase
    .from(TABLE)
    .select('level')
    .eq('company_id', companyId)
    .order('level', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getBuyerPriorityRows(companyId: string, limit = 12) {
  return supabase
    .from(TABLE)
    .select('buyer_id, loyalty_score')
    .eq('company_id', companyId)
    .gt('loyalty_score', 0)
    .order('loyalty_score', { ascending: false })
    .limit(limit);
}

export async function upsertBuyerLoyaltyRow(upsertData: Record<string, any>) {
  return supabase
    .from(TABLE)
    .upsert(upsertData, { onConflict: 'company_id,buyer_id' })
    .select()
    .single();
}
