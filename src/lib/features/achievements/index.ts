import { createElement, lazy } from 'react';
import { ALL_ACHIEVEMENTS } from './achievementDefinitions';
import { getAchievementLevelInfo } from './achievementDefinitionUtils';
import { filterAchievementSeriesForDisplay } from './achievementPresentationService';
import type { AchievementsFeature } from './featureTypes';

const AchievementsPage = lazy(() => import('./ui/AchievementsPage').then(module => ({ default: module.AchievementsPage })));

export const achievementsFeature: AchievementsFeature = {
  evaluation: {
    async checkAll(companyId) {
      const { checkAllAchievements } = await import('./achievementService');
      return checkAllAchievements(companyId);
    },
    async checkOne(achievementId, companyId) {
      const { checkAndUnlockAchievement } = await import('./achievementService');
      return checkAndUnlockAchievement(achievementId, companyId);
    },
  },
  progression: {
    async getUnlockedIds(companyId) {
      const { getAllAchievementUnlocks } = await import('@/lib/database/core/achievementsDB');
      const unlocks = await getAllAchievementUnlocks(companyId);
      return new Set(unlocks.map((unlock) => unlock.achievementId));
    },
  },
  catalog: {
    getTitle(achievementId) {
      return ALL_ACHIEVEMENTS.find((achievement) => achievement.id === achievementId)?.name;
    },
    getLevelInfo: getAchievementLevelInfo,
  },
  views: {
    async getAllWithStatus(companyId) {
      const { getAllAchievementsWithStatus } = await import('./achievementService');
      return getAllAchievementsWithStatus(companyId);
    },
    async getStats(companyId) {
      const { getAchievementStats } = await import('./achievementService');
      return getAchievementStats(companyId);
    },
    filterForDisplay: filterAchievementSeriesForDisplay,
  },
  ui: {
    renderAchievementsPage: ({ currentCompany, onBack }) => createElement(AchievementsPage, { currentCompany, onBack }),
  },
};

export type {
  AchievementLevelInfo,
  AchievementsFeature,
  AchievementsPageInput,
  AchievementConfig,
  AchievementLevel,
  AchievementUnlock,
  AchievementWithStatus,
} from './featureTypes';
