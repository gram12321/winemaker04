import { AchievementConfig, AchievementWithStatus, AchievementUnlock, AchievementCategory, AchievementLevel } from '../../types/types';
import { ALL_ACHIEVEMENTS, achievementLevels } from '../../constants/achievementConstants';
import { unlockAchievement, getAllAchievementUnlocks, isAchievementUnlocked } from '../../database/core/achievementsDB';
import { insertPrestigeEvent } from '../../database/customers/prestigeEventsDB';
import { getGameState, calculateFinancialData, calculateNetWorth } from '../index';
import { calculateAbsoluteWeeks } from '../../utils';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { loadWineLogByVineyard } from '../../database';
import { v4 as uuidv4 } from 'uuid';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { formatNumber as formatNumberUtil, getBadgeColorClasses } from '../../utils/utils';

// ===== ACHIEVEMENT BUSINESS LOGIC FUNCTIONS =====

/**
 * Get achievement level info including colors
 * Uses the existing badge color system from utils.ts
 */
export function getAchievementLevelInfo(level: AchievementLevel): {
  name: string;
  prestige: number;
  decayYears: number;
  color: string;
} {
  const levelData = achievementLevels[level];
  // Map achievement levels 1-5 to quality values 0.2-1.0 for color progression
  const qualityValue = (level - 1) / 4; // 0, 0.25, 0.5, 0.75, 1.0
  const colors = getBadgeColorClasses(qualityValue);
  
  return {
    name: levelData.name,
    prestige: levelData.prestige,
    decayYears: levelData.decayYears,
    color: `${colors.bg} ${colors.text}`
  };
}

/**
 * Create a short, human-friendly suffix for an achievement name
 * based on the condition type and numeric threshold, e.g.:
 *  - "100 Bottles", "€50,000", "25 Varieties", "10 Years", "95 Score"
 */
export function getConditionSuffix(conditionType: string, threshold: number): string {
  const num = formatNumberUtil(threshold);

  switch (conditionType) {
    // Currency based thresholds
    case 'money_threshold':
    case 'sales_value':
    case 'single_contract_value':
    case 'cellar_value':
    case 'total_assets':
    case 'vineyard_value':
    case 'revenue_by_year':
    case 'assets_by_year':
    case 'average_hectare_value':
    case 'wine_price_threshold':
      return `€${num}`;

    // Percentage thresholds
    case 'achievement_completion':
    case 'sales_price_percentage':
      return `${num}%`;

    // Time thresholds
    case 'time_threshold':
    case 'vineyard_time_same_grape':
      return `${num} Years`;

    // Count thresholds
    case 'bottles_produced':
    case 'single_contract_bottles':
    case 'vineyard_bottles_produced':
      return `${num} Bottles`;
    case 'sales_count':
    case 'vineyard_sales_count':
      return `${num} Sales`;
    case 'production_count':
    case 'different_grapes':
      return `${num} Varieties`;
    case 'vineyard_count':
      return `${num} Vineyards`;
    case 'total_hectares':
    case 'hectares_by_year':
      return `${num} Hectares`;

    // Rating/score thresholds
    case 'wine_grape_quality_threshold':
      return `${num} Grape Quality`;
    case 'wine_balance_threshold':
      return `${num} Balance`;
    case 'wine_score_threshold':
      return `${num} Score`;
    case 'prestige_threshold':
    case 'vineyard_prestige_threshold':
    case 'prestige_by_year':
      return `${num} Prestige`;

    default:
      return `${num}`;
  }
}

/**
 * Generate tiered achievements for a specific type
 */
export function createTieredAchievements(
  baseId: string,
  baseName: string,
  baseDescription: string,
  icon: string,
  category: AchievementCategory,
  conditionType: string,
  thresholds: number[],
  prerequisites: string[] = [],
  options: {
    includeVineyard?: boolean;
    vineyardDecayMultiplier?: number; // Vineyard events decay faster (default 0.5 = half company decay time)
  } = {}
): AchievementConfig[] {
  return thresholds.map((threshold, index) => {
    const tier = index + 1;
    const achievementLevel = Math.min(5, Math.max(1, tier)) as AchievementLevel;
    const prevId = index > 0 ? `${baseId}_tier_${index}` : null;
    const levelInfo = achievementLevels[achievementLevel];
    
    // Calculate weekly retention rates (0-1, where 1 = no decay, 0 = immediate decay)
    // For yearly decay, we want the weekly retention rate that results in the desired yearly decay
    // If we want 50% decay over X years, weekly retention = (0.5)^(1/(52*X))
    const yearlyRetentionRate = 0.5; // 50% retention after the specified years
    const companyDecayRate = Math.pow(yearlyRetentionRate, 1 / (levelInfo.decayYears * 52));
    const vineyardDecayRate = options.includeVineyard 
      ? Math.pow(yearlyRetentionRate, 1 / (levelInfo.decayYears * 52 * (options.vineyardDecayMultiplier || 0.5)))
      : undefined;
    
    const prestigeConfig: any = {
      company: {
        baseAmount: levelInfo.prestige,
        decayRate: companyDecayRate
      }
    };
    
    // Add vineyard prestige if requested
    if (options.includeVineyard) {
      prestigeConfig.vineyard = {
        baseAmount: levelInfo.prestige,
        decayRate: vineyardDecayRate
      };
    }
    
    const valueSuffix = getConditionSuffix(conditionType, threshold);

    return {
      id: `${baseId}_tier_${tier}`,
      name: `${baseName} - ${valueSuffix}`,
      description: baseDescription.replace('{threshold}', formatNumberUtil(threshold)),
      icon,
      category,
      achievementLevel,
      condition: {
        type: conditionType as any,
        threshold
      },
      prerequisites: prevId ? [prevId] : prerequisites,
      prestige: prestigeConfig
    };
  });
}

/**
 * Achievement condition checker context
 * Contains all data needed to evaluate achievement conditions
 */
interface AchievementCheckContext {
  companyId: string;
  currentMoney: number;
  netWorth: number;
  currentPrestige: number;
  companyAgeInYears: number;
  totalSalesCount: number;
  totalSalesValue: number;
  totalWinesProduced: number;
  totalBottlesProduced: number;
  vineyardCount: number;
  totalAssets: number;
  cellarValue: number;
  totalVineyardValue: number;
  yearlyRevenue: number;
  completedAchievementsCount: number;
  totalAchievementsCount: number;
  vineyards: Array<{
    id: string;
    name: string;
    grape: string | null;
    yearsWithSameGrape: number;
    winesProduced: number;
    bottlesProduced: number;
    salesCount: number;
    prestige: number;
    grapeVarietiesProduced: string[];
    vineyardTotalValue: number;
    hectares: number;
  }>;
  wineLogEntries: Array<{
    grapeQuality: number;
    balance: number;
    estimatedPrice: number;
    vintage: number;
  }>;
}

/**
 * Build achievement check context from current game state
 */
async function buildAchievementContext(companyId: string): Promise<AchievementCheckContext> {
  const gameState = getGameState();
  const vineyards = await loadVineyards();
  
  // Calculate company age
  const companyAgeInYears = gameState.currentYear! - gameState.foundedYear!;
  
  // Load financial data
  const [financialData, netWorth] = await Promise.all([
    calculateFinancialData('year'),
    calculateNetWorth()
  ]);
  
  // OPTIMIZATION: Use lightweight summary queries instead of loading full datasets
  const { getSalesSummary } = await import('../../database/customers/salesDB');
  const { getWineProductionSummary } = await import('../../database/core/wineLogDB');
  
  const [salesSummary, productionSummary] = await Promise.all([
    getSalesSummary(),
    getWineProductionSummary()
  ]);
  
  const totalSalesCount = salesSummary.totalSalesCount;
  const totalSalesValue = salesSummary.totalSalesValue;
  const totalWinesProduced = productionSummary.totalWinesProduced;
  const totalBottlesProduced = productionSummary.totalBottlesProduced;
  
  // Load wine log entries for quality/balance/price tracking
  const allWineLogEntries = [];
  for (const vineyard of vineyards) {
    try {
      const vineyardEntries = await loadWineLogByVineyard(vineyard.id);
      allWineLogEntries.push(...vineyardEntries);
    } catch (error) {
      console.warn(`Failed to load wine log for vineyard ${vineyard.id}:`, error);
      // Continue with other vineyards rather than failing completely
    }
  }
  
  // Create a wine log map for quick lookup by vineyard
  const wineLogMap = new Map<string, any[]>();
  for (const wine of allWineLogEntries) {
    if (!wineLogMap.has(wine.vineyardId)) {
      wineLogMap.set(wine.vineyardId, []);
    }
    wineLogMap.get(wine.vineyardId)!.push(wine);
  }
  
  // Get achievement completion data (excluding meta achievements from the count)
  const completedAchievements = await getAllAchievementUnlocks();
  
  // Exclude meta achievements from both completed and total counts to avoid chicken-and-egg problem
  // The 100% achievement completion achievement shouldn't count itself
  const metaAchievementIds = ALL_ACHIEVEMENTS
    .filter(achievement => achievement.id.startsWith('achievement_completion_'))
    .map(achievement => achievement.id);
  
  // Filter out completed meta achievements from the count
  const completedNonMetaAchievements = completedAchievements.filter(
    achievement => !metaAchievementIds.includes(achievement.achievementId)
  );
  
  const completedAchievementsCount = completedNonMetaAchievements.length;
  const totalAchievementsCount = ALL_ACHIEVEMENTS.length - metaAchievementIds.length;
  
  // Build vineyard-specific data
  const vineyardData = vineyards.map(vineyard => {
    // Get wines produced from this vineyard
    const vineyardWines = wineLogMap.get(vineyard.id) || [];
    const vineyardBottles = vineyardWines.reduce((sum: number, wine: any) => sum + wine.quantity, 0);
    
    // Get sales from wines produced in this vineyard (simplified - would need wine order tracking)
    const vineyardSales: any[] = []; // TODO: Implement proper vineyard sales tracking
    
    // Get unique grape varieties produced from this vineyard
    const grapeVarietiesProduced = [...new Set(vineyardWines.map((wine: any) => wine.grape))];
    
    // Calculate years with same grape (simplified - would need historical tracking)
    const yearsWithSameGrape = 1; // TODO: Implement proper grape change tracking
    
    // Use actual vineyard prestige from the vineyard data
    const vineyardPrestige = vineyard.vineyardPrestige || 0;
    
    return {
      id: vineyard.id,
      name: vineyard.name,
      grape: vineyard.grape,
      yearsWithSameGrape,
      winesProduced: vineyardWines.length,
      bottlesProduced: vineyardBottles,
      salesCount: vineyardSales.length,
      prestige: vineyardPrestige,
      grapeVarietiesProduced: grapeVarietiesProduced as string[],
      vineyardTotalValue: vineyard.vineyardTotalValue || 0,
      hectares: vineyard.hectares || 0
    };
  });
  
  return {
    companyId,
    currentMoney: gameState.money || 0,
    netWorth,
    currentPrestige: gameState.prestige || 0,
    companyAgeInYears,
    totalSalesCount,
    totalSalesValue,
    totalWinesProduced,
    totalBottlesProduced,
    vineyardCount: vineyards.length,
    totalAssets: financialData.totalAssets,
    cellarValue: financialData.wineValue,
    totalVineyardValue: financialData.allVineyardsValue,
    yearlyRevenue: financialData.income,
    completedAchievementsCount,
    totalAchievementsCount,
    vineyards: vineyardData,
    wineLogEntries: allWineLogEntries.map(entry => ({
      grapeQuality: entry.grapeQuality,
      balance: entry.balance,
      estimatedPrice: entry.estimatedPrice,
      vintage: entry.vintage
    }))
  };
}

/**
 * Helper function for year-based achievements
 */
function checkYearBasedAchievement(
  companyAgeInYears: number,
  requiredYear: number,
  currentValue: number,
  threshold: number,
  unit: string
): { isMet: boolean; progress: number; target: number; unit: string } {
  const currentYear = Math.floor(companyAgeInYears);
  if (currentYear >= requiredYear) {
    return {
      isMet: currentValue >= threshold,
      progress: currentValue,
      target: threshold,
      unit
    };
  }
  return {
    isMet: false,
    progress: currentValue,
    target: threshold,
    unit
  };
}

/**
 * Check if achievement condition is met
 */
function checkAchievementCondition(
  achievement: AchievementConfig, 
  context: AchievementCheckContext
): { isMet: boolean; progress?: number; target?: number; unit?: string } {
  const condition = achievement.condition;
  
  switch (condition.type) {
    case 'money_threshold':
      // Cash reserves minus outstanding loan debt (net cash position)
      const outstandingLoans = context.totalAssets - context.netWorth;
      const netCashPosition = context.currentMoney - outstandingLoans;
      return {
        isMet: netCashPosition >= (condition.threshold || 0),
        progress: netCashPosition,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'prestige_threshold':
      return {
        isMet: context.currentPrestige >= (condition.threshold || 0),
        progress: context.currentPrestige,
        target: condition.threshold,
        unit: 'prestige'
      };
      
    case 'time_threshold':
      return {
        isMet: context.companyAgeInYears >= (condition.threshold || 0),
        progress: context.companyAgeInYears,
        target: condition.threshold,
        unit: 'years'
      };
      
    case 'sales_count':
      return {
        isMet: context.totalSalesCount >= (condition.threshold || 0),
        progress: context.totalSalesCount,
        target: condition.threshold,
        unit: 'sales'
      };
      
    case 'sales_value':
      return {
        isMet: context.totalSalesValue >= (condition.threshold || 0),
        progress: context.totalSalesValue,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'production_count':
      return {
        isMet: context.totalWinesProduced >= (condition.threshold || 0),
        progress: context.totalWinesProduced,
        target: condition.threshold,
        unit: 'wines'
      };
      
    case 'bottles_produced':
      return {
        isMet: context.totalBottlesProduced >= (condition.threshold || 0),
        progress: context.totalBottlesProduced,
        target: condition.threshold,
        unit: 'bottles'
      };
      
    case 'vineyard_count':
      return {
        isMet: context.vineyardCount >= (condition.threshold || 0),
        progress: context.vineyardCount,
        target: condition.threshold,
        unit: 'vineyards'
      };
      
    case 'vineyard_time_same_grape':
      // Check if any vineyard has maintained the same grape for the threshold years
      const maxYearsWithSameGrape = Math.max(...context.vineyards.map(v => v.yearsWithSameGrape), 0);
      return {
        isMet: maxYearsWithSameGrape >= (condition.threshold || 0),
        progress: maxYearsWithSameGrape,
        target: condition.threshold,
        unit: 'years'
      };
      
    case 'vineyard_wine_variety_count':
      // Check if any vineyard has produced the threshold number of different grape varieties
      const maxGrapeVarieties = Math.max(...context.vineyards.map(v => v.grapeVarietiesProduced.length), 0);
      return {
        isMet: maxGrapeVarieties >= (condition.threshold || 0),
        progress: maxGrapeVarieties,
        target: condition.threshold,
        unit: 'varieties'
      };
      
    case 'vineyard_bottles_produced':
      // Check if any vineyard has produced the threshold number of bottles
      const maxVineyardBottles = Math.max(...context.vineyards.map(v => v.bottlesProduced), 0);
      return {
        isMet: maxVineyardBottles >= (condition.threshold || 0),
        progress: maxVineyardBottles,
        target: condition.threshold,
        unit: 'bottles'
      };
      
    case 'vineyard_sales_count':
      // Check if any vineyard has made the threshold number of sales
      const maxVineyardSales = Math.max(...context.vineyards.map(v => v.salesCount), 0);
      return {
        isMet: maxVineyardSales >= (condition.threshold || 0),
        progress: maxVineyardSales,
        target: condition.threshold,
        unit: 'sales'
      };
      
    case 'vineyard_prestige_threshold':
      // Check if any vineyard has achieved the threshold prestige
      const maxVineyardPrestige = Math.max(...context.vineyards.map(v => v.prestige), 0);
      return {
        isMet: maxVineyardPrestige >= (condition.threshold || 0),
        progress: maxVineyardPrestige,
        target: condition.threshold,
        unit: 'prestige'
      };
      
    case 'single_contract_bottles':
      // Check if any single contract sold the threshold number of bottles
      // TODO: Implement single contract bottle tracking
      return {
        isMet: false,
        progress: 0,
        target: condition.threshold,
        unit: 'bottles'
      };
      
    case 'single_contract_value':
      // Check if any single contract had the threshold value
      // TODO: Implement single contract value tracking
      return {
        isMet: false,
        progress: 0,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'cellar_value':
      // Check if cellar wine value meets threshold
      return {
        isMet: context.cellarValue >= (condition.threshold || 0),
        progress: context.cellarValue,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'total_assets':
      // Check if net worth meets threshold (assets minus liabilities)
      return {
        isMet: context.netWorth >= (condition.threshold || 0),
        progress: context.netWorth,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'vineyard_value':
      // Check if total vineyard value meets threshold
      return {
        isMet: context.totalVineyardValue >= (condition.threshold || 0),
        progress: context.totalVineyardValue,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'achievement_completion':
      // Check if achievement completion percentage meets threshold
      const completionPercentage = Math.round((context.completedAchievementsCount / context.totalAchievementsCount) * 100);
      return {
        isMet: completionPercentage >= (condition.threshold || 0),
        progress: completionPercentage,
        target: condition.threshold,
        unit: '%'
      };
      
    case 'different_grapes':
      // Check if produced wines from threshold number of different grape varieties
      const allGrapeVarieties = new Set<string>();
      context.vineyards.forEach(v => {
        v.grapeVarietiesProduced.forEach(grape => allGrapeVarieties.add(grape));
      });
      return {
        isMet: allGrapeVarieties.size >= (condition.threshold || 0),
        progress: allGrapeVarieties.size,
        target: condition.threshold,
        unit: 'varieties'
      };
      
    case 'wine_grape_quality_threshold':
      // Check if produced a wine with grape quality rating >= threshold
      const maxQuality = Math.max(...context.wineLogEntries.map(e => e.grapeQuality), 0);
      return {
        isMet: maxQuality >= (condition.threshold || 0),
        progress: maxQuality,
        target: condition.threshold,
        unit: 'quality'
      };
      
    case 'wine_balance_threshold':
      // Check if produced a wine with balance rating >= threshold
      const maxBalance = Math.max(...context.wineLogEntries.map(e => e.balance), 0);
      return {
        isMet: maxBalance >= (condition.threshold || 0),
        progress: maxBalance,
        target: condition.threshold,
        unit: 'balance'
      };
      
    case 'wine_score_threshold':
      // Check if produced a wine with wine score >= threshold
      const maxWineScore = Math.max(...context.wineLogEntries.map(e => (e.grapeQuality + e.balance) / 2), 0);
      return {
        isMet: maxWineScore >= (condition.threshold || 0),
        progress: maxWineScore,
        target: condition.threshold,
        unit: 'score'
      };
      
    case 'wine_price_threshold':
      // Check if produced a wine with estimated price >= threshold
      const maxPrice = Math.max(...context.wineLogEntries.map(e => e.estimatedPrice), 0);
      return {
        isMet: maxPrice >= (condition.threshold || 0),
        progress: maxPrice,
        target: condition.threshold,
        unit: 'euros/bottle'
      };
      
    case 'sales_price_percentage':
      // Check if sold wine for X% over/under estimated price
      // TODO: Implement sales price percentage tracking
      return {
        isMet: false,
        progress: 0,
        target: condition.threshold,
        unit: '%'
      };
      
    case 'prestige_by_year':
      // Check if achieved threshold prestige before year 5
      return checkYearBasedAchievement(
        context.companyAgeInYears, 5, context.currentPrestige, condition.threshold || 0, 'prestige'
      );
      
    case 'revenue_by_year':
      // Check if generated threshold revenue in a single year
      return {
        isMet: context.yearlyRevenue >= (condition.threshold || 0),
        progress: context.yearlyRevenue,
        target: condition.threshold,
        unit: 'euros/year'
      };
      
    case 'assets_by_year':
      // Check if accumulated threshold net worth before year 10
      return checkYearBasedAchievement(
        context.companyAgeInYears, 10, context.netWorth, condition.threshold || 0, 'euros'
      );
      
    case 'hectares_by_year':
      // Check if owned threshold hectares before year 15
      const totalHectaresByYear = context.vineyards.reduce((sum, v) => sum + v.hectares, 0);
      return checkYearBasedAchievement(
        context.companyAgeInYears, 15, totalHectaresByYear, condition.threshold || 0, 'hectares'
      );
      
    case 'total_hectares':
      // Check if total hectares meets threshold
      const totalHectares = context.vineyards.reduce((sum, v) => sum + v.hectares, 0);
      return {
        isMet: totalHectares >= (condition.threshold || 0),
        progress: totalHectares,
        target: condition.threshold,
        unit: 'hectares'
      };
      
    case 'average_hectare_value':
      // Check if average hectare value meets threshold
      const totalHectaresForAvg = context.vineyards.reduce((sum, v) => sum + v.hectares, 0);
      const averageHectareValue = totalHectaresForAvg > 0 
        ? context.totalVineyardValue / totalHectaresForAvg 
        : 0;
      return {
        isMet: averageHectareValue >= (condition.threshold || 0),
        progress: averageHectareValue,
        target: condition.threshold,
        unit: 'euros/hectare'
      };
      
    case 'custom':
      // Custom condition checking can be implemented here
      return { isMet: false };
      
    default:
      return { isMet: false };
  }
}

/**
 * Spawn prestige events for unlocked achievement
 */
async function spawnAchievementPrestigeEvents(
  achievement: AchievementConfig,
  unlock: AchievementUnlock,
  context?: AchievementCheckContext
): Promise<void> {
  if (!achievement.prestige) return;
  
  const gameState = getGameState();
  const currentWeek = calculateAbsoluteWeeks(
    gameState.week!, 
    gameState.season!, 
    gameState.currentYear!
  );
  
  // Spawn company prestige event
  if (achievement.prestige.company) {
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'achievement',
      amount_base: achievement.prestige.company.baseAmount,
      created_game_week: currentWeek,
      decay_rate: achievement.prestige.company.decayRate,
      source_id: null,
      payload: {
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        achievementCategory: achievement.category,
        achievementLevel: achievement.achievementLevel,
        unlockedValue: unlock.metadata?.value
      }
    });
  }
  
  // Spawn vineyard prestige event
  if (achievement.prestige.vineyard && context) {
    // Find the best performing vineyard for this achievement type
    let bestVineyard = null;
    
    if (achievement.condition.type.includes('vineyard_time_same_grape')) {
      bestVineyard = context.vineyards.reduce((best, current) => 
        current.yearsWithSameGrape > best.yearsWithSameGrape ? current : best
      );
    } else if (achievement.condition.type.includes('vineyard_wine_variety_count')) {
      bestVineyard = context.vineyards.reduce((best, current) => 
        current.grapeVarietiesProduced.length > best.grapeVarietiesProduced.length ? current : best
      );
    } else if (achievement.condition.type.includes('vineyard_bottles_produced')) {
      bestVineyard = context.vineyards.reduce((best, current) => 
        current.bottlesProduced > best.bottlesProduced ? current : best
      );
    } else if (achievement.condition.type.includes('vineyard_sales_count')) {
      bestVineyard = context.vineyards.reduce((best, current) => 
        current.salesCount > best.salesCount ? current : best
      );
    } else if (achievement.condition.type.includes('vineyard_prestige_threshold')) {
      bestVineyard = context.vineyards.reduce((best, current) => 
        current.prestige > best.prestige ? current : best
      );
    }
    
    if (bestVineyard) {
      await insertPrestigeEvent({
        id: uuidv4(),
        type: 'vineyard_achievement',
        amount_base: achievement.prestige.vineyard.baseAmount,
        created_game_week: currentWeek,
        decay_rate: achievement.prestige.vineyard.decayRate,
        source_id: bestVineyard.id,
        payload: {
          achievementId: achievement.id,
          achievementName: achievement.name,
          achievementIcon: achievement.icon,
          achievementCategory: achievement.category,
          achievementLevel: achievement.achievementLevel,
          vineyardName: bestVineyard.name,
          event: 'achievement_unlock'
        }
      });
    }
  }
}

/**
 * Unlock achievement and spawn prestige events
 */
async function unlockAchievementWithPrestige(
  achievement: AchievementConfig,
  context: AchievementCheckContext,
  progressData?: { progress?: number; target?: number; unit?: string }
): Promise<AchievementUnlock> {
  const gameState = getGameState();
  const currentWeek = calculateAbsoluteWeeks(
    gameState.week!, 
    gameState.season!, 
    gameState.currentYear!
  );
  
  // Create unlock record
  const unlock = await unlockAchievement({
    achievementId: achievement.id,
    companyId: context.companyId,
    unlockedAt: {
      week: gameState.week!,
      season: gameState.season!,
      year: gameState.currentYear!
    },
    unlockedAtTimestamp: currentWeek,
    progress: progressData?.progress,
    metadata: {
      value: progressData?.progress,
      threshold: progressData?.target,
      category: achievement.category,
      achievementLevel: achievement.achievementLevel
    }
  });
  
  // Spawn prestige events
  await spawnAchievementPrestigeEvents(achievement, unlock, context);
  
  // Trigger global update for UI
  triggerGameUpdate();
  
  // User-facing notification
  await notificationService.addMessage(
    `🏆 Achievement Unlocked: ${achievement.name} (${achievement.icon})`,
    'achievements.unlock',
    'Achievements',
    NotificationCategory.SYSTEM
  );
  
  return unlock;
}

/**
 * Check and unlock a specific achievement
 */
export async function checkAndUnlockAchievement(
  achievementId: string,
  companyId?: string
): Promise<AchievementUnlock | null> {
  const achievement = getAchievementConfig(achievementId);
  if (!achievement) {
    console.warn(`Achievement ${achievementId} not found`);
    return null;
  }
  
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return null;
  
  // Check if already unlocked
  const alreadyUnlocked = await isAchievementUnlocked(achievementId, targetCompanyId);
  if (alreadyUnlocked) return null;
  
  // Build context and check condition
  const context = await buildAchievementContext(targetCompanyId);
  const conditionResult = checkAchievementCondition(achievement, context);
  
  if (conditionResult.isMet) {
    return await unlockAchievementWithPrestige(achievement, context, conditionResult);
  }
  
  return null;
}

/**
 * Check all achievements and unlock any that are met
 */
export async function checkAllAchievements(companyId?: string): Promise<AchievementUnlock[]> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) return [];
  
  const context = await buildAchievementContext(targetCompanyId);
  const newUnlocks: AchievementUnlock[] = [];
  
  for (const achievement of ALL_ACHIEVEMENTS) {
    // Skip if already unlocked
    const alreadyUnlocked = await isAchievementUnlocked(achievement.id, targetCompanyId);
    if (alreadyUnlocked) continue;
    
    // Check condition
    const conditionResult = checkAchievementCondition(achievement, context);
    
    if (conditionResult.isMet) {
      const unlock = await unlockAchievementWithPrestige(achievement, context, conditionResult);
      newUnlocks.push(unlock);
    }
  }
  
  return newUnlocks;
}

/**
 * Get all achievements with unlock status for UI
 */
export async function getAllAchievementsWithStatus(companyId?: string): Promise<AchievementWithStatus[]> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  if (!targetCompanyId) {
    // Return all achievements as locked if no company
    return ALL_ACHIEVEMENTS.map(achievement => ({
      ...achievement,
      isUnlocked: false
    }));
  }
  
  const context = await buildAchievementContext(targetCompanyId);
  const unlocks = await getAllAchievementUnlocks(targetCompanyId);
  const unlockMap = new Map(unlocks.map(u => [u.achievementId, u]));
  
  return ALL_ACHIEVEMENTS.map(achievement => {
    const unlock = unlockMap.get(achievement.id);
    const conditionResult = checkAchievementCondition(achievement, context);
    
    return {
      ...achievement,
      isUnlocked: !!unlock,
      unlockedAt: unlock?.unlockedAt,
      progress: conditionResult.progress !== undefined ? {
        current: conditionResult.progress,
        target: conditionResult.target || 0,
        unit: conditionResult.unit || ''
      } : undefined
    };
  });
}

/**
 * Get achievement statistics for a company
 */
export async function getAchievementStats(companyId?: string): Promise<{
  totalAchievements: number;
  unlockedCount: number;
  unlockedPercent: number;
  byCategory: Record<string, { total: number; unlocked: number }>;
  byRarity: Record<string, { total: number; unlocked: number }>;
}> {
  const achievementsWithStatus = await getAllAchievementsWithStatus(companyId);
  
  const totalAchievements = achievementsWithStatus.length;
  const unlockedCount = achievementsWithStatus.filter(a => a.isUnlocked).length;
  const unlockedPercent = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;
  
  // Category stats
  const byCategory: Record<string, { total: number; unlocked: number }> = {};
  const byRarity: Record<string, { total: number; unlocked: number }> = {};
  
  for (const achievement of achievementsWithStatus) {
    // Category
    if (!byCategory[achievement.category]) {
      byCategory[achievement.category] = { total: 0, unlocked: 0 };
    }
    byCategory[achievement.category].total++;
    if (achievement.isUnlocked) {
      byCategory[achievement.category].unlocked++;
    }
    
    // Achievement Level
    const level = achievement.achievementLevel || 1;
    if (!byRarity[level]) {
      byRarity[level] = { total: 0, unlocked: 0 };
    }
    byRarity[level].total++;
    if (achievement.isUnlocked) {
      byRarity[level].unlocked++;
    }
  }
  
  return {
    totalAchievements,
    unlockedCount,
    unlockedPercent,
    byCategory,
    byRarity
  };
}

// ===== ACHIEVEMENT UTILITY FUNCTIONS =====

/**
 * Get achievement configuration by ID
 */
export function getAchievementConfig(achievementId: string): AchievementConfig | undefined {
  return ALL_ACHIEVEMENTS.find(achievement => achievement.id === achievementId);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: string): AchievementConfig[] {
  return ALL_ACHIEVEMENTS.filter(achievement => achievement.category === category);
}

/**
 * Get achievements by achievement level
 */
export function getAchievementsByLevel(level: number): AchievementConfig[] {
  return ALL_ACHIEVEMENTS.filter(achievement => achievement.achievementLevel === level);
}

