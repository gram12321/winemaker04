import { describe, expect, it } from 'vitest';
import { normalizeVitestTarget, parseVitestJsonOutput } from '../../server/test-runner-parser';

const buildVitestJson = () => JSON.stringify({
  success: true,
  numTotalTests: 4,
  numPassedTests: 2,
  numFailedTests: 1,
  numPendingTests: 1,
  numTodoTests: 0,
  startTime: Date.now(),
  testResults: [
    {
      name: 'tests/example/a.test.ts',
      status: 'passed',
      startTime: 1000,
      endTime: 1100,
      assertionResults: [
        { fullName: 'passes one', status: 'passed', duration: 4 },
        { fullName: 'skips one', status: 'pending', duration: 0 }
      ]
    },
    {
      name: 'tests/example/b.test.ts',
      status: 'failed',
      startTime: 1100,
      endTime: 1250,
      assertionResults: [
        { fullName: 'passes two', status: 'passed', duration: 5 },
        { fullName: 'fails one', status: 'failed', duration: 7, failureMessages: ['expected true to be false'] }
      ]
    }
  ]
});

describe('parseVitestJsonOutput', () => {
  it('counts tests separately from files and keeps skipped tests separate', () => {
    const result = parseVitestJsonOutput(buildVitestJson(), '', 1);

    expect(result.status).toBe('failed');
    expect(result.total).toBe(4);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.testFiles).toHaveLength(2);
    expect(result.testFiles[0].tests).toBe(2);
    expect(result.testFiles[0].skippedTests).toBe(1);
  });

  it('reports failed test names and messages', () => {
    const result = parseVitestJsonOutput(buildVitestJson(), '', 1);

    expect(result.failedTests).toEqual([
      {
        file: 'tests/example/b.test.ts',
        name: 'fails one',
        messages: ['expected true to be false']
      }
    ]);
  });

  it('returns a structured failed result for malformed output', () => {
    const result = parseVitestJsonOutput('not json', 'stderr text', 1);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unable to parse');
    expect(result.output).toContain('not json');
    expect(result.output).toContain('stderr text');
  });
});

describe('normalizeVitestTarget', () => {
  it('accepts tests/**/*.test.ts paths', () => {
    expect(normalizeVitestTarget('tests\\wine\\example.test.ts')).toBe('tests/wine/example.test.ts');
  });

  it('rejects non-test paths', () => {
    expect(() => normalizeVitestTarget('../package.json')).toThrow();
    expect(() => normalizeVitestTarget('src/App.tsx')).toThrow();
    expect(() => normalizeVitestTarget('tests/example.ts')).toThrow();
  });
});
