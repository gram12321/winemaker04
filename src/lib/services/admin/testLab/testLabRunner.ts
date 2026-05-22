import { getTestLabScenario } from './testLabScenarios';
import type { TestLabParamField, TestLabRunRequest, TestLabScenarioResult, TestLabScenarioStatus } from './types';
import { createTestLabRunId } from './runId';
import { cleanupTestLabRun } from './testLabCleanupService';
import type { Season } from '@/lib/types/types';
import {
  createBottledWine,
  createFermentingBatch,
  createGrapeBatch,
  createHarvestReadyVineyard,
  createMustReadyBatch,
  createTestLabCompany,
  type TestLabBatchResult,
  type TestLabVineyardResult
} from './testLabFixtureService';

interface NormalizedParams {
  params: Record<string, string | number | boolean>;
  warnings: string[];
}

const normalizeFieldValue = (
  field: TestLabParamField,
  value: string | number | boolean | undefined
): string | number | boolean => {
  const candidate = value ?? field.defaultValue;

  if (field.type === 'number') {
    const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
    if (!Number.isFinite(numeric)) {
      throw new Error(`${field.label} must be a number`);
    }
    if (field.min !== undefined && numeric < field.min) {
      throw new Error(`${field.label} must be at least ${field.min}`);
    }
    if (field.max !== undefined && numeric > field.max) {
      throw new Error(`${field.label} must be at most ${field.max}`);
    }
    return numeric;
  }

  if (field.type === 'boolean') {
    if (typeof candidate === 'boolean') return candidate;
    if (candidate === 'true') return true;
    if (candidate === 'false') return false;
    return Boolean(candidate);
  }

  if (field.type === 'select') {
    const stringValue = String(candidate);
    const allowedValues = field.options?.map(option => String(option.value)) || [];
    if (allowedValues.length > 0 && !allowedValues.includes(stringValue)) {
      throw new Error(`${field.label} must be one of: ${allowedValues.join(', ')}`);
    }
    return stringValue;
  }

  return String(candidate);
};

export function normalizeTestLabParams(
  fields: TestLabParamField[],
  suppliedParams: Record<string, string | number | boolean>
): NormalizedParams {
  const params: Record<string, string | number | boolean> = {};
  const warnings: string[] = [];

  for (const field of fields) {
    params[field.key] = normalizeFieldValue(field, suppliedParams[field.key]);
  }

  for (const key of Object.keys(suppliedParams)) {
    if (!fields.some(field => field.key === key)) {
      warnings.push(`Ignored unknown parameter: ${key}`);
    }
  }

  return { params, warnings };
}

const resultStatusFromAssertions = (
  assertions: Array<{ passed: boolean }>,
  fallback: TestLabScenarioStatus = 'passed'
): TestLabScenarioStatus => assertions.some(assertion => !assertion.passed) ? 'failed' : fallback;

async function runRegressionScenario(
  runId: string,
  scenarioId: string,
  params: Record<string, string | number | boolean>,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const target = typeof params.target === 'string' && params.target.trim() ? params.target.trim() : undefined;
  const response = await fetch('/api/test-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target ? { target } : {})
  });
  const data = await response.json();

  return {
    runId,
    scenarioId,
    status: response.ok && data.status === 'passed' ? 'passed' : 'failed',
    summary: response.ok
      ? `${data.passed || 0} passed, ${data.failed || 0} failed, ${data.skipped || 0} skipped`
      : data.message || 'Regression runner request failed',
    assertions: [
      {
        name: 'Vitest runner completed',
        passed: response.ok,
        details: response.ok ? `Exit code ${data.exitCode ?? 0}` : data.message
      },
      {
        name: 'No failing tests',
        passed: (data.failed || 0) === 0,
        details: `${data.failed || 0} failing tests`
      }
    ],
    createdEntities: [],
    warnings,
    data
  };
}

export async function runTestLabScenario(request: TestLabRunRequest): Promise<TestLabScenarioResult> {
  const scenario = getTestLabScenario(request.scenarioId);
  const runId = request.scenarioId === 'cleanup.by-run-id'
    ? String(request.params.runId || '')
    : createTestLabRunId();

  if (!scenario) {
    return {
      runId,
      scenarioId: request.scenarioId,
      status: 'blocked',
      summary: `Unknown scenario: ${request.scenarioId}`,
      assertions: [],
      createdEntities: [],
      warnings: []
    };
  }

  try {
    const { params, warnings } = normalizeTestLabParams(scenario.params, request.params);

    if (request.mode === 'dryRun') {
      return {
        runId,
        scenarioId: scenario.id,
        status: 'passed',
        summary: `Dry run passed for ${scenario.title}`,
        assertions: [
          { name: 'Scenario exists', passed: true },
          { name: 'Parameters are valid', passed: true }
        ],
        createdEntities: [],
        warnings,
        data: { params }
      };
    }

    if (scenario.id === 'regression.full-suite') {
      return await runRegressionScenario(runId, scenario.id, params, warnings);
    }

    if (scenario.id === 'cleanup.by-run-id') {
      const targetRunId = String(params.runId || '').trim();
      if (!targetRunId) {
        return {
          runId,
          scenarioId: scenario.id,
          status: 'blocked',
          summary: 'Cleanup requires a run id',
          assertions: [{ name: 'Run id provided', passed: false }],
          createdEntities: [],
          warnings
        };
      }

      const cleanup = await cleanupTestLabRun(targetRunId);
      return {
        runId: targetRunId,
        scenarioId: scenario.id,
        status: cleanup.status,
        summary: `Cleanup completed for ${targetRunId}`,
        assertions: [{ name: 'Cleanup executed', passed: cleanup.status === 'passed' }],
        createdEntities: [],
        warnings: [...warnings, ...cleanup.warnings],
        cleanup,
        data: cleanup
      };
    }

    if (scenario.id === 'company.create-isolated') {
      const company = await createTestLabCompany(runId, params);
      return {
        runId,
        scenarioId: scenario.id,
        status: 'passed',
        summary: `Created isolated test company ${company.name}`,
        assertions: [{ name: 'Company created', passed: Boolean(company.id), details: company.id }],
        createdEntities: [{ type: 'company', id: company.id, label: company.name }],
        warnings,
        after: company,
        data: { company }
      };
    }

    let fixtureResult: TestLabVineyardResult | TestLabBatchResult | null = null;
    switch (scenario.id) {
      case 'vineyard.harvest-ready': {
        const { adminSetGameDate } = await import('@/lib/services/admin/adminService');
        await adminSetGameDate({
          week: Number(params.week),
          season: params.season as Season,
          year: Number(params.year)
        });
        fixtureResult = await createHarvestReadyVineyard(runId, params);
        break;
      }
      case 'winery.grapes-batch':
        fixtureResult = await createGrapeBatch(runId, params);
        break;
      case 'winery.must-ready-batch':
        fixtureResult = await createMustReadyBatch(runId, params);
        break;
      case 'winery.fermenting-batch':
        fixtureResult = await createFermentingBatch(runId, params);
        break;
      case 'winery.bottled-wine':
        fixtureResult = await createBottledWine(runId, params);
        break;
      default:
        fixtureResult = null;
        break;
    }

    if (!fixtureResult) {
      return {
        runId,
        scenarioId: scenario.id,
        status: 'blocked',
        summary: `Scenario has no runner yet: ${scenario.title}`,
        assertions: [],
        createdEntities: [],
        warnings
      };
    }

    const maybeBatch = 'batch' in fixtureResult ? fixtureResult.batch : undefined;
    const maybeWineLog = 'wineLogEntry' in fixtureResult ? fixtureResult.wineLogEntry : undefined;
    const assertions = [
      { name: 'Company active', passed: Boolean(fixtureResult.company.id), details: fixtureResult.company.id },
      { name: 'Vineyard created', passed: Boolean(fixtureResult.vineyard.id), details: fixtureResult.vineyard.id },
      ...(maybeBatch ? [{ name: `Batch is ${maybeBatch.state}`, passed: Boolean(maybeBatch.id), details: maybeBatch.id }] : []),
      ...(scenario.id === 'winery.bottled-wine'
        ? [{ name: 'Wine log entry recorded', passed: Boolean(maybeWineLog?.id), details: maybeWineLog?.id || 'No wine log entry found' }]
        : [])
    ];

    return {
      runId,
      scenarioId: scenario.id,
      status: resultStatusFromAssertions(assertions),
      summary: maybeBatch
        ? `Created ${maybeBatch.state} ${maybeBatch.grape} batch from ${fixtureResult.vineyard.name}`
        : `Created harvest-ready vineyard ${fixtureResult.vineyard.name}`,
      assertions,
      createdEntities: [
        { type: 'company', id: fixtureResult.company.id, label: fixtureResult.company.name },
        { type: 'vineyard', id: fixtureResult.vineyard.id, label: fixtureResult.vineyard.name },
        ...(maybeBatch ? [{ type: 'wineBatch' as const, id: maybeBatch.id, label: `${maybeBatch.grape} ${maybeBatch.state}` }] : []),
        ...(maybeWineLog ? [{ type: 'wineLog' as const, id: maybeWineLog.id, label: `${maybeWineLog.grape} ${maybeWineLog.vintage}` }] : [])
      ],
      warnings,
      after: fixtureResult,
      data: fixtureResult
    };
  } catch (error) {
    return {
      runId,
      scenarioId: scenario.id,
      status: 'failed',
      summary: error instanceof Error ? error.message : 'Scenario failed',
      assertions: [],
      createdEntities: [],
      warnings: [],
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    };
  }
}
