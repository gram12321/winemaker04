import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_LAB_SCENARIOS, getTestLabScenario, getTestLabScenarios } from '@/lib/services/admin/testLab/testLabScenarios';
import { isDevAdminSurfaceAvailable, isLoopbackHostname as isBrowserLoopbackHostname } from '@/lib/services/admin/testLab/devAdminGate';
import {
  getHostnameFromHostHeader,
  isLoopbackHostname as isServerLoopbackHostname,
  isLoopbackRequest
} from '../../server/devAdminGate';

const runnerMocks = vi.hoisted(() => ({
  createTestLabRunId: vi.fn(() => 'testlab_run_1'),
  cleanupTestLabRun: vi.fn(async () => ({
    runId: 'testlab_run_1',
    status: 'passed',
    deletedByEntity: {},
    warnings: []
  })),
  createTestLabCompany: vi.fn(),
  createHarvestReadyVineyard: vi.fn(),
  createGrapeBatch: vi.fn(),
  createMustReadyBatch: vi.fn(),
  createFermentingBatch: vi.fn(),
  createBottledWine: vi.fn(),
  adminGenerateTestOrders: vi.fn(async () => ({ totalOrdersCreated: 2, customersGenerated: 0 })),
  adminGenerateTestContract: vi.fn(async () => ({ success: true, message: 'Contract generated' })),
  adminGenerateTestBottlePresaleContract: vi.fn(async () => ({ success: true, message: 'Bottle pre-sale generated' })),
  adminGenerateTestForwardPresaleContract: vi.fn(async () => ({ success: true, message: 'Forward pre-sale generated' })),
  adminSetGoldToCompany: vi.fn(async () => undefined),
  adminSetPlayerBalance: vi.fn(async () => ({ success: true, message: 'Player balance set' })),
  adminAddPrestigeToCompany: vi.fn(async () => undefined),
  adminSetGameDate: vi.fn(async () => undefined),
  adminGrantAllResearch: vi.fn(async () => ({ success: true, unlocked: 3, alreadyUnlocked: 1 })),
  adminRemoveAllResearch: vi.fn(async () => ({ success: true, removed: 4 })),
  adminSetStaffXP: vi.fn(async () => ({ success: true, message: 'Set staff XP' })),
  getAllActivities: vi.fn(async () => ([
    {
      id: 'activity-1',
      title: 'Harvest North Block',
      category: 'harvesting',
      totalWork: 120,
      completedWork: 40,
      status: 'active',
      params: {}
    }
  ])),
  completeActivityNow: vi.fn(async (activityId: string) => ({
    success: true,
    activity: {
      id: activityId,
      title: 'Harvest North Block',
      category: 'harvesting',
      totalWork: 120,
      completedWork: 120,
      status: 'active',
      params: {}
    }
  }))
}));

vi.mock('@/lib/services/admin/testLab/runId', () => ({
  createTestLabRunId: runnerMocks.createTestLabRunId,
  withTestLabPrefix: (runId: string, value: string) => `[${runId}] ${value}`,
  formatTestLabPrefix: (runId: string) => `testlab_${runId}`
}));

vi.mock('@/lib/services/admin/testLab/testLabCleanupService', () => ({
  cleanupTestLabRun: runnerMocks.cleanupTestLabRun
}));

vi.mock('@/lib/services/admin/testLab/testLabFixtureService', () => ({
  createTestLabCompany: runnerMocks.createTestLabCompany,
  createHarvestReadyVineyard: runnerMocks.createHarvestReadyVineyard,
  createGrapeBatch: runnerMocks.createGrapeBatch,
  createMustReadyBatch: runnerMocks.createMustReadyBatch,
  createFermentingBatch: runnerMocks.createFermentingBatch,
  createBottledWine: runnerMocks.createBottledWine
}));

vi.mock('@/lib/services/admin/adminService', () => ({
  adminGenerateTestOrders: runnerMocks.adminGenerateTestOrders,
  adminGenerateTestContract: runnerMocks.adminGenerateTestContract,
  adminGenerateTestBottlePresaleContract: runnerMocks.adminGenerateTestBottlePresaleContract,
  adminGenerateTestForwardPresaleContract: runnerMocks.adminGenerateTestForwardPresaleContract,
  adminSetGoldToCompany: runnerMocks.adminSetGoldToCompany,
  adminSetPlayerBalance: runnerMocks.adminSetPlayerBalance,
  adminAddPrestigeToCompany: runnerMocks.adminAddPrestigeToCompany,
  adminSetGameDate: runnerMocks.adminSetGameDate,
  adminGrantAllResearch: runnerMocks.adminGrantAllResearch,
  adminRemoveAllResearch: runnerMocks.adminRemoveAllResearch,
  adminSetStaffXP: runnerMocks.adminSetStaffXP
}));

vi.mock('@/lib/services/activity/activitymanagers/activityManager', () => ({
  getAllActivities: runnerMocks.getAllActivities,
  completeActivityNow: runnerMocks.completeActivityNow
}));

describe('Admin Test Lab behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps scenario ids unique and default params valid for every registered scenario', async () => {
    const { normalizeTestLabParams } = await import('@/lib/services/admin/testLab/testLabRunner');
    const ids = TEST_LAB_SCENARIOS.map(scenario => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const scenario of getTestLabScenarios()) {
      const normalized = normalizeTestLabParams(scenario.params, scenario.defaultParams);
      expect(normalized.warnings).toEqual([]);
      expect(Object.keys(normalized.params).sort()).toEqual(
        scenario.params.map(field => field.key).sort()
      );
    }
  });

  it('normalizes number, boolean, select, and unknown parameters before running a dry run', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const result = await runTestLabScenario({
      scenarioId: 'winery.must-ready-batch',
      mode: 'dryRun',
      params: {
        vineyardId: 'new',
        country: 'France',
        region: 'Bourgogne',
        grape: 'Pinot Noir',
        hectares: '1.5',
        density: '5200',
        vineAge: '11',
        vineyardHealth: '0.88',
        ripeness: '0.93',
        landValue: '300000',
        altitude: '310',
        aspect: 'Southeast',
        soil: 'Clay,Limestone',
        week: '2',
        season: 'Fall',
        year: '2026',
        quantityKg: '1500',
        crushingMethod: 'Mechanical Press',
        destemming: 'true',
        coldSoak: 'false',
        pressingIntensity: '0.55',
        ignoredParam: 'ignored'
      }
    });

    expect(result).toMatchObject({
      runId: 'testlab_run_1',
      scenarioId: 'winery.must-ready-batch',
      status: 'passed',
      summary: 'Dry run passed for Create Must-Ready Batch',
      createdEntities: []
    });
    expect(result.warnings).toEqual(['Ignored unknown parameter: ignoredParam']);
    expect(result.data).toEqual({
      params: expect.objectContaining({
        hectares: 1.5,
        density: 5200,
        destemming: true,
        coldSoak: false,
        pressingIntensity: 0.55
      })
    });
    expect(runnerMocks.createMustReadyBatch).not.toHaveBeenCalled();
  });

  it('blocks cleanup without a run id before mutating persisted data', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const result = await runTestLabScenario({
      scenarioId: 'cleanup.by-run-id',
      mode: 'run',
      params: { runId: '' }
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toBe('Cleanup requires a run id');
    expect(runnerMocks.cleanupTestLabRun).not.toHaveBeenCalled();
  });

  it('finds scenarios by id for UI routing', () => {
    expect(getTestLabScenario('winery.bottled-wine')).toEqual(expect.objectContaining({
      title: 'Create Bottled Wine',
      mutatesData: true
    }));
    expect(getTestLabScenario('missing.scenario')).toBeUndefined();
  });

  it('registers active-company scenario families beyond vineyard and winery setup', () => {
    expect(getTestLabScenario('sales.generate-orders')).toEqual(expect.objectContaining({
      group: 'Sales Flow',
      mutatesData: true
    }));
    expect(getTestLabScenario('sales.generate-contract')).toEqual(expect.objectContaining({
      group: 'Sales Flow',
      mutatesData: true
    }));
    expect(getTestLabScenario('sales.generate-bottle-presale-contract')).toEqual(expect.objectContaining({
      group: 'Sales Flow',
      mutatesData: true
    }));
    expect(getTestLabScenario('sales.generate-grape-forward-contract')).toEqual(expect.objectContaining({
      group: 'Sales Flow',
      mutatesData: true
    }));
    expect(getTestLabScenario('finance.set-company-money')).toEqual(expect.objectContaining({
      group: 'Finance Flow',
      mutatesData: true
    }));
    expect(getTestLabScenario('research.grant-all')).toEqual(expect.objectContaining({
      group: 'Research and Staff',
      mutatesData: true
    }));
    expect(getTestLabScenario('activity.complete-now')).toEqual(expect.objectContaining({
      group: 'Activity Lifecycle',
      mutatesData: true
    }));
    expect(getTestLabScenario('staff.set-xp')).toEqual(expect.objectContaining({
      group: 'Research and Staff',
      mutatesData: true
    }));
    expect(getTestLabScenario('winery.bottled-wine')?.params.some(field => field.key === 'featurePreset')).toBe(true);
    expect(getTestLabScenario('winery.bottled-wine')?.params.some(field => field.key === 'terroirExpressionOverride')).toBe(true);
  });

  it('runs sales shortcut scenarios through the active company admin services', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const orderResult = await runTestLabScenario({
      scenarioId: 'sales.generate-orders',
      mode: 'run',
      params: {}
    });
    const contractResult = await runTestLabScenario({
      scenarioId: 'sales.generate-contract',
      mode: 'run',
      params: {}
    });
    const bottlePresaleResult = await runTestLabScenario({
      scenarioId: 'sales.generate-bottle-presale-contract',
      mode: 'run',
      params: {}
    });
    const forwardPresaleResult = await runTestLabScenario({
      scenarioId: 'sales.generate-grape-forward-contract',
      mode: 'run',
      params: {}
    });

    expect(orderResult).toMatchObject({
      status: 'passed',
      summary: 'Generated 2 test order(s) for the active company'
    });
    expect(contractResult).toMatchObject({
      status: 'passed',
      summary: 'Contract generated'
    });
    expect(bottlePresaleResult).toMatchObject({
      status: 'passed',
      summary: 'Bottle pre-sale generated'
    });
    expect(forwardPresaleResult).toMatchObject({
      status: 'passed',
      summary: 'Forward pre-sale generated'
    });
    expect(runnerMocks.adminGenerateTestOrders).toHaveBeenCalledOnce();
    expect(runnerMocks.adminGenerateTestContract).toHaveBeenCalledOnce();
    expect(runnerMocks.adminGenerateTestBottlePresaleContract).toHaveBeenCalledOnce();
    expect(runnerMocks.adminGenerateTestForwardPresaleContract).toHaveBeenCalledOnce();
  });

  it('runs finance and research scenarios through active-company admin services', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    await runTestLabScenario({
      scenarioId: 'finance.set-company-money',
      mode: 'run',
      params: { amount: '25000' }
    });
    await runTestLabScenario({
      scenarioId: 'finance.add-prestige',
      mode: 'run',
      params: { amount: '125' }
    });
    const grantResult = await runTestLabScenario({
      scenarioId: 'research.grant-all',
      mode: 'run',
      params: {}
    });

    expect(runnerMocks.adminSetGoldToCompany).toHaveBeenCalledWith(25000);
    expect(runnerMocks.adminAddPrestigeToCompany).toHaveBeenCalledWith(125);
    expect(grantResult.summary).toBe('Research granted: 3 unlocked, 1 already unlocked');
    expect(runnerMocks.adminGrantAllResearch).toHaveBeenCalledOnce();
  });

  it('blocks staff XP scenarios without a selected staff member', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const result = await runTestLabScenario({
      scenarioId: 'staff.set-xp',
      mode: 'run',
      params: { staffId: '', xpCategory: 'skill:field', xpAmount: 500 }
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toBe('Staff XP scenario requires a staff member');
    expect(runnerMocks.adminSetStaffXP).not.toHaveBeenCalled();
  });

  it('sets staff XP through the active company admin service', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const result = await runTestLabScenario({
      scenarioId: 'staff.set-xp',
      mode: 'run',
      params: { staffId: 'staff_1', xpCategory: 'skill:winery', xpAmount: '750' }
    });

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Set staff XP');
    expect(runnerMocks.adminSetStaffXP).toHaveBeenCalledWith('staff_1', 'skill:winery', 750);
  });

  it('completes an existing activity immediately through the shared activity manager', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const result = await runTestLabScenario({
      scenarioId: 'activity.complete-now',
      mode: 'run',
      params: { activityId: 'activity-1' }
    });

    expect(result.status).toBe('passed');
    expect(result.summary).toBe('Completed activity Harvest North Block');
    expect(runnerMocks.completeActivityNow).toHaveBeenCalledWith('activity-1');
    expect(result.createdEntities).toEqual([
      { type: 'activity', id: 'activity-1', label: 'Harvest North Block' }
    ]);
  });

  it('blocks instant completion when no activity is selected', async () => {
    const { runTestLabScenario } = await import('@/lib/services/admin/testLab/testLabRunner');

    const result = await runTestLabScenario({
      scenarioId: 'activity.complete-now',
      mode: 'run',
      params: { activityId: 'none' }
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toBe('Activity completion requires an activity');
    expect(runnerMocks.completeActivityNow).not.toHaveBeenCalled();
  });
});

describe('dev admin loopback gates', () => {
  it('allows browser admin surfaces only in dev mode on loopback hostnames', () => {
    expect(isBrowserLoopbackHostname('localhost')).toBe(true);
    expect(isBrowserLoopbackHostname('[::1]')).toBe(true);
    expect(isBrowserLoopbackHostname('example.com')).toBe(false);

    expect(isDevAdminSurfaceAvailable({ hostname: 'localhost' } as Location, true)).toBe(true);
    expect(isDevAdminSurfaceAvailable({ hostname: 'localhost' } as Location, false)).toBe(false);
    expect(isDevAdminSurfaceAvailable({ hostname: '192.168.1.10' } as Location, true)).toBe(false);
  });

  it('parses server host headers and accepts only loopback requests', () => {
    expect(getHostnameFromHostHeader('localhost:3000')).toBe('localhost');
    expect(getHostnameFromHostHeader('[::1]:3000')).toBe('::1');
    expect(isServerLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isServerLoopbackHostname('dev.example.com')).toBe(false);

    expect(isLoopbackRequest({ headers: { host: '127.0.0.1:3000' } } as any)).toBe(true);
    expect(isLoopbackRequest({ headers: { host: '10.0.0.5:3000' } } as any)).toBe(false);
  });
});
