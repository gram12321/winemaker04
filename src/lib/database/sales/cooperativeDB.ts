import { supabase } from '../core/supabase';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

const COOPERATIVE_MEMBERSHIP_TABLE = 'cooperative_membership';

export interface CooperativeMembershipRow {
  company_id: string;
  total_sales: number;
  consecutive_years: number;
  total_kg_sold: number;
  last_sale_year: number | null;
  level: 0 | 1 | 2 | 3;
}

export async function loadCooperativeMembershipRow(): Promise<CooperativeMembershipRow | null> {
  const companyId = getCurrentCompanyId();
  const { data, error } = await supabase
    .from(COOPERATIVE_MEMBERSHIP_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load cooperative membership:', error);
    return null;
  }

  return (data as CooperativeMembershipRow | null) ?? null;
}

export async function upsertCooperativeMembershipRow(row: CooperativeMembershipRow): Promise<CooperativeMembershipRow | null> {
  const { data, error } = await supabase
    .from(COOPERATIVE_MEMBERSHIP_TABLE)
    .upsert(
      {
        ...row,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to record cooperative sale:', error);
    return null;
  }

  return data as CooperativeMembershipRow;
}
