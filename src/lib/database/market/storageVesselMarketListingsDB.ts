import { supabase } from '@/lib/database/core/supabase';
import type { PersistedTransactionRow } from '@/lib/services/finance/financeService';
import type { StorageVessel, StorageVesselCleanliness, StorageVesselMarketListing, StorageVesselMaterial } from '@/lib/types/storageVessels';

interface ListingRow {
  id: string;
  vessel_id: string;
  seller_kind: StorageVesselMarketListing['sellerKind'];
  seller_counterparty_id: string;
  seller_name: string;
  seller_company_id: string | null;
  origin: StorageVesselMarketListing['origin'];
  status: StorageVesselMarketListing['status'];
  evolution_seed: string;
  generation_key: string | null;
  starting_condition: number;
  listed_year: number;
  listed_season: string;
  listed_week: number;
  retired_year: number;
  retired_season: string;
  retired_week: number;
}

function fromListingRow(row: ListingRow): StorageVesselMarketListing {
  return {
    id: row.id, vesselId: row.vessel_id, sellerKind: row.seller_kind, sellerCounterpartyId: row.seller_counterparty_id, sellerName: row.seller_name,
    origin: row.origin, status: row.status, evolutionSeed: row.evolution_seed, sellerCompanyId: row.seller_company_id ?? undefined,
    generationKey: row.generation_key ?? undefined, startingCondition: row.starting_condition,
    listedYear: row.listed_year, listedSeason: row.listed_season, listedWeek: row.listed_week,
    retiredYear: row.retired_year, retiredSeason: row.retired_season, retiredWeek: row.retired_week,
  };
}

export async function getActiveStorageVesselMarketListings(): Promise<{ data: Array<{ listing: StorageVesselMarketListing; vessel: StorageVessel }>; error: unknown }> {
  const { data, error } = await supabase
    .from('storage_vessel_market_listings')
    .select('*, storage_vessels(*)')
    .eq('status', 'active');
  if (error) return { data: [], error };
  return {
    data: ((data ?? []) as Array<ListingRow & { storage_vessels: Record<string, unknown> | null }>)
      .filter((row) => row.storage_vessels)
      .map((row) => ({ listing: fromListingRow(row), vessel: mapMarketVessel(row.storage_vessels!) })),
    error: null,
  };
}

function mapMarketVessel(row: Record<string, unknown>): StorageVessel {
  return {
    id: String(row.id), vesselName: typeof row.vessel_name === 'string' ? row.vessel_name : undefined,
    ownerKind: row.owner_kind as StorageVessel['ownerKind'], ownerCompanyId: typeof row.owner_company_id === 'string' ? row.owner_company_id : undefined,
    catalogueId: row.catalogue_id as StorageVessel['catalogueId'], vesselType: row.vessel_type as StorageVessel['vesselType'], material: row.material as StorageVessel['material'],
    qualityScore: Number(row.quality_score), condition: Number(row.condition), fillHistory: Number(row.fill_history),
    productionYear: Number(row.production_year), capacityLitres: Number(row.capacity_litres), acquisitionPrice: Number(row.acquisition_price),
    sourceOfferId: String(row.source_offer_id), operationalStatus: row.operational_status as StorageVessel['operationalStatus'],
    cleanliness: row.cleanliness as StorageVessel['cleanliness'], occupancy: 'available',
    purchasedYear: Number(row.purchased_year), purchasedSeason: String(row.purchased_season), purchasedWeek: Number(row.purchased_week),
  };
}

export interface NpcStorageVesselListingInput {
  generationKey: string;
  catalogueId: StorageVessel['catalogueId'];
  vesselType: StorageVessel['vesselType'];
  sellerCounterpartyId: string;
  sellerName: string;
  vesselName: string;
  material: StorageVesselMaterial;
  capacityLitres: number;
  qualityScore: number;
  condition: number;
  fillHistory: number;
  productionYear: number;
  cleanliness: StorageVesselCleanliness;
}

export async function ensureNpcUsedStorageVesselListings(input: {
  year: number;
  season: string;
  week: number;
  listings: NpcStorageVesselListingInput[];
}) {
  return supabase.rpc('ensure_npc_used_storage_vessel_listings', {
    p_year: input.year, p_season: input.season, p_week: input.week, p_listings: input.listings,
  });
}

export async function sellStorageVesselToMarket(input: { companyId: string; companyName: string; vesselId: string; payout: number; year: number; season: string; week: number }) {
  return supabase.rpc('sell_storage_vessel_to_market', {
    p_company_id: input.companyId, p_company_name: input.companyName, p_vessel_id: input.vesselId, p_payout: input.payout,
    p_year: input.year, p_season: input.season, p_week: input.week,
  });
}

export interface UsedStorageVesselPurchaseResult {
  transaction: PersistedTransactionRow;
}

export async function purchaseUsedStorageVesselListing(input: { companyId: string; listingId: string; year: number; season: string; week: number }) {
  const result = await supabase.rpc('purchase_used_storage_vessel_listing', {
    p_company_id: input.companyId, p_listing_id: input.listingId,
    p_year: input.year, p_season: input.season, p_week: input.week,
  });
  return result as { data: UsedStorageVesselPurchaseResult | null; error: unknown };
}
