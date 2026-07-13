import type { ReactElement } from 'react';
import type {
  AchievementConfig,
  AchievementLevel,
  AchievementUnlock,
  AchievementWithStatus,
} from '@/lib/types/types';

export interface AchievementLevelInfo {
  name: string;
  prestige: number;
  decayYears: number;
  color: string;
}

export interface AchievementsPageInput {
  currentCompany: unknown | null;
  onBack?: () => void;
}

export interface AchievementStats {
  totalAchievements: number;
  unlockedCount: number;
  unlockedPercent: number;
  byCategory: Record<string, { total: number; unlocked: number }>;
  byRarity: Record<string, { total: number; unlocked: number }>;
}

export interface AchievementWorkspace {
  achievements: AchievementWithStatus[];
  stats: AchievementStats;
}

export interface AchievementsFeature {
  evaluation: {
    checkAll(): Promise<AchievementUnlock[]>;
    checkOne(achievementId: string): Promise<AchievementUnlock | null>;
  };
  progression: {
    getUnlockedIds(): Promise<Set<string>>;
  };
  catalog: {
    getTitle(achievementId: string): string | undefined;
    getLevelInfo(level: AchievementLevel): AchievementLevelInfo;
  };
  views: {
    getAllWithStatus(): Promise<AchievementWithStatus[]>;
    getStats(): Promise<AchievementStats>;
    getWorkspace(): Promise<AchievementWorkspace>;
    filterForDisplay(achievements: AchievementWithStatus[]): AchievementWithStatus[];
  };
  ticks: {
    checkAfterWeekAdvance(): Promise<void>;
  };
  ui: {
    renderAchievementsPage(input: AchievementsPageInput): ReactElement;
  };
}

export type { AchievementConfig, AchievementLevel, AchievementUnlock, AchievementWithStatus };
