import { supabase } from '@/lib/database/core/supabase';
import type { PersistedTransactionRow } from '@/lib/services/finance/financeService';
import type { GlobalGrapeMarketListing } from '@/lib/types/market';
import type { Season, WineBatch } from '@/lib/types/types';

const TABLE = 'global_grape_market_listings';

interface GlobalGrapeListingRow {
  id: string;
  seller_kind: 'npc' | 'company';
  seller_counterparty_id: string;
  seller_name: string;
  seller_company_id: string | null;
  origin: GlobalGrapeMarketListing['origin'];
  status: GlobalGrapeMarketListing['status'];
  evolution_seed: string;
  available_kg: number;
  base_price_per_kg: number;
  quality_score: number;
  quality_decay_per_week: number;
  min_quality_floor: number;
  batch_state: GlobalGrapeMarketListing['batchState'];
  grape_variety: string;
  batch_snapshot: WineBatch;
  provenance_snapshot: GlobalGrapeMarketListing['provenanceSnapshot'] | null;
  listed_year: number;
  listed_season: Season;
  listed_week: number;
  expires_year: number | null;
  expires_season: Season | null;
  expires_week: number | null;
}

function fromRow(row: GlobalGrapeListingRow): GlobalGrapeMarketListing {
  const seller = row.seller_kind === 'company'
    ? { kind: 'company' as const, id: row.seller_counterparty_id, name: row.seller_name, companyId: row.seller_company_id! }
    : { kind: 'npc' as const, id: row.seller_counterparty_id, name: row.seller_name };
  return {
    id: row.id, seller, origin: row.origin, status: row.status, evolutionSeed: row.evolution_seed,
    availableKg: Number(row.available_kg), basePricePerKg: Number(row.base_price_per_kg), qualityScore: Number(row.quality_score),
    qualityDecayPerWeek: Number(row.quality_decay_per_week), minQualityFloor: Number(row.min_quality_floor),
    batchState: row.batch_state, grapeVariety: row.grape_variety as GlobalGrapeMarketListing['grapeVariety'], batchSnapshot: row.batch_snapshot,
    provenanceSnapshot: row.provenance_snapshot ?? undefined,
    createdYear: row.listed_year, createdSeason: row.listed_season, createdWeek: row.listed_week,
    expiresYear: row.expires_year, expiresSeason: row.expires_season, expiresWeek: row.expires_week,
  };
}

export async function getActiveGlobalGrapeMarketListings() {
  const { data, error } = await supabase.from(TABLE).select('*').eq('status', 'active');
  return { data: ((data ?? []) as GlobalGrapeListingRow[]).map(fromRow), error };
}

export interface NpcGlobalGrapeListingInput {
  evolutionSeed: string;
  sellerCounterpartyId: string;
  sellerName: string;
  availableKg: number;
  basePricePerKg: number;
  qualityScore: number;
  batchState: GlobalGrapeMarketListing['batchState'];
  grapeVariety: GlobalGrapeMarketListing['grapeVariety'];
  batchSnapshot: WineBatch;
}

export async function ensureNpcGlobalGrapeMarketListings(input: { year: number; season: Season; week: number; listings: NpcGlobalGrapeListingInput[] }) {
  return supabase.rpc('ensure_npc_global_grape_market_listings', {
    p_year: input.year, p_season: input.season, p_week: input.week, p_listings: input.listings,
  });
}

export async function listGrapeBatchOnGlobalMarket(input: {
  companyId: string; companyName: string; batchId: string; quantityKg: number; payout: number;
  batchSnapshot: WineBatch; basePricePerKg: number; qualityScore: number; week: number; season: Season; year: number;
}) {
  return supabase.rpc('list_grape_batch_on_global_market', {
    p_company_id: input.companyId, p_company_name: input.companyName, p_batch_id: input.batchId, p_quantity_kg: input.quantityKg,
    p_payout: input.payout, p_batch_snapshot: input.batchSnapshot, p_base_price_per_kg: input.basePricePerKg,
    p_quality_score: input.qualityScore, p_week: input.week, p_season: input.season, p_year: input.year,
  }) as unknown as Promise<{ data: { transaction: PersistedTransactionRow; listingId: string } | null; error: unknown }>;
}

export async function purchaseGlobalGrapeMarketListing(input: {
  companyId: string; purchaseId: string; listingId: string; quantityKg: number; vesselIds: string[]; requiredLitres: number;
  batch: Record<string, unknown>; cost: number; relationshipPoints: number; relationshipYearlyCap: number; week: number; season: Season; year: number;
}) {
  return supabase.rpc('purchase_global_grape_market_listing', {
    p_company_id: input.companyId, p_purchase_id: input.purchaseId, p_listing_id: input.listingId, p_quantity_kg: input.quantityKg,
    p_vessel_ids: input.vesselIds, p_required_litres: input.requiredLitres, p_batch: input.batch, p_cost: input.cost,
    p_relationship_points: input.relationshipPoints, p_relationship_yearly_cap: input.relationshipYearlyCap,
    p_week: input.week, p_season: input.season, p_year: input.year,
  }) as unknown as Promise<{ data: { transaction: PersistedTransactionRow } | null; error: unknown }>;
}
