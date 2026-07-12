import { supabase } from '../core/supabase';
import type { BuyMarketOfferRecord, BuyMarketWareGroup } from '@/lib/types/market';
import type { Season } from '@/lib/types/types';

const TABLE = 'market_buy_offers';

interface BuyMarketOfferRow {
  company_id: string;
  offer_id: string;
  ware_group: BuyMarketWareGroup;
  seller_id: string;
  seller_name: string;
  origin_tag: string;
  available_units: number;
  unit: BuyMarketOfferRecord['unit'];
  base_price_per_unit: number;
  effective_price_per_unit: number;
  is_persistent: boolean;
  created_year: number;
  created_season: Season;
  created_week: number;
  last_refreshed_year: number;
  last_refreshed_season: Season;
  last_refreshed_week: number;
  expires_year: number | null;
  expires_season: Season | null;
  expires_week: number | null;
  payload: Record<string, unknown>;
  updated_at?: string;
}

const SELECT_FIELDS = [
  'company_id', 'offer_id', 'ware_group', 'seller_id', 'seller_name', 'origin_tag',
  'available_units', 'unit', 'base_price_per_unit', 'effective_price_per_unit', 'is_persistent',
  'created_year', 'created_season', 'created_week', 'last_refreshed_year', 'last_refreshed_season',
  'last_refreshed_week', 'expires_year', 'expires_season', 'expires_week', 'payload', 'updated_at',
].join(',');

function fromRow(row: BuyMarketOfferRow): BuyMarketOfferRecord {
  return {
    companyId: row.company_id,
    offerId: row.offer_id,
    wareGroup: row.ware_group,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    originTag: row.origin_tag,
    availableUnits: row.available_units,
    unit: row.unit,
    basePricePerUnit: row.base_price_per_unit,
    effectivePricePerUnit: row.effective_price_per_unit,
    isPersistent: row.is_persistent,
    createdYear: row.created_year,
    createdSeason: row.created_season,
    createdWeek: row.created_week,
    lastRefreshedYear: row.last_refreshed_year,
    lastRefreshedSeason: row.last_refreshed_season,
    lastRefreshedWeek: row.last_refreshed_week,
    expiresYear: row.expires_year,
    expiresSeason: row.expires_season,
    expiresWeek: row.expires_week,
    payload: row.payload ?? {},
  };
}

function toRow(record: BuyMarketOfferRecord): BuyMarketOfferRow {
  return {
    company_id: record.companyId,
    offer_id: record.offerId,
    ware_group: record.wareGroup,
    seller_id: record.sellerId,
    seller_name: record.sellerName,
    origin_tag: record.originTag,
    available_units: record.availableUnits,
    unit: record.unit,
    base_price_per_unit: record.basePricePerUnit,
    effective_price_per_unit: record.effectivePricePerUnit,
    is_persistent: record.isPersistent,
    created_year: record.createdYear,
    created_season: record.createdSeason,
    created_week: record.createdWeek,
    last_refreshed_year: record.lastRefreshedYear,
    last_refreshed_season: record.lastRefreshedSeason,
    last_refreshed_week: record.lastRefreshedWeek,
    expires_year: record.expiresYear,
    expires_season: record.expiresSeason,
    expires_week: record.expiresWeek,
    payload: record.payload,
    updated_at: new Date().toISOString(),
  };
}

export async function getCompanyBuyMarketOffers(companyId: string, wareGroup?: BuyMarketWareGroup): Promise<{ data: BuyMarketOfferRecord[]; error: unknown }> {
  let query = supabase.from(TABLE).select(SELECT_FIELDS).eq('company_id', companyId);
  if (wareGroup) query = query.eq('ware_group', wareGroup);
  const { data, error } = await query;
  return { data: ((data ?? []) as unknown as BuyMarketOfferRow[]).map(fromRow), error };
}

export async function getCompanyBuyMarketOffer(companyId: string, offerId: string): Promise<{ data: BuyMarketOfferRecord | null; error: unknown }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_FIELDS)
    .eq('company_id', companyId)
    .eq('offer_id', offerId)
    .maybeSingle();
  return { data: data ? fromRow(data as unknown as BuyMarketOfferRow) : null, error };
}

export async function upsertBuyMarketOffers(records: BuyMarketOfferRecord[]) {
  if (records.length === 0) return { data: [], error: null };
  return supabase.from(TABLE).upsert(records.map(toRow), { onConflict: 'company_id,offer_id' }).select(SELECT_FIELDS);
}

export async function updateBuyMarketOffer(companyId: string, offerId: string, patch: Partial<BuyMarketOfferRecord>) {
  const existing = await getCompanyBuyMarketOffer(companyId, offerId);
  if (existing.error || !existing.data) return { data: null, error: existing.error ?? new Error('Offer not found.') };
  return supabase.from(TABLE).update(toRow({ ...existing.data, ...patch })).eq('company_id', companyId).eq('offer_id', offerId);
}

export async function deleteBuyMarketOffer(companyId: string, offerId: string) {
  return supabase.from(TABLE).delete().eq('company_id', companyId).eq('offer_id', offerId);
}

export async function claimBuyMarketOfferUnits(companyId: string, offerId: string, units: number) {
  const { data, error } = await supabase.rpc('claim_market_buy_offer_units', {
    p_company_id: companyId,
    p_offer_id: offerId,
    p_units: units,
  });
  return { claimed: Boolean(data), error };
}
