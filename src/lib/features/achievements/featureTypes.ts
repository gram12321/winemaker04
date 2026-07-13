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

export interface AchievementsFeature {
  evaluation: {
    checkAll(companyId?: string): Promise<AchievementUnlock[]>;
    checkOne(achievementId: string, companyId?: string): Promise<AchievementUnlock | null>;
  };
  progression: {
    getUnlockedIds(companyId?: string): Promise<Set<string>>;
  };
  catalog: {
    getTitle(achievementId: string): string | undefined;
    getLevelInfo(level: AchievementLevel): AchievementLevelInfo;
  };
  views: {
    getAllWithStatus(companyId?: string): Promise<AchievementWithStatus[]>;
    getStats(companyId?: string): ReturnType<typeof import('./achievementService').getAchievementStats>;
    filterForDisplay(achievements: AchievementWithStatus[]): AchievementWithStatus[];
  };
  ui: {
    renderAchievementsPage(input: AchievementsPageInput): ReactElement;
  };
}

export type { AchievementConfig, AchievementLevel, AchievementUnlock, AchievementWithStatus };
