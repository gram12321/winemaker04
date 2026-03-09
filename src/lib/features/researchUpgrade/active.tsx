import { ResearchPanel } from '@/components/finance/ResearchPanel';
import { GAME_INITIALIZATION, type SeasonName } from '@/lib/constants';
import { RESEARCH_PROJECTS, type ResearchProject, type UnlockType } from '@/lib/constants/researchConstants';
import { getAllResearchUnlocks, getUnlockedResearchIds, unlockResearch } from '@/lib/database/core/researchUnlocksDB';
import { supabase } from '@/lib/database/core/supabase';
import { startResearch, completeResearch } from './services/activity/activitymanagers/researchManager';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import type { ResearchUpgradeFeature } from './featureTypes';

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

export const activeResearchUpgradeFeature: ResearchUpgradeFeature = {
  ui: {
    getFinanceTabs() {
      return [
        {
          id: 'upgrades',
          label: 'Research and Upgrades',
          activeLabel: 'Research & Upgrades',
          render: () => <ResearchPanel />
        }
      ];
    }
  },

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
        vineyard_size: 'vineyard size',
        fermentation_technology: 'fermentation technology',
        staff_limit: 'staff limit',
        building_type: 'building type',
        wine_feature: 'wine feature',
        contract_type: 'contract type'
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

  admin: {
    async grantAllResearch() {
      const companyId = getCurrentCompanyId();
      if (!companyId) {
        throw new Error('No active company found');
      }

      const gameState = getGameState();
      const gameDate = {
        week: gameState.week || GAME_INITIALIZATION.STARTING_WEEK,
        season: (gameState.season || GAME_INITIALIZATION.STARTING_SEASON) as SeasonName,
        year: gameState.currentYear || GAME_INITIALIZATION.STARTING_YEAR
      };

      const absoluteWeeks = calculateAbsoluteWeeks(
        gameDate.week,
        gameDate.season,
        gameDate.year
      );

      const existingUnlocks = await getAllResearchUnlocks(companyId);
      const unlockedIds = new Set(existingUnlocks.map(unlock => unlock.researchId));

      let unlocked = 0;
      let alreadyUnlocked = 0;

      for (const project of RESEARCH_PROJECTS) {
        if (unlockedIds.has(project.id)) {
          alreadyUnlocked++;
          continue;
        }

        try {
          await unlockResearch({
            researchId: project.id,
            companyId,
            unlockedAt: gameDate,
            unlockedAtTimestamp: absoluteWeeks,
            metadata: {
              unlocks: project.unlocks || [],
              adminGranted: true
            }
          });
          unlocked++;
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
            alreadyUnlocked++;
          } else {
            console.error(`Error unlocking research ${project.id}:`, error);
          }
        }
      }

      console.log(`Admin granted all research: ${unlocked} unlocked, ${alreadyUnlocked} already unlocked`);

      return {
        success: true,
        unlocked,
        alreadyUnlocked
      };
    },

    async removeAllResearch() {
      const companyId = getCurrentCompanyId();
      if (!companyId) {
        throw new Error('No active company found');
      }

      const unlocks = await getAllResearchUnlocks(companyId);
      const unlockIds = unlocks.map(unlock => unlock.id);

      if (unlockIds.length === 0) {
        return {
          success: true,
          removed: 0
        };
      }

      const { error } = await supabase
        .from('research_unlocks')
        .delete()
        .in('id', unlockIds);

      if (error) {
        throw error;
      }

      console.log(`Admin removed all research: ${unlockIds.length} unlocks removed`);

      return {
        success: true,
        removed: unlockIds.length
      };
    }
  }
};
