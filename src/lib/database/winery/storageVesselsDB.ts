import { supabase } from '../core/supabase';
import type { StorageVessel, StorageVesselAllocation, StorageVesselAllocationPlan, StorageVesselOccupancy } from '@/lib/types/storageVessels';

const TABLE = 'storage_vessels';

interface StorageVesselRow {
  id: string;
  vessel_name: string | null;
  owner_kind: StorageVessel['ownerKind'];
  owner_company_id: string | null;
  vessel_type: StorageVessel['vesselType'];
  material: StorageVessel['material'];
  quality_score: number;
  condition: number;
  fill_history: number;
  production_year: number;
  capacity_litres: number;
  acquisition_price: number;
  source_offer_id: string;
  operational_status: StorageVessel['operationalStatus'];
  cleanliness: StorageVessel['cleanliness'];
  purchased_year: number;
  purchased_season: string;
  purchased_week: number;
}

function fromRow(row: StorageVesselRow): StorageVessel {
  return {
    id: row.id,
    vesselName: row.vessel_name ?? undefined,
    ownerKind: row.owner_kind,
    ownerCompanyId: row.owner_company_id ?? undefined,
    vesselType: row.vessel_type,
    material: row.material,
    qualityScore: row.quality_score,
    condition: row.condition,
    fillHistory: row.fill_history,
    productionYear: row.production_year,
    capacityLitres: row.capacity_litres,
    acquisitionPrice: row.acquisition_price,
    sourceOfferId: row.source_offer_id,
    operationalStatus: row.operational_status,
    cleanliness: row.cleanliness,
    occupancy: 'available',
    purchasedYear: row.purchased_year,
    purchasedSeason: row.purchased_season,
    purchasedWeek: row.purchased_week,
  };
}

function toRow(vessel: StorageVessel): StorageVesselRow {
  return {
    id: vessel.id,
    vessel_name: vessel.vesselName ?? null,
    owner_kind: vessel.ownerKind,
    owner_company_id: vessel.ownerCompanyId ?? null,
    vessel_type: vessel.vesselType,
    material: vessel.material,
    quality_score: vessel.qualityScore,
    condition: vessel.condition,
    fill_history: vessel.fillHistory,
    production_year: vessel.productionYear,
    capacity_litres: vessel.capacityLitres,
    acquisition_price: vessel.acquisitionPrice,
    source_offer_id: vessel.sourceOfferId,
    operational_status: vessel.operationalStatus,
    cleanliness: vessel.cleanliness,
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
): { occupancy: StorageVesselOccupancy; activePlanId?: string; activeWineBatchId?: string } {
  const allocation = allocations.find((candidate) => candidate.vesselId === vesselId && !candidate.releasedAt);
  if (!allocation) return { occupancy: 'available' };
  const plan = plans.find((candidate) => candidate.id === allocation.planId);
  if (!plan) return { occupancy: 'reserved', activePlanId: allocation.planId };
  return {
    occupancy: plan.status === 'active' ? 'in_use' : plan.status === 'reserved' ? 'reserved' : 'available',
    activePlanId: plan.id,
    activeWineBatchId: plan.wineBatchId,
  };
}

export async function getCompanyStorageVessels(companyId: string): Promise<{ data: StorageVessel[]; error: unknown }> {
  const [{ data, error }, plansResult, allocationsResult] = await Promise.all([
    supabase.from(TABLE).select('*').eq('owner_kind', 'company').eq('owner_company_id', companyId).order('purchased_year').order('purchased_week'),
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
  return supabase.from(TABLE).delete().eq('owner_kind', 'company').eq('owner_company_id', companyId).in('id', vesselIds);
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
  const filledVesselIds: string[] = [];
  const rows = (data ?? []) as unknown as AllocationRow[];
  for (const row of rows) {
    const fill = Math.min(row.assigned_capacity_litres, remaining);
    if (fill > 0) filledVesselIds.push(row.vessel_id);
    const result = await supabase
      .from('storage_vessel_allocations')
      .update({ filled_litres: fill })
      .eq('company_id', companyId)
      .eq('id', row.id);
    if (result.error) return { data: null, error: result.error };
    remaining -= fill;
  }
  if (filledLitres > 0) {
    if (filledVesselIds.length > 0) {
      const dirtyResult = await supabase
        .from(TABLE)
        .update({ cleanliness: 'dirty' })
        .eq('owner_kind', 'company')
        .eq('owner_company_id', companyId)
        .in('id', filledVesselIds);
      if (dirtyResult.error) return { data: null, error: dirtyResult.error };
    }
  }
  return { data: rows.length, error: null };
}

export async function releaseStorageVesselAllocation(companyId: string, planId: string, vesselId: string) {
  return supabase
    .from('storage_vessel_allocations')
    .update({ released_at: new Date().toISOString(), filled_litres: 0 })
    .eq('company_id', companyId)
    .eq('plan_id', planId)
    .eq('vessel_id', vesselId)
    .is('released_at', null);
}

export async function consumeStorageBackedWineBatch(input: {
  companyId: string;
  batchId: string;
  quantity: number;
  releasedYear: number;
  releasedSeason: string;
  releasedWeek: number;
}) {
  const { data, error } = await supabase.rpc('consume_storage_backed_wine_batch', {
    p_company_id: input.companyId,
    p_batch_id: input.batchId,
    p_quantity: input.quantity,
    p_released_year: input.releasedYear,
    p_released_season: input.releasedSeason,
    p_released_week: input.releasedWeek,
  });
  return { consumed: Boolean(data), error };
}

export async function completeEmptyStorageVessel(input: {
  companyId: string;
  batchId: string;
  planId: string;
  vesselId: string;
  remainingLitres: number;
  remainingQuantity: number;
  releasedAt: string;
  releasedYear: number;
  releasedSeason: string;
  releasedWeek: number;
}) {
  const { data, error } = await supabase.rpc('complete_empty_storage_vessel', {
    p_company_id: input.companyId,
    p_batch_id: input.batchId,
    p_plan_id: input.planId,
    p_vessel_id: input.vesselId,
    p_remaining_litres: input.remainingLitres,
    p_remaining_quantity: input.remainingQuantity,
    p_released_at: input.releasedAt,
    p_released_year: input.releasedYear,
    p_released_season: input.releasedSeason,
    p_released_week: input.releasedWeek,
  });
  return { completed: Boolean(data), error };
}

export async function completeCleanStorageVessel(input: { companyId: string; vesselId: string }) {
  const { data, error } = await supabase.rpc('complete_clean_storage_vessel', {
    p_company_id: input.companyId,
    p_vessel_id: input.vesselId,
  });
  return { completed: Boolean(data), error };
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
