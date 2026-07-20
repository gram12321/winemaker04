import { completeCleanStorageVessel, completeEmptyStorageVessel, getCompanyStorageAllocationPlans, getCompanyStorageAllocations, getCompanyStorageVessels } from '@/lib/database/winery/storageVesselsDB';
import { activitiesFeature } from '@/lib/features/activities';
import { getGameState } from '@/lib/services/core/gameState';
import type { StorageVessel, StorageVesselAllocation, StorageVesselAllocationPlan } from '@/lib/types/storageVessels';
import { WorkCategory, type Activity, type WineBatch } from '@/lib/types/types';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { triggerTopicUpdate } from '@/hooks/useGameUpdates';
import { getAllWineBatches } from './inventoryService';
import { getStorageVesselDisplayName } from './storageVesselService';

const EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE = 'empty_storage_vessel';
const CLEAN_STORAGE_VESSEL_ACTIVITY_TYPE = 'clean_storage_vessel';

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

export function isStorageVesselCleaningInProgress(vesselId: string): boolean {
  return (getGameState().activities ?? []).some((activity) =>
    (activity.status === 'active' || activity.status === 'paused')
    && activity.category === WorkCategory.MAINTENANCE
    && activity.params.type === CLEAN_STORAGE_VESSEL_ACTIVITY_TYPE
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

export interface CleanStorageVesselResult {
  success: boolean;
  error?: string;
  vesselName?: string;
}

async function resolveVessel(vesselId: string): Promise<{ vessel?: StorageVessel; error?: string }> {
  const companyId = getCurrentCompanyId();
  if (!companyId) return { error: 'No active company selected.' };
  const result = await getCompanyStorageVessels(companyId);
  if (result.error) return { error: 'Could not load the vessel records. Please try again.' };
  const vessel = result.data.find((candidate) => candidate.id === vesselId);
  return vessel ? { vessel } : { error: 'The selected vessel no longer belongs to this company.' };
}

export async function startCleanStorageVesselActivity(vesselId: string): Promise<CleanStorageVesselResult> {
  const resolved = await resolveVessel(vesselId);
  if (!resolved.vessel) return { success: false, error: resolved.error };
  const vessel = resolved.vessel;
  const vesselName = getStorageVesselDisplayName(vessel);
  if (vessel.operationalStatus !== 'operational') return { success: false, error: `${vesselName} is ${vessel.operationalStatus} and cannot be cleaned.` };
  if (vessel.occupancy !== 'available') return { success: false, error: `${vesselName} must be empty before it can be cleaned.` };
  if (vessel.cleanliness !== 'dirty') return { success: false, error: `${vesselName} is already clean.` };
  if (isStorageVesselCleaningInProgress(vesselId) || isStorageVesselEmptyingInProgress(vesselId)) {
    return { success: false, error: `${vesselName} already has a vessel maintenance activity in progress.` };
  }

  const work = activitiesFeature.work.calculateCleanStorageVessel(vessel.capacityLitres);
  const activityResult = await activitiesFeature.lifecycle.createWithResult({
    category: WorkCategory.MAINTENANCE,
    title: `Clean Vessel - ${vesselName}`,
    targetId: vessel.id,
    totalWork: work.totalWork,
    activityDetails: `Clean ${vesselName} for reuse`,
    params: { type: CLEAN_STORAGE_VESSEL_ACTIVITY_TYPE, vesselId: vessel.id, targetName: vesselName },
    isCancellable: true,
  });
  return activityResult.activityId
    ? { success: true, vesselName }
    : { success: false, error: activityResult.reason ?? 'Could not start the Clean Vessel activity.' };
}

export async function completeCleanStorageVesselActivity(activity: Activity): Promise<CleanStorageVesselResult> {
  const vesselId = typeof activity.params.vesselId === 'string' ? activity.params.vesselId : null;
  if (!vesselId) return { success: false, error: 'This Clean Vessel activity has incomplete vessel details.' };
  const resolved = await resolveVessel(vesselId);
  if (!resolved.vessel) return { success: false, error: resolved.error };
  const vessel = resolved.vessel;
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const completed = await completeCleanStorageVessel({ companyId, vesselId });
  if (completed.error || !completed.completed) return { success: false, error: 'Could not persist the cleaned vessel state.' };
  refreshStorageVesselViews();
  return { success: true, vesselName: getStorageVesselDisplayName(vessel) };
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

  const persistedActivities = await activitiesFeature.reads.getAll();
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
  const work = activitiesFeature.work.calculateEmptyStorageVessel(allocation.filledLitres);
  const activityResult = await activitiesFeature.lifecycle.createWithResult({
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

  const currentQuantity = Math.max(0, batch.quantity ?? 0);
  const currentVolume = Math.max(0, batch.volumeLitres ?? currentQuantity);
  const emptiedLitres = Math.min(currentVolume, allocation.filledLitres);
  const remainingLitres = Math.max(0, currentVolume - emptiedLitres);
  const quantityRatio = currentVolume > 0 ? remainingLitres / currentVolume : 0;
  const remainingQuantity = Math.max(0, currentQuantity * quantityRatio);
  const companyId = getCurrentCompanyId();
  if (!companyId) return { success: false, error: 'No active company selected.' };
  const state = getGameState();
  const completed = await completeEmptyStorageVessel({
    companyId,
    batchId: batch.id,
    planId: plan.id,
    vesselId: vessel.id,
    remainingLitres,
    remainingQuantity,
    releasedAt: new Date().toISOString(),
    releasedYear: state.currentYear ?? 2024,
    releasedSeason: state.season ?? 'Spring',
    releasedWeek: state.week ?? 1,
  });
  if (completed.error || !completed.completed) return { success: false, error: 'Could not persist the emptied vessel state.' };

  refreshStorageVesselViews();
  return { success: true, batch: { ...batch, volumeLitres: remainingLitres, quantity: remainingQuantity }, vesselName: getStorageVesselDisplayName(vessel), emptiedLitres, remainingLitres };
}

export function isEmptyStorageVesselActivity(activity: Activity): boolean {
  return activity.category === WorkCategory.MAINTENANCE && activity.params.type === EMPTY_STORAGE_VESSEL_ACTIVITY_TYPE;
}
