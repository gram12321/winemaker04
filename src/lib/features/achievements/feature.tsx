import { createElement, lazy } from 'react';
import { ALL_ACHIEVEMENTS } from './achievementDefinitions';
import { getAchievementLevelInfo } from './achievementDefinitionUtils';
import { filterAchievementSeriesForDisplay } from './achievementPresentationService';
import type { AchievementsFeature } from './featureTypes';

const AchievementsPage = lazy(() => import('./ui/AchievementsPage').then(module => ({ default: module.AchievementsPage })));

export const achievementsFeature: AchievementsFeature = {
  evaluation: {
    async checkAll() {
      const { checkAllAchievements } = await import('./achievementService');
      return checkAllAchievements();
    },
    async checkOne(achievementId) {
      const { checkAndUnlockAchievement } = await import('./achievementService');
      return checkAndUnlockAchievement(achievementId);
    },
  },
  progression: {
    async getUnlockedIds() {
      const { getUnlockedAchievementIds } = await import('./achievementService');
      return getUnlockedAchievementIds();
    },
  },
  catalog: {
    getTitle(achievementId) {
      return ALL_ACHIEVEMENTS.find((achievement) => achievement.id === achievementId)?.name;
    },
    getLevelInfo: getAchievementLevelInfo,
  },
  views: {
    async getAllWithStatus() {
      const { getAllAchievementsWithStatus } = await import('./achievementService');
      return getAllAchievementsWithStatus();
    },
    async getStats() {
      const { getAchievementStats } = await import('./achievementService');
      return getAchievementStats();
    },
    async getWorkspace() {
      const { getAchievementWorkspace } = await import('./achievementService');
      return getAchievementWorkspace();
    },
    filterForDisplay: filterAchievementSeriesForDisplay,
  },
  ticks: {
    async checkAfterWeekAdvance() {
      const { checkAchievementsAfterWeekAdvance } = await import('./achievementTickService');
      return checkAchievementsAfterWeekAdvance();
    },
  },
  ui: {
    renderAchievementsPage: ({ currentCompany, onBack }) => createElement(AchievementsPage, {
      currentCompany,
      onBack,
      views: achievementsFeature.views,
      catalog: achievementsFeature.catalog,
    }),
  },
};
