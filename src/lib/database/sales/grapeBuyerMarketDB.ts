import { supabase } from '../core/supabase';

const TABLE = 'grape_market_buyers';
const BUYER_SELECT = 'buyer_id,display_name,country,description,is_germany_coop,base_multiplier,multiplier_min,multiplier_max,base_season_limit_kg,sold_this_season_kg,favorite_grape_1,favorite_grape_2,last_active_year,last_active_season';

export async function createBuyerRow(insertData: Record<string, any>) {
  return supabase
    .from(TABLE)
    .insert(insertData)
    .select(BUYER_SELECT)
    .single();
}

export async function getBuyerRow(companyId: string, buyerId: string) {
  return supabase
    .from(TABLE)
    .select(BUYER_SELECT)
    .eq('company_id', companyId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
}

export async function updateBuyerRow(companyId: string, buyerId: string, patch: Record<string, any>) {
  return supabase
    .from(TABLE)
    .update(patch)
    .eq('company_id', companyId)
    .eq('buyer_id', buyerId);
}

export async function getSeasonBuyerRows(
  companyId: string,
  country: string,
  currentYear: number,
  currentSeason: string,
  excludeBuyerId?: string,
  limit = 12
) {
  let query = supabase
    .from(TABLE)
    .select(BUYER_SELECT)
    .eq('company_id', companyId)
    .eq('country', country)
    .eq('last_active_year', currentYear)
    .eq('last_active_season', currentSeason)
    .limit(limit);

  if (excludeBuyerId) {
    query = query.neq('buyer_id', excludeBuyerId);
  }

  return query;
}

export async function getKnownCountryBuyerRows(
  companyId: string,
  country: string,
  excludeBuyerId?: string,
  limit = 40
) {
  let query = supabase
    .from(TABLE)
    .select(BUYER_SELECT)
    .eq('company_id', companyId)
    .eq('country', country)
    .limit(limit);

  if (excludeBuyerId) {
    query = query.neq('buyer_id', excludeBuyerId);
  }

  return query;
}

export async function getSeasonBuyerRowsForCountries(
  companyId: string,
  countries: string[],
  currentYear: number,
  currentSeason: string,
  excludeBuyerId?: string,
  limit = 12
) {
  let query = supabase
    .from(TABLE)
    .select(BUYER_SELECT)
    .eq('company_id', companyId)
    .in('country', countries)
    .eq('last_active_year', currentYear)
    .eq('last_active_season', currentSeason)
    .limit(limit);

  if (excludeBuyerId) {
    query = query.neq('buyer_id', excludeBuyerId);
  }

  return query;
}

export async function getKnownCountryBuyerRowsForCountries(
  companyId: string,
  countries: string[],
  excludeBuyerId?: string,
  limit = 40
) {
  let query = supabase
    .from(TABLE)
    .select(BUYER_SELECT)
    .eq('company_id', companyId)
    .in('country', countries)
    .limit(limit);

  if (excludeBuyerId) {
    query = query.neq('buyer_id', excludeBuyerId);
  }

  return query;
}

export async function getBuyerSeasonStateRow(companyId: string, buyerId: string) {
  return supabase
    .from(TABLE)
    .select('sold_this_season_kg,last_active_year,last_active_season')
    .eq('company_id', companyId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
}
