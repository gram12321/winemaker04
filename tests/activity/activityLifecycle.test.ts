import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkCategory, type Activity, type Vineyard } from '@/lib/types/types';

const mocks = vi.hoisted(() => {
  let state: any = {};
  let activities: Activity[] = [];
  let vineyards: Vineyard[] = [];
  const uuid = vi.fn(() => 'activity-1');

  return {
    uuid,
    setState: (nextState: any) => {
      state = nextState;
    },
    getActivities: () => activities,
    getVineyards: () => vineyards,
    setActivities: (nextActivities: Activity[]) => {
      activities = nextActivities;
    },
    setVineyards: (nextVineyards: Vineyard[]) => {
      vineyards = nextVineyards;
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
    getAltitudeRating: vi.fn(() => 0),
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
  getAltitudeRating: mocks.getAltitudeRating,
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
  loadVineyards: vi.fn(async () => mocks.getVineyards()),
  saveVineyard: vi.fn(async () => true)
}));

vi.mock('@/lib/services/core/gameState', () => ({
  getGameState: mocks.getGameState
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

vi.mock('@/lib/features/researchUpgrade/services/research/researchPermanentEffectsService', () => ({
  getResearchPermanentEffects: vi.fn(async () => ({
    allStaffWorkMultiplier: 1,
    researchSkillMultiplier: 1
  }))
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
    mocks.setVineyards([]);
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

  it('rejects planting against the current Winter state before saving the activity and returns the weather reason', async () => {
    mocks.setState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      activities: [],
      staff: []
    });
    mocks.setState({
      week: 3,
      season: 'Winter',
      currentYear: 2026,
      activities: [],
      staff: []
    });
    mocks.setVineyards([vineyard({ grape: null, status: 'Barren', ripeness: 0 })]);
    const { createActivity, createActivityWithResult } = await import('@/lib/services/activity/activitymanagers/activityManager');

    const result = await createActivityWithResult({
      category: WorkCategory.PLANTING,
      title: 'Plant Lifecycle Vineyard',
      totalWork: 50,
      targetId: 'vineyard-1',
      params: { density: 5000 },
      skipNotification: true
    });

    expect(result).toEqual({
      activityId: null,
      reason: 'Planting is unavailable in Winter.'
    });
    expect(mocks.saveActivityToDb).not.toHaveBeenCalled();

    await expect(createActivity({
      category: WorkCategory.PLANTING,
      title: 'Plant Lifecycle Vineyard',
      totalWork: 50,
      targetId: 'vineyard-1',
      params: { density: 5000 },
      skipNotification: true
    })).resolves.toBeNull();
  });

  it('allows weather-permitted planting and harvesting activity creation', async () => {
    mocks.setVineyards([vineyard({ grape: null, status: 'Barren', ripeness: 0 })]);
    const { createActivity } = await import('@/lib/services/activity/activitymanagers/activityManager');

    const plantingId = await createActivity({
      category: WorkCategory.PLANTING,
      title: 'Plant Lifecycle Vineyard',
      totalWork: 50,
      targetId: 'vineyard-1',
      params: { density: 5000 },
      skipNotification: true
    });

    mocks.setVineyards([vineyard({ grape: 'Pinot Noir', status: 'Growing', ripeness: 0.85 })]);
    mocks.uuid.mockReturnValue('activity-2');
    const harvestingId = await createActivity({
      category: WorkCategory.HARVESTING,
      title: 'Harvest Lifecycle Vineyard',
      totalWork: 50,
      targetId: 'vineyard-1',
      params: { grape: 'Pinot Noir' },
      skipNotification: true
    });

    expect(plantingId).toBe('activity-1');
    expect(harvestingId).toBe('activity-2');
    expect(mocks.saveActivityToDb).toHaveBeenCalledTimes(2);
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

  it('applies current weather only to planting and harvesting work as conditions change', async () => {
    mocks.setState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      weatherState: 'Heat',
      weatherIntensity: 'Severe',
      activities: [],
      staff: [{ id: 'staff-1' }]
    });
    mocks.setActivities([
      activeActivity({ id: 'planting-1', category: WorkCategory.PLANTING }),
      activeActivity({ id: 'clearing-1', category: WorkCategory.CLEARING })
    ]);
    mocks.calculateStaffWorkContribution.mockReturnValue(10);
    mocks.calculateIndividualStaffContribution.mockReturnValue(10);
    const { progressActivities } = await import('@/lib/services/activity/activitymanagers/activityManager');

    await progressActivities();

    expect(mocks.getActivities()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'planting-1', totalWork: 100, completedWork: 6 }),
      expect.objectContaining({ id: 'clearing-1', totalWork: 100, completedWork: 10 })
    ]));
    expect(mocks.awardExperience).toHaveBeenCalledWith('staff-1', 6, expect.any(Array));
    expect(mocks.awardExperience).toHaveBeenCalledWith('staff-1', 10, expect.any(Array));

    mocks.setState({
      ...mocks.getGameState(),
      weatherState: 'Storm',
      weatherIntensity: 'Extreme'
    });
    mocks.awardExperience.mockClear();
    await progressActivities();

    expect(mocks.getActivities()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'planting-1', completedWork: 6 }),
      expect.objectContaining({ id: 'clearing-1', completedWork: 20 })
    ]));
    expect(mocks.awardExperience).toHaveBeenCalledTimes(1);
    expect(mocks.awardExperience).toHaveBeenCalledWith('staff-1', 10, expect.any(Array));

    mocks.setState({
      ...mocks.getGameState(),
      weatherState: 'Clear',
      weatherIntensity: 'Mild'
    });
    await progressActivities();

    expect(mocks.getActivities()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'planting-1', completedWork: 16 }),
      expect.objectContaining({ id: 'clearing-1', completedWork: 30 })
    ]));
  });

  it('keeps weekly completion removal intact after weather-adjusted harvesting work', async () => {
    mocks.setState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      weatherState: 'Heat',
      weatherIntensity: 'Severe',
      activities: [],
      staff: [{ id: 'staff-1' }]
    });
    mocks.setActivities([
      activeActivity({ id: 'harvesting-1', category: WorkCategory.HARVESTING, totalWork: 6 })
    ]);
    mocks.calculateStaffWorkContribution.mockReturnValue(10);
    mocks.calculateIndividualStaffContribution.mockReturnValue(10);
    const { progressActivities } = await import('@/lib/services/activity/activitymanagers/activityManager');

    await progressActivities();

    expect(mocks.updateActivityInDb).toHaveBeenCalledWith('harvesting-1', { completedWork: 6 });
    expect(mocks.removeActivityFromDb).toHaveBeenCalledWith('harvesting-1');
    expect(mocks.getActivities()).toEqual([]);
  });

  it('keeps calculated planting and harvesting total work weather-neutral', async () => {
    mocks.setState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      weatherState: 'Clear',
      weatherIntensity: 'Mild'
    });
    mocks.calculateVineyardYield.mockReturnValue(1000);
    const { calculatePlantingWork } = await import('@/lib/services/activity/workcalculators/plantingWorkCalculator');
    const { calculateHarvestWork } = await import('@/lib/services/activity/workcalculators/harvestingWorkCalculator');
    const targetVineyard = vineyard();

    // `calculatePlantingWork` imports this exact core-game-state module directly.
    mocks.getGameState.mockClear();
    const clearPlantingWork = calculatePlantingWork(targetVineyard, { grape: 'Pinot Noir', density: 5000 }).totalWork;
    const clearHarvestingWork = calculateHarvestWork(targetVineyard).totalWork;
    expect(mocks.getGameState).toHaveBeenCalledOnce();

    mocks.setState({
      week: 3,
      season: 'Summer',
      currentYear: 2026,
      weatherState: 'Storm',
      weatherIntensity: 'Extreme'
    });

    expect(calculatePlantingWork(targetVineyard, { grape: 'Pinot Noir', density: 5000 }).totalWork).toBe(clearPlantingWork);
    expect(calculateHarvestWork(targetVineyard).totalWork).toBe(clearHarvestingWork);
    expect(mocks.getGameState).toHaveBeenCalledTimes(2);
  });
});

function activeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'active-activity',
    category: WorkCategory.PLANTING,
    title: 'Active field work',
    totalWork: 100,
    completedWork: 0,
    params: { assignedStaffIds: ['staff-1'] },
    status: 'active',
    gameWeek: 3,
    gameSeason: 'Summer',
    gameYear: 2026,
    isCancellable: true,
    createdAt: new Date('2026-07-12T00:00:00.000Z'),
    ...overrides
  };
}

function vineyard(overrides: Partial<Vineyard> = {}): Vineyard {
  return {
    id: 'vineyard-1',
    name: 'Lifecycle Vineyard',
    country: 'France',
    region: 'Bourgogne',
    hectares: 1,
    grape: 'Pinot Noir',
    vineAge: 12,
    soil: ['Clay'],
    altitude: 300,
    aspect: 'Southeast',
    density: 5000,
    vineyardHealth: 0.9,
    landValue: 250000,
    vineyardTotalValue: 250000,
    status: 'Growing',
    ripeness: 0.85,
    vineyardPrestige: 1,
    vineYield: 1,
    overgrowth: { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
    pendingFeatures: [],
    ...overrides
  };
}
