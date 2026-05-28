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

async function runSalesOrdersScenario(
  runId: string,
  scenarioId: string,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const { adminGenerateTestOrders } = await import('@/lib/services/admin/adminService');
  const data = await adminGenerateTestOrders();
  const createdOrders = data.totalOrdersCreated || 0;
  const status: TestLabScenarioStatus = createdOrders > 0 ? 'passed' : 'blocked';

  return {
    runId,
    scenarioId,
    status,
    summary: createdOrders > 0
      ? `Generated ${createdOrders} test order(s) for the active company`
      : 'No test orders generated. Create bottled wine with available quantity first.',
    assertions: [
      { name: 'Order generator completed', passed: true },
      { name: 'Orders created', passed: createdOrders > 0, details: String(createdOrders) }
    ],
    createdEntities: [],
    warnings,
    data
  };
}

async function runSalesContractScenario(
  runId: string,
  scenarioId: string,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const {
    adminGenerateTestContract,
    adminGenerateTestBottlePresaleContract,
    adminGenerateTestForwardPresaleContract
  } = await import('@/lib/services/admin/adminService');

  const data = scenarioId === 'sales.generate-bottle-presale-contract'
    ? await adminGenerateTestBottlePresaleContract()
    : scenarioId === 'sales.generate-grape-forward-contract'
      ? await adminGenerateTestForwardPresaleContract()
      : await adminGenerateTestContract();

  return {
    runId,
    scenarioId,
    status: data.success ? 'passed' : 'blocked',
    summary: data.message,
    assertions: [{ name: 'Contract generated', passed: data.success }],
    createdEntities: [],
    warnings,
    data
  };
}

async function runFinanceScenario(
  runId: string,
  scenarioId: string,
  params: Record<string, string | number | boolean>,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const amount = Number(params.amount ?? 0);
  const {
    adminAddPrestigeToCompany,
    adminSetGoldToCompany,
    adminSetPlayerBalance
  } = await import('@/lib/services/admin/adminService');

  if (scenarioId === 'finance.set-company-money') {
    await adminSetGoldToCompany(amount);
    return {
      runId,
      scenarioId,
      status: 'passed',
      summary: `Company money set to ${amount}`,
      assertions: [{ name: 'Company money updated', passed: true, details: String(amount) }],
      createdEntities: [],
      warnings,
      data: { amount }
    };
  }

  if (scenarioId === 'finance.set-player-balance') {
    const { authService } = await import('@/lib/services/user/authService');
    const currentUser = authService.getCurrentUser();

    if (!currentUser) {
      return {
        runId,
        scenarioId,
        status: 'blocked',
        summary: 'No signed-in user found for player balance update',
        assertions: [{ name: 'Signed-in user available', passed: false }],
        createdEntities: [],
        warnings,
        data: { amount }
      };
    }

    const data = await adminSetPlayerBalance(amount, currentUser.id);
    return {
      runId,
      scenarioId,
      status: data.success ? 'passed' : 'blocked',
      summary: data.message || data.error || 'Player balance update completed',
      assertions: [{ name: 'Player balance updated', passed: data.success, details: String(amount) }],
      createdEntities: [],
      warnings,
      data
    };
  }

  await adminAddPrestigeToCompany(amount);
  return {
    runId,
    scenarioId,
    status: 'passed',
    summary: `Added ${amount} prestige to the active company`,
    assertions: [{ name: 'Prestige event added', passed: true, details: String(amount) }],
    createdEntities: [],
    warnings,
    data: { amount }
  };
}

async function runResearchScenario(
  runId: string,
  scenarioId: string,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const { adminGrantAllResearch, adminRemoveAllResearch } = await import('@/lib/services/admin/adminService');

  if (scenarioId === 'research.grant-all') {
    const data = await adminGrantAllResearch();
    return {
      runId,
      scenarioId,
      status: data.success ? 'passed' : 'failed',
      summary: `Research granted: ${data.unlocked} unlocked, ${data.alreadyUnlocked} already unlocked`,
      assertions: [{ name: 'Research grant completed', passed: data.success }],
      createdEntities: [],
      warnings,
      data
    };
  }

  const data = await adminRemoveAllResearch();
  return {
    runId,
    scenarioId,
    status: data.success ? 'passed' : 'failed',
    summary: `Research removed: ${data.removed} unlocks removed`,
    assertions: [{ name: 'Research removal completed', passed: data.success }],
    createdEntities: [],
    warnings,
    data
  };
}

async function runStaffXpScenario(
  runId: string,
  scenarioId: string,
  params: Record<string, string | number | boolean>,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const staffId = String(params.staffId || '').trim();
  const xpCategory = String(params.xpCategory || '').trim();
  const xpAmount = Number(params.xpAmount ?? 0);

  if (!staffId || staffId === 'none') {
    return {
      runId,
      scenarioId,
      status: 'blocked',
      summary: 'Staff XP scenario requires a staff member',
      assertions: [{ name: 'Staff member selected', passed: false }],
      createdEntities: [],
      warnings
    };
  }

  const { adminSetStaffXP } = await import('@/lib/services/admin/adminService');
  const data = await adminSetStaffXP(staffId, xpCategory, xpAmount);

  return {
    runId,
    scenarioId,
    status: data.success ? 'passed' : 'blocked',
    summary: data.message || data.error || 'Staff XP update completed',
    assertions: [{ name: 'Staff XP updated', passed: data.success, details: xpCategory }],
    createdEntities: data.success ? [{ type: 'staff', id: staffId, label: xpCategory }] : [],
    warnings,
    data
  };
}

async function runCompleteActivityScenario(
  runId: string,
  scenarioId: string,
  params: Record<string, string | number | boolean>,
  warnings: string[]
): Promise<TestLabScenarioResult> {
  const activityId = String(params.activityId || '').trim();

  if (!activityId || activityId === 'none') {
    return {
      runId,
      scenarioId,
      status: 'blocked',
      summary: 'Activity completion requires an activity',
      assertions: [{ name: 'Activity selected', passed: false }],
      createdEntities: [],
      warnings
    };
  }

  const { completeActivityNow } = await import('@/lib/services/activity/activitymanagers/activityManager');
  const data = await completeActivityNow(activityId);

  return {
    runId,
    scenarioId,
    status: data.success ? 'passed' : 'blocked',
    summary: data.success
      ? `Completed activity ${data.activity?.title || activityId}`
      : data.error || 'Failed to complete activity',
    assertions: [{ name: 'Activity completed', passed: data.success, details: data.activity?.id || activityId }],
    createdEntities: data.activity
      ? [{ type: 'activity', id: data.activity.id, label: data.activity.title }]
      : [],
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

    if (scenario.id === 'sales.generate-orders') {
      return await runSalesOrdersScenario(runId, scenario.id, warnings);
    }

    if (scenario.id === 'sales.generate-contract') {
      return await runSalesContractScenario(runId, scenario.id, warnings);
    }

    if (scenario.id === 'sales.generate-bottle-presale-contract') {
      return await runSalesContractScenario(runId, scenario.id, warnings);
    }

    if (scenario.id === 'sales.generate-grape-forward-contract') {
      return await runSalesContractScenario(runId, scenario.id, warnings);
    }

    if (
      scenario.id === 'finance.set-company-money' ||
      scenario.id === 'finance.set-player-balance' ||
      scenario.id === 'finance.add-prestige'
    ) {
      return await runFinanceScenario(runId, scenario.id, params, warnings);
    }

    if (scenario.id === 'research.grant-all' || scenario.id === 'research.remove-all') {
      return await runResearchScenario(runId, scenario.id, warnings);
    }

    if (scenario.id === 'staff.set-xp') {
      return await runStaffXpScenario(runId, scenario.id, params, warnings);
    }

    if (scenario.id === 'activity.complete-now') {
      return await runCompleteActivityScenario(runId, scenario.id, params, warnings);
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
      case 'company.set-game-date': {
        const { adminSetGameDate } = await import('@/lib/services/admin/adminService');
        await adminSetGameDate({
          week: Number(params.week),
          season: params.season as Season,
          year: Number(params.year)
        });
        return {
          runId,
          scenarioId: scenario.id,
          status: 'passed',
          summary: `Game date set to ${params.season} week ${params.week}, ${params.year}`,
          assertions: [{ name: 'Game date updated', passed: true }],
          createdEntities: [],
          warnings,
          data: {
            week: params.week,
            season: params.season,
            year: params.year
          }
        };
      }
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
