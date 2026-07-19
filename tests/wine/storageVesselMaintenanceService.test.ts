import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageVessel } from '@/lib/types/storageVessels';
import { WorkCategory, type Activity, type WineBatch } from '@/lib/types/types';

const mocks = vi.hoisted(() => ({
  activities: [] as Activity[],
  vessel: null as StorageVessel | null,
  batch: null as WineBatch | null,
  createActivityWithResult: vi.fn(async () => ({ activityId: 'activity-1' })),
  calculateEmptyStorageVessel: vi.fn(() => ({ totalWork: 10, workFactors: [] })),
  loadActivitiesFromDb: vi.fn(async () => [] as Activity[]),
  getAllWineBatches: vi.fn(async () => [] as WineBatch[]),
  completeEmptyStorageVessel: vi.fn(async () => ({ completed: true, error: null })),
  getCompanyStorageVessels: vi.fn(async () => ({ data: [] as StorageVessel[], error: null })),
  getCompanyStorageAllocationPlans: vi.fn(async () => ({ data: [{ id: 'plan-1', status: 'active', wineBatchId: 'batch-1' }], error: null })),
  getCompanyStorageAllocations: vi.fn(async () => ({ data: [{ planId: 'plan-1', vesselId: 'vessel-1', filledLitres: 500, assignedCapacityLitres: 500, releasedAt: undefined }], error: null })),
  releaseStorageVesselAllocation: vi.fn(async () => ({ error: null })),
  triggerTopicUpdate: vi.fn(),
}));

vi.mock('@/lib/features/activities', () => ({
  activitiesFeature: {
    reads: { getAll: mocks.loadActivitiesFromDb },
    lifecycle: { createWithResult: mocks.createActivityWithResult },
    work: { calculateEmptyStorageVessel: mocks.calculateEmptyStorageVessel },
  },
}));
vi.mock('@/lib/services/core/gameState', () => ({ getGameState: () => ({ activities: mocks.activities }) }));
vi.mock('@/lib/services/wine/winery/inventoryService', () => ({
  getAllWineBatches: mocks.getAllWineBatches,
}));
vi.mock('@/lib/services/wine/winery/storageVesselService', () => ({ getStorageVesselDisplayName: () => '2024 - 500 L oak cask' }));
vi.mock('@/lib/utils/companyUtils', () => ({ getCurrentCompanyId: () => 'company-1' }));
vi.mock('@/lib/database/winery/storageVesselsDB', () => ({
  getCompanyStorageVessels: mocks.getCompanyStorageVessels,
  getCompanyStorageAllocationPlans: mocks.getCompanyStorageAllocationPlans,
  getCompanyStorageAllocations: mocks.getCompanyStorageAllocations,
  completeEmptyStorageVessel: mocks.completeEmptyStorageVessel,
}));
vi.mock('@/hooks/useGameUpdates', () => ({ triggerTopicUpdate: mocks.triggerTopicUpdate }));

describe('Storage Vessel maintenance service', () => {
  beforeEach(() => {
    mocks.activities = [];
    mocks.vessel = {
      id: 'vessel-1', companyId: 'company-1', vesselType: 'cask', material: 'oak', qualityScore: 0.8,
      productionYear: 2024, capacityLitres: 500, acquisitionPrice: 1000, sourceOfferId: 'offer-1',
      operationalStatus: 'operational', occupancy: 'in_use', activePlanId: 'plan-1', activeWineBatchId: 'batch-1',
      purchasedYear: 2026, purchasedSeason: 'Spring', purchasedWeek: 1,
    };
    mocks.batch = { id: 'batch-1', storagePlanId: 'plan-1', volumeLitres: 500, grape: 'Pinot Noir' } as WineBatch;
    mocks.getCompanyStorageVessels.mockResolvedValue({ data: [mocks.vessel], error: null });
    mocks.getAllWineBatches.mockResolvedValue([mocks.batch]);
    mocks.createActivityWithResult.mockResolvedValue({ activityId: 'activity-1' });
    mocks.loadActivitiesFromDb.mockResolvedValue([]);
    mocks.completeEmptyStorageVessel.mockResolvedValue({ completed: true, error: null });
    vi.clearAllMocks();
  });

  it('creates a cancellable Maintenance activity for an occupied vessel', async () => {
    const { startEmptyStorageVesselActivity } = await import('@/lib/services/wine/winery/storageVesselMaintenanceService');

    await expect(startEmptyStorageVesselActivity('vessel-1')).resolves.toMatchObject({ success: true, vesselName: '2024 - 500 L oak cask' });
    expect(mocks.createActivityWithResult).toHaveBeenCalledWith(expect.objectContaining({
      category: WorkCategory.MAINTENANCE,
      title: 'Empty Vessel - 2024 - 500 L oak cask',
      targetId: 'vessel-1',
      isCancellable: true,
      params: expect.objectContaining({
        type: 'empty_storage_vessel', batchId: 'batch-1', vesselId: 'vessel-1', sourceStoragePlanId: 'plan-1',
      }),
    }));
  });

  it('does not create a second emptying activity for the same vessel', async () => {
    mocks.activities = [activity({ params: { type: 'empty_storage_vessel', vesselId: 'vessel-1' } })];
    const { startEmptyStorageVesselActivity } = await import('@/lib/services/wine/winery/storageVesselMaintenanceService');

    await expect(startEmptyStorageVesselActivity('vessel-1')).resolves.toMatchObject({
      success: false,
      error: 'An Empty Vessel activity is already in progress for this vessel.',
    });
    expect(mocks.createActivityWithResult).not.toHaveBeenCalled();
  });

  it('resolves a batch through the storage plan when derived vessel IDs are missing', async () => {
    mocks.vessel = { ...mocks.vessel, activeWineBatchId: undefined } as StorageVessel;
    mocks.getCompanyStorageVessels.mockResolvedValue({ data: [mocks.vessel], error: null });
    mocks.getAllWineBatches.mockResolvedValue([mocks.batch as WineBatch]);
    const { startEmptyStorageVesselActivity } = await import('@/lib/services/wine/winery/storageVesselMaintenanceService');

    await expect(startEmptyStorageVesselActivity('vessel-1')).resolves.toMatchObject({ success: true, batch: mocks.batch });
  });

  it('explains when an active harvest still owns the batch storage plan', async () => {
    mocks.loadActivitiesFromDb.mockResolvedValue([activity({
      category: WorkCategory.HARVESTING,
      title: 'Harvest Test Vineyard',
      params: { storagePlanId: 'plan-1', outputBatchId: 'batch-1' },
    })]);
    const { startEmptyStorageVesselActivity } = await import('@/lib/services/wine/winery/storageVesselMaintenanceService');

    await expect(startEmptyStorageVesselActivity('vessel-1')).resolves.toMatchObject({
      success: false,
      error: 'Cannot empty 2024 - 500 L oak cask while "Harvest Test Vineyard" is still in progress. Cancel or complete that activity first.',
    });
  });

  it('deletes the batch on completion so its storage plan is released by inventory cleanup', async () => {
    const { completeEmptyStorageVesselActivity } = await import('@/lib/services/wine/winery/storageVesselMaintenanceService');

    await expect(completeEmptyStorageVesselActivity(activity())).resolves.toMatchObject({ success: true, batch: { ...mocks.batch, volumeLitres: 0, quantity: 0 } });
    expect(mocks.completeEmptyStorageVessel).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'batch-1', remainingLitres: 0 }));
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('storage_vessels');
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('wine_batches');
  });

  it('reduces the batch and releases only the selected vessel when other volume remains', async () => {
    mocks.batch = { ...mocks.batch, volumeLitres: 500, quantity: 1000 } as WineBatch;
    mocks.getAllWineBatches.mockResolvedValue([mocks.batch]);
    mocks.getCompanyStorageAllocations.mockResolvedValue({
      data: [{ planId: 'plan-1', vesselId: 'vessel-1', filledLitres: 200, assignedCapacityLitres: 500, releasedAt: undefined }],
      error: null,
    });
    const { completeEmptyStorageVesselActivity } = await import('@/lib/services/wine/winery/storageVesselMaintenanceService');

    await expect(completeEmptyStorageVesselActivity(activity())).resolves.toMatchObject({
      success: true,
      emptiedLitres: 200,
      remainingLitres: 300,
    });
    expect(mocks.completeEmptyStorageVessel).toHaveBeenCalledWith(expect.objectContaining({ batchId: 'batch-1', remainingLitres: 300, remainingQuantity: 600 }));
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('storage_vessels');
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('wine_batches');
  });
});

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1', category: WorkCategory.MAINTENANCE, title: 'Empty Vessel - 2024 - 500 L oak cask',
    totalWork: 18, completedWork: 0, targetId: 'batch-1',
    params: { type: 'empty_storage_vessel', batchId: 'batch-1', vesselId: 'vessel-1', sourceStoragePlanId: 'plan-1' },
    status: 'active', gameWeek: 1, gameSeason: 'Spring', gameYear: 2026, isCancellable: true, createdAt: new Date(),
    ...overrides,
  };
}
