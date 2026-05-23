import { supabase } from '../core/supabase';

const TABLE = 'grape_market_buy_offers';

export interface BuyMarketOfferRow {
  company_id: string;
  offer_id: string;
  ware_group: 'grapes';
  supplier_id: string;
  supplier_name: string;
  origin_tag: 'trusted_carryover' | 'seasonal_rotation' | 'country_special';
  batch_state: 'grapes' | 'must_ready' | 'must_fermenting';
  grape_variety: string;
  available_kg: number;
  quality_score: number;
  base_price_per_kg: number;
  effective_price_per_kg: number;
  weeks_on_market: number;
  quality_decay_per_week: number;
  min_quality_floor: number;
  is_persistent: boolean;
  created_year: number;
  created_season: string;
  created_week: number;
  last_refreshed_year: number;
  last_refreshed_season: string;
  last_refreshed_week: number;
  expires_year: number | null;
  expires_season: string | null;
  expires_week: number | null;
  updated_at?: string;
}

const SELECT_FIELDS = [
  'offer_id',
  'supplier_id',
  'supplier_name',
  'origin_tag',
  'batch_state',
  'grape_variety',
  'available_kg',
  'quality_score',
  'base_price_per_kg',
  'effective_price_per_kg',
  'weeks_on_market',
  'quality_decay_per_week',
  'min_quality_floor',
  'is_persistent',
  'created_year',
  'created_season',
  'created_week',
  'last_refreshed_year',
  'last_refreshed_season',
  'last_refreshed_week',
  'expires_year',
  'expires_season',
  'expires_week'
].join(',');

export async function getCompanyBuyOfferRows(companyId: string) {
  return supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq('company_id', companyId)
    .eq('ware_group', 'grapes');
}

export async function getCompanyBuyOfferRow(companyId: string, offerId: string) {
  return supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq('company_id', companyId)
    .eq('offer_id', offerId)
    .eq('ware_group', 'grapes')
    .maybeSingle();
}

export async function upsertBuyOfferRows(rows: BuyMarketOfferRow[]) {
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  return supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'company_id,offer_id' })
    .select(SELECT_FIELDS);
}

export async function updateBuyOfferRow(companyId: string, offerId: string, patch: Partial<BuyMarketOfferRow>) {
  return supabase
    .from(TABLE)
    .update(patch)
    .eq('company_id', companyId)
    .eq('offer_id', offerId)
    .eq('ware_group', 'grapes');
}

export async function deleteBuyOfferRow(companyId: string, offerId: string) {
  return supabase
    .from(TABLE)
    .delete()
    .eq('company_id', companyId)
    .eq('offer_id', offerId)
    .eq('ware_group', 'grapes');
}

export async function deleteExpiredBuyOfferRows(companyId: string, currentYear: number, currentSeason: string, currentWeek: number) {
  return supabase
    .from(TABLE)
    .delete()
    .eq('company_id', companyId)
    .eq('ware_group', 'grapes')
    .or(`expires_year.lt.${currentYear},and(expires_year.eq.${currentYear},expires_season.eq.${currentSeason},expires_week.lt.${currentWeek})`);
}
