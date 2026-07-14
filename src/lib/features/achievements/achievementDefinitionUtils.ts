import type { AchievementCategory, AchievementConfig, AchievementLevel } from '@/lib/types/types';
import { formatNumber, getBadgeColorClasses } from '@/lib/utils/utils';
import { achievementLevels } from './achievementLevels';

export function getAchievementLevelInfo(level: AchievementLevel): {
  name: string;
  prestige: number;
  decayYears: number;
  color: string;
} {
  const levelData = achievementLevels[level];
  const qualityValue = (level - 1) / 4;
  const colors = getBadgeColorClasses(qualityValue);

  return {
    name: levelData.name,
    prestige: levelData.prestige,
    decayYears: levelData.decayYears,
    color: `${colors.bg} ${colors.text}`,
  };
}

function getConditionSuffix(conditionType: string, threshold: number): string {
  const numericThreshold = Number(threshold);
  const numberText = Number.isFinite(numericThreshold) ? formatNumber(numericThreshold) : String(threshold);

  switch (conditionType) {
    case 'money_threshold':
    case 'sales_value':
    case 'single_contract_value':
    case 'cellar_value':
    case 'total_assets':
    case 'vineyard_value':
    case 'total_vineyard_value':
    case 'revenue_by_year':
    case 'assets_by_year':
    case 'average_hectare_value':
    case 'wine_price_threshold':
      return Number.isFinite(numericThreshold)
        ? formatNumber(numericThreshold, { currency: true, decimals: 0 })
        : String(threshold);
    case 'achievement_completion':
    case 'sales_price_percentage':
      return `${numberText}%`;
    case 'time_threshold':
    case 'vineyard_time_same_grape':
      return `${numberText} Years`;
    case 'bottles_produced':
    case 'single_contract_bottles':
    case 'vineyard_bottles_produced':
      return `${numberText} Bottles`;
    case 'bulk_grape_kg_sold':
      return `${numberText} kg`;
    case 'bulk_grape_multiplier_threshold':
      return `${threshold.toFixed(2)}x`;
    case 'sales_count':
    case 'vineyard_sales_count':
    case 'bulk_grape_sales_count':
      return `${numberText} Sales`;
    case 'production_count':
    case 'different_grapes':
      return `${numberText} Varieties`;
    case 'vineyard_count':
      return `${numberText} Vineyards`;
    case 'total_hectares':
    case 'hectares_by_year':
      return `${numberText} Hectares`;
    case 'wine_taste_quality_index_threshold':
      return `${numberText} Taste Quality`;
    case 'wine_structure_index_threshold':
      return `${numberText} Structure`;
    case 'wine_score_threshold':
      return `${numberText} Score`;
    case 'prestige_threshold':
    case 'vineyard_prestige_threshold':
    case 'prestige_by_year':
      return `${numberText} Prestige`;
    default:
      return numberText;
  }
}

export function createTieredAchievements(
  baseId: string,
  baseName: string,
  baseDescription: string,
  icon: string,
  category: AchievementCategory,
  conditionType: string,
  thresholds: number[],
  prerequisites: string[] = [],
  options: { includeVineyard?: boolean; vineyardDecayMultiplier?: number } = {},
): AchievementConfig[] {
  return thresholds.map((threshold, index) => {
    const tier = index + 1;
    const achievementLevel = Math.min(5, Math.max(1, tier)) as AchievementLevel;
    const previousId = index > 0 ? `${baseId}_tier_${index}` : null;
    const levelInfo = achievementLevels[achievementLevel];
    const yearlyRetentionRate = 0.5;
    const companyDecayRate = Math.pow(yearlyRetentionRate, 1 / (levelInfo.decayYears * 52));
    const vineyardDecayRate = options.includeVineyard
      ? Math.pow(yearlyRetentionRate, 1 / (levelInfo.decayYears * 52 * (options.vineyardDecayMultiplier || 0.5)))
      : undefined;
    const prestige: AchievementConfig['prestige'] = {
      company: { baseAmount: levelInfo.prestige, decayRate: companyDecayRate },
    };

    if (options.includeVineyard) {
      prestige.vineyard = { baseAmount: levelInfo.prestige / 100, decayRate: vineyardDecayRate! };
    }

    return {
      id: `${baseId}_tier_${tier}`,
      name: `${baseName} - ${getConditionSuffix(conditionType, threshold)}`,
      description: baseDescription.replace('{threshold}', formatNumber(threshold)),
      icon,
      category,
      achievementLevel,
      condition: { type: conditionType as AchievementConfig['condition']['type'], threshold },
      prerequisites: previousId ? [previousId] : prerequisites,
      prestige,
    };
  });
}
