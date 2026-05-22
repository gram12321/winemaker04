import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCategory, type Activity } from '@/lib/types/types';

const mocks = vi.hoisted(() => {
  let state: any = {};
  let activities: Activity[] = [];
  const uuid = vi.fn(() => 'activity-1');

  return {
    uuid,
    setState: (nextState: any) => {
      state = nextState;
    },
    getActivities: () => activities,
    setActivities: (nextActivities: Activity[]) => {
      activities = nextActivities;
    },
    getGameState: vi.fn(() => state),
    updateGameState: vi.fn(updates => {
      state = { ...state, ...updates };
    }),
    notificationAddMessage: vi.fn(async () => undefined),
    saveActivityToDb: vi.fn(async (activity: Activity) => {
      activities = [...activities, activity];
      return true;
    }),
    loadActivitiesFromDb: vi.fn(async () => activities),
    updateActivityInDb: vi.fn(async (activityId: string, updates: Partial<Activity>) => {
      activities = activities.map(activity =>
        activity.id === activityId ? { ...activity, ...updates } : activity
      );
      return true;
    }),
    removeActivityFromDb: vi.fn(async (activityId: string) => {
      activities = activities.filter(activity => activity.id !== activityId);
      return true;
    }),
    hasActiveActivity: vi.fn(async () => false),
    getTeamForCategory: vi.fn(() => ({ id: 'team-1', memberIds: ['staff-1'] })),
    triggerGameUpdateImmediate: vi.fn(() => undefined),
    completePlanting: vi.fn(async () => undefined),
    createWineBatchFromHarvest: vi.fn(async () => undefined),
    calculateVineyardYield: vi.fn(() => 0),
    completeClearingActivity: vi.fn(async () => undefined),
    handlePartialPlanting: vi.fn(async () => undefined),
    handlePartialHarvesting: vi.fn(async () => undefined),
    completeCrushing: vi.fn(async () => undefined),
    completeFermentationSetup: vi.fn(async () => undefined),
    completeBookkeeping: vi.fn(async () => undefined),
    calculateStaffWorkContribution: vi.fn(() => 0),
    calculateIndividualStaffContribution: vi.fn(() => 0),
    completeStaffSearch: vi.fn(async () => undefined),
    completeHiringProcess: vi.fn(async () => undefined),
    completeLandSearch: vi.fn(async () => undefined),
    awardExperience: vi.fn(async () => undefined)
  };
});

vi.mock('uuid', () => ({
  v4: mocks.uuid
}));

vi.mock('@/lib/services', () => ({
  getGameState: mocks.getGameState,
  updateGameState: mocks.updateGameState,
  notificationService: { addMessage: mocks.notificationAddMessage },
  completePlanting: mocks.completePlanting,
  createWineBatchFromHarvest: mocks.createWineBatchFromHarvest,
  calculateVineyardYield: mocks.calculateVineyardYield,
  completeClearingActivity: mocks.completeClearingActivity,
  getTeamForCategory: mocks.getTeamForCategory,
  handlePartialPlanting: mocks.handlePartialPlanting,
  handlePartialHarvesting: mocks.handlePartialHarvesting
}));

vi.mock('@/lib/services/activity', () => ({
  WorkCategory: {
    PLANTING: 'PLANTING',
    HARVESTING: 'HARVESTING',
    CRUSHING: 'CRUSHING',
    FERMENTATION: 'FERMENTATION',
    CLEARING: 'CLEARING',
    BUILDING: 'BUILDING',
    UPGRADING: 'UPGRADING',
    ADMINISTRATION_AND_RESEARCH: 'ADMINISTRATION_AND_RESEARCH',
    STAFF_SEARCH: 'STAFF_SEARCH',
    STAFF_HIRING: 'STAFF_HIRING',
    LAND_SEARCH: 'LAND_SEARCH',
    LENDER_SEARCH: 'LENDER_SEARCH',
    TAKE_LOAN: 'TAKE_LOAN',
    FINANCE_AND_STAFF: 'FINANCE_AND_STAFF'
  },
  completeCrushing: mocks.completeCrushing,
  completeFermentationSetup: mocks.completeFermentationSetup,
  completeBookkeeping: mocks.completeBookkeeping,
  calculateStaffWorkContribution: mocks.calculateStaffWorkContribution,
  calculateIndividualStaffContribution: mocks.calculateIndividualStaffContribution
}));

vi.mock('@/lib/services/activity/activitymanagers/staffSearchManager', () => ({
  completeStaffSearch: mocks.completeStaffSearch,
  completeHiringProcess: mocks.completeHiringProcess
}));

vi.mock('@/lib/services/activity/activitymanagers/landSearchManager', () => ({
  completeLandSearch: mocks.completeLandSearch
}));

vi.mock('@/lib/database/activities/activityDB', () => ({
  saveActivityToDb: mocks.saveActivityToDb,
  loadActivitiesFromDb: mocks.loadActivitiesFromDb,
  updateActivityInDb: mocks.updateActivityInDb,
  removeActivityFromDb: mocks.removeActivityFromDb,
  hasActiveActivity: mocks.hasActiveActivity
}));

vi.mock('@/lib/database/activities/vineyardDB', () => ({
  loadVineyards: vi.fn(async () => []),
  saveVineyard: vi.fn(async () => true)
}));

vi.mock('@/lib/services/user/staffService', () => ({
  awardExperience: mocks.awardExperience
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdateImmediate: mocks.triggerGameUpdateImmediate
}));

vi.mock('@/lib/features/loanLender', () => ({
  getLoanLenderFeature: () => ({
    workflow: {
      completeLenderSearch: vi.fn(async () => undefined),
      completeTakeLoan: vi.fn(async () => undefined)
    }
  })
}));

vi.mock('@/lib/features/researchUpgrade', () => ({
  getResearchUpgradeFeature: () => ({
    workflow: {
      completeResearch: vi.fn(async () => undefined)
    }
  })
}));

describe('activity lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      activities: [],
      staff: []
    });
    mocks.setActivities([]);
    mocks.uuid.mockReturnValue('activity-1');
    mocks.getTeamForCategory.mockReturnValue({ id: 'team-1', memberIds: ['staff-1'] });
    mocks.hasActiveActivity.mockResolvedValue(false);
  });

  it('creates an active activity, auto-assigns the matching team, and refreshes state', async () => {
    const { createActivity } = await import('@/lib/services/activity/activitymanagers/activityManager');

    const activityId = await createActivity({
      category: WorkCategory.BUILDING,
      title: 'Build Test Shed',
      totalWork: 50,
      targetId: 'building-1',
      params: {},
      skipNotification: true
    });

    expect(activityId).toBe('activity-1');
    expect(mocks.saveActivityToDb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'activity-1',
        category: WorkCategory.BUILDING,
        title: 'Build Test Shed',
        completedWork: 0,
        status: 'active',
        gameWeek: 3,
        gameSeason: 'Summer',
        gameYear: 2026,
        params: { assignedStaffIds: ['staff-1'] }
      })
    );
    expect(mocks.updateGameState).toHaveBeenLastCalledWith({
      activities: [expect.objectContaining({ id: 'activity-1' })]
    });
    expect(mocks.triggerGameUpdateImmediate).toHaveBeenCalledOnce();
    expect(mocks.notificationAddMessage).not.toHaveBeenCalled();
  });

  it('pauses, resumes, cancels, and hides cancelled activities from visible state', async () => {
    const manager = await import('@/lib/services/activity/activitymanagers/activityManager');
    await manager.createActivity({
      category: WorkCategory.BUILDING,
      title: 'Lifecycle Activity',
      totalWork: 20,
      skipNotification: true
    });

    await expect(manager.pauseActivity('activity-1')).resolves.toBe(true);
    expect(mocks.getActivities()[0].status).toBe('paused');

    await expect(manager.resumeActivity('activity-1')).resolves.toBe(true);
    expect(mocks.getActivities()[0].status).toBe('active');

    await expect(manager.cancelActivity('activity-1')).resolves.toBe(true);
    expect(mocks.getActivities()[0].status).toBe('cancelled');
    expect(mocks.updateGameState).toHaveBeenLastCalledWith({ activities: [] });
  });

  it('force-completes an activity through the same removal path used by weekly progress', async () => {
    const manager = await import('@/lib/services/activity/activitymanagers/activityManager');
    await manager.createActivity({
      category: WorkCategory.BUILDING,
      title: 'Complete Now Activity',
      totalWork: 30,
      skipNotification: true
    });

    const result = await manager.completeActivityNow('activity-1');

    expect(result).toMatchObject({
      success: true,
      activity: {
        id: 'activity-1',
        completedWork: 30
      }
    });
    expect(mocks.updateActivityInDb).toHaveBeenCalledWith('activity-1', { completedWork: 30 });
    expect(mocks.removeActivityFromDb).toHaveBeenCalledWith('activity-1');
    expect(mocks.getActivities()).toEqual([]);
    expect(mocks.updateGameState).toHaveBeenLastCalledWith({ activities: [] });
  });
});
