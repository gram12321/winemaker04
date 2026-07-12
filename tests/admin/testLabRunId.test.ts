import { describe, expect, it } from 'vitest';
import { createTestLabRunId, extractTestLabRunId, formatTestLabPrefix, withTestLabPrefix } from '@/lib/features/admin/services/testLab/runId';

describe('test lab run ids', () => {
  it('creates stable prefixed run ids', () => {
    const runId = createTestLabRunId(new Date('2026-05-21T12:34:56.000Z'), 0);

    expect(runId).toBe('testlab_20260521123456_000000');
    expect(formatTestLabPrefix(runId)).toBe('[TESTLAB:testlab_20260521123456_000000]');
  });

  it('extracts run ids from tagged labels', () => {
    const label = withTestLabPrefix('testlab_20260521123456_abcdef', 'Harvest Ready Vineyard');

    expect(extractTestLabRunId(label)).toBe('testlab_20260521123456_abcdef');
    expect(extractTestLabRunId('Normal Vineyard')).toBeNull();
  });
});
