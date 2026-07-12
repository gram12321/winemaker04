import { supabase } from '../core/supabase';
import type { StorageVessel } from '@/lib/types/storageVessels';

const TABLE = 'storage_vessels';

interface StorageVesselRow {
  id: string;
  company_id: string;
  vessel_type: StorageVessel['vesselType'];
  material: StorageVessel['material'];
  capacity_litres: number;
  acquisition_price: number;
  source_offer_id: string;
  state: StorageVessel['state'];
  purchased_year: number;
  purchased_season: string;
  purchased_week: number;
}

function fromRow(row: StorageVesselRow): StorageVessel {
  return {
    id: row.id,
    companyId: row.company_id,
    vesselType: row.vessel_type,
    material: row.material,
    capacityLitres: row.capacity_litres,
    acquisitionPrice: row.acquisition_price,
    sourceOfferId: row.source_offer_id,
    state: row.state,
    purchasedYear: row.purchased_year,
    purchasedSeason: row.purchased_season,
    purchasedWeek: row.purchased_week,
  };
}

function toRow(vessel: StorageVessel): StorageVesselRow {
  return {
    id: vessel.id,
    company_id: vessel.companyId,
    vessel_type: vessel.vesselType,
    material: vessel.material,
    capacity_litres: vessel.capacityLitres,
    acquisition_price: vessel.acquisitionPrice,
    source_offer_id: vessel.sourceOfferId,
    state: vessel.state,
    purchased_year: vessel.purchasedYear,
    purchased_season: vessel.purchasedSeason,
    purchased_week: vessel.purchasedWeek,
  };
}

export async function getCompanyStorageVessels(companyId: string): Promise<{ data: StorageVessel[]; error: unknown }> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('company_id', companyId).order('purchased_year').order('purchased_week');
  return { data: ((data ?? []) as StorageVesselRow[]).map(fromRow), error };
}

export async function insertStorageVessels(vessels: StorageVessel[]) {
  if (vessels.length === 0) return { data: [], error: null };
  return supabase.from(TABLE).insert(vessels.map(toRow)).select('*');
}
