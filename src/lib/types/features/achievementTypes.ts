import type { GameDate } from '../shared/coreTypes';

export type AchievementCategory = 'financial' | 'production' | 'time' | 'prestige' | 'sales' | 'vineyard' | 'special';

export type AchievementLevel = 1 | 2 | 3 | 4 | 5;

export type AchievementConditionType =
  | 'money_threshold'
  | 'prestige_threshold'
  | 'time_threshold'
  | 'sales_count'
  | 'sales_value'
  | 'production_count'
  | 'bottles_produced'
  | 'vineyard_count'
  | 'vineyard_time_same_grape'
  | 'vineyard_wine_variety_count'
  | 'vineyard_bottles_produced'
  | 'vineyard_sales_count'
  | 'vineyard_prestige_threshold'
  | 'single_contract_bottles'
  | 'single_contract_value'
  | 'cellar_value'
  | 'total_assets'
  | 'vineyard_value'
  | 'total_vineyard_value'
  | 'achievement_completion'
  | 'different_grapes'
  | 'wine_grape_quality_threshold'
  | 'wine_balance_threshold'
  | 'wine_score_threshold'
  | 'wine_price_threshold'
  | 'sales_price_percentage'
  | 'prestige_by_year'
  | 'revenue_by_year'
  | 'assets_by_year'
  | 'hectares_by_year'
  | 'total_hectares'
  | 'average_hectare_value'
  | 'custom';

export interface AchievementCondition {
  type: AchievementConditionType;
  threshold?: number;
  customChecker?: string;
}

export interface AchievementPrestigeConfig {
  company?: {
    baseAmount: number;
    decayRate: number;
  };
  vineyard?: {
    baseAmount: number;
    decayRate: number;
    vineyardId?: string;
  };
}

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  achievementLevel?: AchievementLevel;
  condition: AchievementCondition;
  prerequisites?: string[];
  prestige?: AchievementPrestigeConfig;
  hidden?: boolean;
}

export interface AchievementUnlock {
  id: string;
  achievementId: string;
  companyId: string;
  unlockedAt: GameDate;
  unlockedAtTimestamp: number;
  progress?: number;
  metadata?: {
    value?: number;
    [key: string]: any;
  };
}

export interface AchievementWithStatus extends AchievementConfig {
  isUnlocked: boolean;
  unlockedAt?: GameDate;
  progress?: {
    current: number;
    target: number;
    unit: string;
  };
}
