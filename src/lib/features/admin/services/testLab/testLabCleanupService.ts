import { cleanupTestLabRecords } from '@/lib/database/admin/testLabCleanupDB';
import type { TestLabCleanupReport } from './types';
import { formatTestLabPrefix } from './runId';

export async function cleanupTestLabRun(runId: string): Promise<TestLabCleanupReport> {
  const result = await cleanupTestLabRecords(formatTestLabPrefix(runId));
  return {
    runId,
    status: result.warnings.length > 0 ? 'blocked' : 'passed',
    deletedByEntity: result.deletedByEntity,
    warnings: result.warnings
  };
}
