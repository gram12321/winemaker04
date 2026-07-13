import { supabase } from '../core/supabase';
import type { StorageVessel, StorageVesselAllocation, StorageVesselAllocationPlan, StorageVesselOccupancy } from '@/lib/types/storageVessels';

const TABLE = 'storage_vessels';

interface StorageVesselRow {
  id: string;
  company_id: string;
  vessel_type: StorageVessel['vesselType'];
  material: StorageVessel['material'];
  capacity_litres: number;
  acquisition_price: number;
  source_offer_id: string;
  operational_status: StorageVessel['operationalStatus'];
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
    operationalStatus: row.operational_status,
    occupancy: 'available',
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
    operational_status: vessel.operationalStatus,
    purchased_year: vessel.purchasedYear,
    purchased_season: vessel.purchasedSeason,
    purchased_week: vessel.purchasedWeek,
  };
}

interface AllocationPlanRow {
  id: string;
  company_id: string;
  activity_id: string | null;
  wine_batch_id: string | null;
  status: StorageVesselAllocationPlan['status'];
  required_litres: number;
  created_year: number;
  created_season: string;
  created_week: number;
  activated_year: number | null;
  activated_season: string | null;
  activated_week: number | null;
  released_year: number | null;
  released_season: string | null;
  released_week: number | null;
}

interface AllocationRow {
  id: string;
  company_id: string;
  plan_id: string;
  vessel_id: string;
  assigned_capacity_litres: number;
  filled_litres: number;
  released_at: string | null;
}

function fromPlanRow(row: AllocationPlanRow): StorageVesselAllocationPlan {
  return {
    id: row.id,
    companyId: row.company_id,
    activityId: row.activity_id ?? undefined,
    wineBatchId: row.wine_batch_id ?? undefined,
    status: row.status,
    requiredLitres: row.required_litres,
    createdYear: row.created_year,
    createdSeason: row.created_season,
    createdWeek: row.created_week,
    activatedYear: row.activated_year ?? undefined,
    activatedSeason: row.activated_season ?? undefined,
    activatedWeek: row.activated_week ?? undefined,
    releasedYear: row.released_year ?? undefined,
    releasedSeason: row.released_season ?? undefined,
    releasedWeek: row.released_week ?? undefined,
  };
}

function fromAllocationRow(row: AllocationRow): StorageVesselAllocation {
  return {
    id: row.id,
    companyId: row.company_id,
    planId: row.plan_id,
    vesselId: row.vessel_id,
    assignedCapacityLitres: row.assigned_capacity_litres,
    filledLitres: row.filled_litres,
    releasedAt: row.released_at ?? undefined,
  };
}

function occupancyForVessel(
  vesselId: string,
  plans: StorageVesselAllocationPlan[],
  allocations: StorageVesselAllocation[],
): { occupancy: StorageVesselOccupancy; planId?: string; wineBatchId?: string } {
  const allocation = allocations.find((candidate) => candidate.vesselId === vesselId && !candidate.releasedAt);
  if (!allocation) return { occupancy: 'available' };
  const plan = plans.find((candidate) => candidate.id === allocation.planId);
  if (!plan) return { occupancy: 'reserved', planId: allocation.planId };
  return {
    occupancy: plan.status === 'active' ? 'in_use' : plan.status === 'reserved' ? 'reserved' : 'available',
    planId: plan.id,
    wineBatchId: plan.wineBatchId,
  };
}

export async function getCompanyStorageVessels(companyId: string): Promise<{ data: StorageVessel[]; error: unknown }> {
  const [{ data, error }, plansResult, allocationsResult] = await Promise.all([
    supabase.from(TABLE).select('*').eq('company_id', companyId).order('purchased_year').order('purchased_week'),
    getCompanyStorageAllocationPlans(companyId),
    getCompanyStorageAllocations(companyId),
  ]);
  if (error || plansResult.error || allocationsResult.error) {
    return { data: [], error: error ?? plansResult.error ?? allocationsResult.error };
  }
  const plans = plansResult.data;
  const allocations = allocationsResult.data;
  return {
    data: ((data ?? []) as unknown as StorageVesselRow[]).map((row) => {
      const vessel = fromRow(row);
      const occupancy = occupancyForVessel(vessel.id, plans, allocations);
      return { ...vessel, ...occupancy };
    }),
    error: null,
  };
}

export async function insertStorageVessels(vessels: StorageVessel[]) {
  if (vessels.length === 0) return { data: [], error: null };
  return supabase.from(TABLE).insert(vessels.map(toRow)).select('*');
}

export async function deleteStorageVessels(companyId: string, vesselIds: string[]) {
  if (vesselIds.length === 0) return { error: null };
  return supabase.from(TABLE).delete().eq('company_id', companyId).in('id', vesselIds);
}

export async function getCompanyStorageAllocationPlans(companyId: string): Promise<{ data: StorageVesselAllocationPlan[]; error: unknown }> {
  const { data, error } = await supabase
    .from('storage_vessel_allocation_plans')
    .select('*')
    .eq('company_id', companyId);
  return { data: ((data ?? []) as unknown as AllocationPlanRow[]).map(fromPlanRow), error };
}

export async function getCompanyStorageAllocations(companyId: string): Promise<{ data: StorageVesselAllocation[]; error: unknown }> {
  const { data, error } = await supabase
    .from('storage_vessel_allocations')
    .select('*')
    .eq('company_id', companyId);
  return { data: ((data ?? []) as unknown as AllocationRow[]).map(fromAllocationRow), error };
}

export async function reserveStorageVesselPlan(input: {
  companyId: string;
  requiredLitres: number;
  vesselIds: string[];
  activityId?: string;
  createdYear: number;
  createdSeason: string;
  createdWeek: number;
}): Promise<{ planId: string | null; error: unknown }> {
  const { data, error } = await supabase.rpc('reserve_storage_vessel_plan', {
    p_company_id: input.companyId,
    p_required_litres: input.requiredLitres,
    p_vessel_ids: input.vesselIds,
    p_activity_id: input.activityId ?? null,
    p_created_year: input.createdYear,
    p_created_season: input.createdSeason,
    p_created_week: input.createdWeek,
  });
  return { planId: typeof data === 'string' ? data : null, error };
}

export async function addStorageVesselPlanAllocations(companyId: string, planId: string, vesselIds: string[]) {
  const { data, error } = await supabase.rpc('add_storage_vessel_plan_allocations', {
    p_company_id: companyId,
    p_plan_id: planId,
    p_vessel_ids: vesselIds,
  });
  return { added: Boolean(data), error };
}

export async function activateStorageVesselPlan(companyId: string, planId: string, batchId: string, volumeLitres: number, date: { year: number; season: string; week: number }) {
  const { data, error } = await supabase
    .from('storage_vessel_allocation_plans')
    .update({
      wine_batch_id: batchId,
      status: 'active',
      required_litres: volumeLitres,
      activated_year: date.year,
      activated_season: date.season,
      activated_week: date.week,
    })
    .eq('company_id', companyId)
    .eq('id', planId)
    .eq('status', 'reserved')
    .select('*')
    .maybeSingle();
  return { data: data ? fromPlanRow(data as unknown as AllocationPlanRow) : null, error };
}

export async function updateStorageVesselPlanVolume(companyId: string, planId: string, volumeLitres: number) {
  return supabase
    .from('storage_vessel_allocation_plans')
    .update({ required_litres: volumeLitres })
    .eq('company_id', companyId)
    .eq('id', planId)
    .in('status', ['reserved', 'active']);
}

export async function updateStorageVesselAllocationFill(companyId: string, planId: string, filledLitres: number) {
  const { data, error } = await supabase
    .from('storage_vessel_allocations')
    .select('*')
    .eq('company_id', companyId)
    .eq('plan_id', planId)
    .is('released_at', null)
    .order('created_at');
  if (error) return { data: null, error };
  let remaining = Math.max(0, filledLitres);
  const rows = (data ?? []) as unknown as AllocationRow[];
  for (const row of rows) {
    const fill = Math.min(row.assigned_capacity_litres, remaining);
    const result = await supabase
      .from('storage_vessel_allocations')
      .update({ filled_litres: fill })
      .eq('company_id', companyId)
      .eq('id', row.id);
    if (result.error) return { data: null, error: result.error };
    remaining -= fill;
  }
  return { data: rows.length, error: null };
}

export async function releaseStorageVesselPlan(companyId: string, planId: string, date: { year: number; season: string; week: number }) {
  const releasedAt = new Date().toISOString();
  const allocations = await supabase
    .from('storage_vessel_allocations')
    .update({ released_at: releasedAt, filled_litres: 0 })
    .eq('company_id', companyId)
    .eq('plan_id', planId)
    .is('released_at', null);
  if (allocations.error) return allocations;
  return supabase
    .from('storage_vessel_allocation_plans')
    .update({ status: 'released', released_year: date.year, released_season: date.season, released_week: date.week })
    .eq('company_id', companyId)
    .eq('id', planId);
}
