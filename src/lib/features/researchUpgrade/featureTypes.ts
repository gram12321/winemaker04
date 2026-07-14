import type { ReactElement } from 'react';
import type { ResearchProject, UnlockType } from '@/lib/constants/researchConstants';
import type { Activity, GameDate } from '@/lib/types/types';
import type { ResearchPermanentEffectsSummary } from './services/research/researchPermanentEffectsService';

export type { ResearchPermanentEffectsSummary };

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

export interface ResearchUpgradeUiHooks {
  renderResearchPage(input: {
    getAchievementTitle(achievementId: string): string | undefined;
  }): ReactElement;
}

export interface ResearchUpgradeEffectsHooks {
  getPermanentEffects(companyId?: string): Promise<ResearchPermanentEffectsSummary>;
}

export interface ResearchUpgradeFeature {
  workflow: ResearchUpgradeWorkflowHooks;
  unlocks: ResearchUpgradeUnlockHooks;
  setup: ResearchUpgradeSetupHooks;
  ui: ResearchUpgradeUiHooks;
  effects: ResearchUpgradeEffectsHooks;
}
