export type TestLabRunId = `testlab_${string}`;

const TEST_LAB_PREFIX_PATTERN = /\[TESTLAB:(testlab_[^\]\s]+)\]/;

export function createTestLabRunId(date = new Date(), random = Math.random()): TestLabRunId {
  const timestamp = date.toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('.', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .slice(0, 14);
  const randomPart = Math.floor(random * 0xffffff).toString(16).padStart(6, '0');
  return `testlab_${timestamp}_${randomPart}`;
}

export function formatTestLabPrefix(runId: string): string {
  return `[TESTLAB:${runId}]`;
}

export function withTestLabPrefix(runId: string, label: string): string {
  return `${formatTestLabPrefix(runId)} ${label}`;
}

export function extractTestLabRunId(value: string | undefined | null): TestLabRunId | null {
  if (!value) return null;
  const match = value.match(TEST_LAB_PREFIX_PATTERN);
  return match?.[1] as TestLabRunId | undefined || null;
}
