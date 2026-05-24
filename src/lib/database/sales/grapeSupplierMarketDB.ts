import { supabase } from '../core/supabase';

const TABLE = 'grape_market_suppliers';
const SUPPLIER_SELECT = 'supplier_id,display_name,country,description,is_bulk_supplier,base_price_multiplier,multiplier_min,multiplier_max,base_season_supply_kg,supplied_this_season_kg,last_active_year,last_active_season';

export async function createSupplierRow(insertData: Record<string, any>) {
  return supabase
    .from(TABLE)
    .insert(insertData)
    .select(SUPPLIER_SELECT)
    .single();
}

export async function getSupplierRow(companyId: string, supplierId: string) {
  return supabase
    .from(TABLE)
    .select(SUPPLIER_SELECT)
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .maybeSingle();
}

export async function updateSupplierRow(companyId: string, supplierId: string, patch: Record<string, any>) {
  return supabase
    .from(TABLE)
    .update(patch)
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId);
}

export async function getSeasonSupplierRowsForCountries(
  companyId: string,
  countries: string[],
  currentYear: number,
  currentSeason: string,
  excludeSupplierId?: string,
  limit = 12
) {
  let query = supabase
    .from(TABLE)
    .select(SUPPLIER_SELECT)
    .eq('company_id', companyId)
    .in('country', countries)
    .eq('last_active_year', currentYear)
    .eq('last_active_season', currentSeason)
    .limit(limit);

  if (excludeSupplierId) {
    query = query.neq('supplier_id', excludeSupplierId);
  }

  return query;
}

export async function getKnownSupplierRowsForCountries(
  companyId: string,
  countries: string[],
  excludeSupplierId?: string,
  limit = 40
) {
  let query = supabase
    .from(TABLE)
    .select(SUPPLIER_SELECT)
    .eq('company_id', companyId)
    .in('country', countries)
    .limit(limit);

  if (excludeSupplierId) {
    query = query.neq('supplier_id', excludeSupplierId);
  }

  return query;
}

export async function getSupplierSeasonStateRow(companyId: string, supplierId: string) {
  return supabase
    .from(TABLE)
    .select('supplied_this_season_kg,last_active_year,last_active_season')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .maybeSingle();
}
