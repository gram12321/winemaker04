import { loadActivitiesFromDb } from '@/lib/database/activities/activityDB';
import {
  getCompanyStorageAllocationPlans,
  getCompanyStorageAllocations,
  getCompanyStorageVessels,
  releaseStorageVesselAllocation,
  updateStorageVesselAllocationFill,
  updateStorageVesselPlanVolume,
} from '@/lib/database/winery/storageVesselsDB';
import { createActivityWithResult } from '@/lib/services/activity/activitymanagers/activityManager';
import { calculateEmptyStorageVesselWork } from '@/lib/services/activity/workcalculators/storageVesselMaintenanceWorkCalculator';
import { getGameState } from '@/lib/services/core/gameState';
import type { StorageVessel, StorageVesselAllocation, StorageVesselAllocationPlan } from '@/lib/types/storageVessels';
import { WorkCategory, type Activity, type WineBatch } from '@/lib/types/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { deleteInventoryBatch, getAllWineBatches, updateInventoryBatch } from './inventoryService';
import { getStorageVesselDisplayName } from './storageVesselService';

const EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE = 'empty_storage_vessel';

function refreshStorageVesselViews(): void {
  triggerTopicUpdate('storage_vessels');
  triggerTopicUpdate('wine_batches');
}

interface EmptyVesselContext {
  vessel: StorageVessel;
  allocation: StorageVesselAllocation;
  plan: StorageVesselAllocationPlan;
  batch: WineBatch;
}

export interface EmptyStorageVesselResult {
  success: boolean;
  error?: string;
  batch?: WineBatch;
  vesselName?: string;
  emptiedLitres?: number;
  remainingLitres?: number;
}

export function isStorageVesselEmptyingInProgress(vesselId: string): boolean {
  return (getGameState().activities ?? []).some((activity) =>
    (activity.status === 'active' || activity.status === 'paused')
    && activity.category === WorkCategory.MAINTENANCE
    && activity.params.type === EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE
    && activity.params.vesselId === vesselId
  );
}

/** Production remains paused while any vessel containing this batch is being emptied. */
export function isBatchEmptyingInProgress(batchId: string): boolean {
  return (getGameState().activities ?? []).some((activity) =>
    (activity.status === 'active' || activity.status === 'paused')
    && activity.category === WorkCategory.MAINTENANCE
    && activity.params.type === EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE
    && activity.params.batchId === batchId
  );
}

/**
 * Resolve emptying from canonical persistence records, never from derived
 * `StorageVessel.activePlanId` or `activeWineBatchId` display fields.
 */
async function resolveEmptyVesselContext(vesselId: string): Promise<{ context?: EmptyVesselContext; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { error: 'No active company selected.' };

  const [vesselsResult, plansResult, allocationsResult, batches] = await Promise.all([
    getCompanyStorageVessels(companyId),
    getCompanyStorageAllocationPlans(companyId),
    getCompanyStorageAllocations(companyId),
    getAllWineBatches(),
  ]);
  if (vesselsResult.error || plansResult.error || allocationsResult.error) {
    return { error: 'Could not load the vessel allocation records. Please try again.' };
  }

  const vessel = vesselsResult.data.find((candidate) => candidate.id === vesselId);
  if (!vessel) return { error: 'The selected vessel no longer belongs to this company.' };
  if (vessel.operationalStatus !== 'operational') return { error: `${getStorageVesselDisplayName(vessel)} is ${vessel.operationalStatus} and cannot be emptied.` };

  const allocation = allocationsResult.data.find((candidate) => candidate.vesselId === vesselId && !candidate.releasedAt);
  if (!allocation) return { error: `${getStorageVesselDisplayName(vessel)} has no active storage allocation.` };

  const plan = plansResult.data.find((candidate) => candidate.id === allocation.planId);
  if (!plan || plan.status !== 'active') return { error: `${getStorageVesselDisplayName(vessel)} is not assigned to an active storage plan.` };

  const batch = batches.find((candidate) => candidate.id === plan.wineBatchId)
    ?? batches.find((candidate) => candidate.storagePlanId === plan.id);
  if (!batch) return { error: `The active storage plan for ${getStorageVesselDisplayName(vessel)} has no wine batch.` };

  return { context: { vessel, allocation, plan, batch } };
}

/** Start a cancellable task that removes only the selected vessel's filled volume. */
export async function startEmptyStorageVesselActivity(vesselId: string): Promise<EmptyStorageVesselResult> {
  const resolved = await resolveEmptyVesselContext(vesselId);
  if (!resolved.context) return { success: false, error: resolved.error };
  const { vessel, allocation, plan, batch } = resolved.context;

  if (allocation.filledLitres <= 0) return { success: false, error: `${getStorageVesselDisplayName(vessel)} has no wine volume to empty.` };
  if (isStorageVesselEmptyingInProgress(vessel.id)) return { success: false, error: 'An Empty Vessel activity is already in progress for this vessel.' };

  const persistedActivities = await loadActivitiesFromDb();
  const activities = persistedActivities.length > 0 ? persistedActivities : (getGameState().activities ?? []);
  const blockingActivity = activities.find((activity) =>
    (activity.status === 'active' || activity.status === 'paused')
    && activity.category !== WorkCategory.MAINTENANCE
    && (activity.params.outputBatchId === batch.id || activity.params.batchId === batch.id || activity.params.storagePlanId === plan.id)
  );
  if (blockingActivity) {
    return { success: false, error: `Cannot empty ${getStorageVesselDisplayName(vessel)} while "${blockingActivity.title}" is still in progress. Cancel or complete that activity first.` };
  }

  const vesselName = getStorageVesselDisplayName(vessel);
  const work = calculateEmptyStorageVesselWork(allocation.filledLitres);
  const activityResult = await createActivityWithResult({
    category: WorkCategory.MAINTENANCE,
    title: `Empty Vessel - ${vesselName}`,
    targetId: vessel.id,
    totalWork: work.totalWork,
    activityDetails: `Discard ${Math.round(allocation.filledLitres)} L from ${vesselName}`,
    params: {
      type: EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE,
      batchId: batch.id,
      vesselId: vessel.id,
      sourceStoragePlanId: plan.id,
      targetName: vesselName,
    },
    isCancellable: true,
  });

  return activityResult.activityId
    ? { success: true, batch, vesselName }
    : { success: false, error: activityResult.reason ?? 'Could not start the Empty Vessel activity.' };
}

/** Complete a validated Empty Vessel activity and release only its selected allocation. */
export async function completeEmptyStorageVesselActivity(activity: Activity): Promise<EmptyStorageVesselResult> {
  const vesselId = typeof activity.params.vesselId === 'string' ? activity.params.vesselId : null;
  const expectedPlanId = typeof activity.params.sourceStoragePlanId === 'string' ? activity.params.sourceStoragePlanId : null;
  if (!vesselId || !expectedPlanId) return { success: false, error: 'This Empty Vessel activity has incomplete vessel details.' };

  const resolved = await resolveEmptyVesselContext(vesselId);
  if (!resolved.context) return { success: false, error: resolved.error };
  const { vessel, allocation, plan, batch } = resolved.context;
  if (plan.id !== expectedPlanId) return { success: false, error: 'The selected vessel has been reassigned to another storage plan.' };

  const currentVolume = Math.max(0, batch.volumeLitres ?? batch.quantity);
  const emptiedLitres = Math.min(currentVolume, allocation.filledLitres);
  const remainingLitres = Math.max(0, currentVolume - emptiedLitres);
  if (remainingLitres <= 0) {
    const success = await deleteInventoryBatch(batch.id);
    if (success) refreshStorageVesselViews();
    return success
      ? { success: true, batch, vesselName: getStorageVesselDisplayName(vessel), emptiedLitres, remainingLitres }
      : { success: false, error: 'Could not discard the final remaining batch volume.' };
  }

  const quantityRatio = currentVolume > 0 ? remainingLitres / currentVolume : 0;
  const remainingQuantity = Math.max(0, batch.quantity * quantityRatio);
  if (!(await updateInventoryBatch(batch.id, { volumeLitres: remainingLitres, quantity: remainingQuantity }))) {
    return { success: false, error: 'Could not update the remaining batch volume.' };
  }

  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  if ((await releaseStorageVesselAllocation(companyId, plan.id, vessel.id)).error) return { success: false, error: 'Could not release the emptied vessel.' };
  if ((await updateStorageVesselPlanVolume(companyId, plan.id, remainingLitres)).error) return { success: false, error: 'Could not update the remaining storage plan.' };
  if ((await updateStorageVesselAllocationFill(companyId, plan.id, remainingLitres)).error) return { success: false, error: 'Could not update the remaining vessel fills.' };

  refreshStorageVesselViews();
  return { success: true, batch: { ...batch, volumeLitres: remainingLitres, quantity: remainingQuantity }, vesselName: getStorageVesselDisplayName(vessel), emptiedLitres, remainingLitres };
}

export function isEmptyStorageVesselActivity(activity: Activity): boolean {
  return activity.category === WorkCategory.MAINTENANCE && activity.params.type === EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE;
}
