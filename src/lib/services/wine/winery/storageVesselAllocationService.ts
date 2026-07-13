import {
  addStorageVesselPlanAllocations,
  activateStorageVesselPlan,
  getCompanyStorageAllocationPlans,
  getCompanyStorageAllocations,
  getCompanyStorageVessels,
  releaseStorageVesselPlan,
  reserveStorageVesselPlan,
  updateStorageVesselAllocationFill,
  updateStorageVesselPlanVolume,
} from '@/lib/database/winery/storageVesselsDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getGameState } from '@/lib/services/core/gameState';
import { GAME_INITIALIZATION, STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG } from '@/lib/constants';
import type { StorageVessel } from '@/lib/types/storageVessels';
import type { WineBatch } from '@/lib/types/types';

export interface StorageCapacitySummary {
  totalLitres: number;
  availableLitres: number;
  reservedLitres: number;
  inUseLitres: number;
  availableVesselCount: number;
}

function currentGameDate() {
  const state = getGameState();
  return {
    year: state.currentYear ?? GAME_INITIALIZATION.STARTING_YEAR,
    season: state.season ?? GAME_INITIALIZATION.STARTING_SEASON,
    week: state.week ?? GAME_INITIALIZATION.STARTING_WEEK,
  };
}

export function initializeHarvestVolumeLitres(quantityKg: number): number {
  return Math.max(1, Math.ceil(quantityKg * STORAGE_VESSEL_INITIAL_HARVEST_LITRES_PER_KG));
}

export function getRequiredStorageLitres(batch: WineBatch): number {
  return Math.max(1, Math.ceil(batch.volumeLitres ?? initializeHarvestVolumeLitres(batch.quantity)));
}

export async function getAvailableStorageVessels(): Promise<StorageVessel[]> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return [];
  const { data, error } = await getCompanyStorageVessels(companyId);
  if (error) throw error;
  return data.filter((vessel) => vessel.occupancy === 'available' && vessel.operationalStatus === 'operational');
}

export async function getStorageCapacitySummary(): Promise<StorageCapacitySummary> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { totalLitres: 0, availableLitres: 0, reservedLitres: 0, inUseLitres: 0, availableVesselCount: 0 };
  const { data: vessels, error: vesselError } = await getCompanyStorageVessels(companyId);
  if (vesselError) throw vesselError;
  return vessels.reduce<StorageCapacitySummary>((summary, vessel) => {
    summary.totalLitres += vessel.capacityLitres;
    if (vessel.operationalStatus === 'operational' && vessel.occupancy === 'available') {
      summary.availableLitres += vessel.capacityLitres;
      summary.availableVesselCount += 1;
    } else if (vessel.occupancy === 'reserved') {
      summary.reservedLitres += vessel.capacityLitres;
    } else if (vessel.occupancy === 'in_use') {
      summary.inUseLitres += vessel.capacityLitres;
    }
    return summary;
  }, { totalLitres: 0, availableLitres: 0, reservedLitres: 0, inUseLitres: 0, availableVesselCount: 0 });
}

export async function createStorageAllocationPlan(input: {
  requiredLitres: number;
  vesselIds: string[];
  activityId?: string;
}): Promise<{ planId: string | null; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { planId: null, error: 'No active company selected.' };
  try {
    const date = currentGameDate();
    const result = await reserveStorageVesselPlan({
      companyId,
      requiredLitres: input.requiredLitres,
      vesselIds: input.vesselIds,
      activityId: input.activityId,
      createdYear: date.year,
      createdSeason: date.season,
      createdWeek: date.week,
    });
    if (result.error || !result.planId) return { planId: null, error: 'Selected vessels are unavailable or lack capacity.' };
    return { planId: result.planId };
  } catch (error) {
    console.error('Failed to create Storage Vessel allocation plan:', error);
    return { planId: null, error: 'Could not reserve Storage Vessel capacity.' };
  }
}

export async function addStorageVesselCapacity(planId: string, vesselIds: string[]): Promise<{ success: boolean; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const result = await addStorageVesselPlanAllocations(companyId, planId, vesselIds);
  if (result.error || !result.added) return { success: false, error: 'Selected Storage Vessels are unavailable.' };
  return { success: true };
}

export async function activateStoragePlanForBatch(planId: string, batchId: string, volumeLitres: number): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return false;
  const activated = await activateStorageVesselPlan(companyId, planId, batchId, volumeLitres, currentGameDate());
  if (activated.error || !activated.data) return false;
  const filled = await updateStorageVesselAllocationFill(companyId, planId, volumeLitres);
  return !filled.error;
}

export async function recordBatchStorageVolume(batchId: string, volumeLitres: number): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return false;
  const plansResult = await getCompanyStorageAllocationPlans(companyId);
  if (plansResult.error) throw plansResult.error;
  const plan = plansResult.data.find((candidate) => candidate.wineBatchId === batchId && candidate.status === 'active');
  if (!plan) return false;
  const volume = Math.max(0, volumeLitres);
  const allocationsResult = await getCompanyStorageAllocations(companyId);
  if (allocationsResult.error) throw allocationsResult.error;
  const assignedLitres = allocationsResult.data
    .filter((allocation) => allocation.planId === plan.id && !allocation.releasedAt)
    .reduce((total, allocation) => total + allocation.assignedCapacityLitres, 0);
  if (volume > assignedLitres) return false;
  const updated = await updateStorageVesselPlanVolume(companyId, plan.id, volume);
  if (updated.error) return false;
  const filled = await updateStorageVesselAllocationFill(companyId, plan.id, volume);
  return !filled.error;
}

export async function canStoragePlanHoldVolume(planId: string, volumeLitres: number): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return false;
  const result = await getCompanyStorageAllocations(companyId);
  if (result.error) throw result.error;
  const capacity = result.data
    .filter((allocation) => allocation.planId === planId && !allocation.releasedAt)
    .reduce((total, allocation) => total + allocation.assignedCapacityLitres, 0);
  return Math.max(0, volumeLitres) <= capacity;
}

export async function getStoragePlanCapacityLitres(planId: string): Promise<number> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return 0;
  const result = await getCompanyStorageAllocations(companyId);
  if (result.error) throw result.error;
  return result.data
    .filter((allocation) => allocation.planId === planId && !allocation.releasedAt)
    .reduce((total, allocation) => total + allocation.assignedCapacityLitres, 0);
}

export async function assertBatchHasUsableStorage(batch: WineBatch): Promise<{ valid: boolean; reason?: string }> {
  if (batch.state === 'bottled') return { valid: true };
  if (!batch.storagePlanId || batch.volumeLitres === undefined || batch.volumeLitres <= 0) {
    return { valid: false, reason: 'This batch must be assigned to Storage Vessels before production can continue.' };
  }
  const companyId = getCurrentCompanyId();
  if (!companyId) return { valid: false, reason: 'No active company selected.' };
  const [plansResult, allocationsResult] = await Promise.all([
    getCompanyStorageAllocationPlans(companyId),
    getCompanyStorageAllocations(companyId),
  ]);
  if (plansResult.error || allocationsResult.error) return { valid: false, reason: 'Storage capacity could not be checked.' };
  const plan = plansResult.data.find((candidate) => candidate.id === batch.storagePlanId && candidate.status === 'active');
  const assignedLitres = allocationsResult.data
    .filter((allocation) => allocation.planId === batch.storagePlanId && !allocation.releasedAt)
    .reduce((total, allocation) => total + allocation.assignedCapacityLitres, 0);
  if (!plan || assignedLitres < batch.volumeLitres) {
    return { valid: false, reason: 'This batch does not have enough active Storage Vessel capacity.' };
  }
  return { valid: true };
}

export async function releaseStoragePlanForBatch(batch: WineBatch): Promise<boolean> {
  if (!batch.storagePlanId) return true;
  return releaseStorageAllocationPlan(batch.storagePlanId);
}

export async function releaseStorageAllocationPlan(planId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return false;
  const result = await releaseStorageVesselPlan(companyId, planId, currentGameDate());
  return !result.error;
}

/**
 * Cancelling a production activity may undo capacity that was reserved before
 * any wine existed, but must never release an active plan that already holds
 * a batch (including a partially harvested batch).
 */
export async function releaseReservedStorageAllocationPlan(planId: string): Promise<boolean> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return false;

  const plansResult = await getCompanyStorageAllocationPlans(companyId);
  if (plansResult.error) throw plansResult.error;
  const plan = plansResult.data.find((candidate) => candidate.id === planId);

  if (!plan || plan.status !== 'reserved') return true;

  const result = await releaseStorageVesselPlan(companyId, planId, currentGameDate());
  return !result.error;
}

export function getStorageVesselAllocationAvailability(vessel: StorageVessel): { available: boolean; reason?: string } {
  if (vessel.operationalStatus !== 'operational') return { available: false, reason: `Vessel is ${vessel.operationalStatus}.` };
  if (vessel.occupancy !== 'available') return { available: false, reason: `Vessel is currently ${vessel.occupancy.replace('_', ' ')}.` };
  return { available: true };
}
