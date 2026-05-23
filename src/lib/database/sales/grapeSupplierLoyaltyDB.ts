import { supabase } from '../core/supabase';

const TABLE = 'grape_supplier_loyalty';

export async function getSupplierLoyaltyRow(companyId: string, supplierId: string) {
  return supabase
    .from(TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .maybeSingle();
}

export async function getSupplierLoyaltyRows(companyId: string, supplierIds: string[]) {
  return supabase
    .from(TABLE)
    .select('*')
    .eq('company_id', companyId)
    .in('supplier_id', supplierIds);
}

export async function getMaxSupplierLoyaltyLevelRow(companyId: string) {
  return supabase
    .from(TABLE)
    .select('level')
    .eq('company_id', companyId)
    .order('level', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getSupplierPriorityRows(companyId: string, limit = 12) {
  return supabase
    .from(TABLE)
    .select('supplier_id, supplier_name, loyalty_score')
    .eq('company_id', companyId)
    .gt('loyalty_score', 0)
    .order('loyalty_score', { ascending: false })
    .limit(limit);
}

export async function upsertSupplierLoyaltyRow(upsertData: Record<string, any>) {
  return supabase
    .from(TABLE)
    .upsert(upsertData, { onConflict: 'company_id,supplier_id' })
    .select()
    .single();
}
