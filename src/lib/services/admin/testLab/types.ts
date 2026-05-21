import type { Vineyard, WineBatch } from '@/lib/types/types';

export type TestLabScenarioGroup =
  | 'Regression Tests'
  | 'Company Setup'
  | 'Vineyard Lifecycle'
  | 'Winery Flow'
  | 'Sales Flow'
  | 'Finance Flow'
  | 'Research and Staff'
  | 'Achievements and Wine Log';

export type TestLabParamFieldType = 'string' | 'number' | 'select' | 'boolean';
export type TestLabRunMode = 'run' | 'dryRun';
export type TestLabScenarioStatus = 'passed' | 'failed' | 'blocked';
export type TestLabEntityType =
  | 'company'
  | 'vineyard'
  | 'activity'
  | 'wineBatch'
  | 'wineLog'
  | 'order'
  | 'contract'
  | 'testRun';

export interface TestLabParamOption {
  label: string;
  value: string | number | boolean;
}

export interface TestLabParamField {
  key: string;
  label: string;
  type: TestLabParamFieldType;
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: TestLabParamOption[];
}

export interface TestLabScenarioDefinition {
  id: string;
  title: string;
  group: TestLabScenarioGroup;
  description: string;
  mutatesData: boolean;
  defaultParams: Record<string, string | number | boolean>;
  params: TestLabParamField[];
}

export interface TestLabAssertion {
  name: string;
  passed: boolean;
  details?: string;
}

export interface TestLabCreatedEntity {
  type: TestLabEntityType;
  id: string;
  label: string;
}

export interface TestLabScenarioResult<TData = unknown> {
  runId: string;
  scenarioId: string;
  status: TestLabScenarioStatus;
  summary: string;
  assertions: TestLabAssertion[];
  createdEntities: TestLabCreatedEntity[];
  warnings: string[];
  before?: unknown;
  after?: unknown;
  data?: TData;
  cleanup?: TestLabCleanupReport;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface TestLabCleanupReport {
  runId: string;
  status: TestLabScenarioStatus;
  deletedByEntity: Record<string, number>;
  warnings: string[];
}

export interface TestLabRunRequest {
  scenarioId: string;
  mode: TestLabRunMode;
  params: Record<string, string | number | boolean>;
}

export interface TestLabRunContext {
  runId: string;
  mode: TestLabRunMode;
}

export interface TestLabHarvestReadyVineyardData {
  vineyard: Vineyard;
}

export interface TestLabWineBatchData {
  vineyard: Vineyard;
  batch: WineBatch;
}
