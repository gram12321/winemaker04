import {
  deleteBuyMarketOffer,
  getCompanyBuyMarketOffer,
  getCompanyBuyMarketOffers,
  updateBuyMarketOffer,
  upsertBuyMarketOffers,
} from '@/lib/database/market/buyMarketOffersDB';
import type { BuyMarketOfferRecord } from '@/lib/types/market';
import type { MarketBatchProvenanceSnapshot, WineBatch } from '@/lib/types/types';

export interface GrapeMarketOfferRow {
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
  provenance_snapshot?: MarketBatchProvenanceSnapshot | null;
  preview_snapshot?: WineBatch | null;
  preview_version?: number | null;
  updated_at?: string;
}

export type BuyMarketOfferRow = GrapeMarketOfferRow;

interface GrapeOfferPayload {
  batchState: GrapeMarketOfferRow['batch_state'];
  grapeVariety: string;
  qualityScore: number;
  weeksOnMarket: number;
  qualityDecayPerWeek: number;
  minQualityFloor: number;
  provenanceSnapshot?: MarketBatchProvenanceSnapshot | null;
  previewSnapshot?: WineBatch | null;
  previewVersion?: number | null;
}

function toPayload(row: GrapeMarketOfferRow): GrapeOfferPayload {
  return {
    batchState: row.batch_state,
    grapeVariety: row.grape_variety,
    qualityScore: row.quality_score,
    weeksOnMarket: row.weeks_on_market,
    qualityDecayPerWeek: row.quality_decay_per_week,
    minQualityFloor: row.min_quality_floor,
    provenanceSnapshot: row.provenance_snapshot,
    previewSnapshot: row.preview_snapshot,
    previewVersion: row.preview_version,
  };
}

function fromPayload(record: BuyMarketOfferRecord): GrapeMarketOfferRow {
  const payload = record.payload as unknown as GrapeOfferPayload;
  return {
    company_id: record.companyId,
    offer_id: record.offerId,
    ware_group: 'grapes',
    supplier_id: record.sellerId,
    supplier_name: record.sellerName,
    origin_tag: record.originTag as GrapeMarketOfferRow['origin_tag'],
    batch_state: payload.batchState,
    grape_variety: payload.grapeVariety,
    available_kg: record.availableUnits,
    quality_score: payload.qualityScore,
    base_price_per_kg: record.basePricePerUnit,
    effective_price_per_kg: record.effectivePricePerUnit,
    weeks_on_market: payload.weeksOnMarket,
    quality_decay_per_week: payload.qualityDecayPerWeek,
    min_quality_floor: payload.minQualityFloor,
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
    provenance_snapshot: payload.provenanceSnapshot,
    preview_snapshot: payload.previewSnapshot,
    preview_version: payload.previewVersion,
  };
}

function toRecord(row: GrapeMarketOfferRow): BuyMarketOfferRecord {
  return {
    companyId: row.company_id,
    offerId: row.offer_id,
    wareGroup: 'grapes',
    sellerId: row.supplier_id,
    sellerName: row.supplier_name,
    originTag: row.origin_tag,
    availableUnits: row.available_kg,
    unit: 'kg',
    basePricePerUnit: row.base_price_per_kg,
    effectivePricePerUnit: row.effective_price_per_kg,
    isPersistent: row.is_persistent,
    createdYear: row.created_year,
    createdSeason: row.created_season as BuyMarketOfferRecord['createdSeason'],
    createdWeek: row.created_week,
    lastRefreshedYear: row.last_refreshed_year,
    lastRefreshedSeason: row.last_refreshed_season as BuyMarketOfferRecord['lastRefreshedSeason'],
    lastRefreshedWeek: row.last_refreshed_week,
    expiresYear: row.expires_year,
    expiresSeason: row.expires_season as BuyMarketOfferRecord['expiresSeason'],
    expiresWeek: row.expires_week,
    payload: toPayload(row) as unknown as Record<string, unknown>,
  };
}

export async function getCompanyGrapeMarketOfferRows(companyId: string) {
  const { data, error } = await getCompanyBuyMarketOffers(companyId, 'grapes');
  return { data: data.map(fromPayload), error };
}

export async function getCompanyGrapeMarketOfferRow(companyId: string, offerId: string) {
  const { data, error } = await getCompanyBuyMarketOffer(companyId, offerId);
  if (data && data.wareGroup !== 'grapes') return { data: null, error: null };
  return { data: data ? fromPayload(data) : null, error };
}

export async function upsertGrapeMarketOfferRows(rows: GrapeMarketOfferRow[]) {
  return upsertBuyMarketOffers(rows.map(toRecord));
}

export async function updateGrapeMarketOfferRow(companyId: string, offerId: string, patch: Partial<GrapeMarketOfferRow>) {
  const existing = await getCompanyGrapeMarketOfferRow(companyId, offerId);
  if (existing.error || !existing.data) return { data: null, error: existing.error ?? new Error('Offer not found.') };
  return updateBuyMarketOffer(companyId, offerId, toRecord({ ...existing.data, ...patch }));
}

export async function deleteGrapeMarketOfferRow(companyId: string, offerId: string) {
  return deleteBuyMarketOffer(companyId, offerId);
}

export const getCompanyBuyOfferRows = getCompanyGrapeMarketOfferRows;
export const getCompanyBuyOfferRow = getCompanyGrapeMarketOfferRow;
export const upsertBuyOfferRows = upsertGrapeMarketOfferRows;
export const updateBuyOfferRow = updateGrapeMarketOfferRow;
export const deleteBuyOfferRow = deleteGrapeMarketOfferRow;
