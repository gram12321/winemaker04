import type { ReactNode } from 'react';
import type { ResearchProject, UnlockType } from '@/lib/constants/researchConstants';
import type { Activity, GameDate } from '@/lib/types/types';

export interface ResearchUpgradeFinanceTabRegistration {
  id: string;
  label: string;
  render: () => ReactNode;
  activeLabel: string;
}

export interface ResearchUpgradeUiHooks {
  getFinanceTabs(): ResearchUpgradeFinanceTabRegistration[];
}

export interface ResearchUpgradeWorkflowHooks {
  startResearch(projectId: string): Promise<string | null>;
  completeResearch(activity: Activity): Promise<void>;
}

export interface ResearchUpgradeUnlockHooks {
  isUnlocked(type: UnlockType, value: string | number, companyId?: string): Promise<boolean>;
  getUnlockedItems(type: UnlockType, companyId?: string): Promise<string[]>;
  getRequiredResearch(type: UnlockType, value: string | number): ResearchProject | null;
  getLockedMessage(type: UnlockType, value: string | number): string;
}

export interface GrantResearchUnlockInput {
  researchId: string;
  companyId: string;
  gameDate: GameDate;
  absoluteWeeks: number;
  metadata?: Record<string, unknown>;
}

export interface GrantStartingGrapeUnlockInput {
  companyId: string;
  grape: string;
  countryId: string;
  gameDate: GameDate;
  absoluteWeeks: number;
}

export interface ResearchUpgradeSetupHooks {
  grantResearchUnlock(input: GrantResearchUnlockInput): Promise<void>;
  grantStartingGrapeUnlock(input: GrantStartingGrapeUnlockInput): Promise<void>;
}

export interface ResearchUpgradeAdminGrantAllResult {
  success: boolean;
  unlocked: number;
  alreadyUnlocked: number;
}

export interface ResearchUpgradeAdminRemoveAllResult {
  success: boolean;
  removed: number;
}

export interface ResearchUpgradeAdminHooks {
  grantAllResearch(): Promise<ResearchUpgradeAdminGrantAllResult>;
  removeAllResearch(): Promise<ResearchUpgradeAdminRemoveAllResult>;
}

export interface ResearchUpgradeFeature {
  ui: ResearchUpgradeUiHooks;
  workflow: ResearchUpgradeWorkflowHooks;
  unlocks: ResearchUpgradeUnlockHooks;
  setup: ResearchUpgradeSetupHooks;
  admin: ResearchUpgradeAdminHooks;
}
