export type VitestCaseStatus = 'passed' | 'failed' | 'skipped';
export type VitestRunStatus = 'passed' | 'failed';

export interface VitestTestCaseSummary {
  name: string;
  status: VitestCaseStatus;
  durationMs: number;
  failureMessages: string[];
}

export interface VitestFileSummary {
  file: string;
  tests: number;
  duration: number;
  passed: boolean;
  status: VitestCaseStatus;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  testCases: VitestTestCaseSummary[];
}

export interface VitestFailedTestSummary {
  file: string;
  name: string;
  messages: string[];
}

export interface VitestRunSummary {
  status: VitestRunStatus;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  exitCode: number;
  durationMs: number;
  output: string;
  testFiles: VitestFileSummary[];
  failedTests: VitestFailedTestSummary[];
  error?: string;
}

interface VitestJsonAssertionResult {
  ancestorTitles?: string[];
  title?: string;
  fullName?: string;
  status?: string;
  duration?: number;
  failureMessages?: string[];
}

interface VitestJsonFileResult {
  name?: string;
  filepath?: string;
  file?: string;
  status?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
  assertionResults?: VitestJsonAssertionResult[];
  testResults?: VitestJsonAssertionResult[];
}

interface VitestJsonRunResult {
  startTime?: number;
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  testResults?: VitestJsonFileResult[];
}

const MAX_OUTPUT_LENGTH = 50000;

const normalizeCaseStatus = (status: string | undefined): VitestCaseStatus => {
  if (status === 'failed') return 'failed';
  if (status === 'pending' || status === 'skipped' || status === 'todo') return 'skipped';
  return 'passed';
};

const trimOutput = (output: string): string => {
  if (output.length <= MAX_OUTPUT_LENGTH) return output.trim();
  return `${output.slice(-MAX_OUTPUT_LENGTH).trim()}\n\n... (output truncated)`;
};

const extractJsonPayload = (output: string): VitestJsonRunResult | null => {
  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  const candidate = output.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate) as VitestJsonRunResult;
  } catch {
    return null;
  }
};

const normalizeSingleVitestTarget = (target: string): string => {
  const normalized = target.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (
    normalized.includes('..') ||
    !normalized.startsWith('tests/') ||
    !normalized.endsWith('.test.ts')
  ) {
    throw new Error('Test target must be a tests/**/*.test.ts path');
  }

  return normalized;
};

export function normalizeVitestTargets(target: string | undefined): string[] {
  if (!target) return [];

  const rawTargets = target
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);

  return Array.from(new Set(rawTargets.map(normalizeSingleVitestTarget)));
}

export function normalizeVitestTarget(target: string | undefined): string | undefined {
  const targets = normalizeVitestTargets(target);
  if (targets.length === 0) return undefined;
  if (targets.length > 1) {
    throw new Error('Test target must be a single tests/**/*.test.ts path');
  }

  return targets[0];
}

export function parseVitestJsonOutput(
  stdout: string,
  stderr = '',
  exitCode = 0
): VitestRunSummary {
  const displayOutput = trimOutput(stderr ? `${stdout}\n\n--- Errors ---\n${stderr}` : stdout);
  const payload = extractJsonPayload(stdout);

  if (!payload) {
    return {
      status: 'failed',
      passed: 0,
      failed: exitCode === 0 ? 0 : 1,
      skipped: 0,
      total: 0,
      exitCode,
      durationMs: 0,
      output: displayOutput,
      testFiles: [],
      failedTests: [],
      error: 'Unable to parse Vitest JSON reporter output'
    };
  }

  const testFiles: VitestFileSummary[] = (payload.testResults || []).map(fileResult => {
    const assertions = fileResult.assertionResults || fileResult.testResults || [];
    const testCases = assertions.map(assertion => {
      const status = normalizeCaseStatus(assertion.status);
      const name = assertion.fullName
        || [...(assertion.ancestorTitles || []), assertion.title].filter(Boolean).join(' ')
        || assertion.title
        || 'Unnamed test';

      return {
        name,
        status,
        durationMs: assertion.duration ?? 0,
        failureMessages: assertion.failureMessages || []
      };
    });

    const passedTests = testCases.filter(test => test.status === 'passed').length;
    const failedTests = testCases.filter(test => test.status === 'failed').length;
    const skippedTests = testCases.filter(test => test.status === 'skipped').length;
    const durationMs = fileResult.duration
      ?? ((fileResult.endTime && fileResult.startTime) ? fileResult.endTime - fileResult.startTime : 0);
    const status: VitestCaseStatus = failedTests > 0
      ? 'failed'
      : skippedTests > 0 && passedTests === 0
        ? 'skipped'
        : 'passed';

    return {
      file: fileResult.name || fileResult.filepath || fileResult.file || 'unknown',
      tests: testCases.length,
      duration: durationMs,
      passed: failedTests === 0,
      status,
      passedTests,
      failedTests,
      skippedTests,
      durationMs,
      testCases
    };
  });

  const derivedPassed = testFiles.reduce((sum, file) => sum + file.passedTests, 0);
  const derivedFailed = testFiles.reduce((sum, file) => sum + file.failedTests, 0);
  const derivedSkipped = testFiles.reduce((sum, file) => sum + file.skippedTests, 0);
  const passed = payload.numPassedTests ?? derivedPassed;
  const failed = payload.numFailedTests ?? derivedFailed;
  const skipped = (payload.numPendingTests ?? 0) + (payload.numTodoTests ?? 0) || derivedSkipped;
  const total = payload.numTotalTests ?? passed + failed + skipped;
  const failedTests = testFiles.flatMap(file =>
    file.testCases
      .filter(test => test.status === 'failed')
      .map(test => ({
        file: file.file,
        name: test.name,
        messages: test.failureMessages
      }))
  );

  return {
    status: exitCode === 0 && failed === 0 ? 'passed' : 'failed',
    passed,
    failed,
    skipped,
    total,
    exitCode,
    durationMs: payload.startTime ? Math.max(0, Date.now() - payload.startTime) : 0,
    output: displayOutput,
    testFiles,
    failedTests,
    error: failed > 0 ? 'One or more tests failed' : undefined
  };
}
