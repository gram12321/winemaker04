import { lazy } from 'react';
import { RESEARCH_PROJECTS, type ResearchProject, type UnlockType } from '@/lib/features/researchUpgrade/constants/researchCatalog';
import { getUnlockedResearchIds, unlockResearch } from '@/lib/database/core/researchUnlocksDB';
import { startResearch, completeResearch } from './services/activity/activitymanagers/researchManager';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { ResearchUpgradeFeature } from './featureTypes';
import { getResearchPermanentEffects } from './services/research/researchPermanentEffectsService';

const ResearchWorkspace = lazy(() => import('./components/ResearchWorkspace').then(module => ({ default: module.ResearchWorkspace })));

function getRequiredResearch(type: UnlockType, value: string | number): ResearchProject | null {
  const valueKey = String(value);

  for (const project of RESEARCH_PROJECTS) {
    if (!project.unlocks) continue;

    for (const unlock of project.unlocks) {
      if (unlock.type === type && String(unlock.value) === valueKey) {
        return project;
      }
    }
  }

  return null;
}

async function getUnlockedResearchSet(companyId?: string): Promise<Set<string>> {
  const unlockedResearchIds = await getUnlockedResearchIds(companyId);
  return new Set(unlockedResearchIds);
}

export const researchUpgradeFeature: ResearchUpgradeFeature = {
  workflow: {
    startResearch,
    completeResearch
  },

  unlocks: {
    async isUnlocked(type, value, companyId) {
      const targetCompanyId = companyId || getCurrentCompanyId();
      if (!targetCompanyId) return false;

      const unlockedSet = await getUnlockedResearchSet(targetCompanyId);
      const valueKey = String(value);

      for (const project of RESEARCH_PROJECTS) {
        if (!unlockedSet.has(project.id) || !project.unlocks) continue;

        for (const unlock of project.unlocks) {
          if (unlock.type === type && String(unlock.value) === valueKey) {
            return true;
          }
        }
      }

      return false;
    },

    async getUnlockedItems(type, companyId) {
      const targetCompanyId = companyId || getCurrentCompanyId();
      if (!targetCompanyId) return [];

      const unlockedSet = await getUnlockedResearchSet(targetCompanyId);
      const unlockedValues = new Set<string>();

      for (const project of RESEARCH_PROJECTS) {
        if (!unlockedSet.has(project.id) || !project.unlocks) continue;

        for (const unlock of project.unlocks) {
          if (unlock.type === type) {
            unlockedValues.add(String(unlock.value));
          }
        }
      }

      return Array.from(unlockedValues);
    },

    getRequiredResearch,

    getLockedMessage(type, value) {
      const project = getRequiredResearch(type, value);
      const displayName = String(value);

      if (project) {
        return `${displayName} is locked. Complete research: "${project.title}" to unlock it.`;
      }

      const typeLabels: Record<UnlockType, string> = {
        grape: 'grape variety',
        vineyard_size: 'max size per vineyard',
        total_vineyard_hectares: 'max total vineyard area',
        vineyard_count: 'max vineyard count',
        fermentation_technology: 'fermentation technology',
        staff_limit: 'staff limit',
        wine_feature: 'wine feature',
        contract_type: 'contract type',
        grape_buyer_slots: 'grape buyer slot',
        grape_buyer_limit_multiplier: 'grape buyer seasonal limit upgrade',
        grape_buyer_multiplier_bonus: 'grape buyer multiplier upgrade',
        grape_buyer_country_access: 'grape buyer country access'
      };

      return `${displayName} ${typeLabels[type] || 'item'} is locked. Complete the required research to unlock it.`;
    }
  },

  setup: {
    async grantResearchUnlock(input) {
      await unlockResearch({
        researchId: input.researchId,
        companyId: input.companyId,
        unlockedAt: input.gameDate,
        unlockedAtTimestamp: input.absoluteWeeks,
        metadata: input.metadata
      });
    },

    async grantStartingGrapeUnlock(input) {
      const requiredResearch = getRequiredResearch('grape', input.grape);
      if (!requiredResearch) return;

      await unlockResearch({
        researchId: requiredResearch.id,
        companyId: input.companyId,
        unlockedAt: input.gameDate,
        unlockedAtTimestamp: input.absoluteWeeks,
        metadata: {
          source: 'starting_conditions',
          country: input.countryId,
          grape: input.grape
        }
      });
    }
  },

  ui: {
    renderResearchPage: ({ getAchievementTitle }) => (
      <ResearchWorkspace getAchievementTitle={getAchievementTitle} />
    )
  },

  effects: {
    getPermanentEffects: getResearchPermanentEffects
  }
};
