import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let state: any = {};
  const calls: string[] = [];

  return {
    calls,
    setState: (nextState: any) => {
      state = nextState;
    },
    getGameState: vi.fn(() => state),
    updateGameState: vi.fn(async updates => {
      calls.push('updateGameState');
      state = { ...state, ...updates };
    }),
    getCurrentCompany: vi.fn(() => ({
      id: 'company-1',
      name: 'Tick Winery',
      currentWeek: 12,
      currentSeason: 'Winter',
      currentYear: 2026,
      foundedYear: 2024
    })),
    generateSophisticatedWineOrders: vi.fn(async () => undefined),
    notificationAddMessage: vi.fn(async () => undefined),
    progressActivities: vi.fn(async () => {
      calls.push('progressActivities');
    }),
    checkAndTriggerBookkeeping: vi.fn(async () => {
      calls.push('checkAndTriggerBookkeeping');
    }),
    processEconomyPhaseTransition: vi.fn(async () => 'Economy phase changed'),
    submitCompanyHighscores: vi.fn(async () => undefined),
    checkAllAchievements: vi.fn(async () => undefined),
    updateCellarCollectionPrestige: vi.fn(async () => undefined),
    calculateCompanyValue: vi.fn(async () => 250000),
    updateVineyardRipeness: vi.fn(async () => {
      calls.push('updateVineyardRipeness');
    }),
    updateVineyardAges: vi.fn(async () => undefined),
    updateVineyardVineYields: vi.fn(async () => undefined),
    updateVineyardHealthDegradation: vi.fn(async () => undefined),
    getAllStaff: vi.fn(async () => []),
    processWeeklyFeatureRisks: vi.fn(async () => undefined),
    processWeeklyFermentation: vi.fn(async () => undefined),
    processSeasonalWages: vi.fn(async () => 'Seasonal wages paid'),
    processYearlyFounderDistributions: vi.fn(async () => undefined),
    processWeeklyBuyGrapeOfferDecay: vi.fn(async () => undefined),
    refreshBuyGrapeMarketForSeason: vi.fn(async () => undefined),
    generateContracts: vi.fn(async () => undefined),
    generateForwardContracts: vi.fn(async () => undefined),
    expireOldContracts: vi.fn(async () => undefined),
    expireAndDefaultForwardContracts: vi.fn(async () => undefined),
    expireOldOrders: vi.fn(async () => undefined),
    triggerGameUpdate: vi.fn(() => undefined),
    triggerTopicUpdate: vi.fn(() => undefined),
    hasMinimizedModals: vi.fn(() => false),
    restoreAllMinimizedModals: vi.fn(() => undefined),
    calculateAbsoluteWeeks: vi.fn(() => 1000),
    loadWineBatches: vi.fn(async () => []),
    bulkUpdateWineBatches: vi.fn(async () => true),
    applyFeatureEffectsToBatch: vi.fn(batch => batch),
    applyFeatureLayerAnchors: vi.fn((_batch, anchors) => anchors),
    boardWeekAdvanced: vi.fn(async () => undefined),
    boardSeasonStart: vi.fn(async () => undefined),
    boardYearStart: vi.fn(async () => undefined),
    processSeasonalLoanPayments: vi.fn(async () => undefined),
    enforceEmergencyQuickLoanIfNeeded: vi.fn(async () => undefined),
    restructureForcedLoansIfNeeded: vi.fn(async () => undefined)
  };
});

vi.mock('@/lib/services', () => ({
  getGameState: mocks.getGameState,
  updateGameState: mocks.updateGameState,
  getCurrentCompany: mocks.getCurrentCompany,
  generateSophisticatedWineOrders: mocks.generateSophisticatedWineOrders,
  notificationService: { addMessage: mocks.notificationAddMessage },
  progressActivities: mocks.progressActivities,
  checkAndTriggerBookkeeping: mocks.checkAndTriggerBookkeeping,
  processEconomyPhaseTransition: mocks.processEconomyPhaseTransition,
  highscoreService: { submitCompanyHighscores: mocks.submitCompanyHighscores },
  checkAllAchievements: mocks.checkAllAchievements,
  updateCellarCollectionPrestige: mocks.updateCellarCollectionPrestige,
  calculateCompanyValue: mocks.calculateCompanyValue,
  updateVineyardRipeness: mocks.updateVineyardRipeness,
  updateVineyardAges: mocks.updateVineyardAges,
  updateVineyardVineYields: mocks.updateVineyardVineYields,
  updateVineyardHealthDegradation: mocks.updateVineyardHealthDegradation,
  getAllStaff: mocks.getAllStaff,
  processWeeklyFeatureRisks: mocks.processWeeklyFeatureRisks,
  processWeeklyFermentation: mocks.processWeeklyFermentation,
  processSeasonalWages: mocks.processSeasonalWages,
  processYearlyFounderDistributions: mocks.processYearlyFounderDistributions,
  processWeeklyBuyGrapeOfferDecay: mocks.processWeeklyBuyGrapeOfferDecay,
  refreshBuyGrapeMarketForSeason: mocks.refreshBuyGrapeMarketForSeason,
  generateForwardContracts: mocks.generateForwardContracts,
  expireAndDefaultForwardContracts: mocks.expireAndDefaultForwardContracts
}));

vi.mock('@/lib/services/wine/features/featureService', () => ({
  applyFeatureEffectsToBatch: mocks.applyFeatureEffectsToBatch
}));

vi.mock('@/lib/services/wine/anchors/wineAnchorService', () => ({
  resolveWineAnchors: (anchors: any) => anchors,
  WINE_ANCHOR_KEYS: []
}));

vi.mock('@/lib/services/wine/anchors/wineAnchorProcess', () => ({
  applyFeatureLayerAnchors: mocks.applyFeatureLayerAnchors
}));

vi.mock('@/lib/services/sales/contractGenerationService', () => ({
  generateContracts: mocks.generateContracts
}));

vi.mock('@/lib/services/sales/contractService', () => ({
  expireOldContracts: mocks.expireOldContracts
}));

vi.mock('@/lib/services/sales/salesOrderService', () => ({
  expireOldOrders: mocks.expireOldOrders
}));

vi.mock('@/hooks/useGameUpdates', () => ({
  triggerGameUpdate: mocks.triggerGameUpdate,
  triggerTopicUpdate: mocks.triggerTopicUpdate
}));

vi.mock('@/lib/utils', () => ({
  NotificationCategory: {
    TIME_CALENDAR: 'time_calendar'
  },
  calculateAbsoluteWeeks: mocks.calculateAbsoluteWeeks,
  hasMinimizedModals: mocks.hasMinimizedModals,
  restoreAllMinimizedModals: mocks.restoreAllMinimizedModals
}));

vi.mock('@/lib/database/activities/inventoryDB', () => ({
  loadWineBatches: mocks.loadWineBatches,
  bulkUpdateWineBatches: mocks.bulkUpdateWineBatches
}));

vi.mock('@/lib/features/boardShare', () => ({
  getBoardShareFeature: () => ({
    ticks: {
      onWeekAdvanced: mocks.boardWeekAdvanced,
      onSeasonStart: mocks.boardSeasonStart,
      onYearStart: mocks.boardYearStart
    }
  })
}));

vi.mock('@/lib/features/loanLender', () => ({
  getLoanLenderFeature: () => ({
    ticks: {
      processSeasonalLoanPayments: mocks.processSeasonalLoanPayments,
      enforceEmergencyQuickLoanIfNeeded: mocks.enforceEmergencyQuickLoanIfNeeded,
      restructureForcedLoansIfNeeded: mocks.restructureForcedLoansIfNeeded
    }
  })
}));

describe('processGameTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mocks.setState({
      week: 12,
      season: 'Winter',
      currentYear: 2026,
      economyPhase: 'Stable',
      money: 100000,
      staff: [],
      activities: []
    });
    mocks.hasMinimizedModals.mockReturnValue(false);
    mocks.loadWineBatches.mockResolvedValue([]);
  });

  it('restores minimized modals without advancing game time', async () => {
    mocks.hasMinimizedModals.mockReturnValue(true);
    const { processGameTick } = await import('@/lib/services/core/gameTick');

    await processGameTick();

    expect(mocks.restoreAllMinimizedModals).toHaveBeenCalledOnce();
    expect(mocks.updateGameState).not.toHaveBeenCalled();
    expect(mocks.progressActivities).not.toHaveBeenCalled();
    expect(mocks.triggerGameUpdate).not.toHaveBeenCalled();
    expect(mocks.triggerTopicUpdate).not.toHaveBeenCalled();
  });

  it('runs yearly, seasonal, weekly, vineyard, loan, and highscore hooks on a new-year tick', async () => {
    const { processGameTick } = await import('@/lib/services/core/gameTick');

    await processGameTick();

    expect(mocks.updateGameState).toHaveBeenCalledWith(expect.objectContaining({
      week: 1,
      season: 'Spring',
      currentYear: 2027,
      weatherForecastPattern: expect.any(String),
      weatherForecastConfidence: expect.any(String),
      weatherState: expect.any(String),
      weatherIntensity: expect.any(String),
      nextWeekForecastState: expect.any(String),
      nextWeekForecastIntensity: expect.any(String),
    }));
    expect(mocks.updateVineyardAges).toHaveBeenCalledOnce();
    expect(mocks.updateVineyardVineYields).toHaveBeenCalledOnce();
    expect(mocks.boardYearStart).toHaveBeenCalledWith({ week: 1, season: 'Spring', year: 2027 });
    expect(mocks.processEconomyPhaseTransition).toHaveBeenCalledWith(true);
    expect(mocks.processSeasonalWages).toHaveBeenCalledWith([], true);
    expect(mocks.processSeasonalLoanPayments).toHaveBeenCalledOnce();
    expect(mocks.restructureForcedLoansIfNeeded).toHaveBeenCalledOnce();
    expect(mocks.generateSophisticatedWineOrders).toHaveBeenCalledOnce();
    expect(mocks.generateContracts).toHaveBeenCalledOnce();
    expect(mocks.generateForwardContracts).toHaveBeenCalledOnce();
    expect(mocks.expireOldContracts).toHaveBeenCalledOnce();
    expect(mocks.expireAndDefaultForwardContracts).toHaveBeenCalledOnce();
    expect(mocks.expireOldOrders).toHaveBeenCalledOnce();
    expect(mocks.processWeeklyFermentation).toHaveBeenCalledOnce();
    expect(mocks.processWeeklyFeatureRisks).toHaveBeenCalledOnce();
    expect(mocks.updateCellarCollectionPrestige).toHaveBeenCalledOnce();
    expect(mocks.boardWeekAdvanced).toHaveBeenCalledWith({ week: 1, season: 'Spring', year: 2027 });
    expect(mocks.boardSeasonStart).toHaveBeenCalledWith({ week: 1, season: 'Spring', year: 2027 });
    expect(mocks.checkAndTriggerBookkeeping).toHaveBeenCalledWith(
      'Spring',
      'Economy phase changed',
      'Seasonal wages paid'
    );
    expect(mocks.updateVineyardRipeness).toHaveBeenCalledWith('Spring', 1, expect.objectContaining({
      season: 'Spring',
      week: 1,
      weatherState: expect.any(String),
      weatherIntensity: expect.any(String),
    }));
    expect(mocks.updateVineyardHealthDegradation).toHaveBeenCalledWith('Spring', 1, expect.objectContaining({
      season: 'Spring',
      week: 1,
      weatherState: expect.any(String),
      weatherIntensity: expect.any(String),
    }));
    expect(mocks.submitCompanyHighscores).toHaveBeenCalledWith(
      'company-1',
      'Tick Winery',
      12,
      'Winter',
      2026,
      2024,
      250000,
      expect.any(Number)
    );
    expect(mocks.triggerTopicUpdate).toHaveBeenCalledWith('wine_batches');
    expect(mocks.triggerGameUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.calls.indexOf('updateGameState')).toBeLessThan(mocks.calls.indexOf('progressActivities'));
    expect(mocks.calls.indexOf('progressActivities')).toBeLessThan(mocks.calls.indexOf('checkAndTriggerBookkeeping'));
    expect(mocks.calls.indexOf('checkAndTriggerBookkeeping')).toBeLessThan(mocks.calls.indexOf('updateVineyardRipeness'));
  });

  it('defers bottled aging persistence until feature-risk processing completes', async () => {
    let resolveFeatureRisks: (() => void) | null = null;
    mocks.processWeeklyFeatureRisks.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveFeatureRisks = () => resolve(undefined);
        })
    );

    const { processGameTick } = await import('@/lib/services/core/gameTick');
    const tickPromise = processGameTick();

    // Wait until the feature-risk task is actually queued.
    for (let i = 0; i < 20 && !resolveFeatureRisks; i += 1) {
      await Promise.resolve();
    }
    expect(resolveFeatureRisks).toBeTypeOf('function');

    // If bottled aging runs in parallel, inventory loads happen before feature risks finish.
    expect(mocks.loadWineBatches).not.toHaveBeenCalled();

    resolveFeatureRisks!();
    await tickPromise;

    expect(mocks.loadWineBatches).toHaveBeenCalled();
    expect(mocks.processWeeklyFeatureRisks).toHaveBeenCalledOnce();
  });
});
