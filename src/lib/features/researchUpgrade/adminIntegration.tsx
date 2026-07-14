import { lazy } from 'react';
import { GAME_INITIALIZATION, type SeasonName } from '@/lib/constants';
import { RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';
import {
  deleteResearchUnlocksByIds,
  getAllResearchUnlocks,
  unlockResearch,
} from '@/lib/database/core/researchUnlocksDB';
import { getGameState } from '@/lib/services/core/gameState';
import { calculateAbsoluteWeeks } from '@/lib/utils';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

const ResearchAdminInspector = lazy(() => import('./components/ResearchAdminInspector').then(module => ({ default: module.ResearchAdminInspector })));

/** Development-only Research capability consumed by the Admin feature. */
export const researchUpgradeAdminIntegration = {
  renderInspector: () => <ResearchAdminInspector />,

  async grantAllResearch(): Promise<{ success: boolean; unlocked: number; alreadyUnlocked: number }> {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No active company found');
    }

    const gameState = getGameState();
    const gameDate = {
      week: gameState.week || GAME_INITIALIZATION.STARTING_WEEK,
      season: (gameState.season || GAME_INITIALIZATION.STARTING_SEASON) as SeasonName,
      year: gameState.currentYear || GAME_INITIALIZATION.STARTING_YEAR,
    };
    const absoluteWeeks = calculateAbsoluteWeeks(gameDate.week, gameDate.season, gameDate.year);
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
          metadata: { unlocks: project.unlocks || [], adminGranted: true },
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
    return { success: true, unlocked, alreadyUnlocked };
  },

  async removeAllResearch(): Promise<{ success: boolean; removed: number }> {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      throw new Error('No active company found');
    }

    const unlockIds = (await getAllResearchUnlocks(companyId)).map(unlock => unlock.id);
    await deleteResearchUnlocksByIds(unlockIds);

    console.log(`Admin removed all research: ${unlockIds.length} unlocks removed`);
    return { success: true, removed: unlockIds.length };
  },
};
