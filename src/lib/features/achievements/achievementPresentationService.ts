import type { AchievementWithStatus } from '@/lib/types/types';

function getTierNumber(achievement: AchievementWithStatus): number {
  return Number(achievement.id.match(/_tier_(\d+)$/)?.[1] || 0);
}

/**
 * Shows completed milestones and the next available milestone for each tiered achievement series.
 */
export function filterAchievementSeriesForDisplay(
  achievements: AchievementWithStatus[],
): AchievementWithStatus[] {
  const tieredSeries = new Map<string, AchievementWithStatus[]>();
  const individualAchievements: AchievementWithStatus[] = [];

  for (const achievement of achievements) {
    if (!achievement.id.includes('_tier_')) {
      individualAchievements.push(achievement);
      continue;
    }

    const seriesId = achievement.id.replace(/_tier_\d+$/, '');
    const series = tieredSeries.get(seriesId) || [];
    series.push(achievement);
    tieredSeries.set(seriesId, series);
  }

  const displayAchievements: AchievementWithStatus[] = [];
  for (const series of tieredSeries.values()) {
    const sortedSeries = series.sort((left, right) => getTierNumber(left) - getTierNumber(right));
    const highestUnlockedIndex = sortedSeries.reduce(
      (highestIndex, achievement, index) => achievement.isUnlocked ? index : highestIndex,
      -1,
    );

    displayAchievements.push(...sortedSeries.slice(0, highestUnlockedIndex + 2));
  }

  return [...displayAchievements, ...individualAchievements];
}
