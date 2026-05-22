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
  createBottledWine: vi.fn()
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
