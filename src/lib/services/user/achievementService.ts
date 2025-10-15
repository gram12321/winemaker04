import { AchievementConfig, AchievementWithStatus, AchievementUnlock } from '../../types/types';
import { ALL_ACHIEVEMENTS, getAchievementConfig } from '../../constants/achievementConstants';
import { 
  unlockAchievement, 
  getAllAchievementUnlocks, 
  isAchievementUnlocked 
} from '../../database/core/achievementsDB';
import { insertPrestigeEvent } from '../../database/customers/prestigeEventsDB';
import { getGameState } from '../core/gameState';
import { calculateAbsoluteWeeks } from '../../utils/utils';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { v4 as uuidv4 } from 'uuid';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';

/**
 * Achievement condition checker context
 * Contains all data needed to evaluate achievement conditions
 */
interface AchievementCheckContext {
  companyId: string;
  currentMoney: number;
  currentPrestige: number;
  companyAgeInYears: number;
  totalSalesCount: number;
  totalSalesValue: number;
  totalWinesProduced: number;
  totalBottlesProduced: number;
  vineyardCount: number;
}

/**
 * Build achievement check context from current game state
 */
async function buildAchievementContext(companyId: string): Promise<AchievementCheckContext> {
  const gameState = getGameState();
  const vineyards = await loadVineyards();
  
  // Calculate company age
  const companyAgeInYears = gameState.currentYear! - gameState.foundedYear!;
  
  // Load sales data
  const { loadWineOrders } = await import('../../database/customers/salesDB');
  const orders = await loadWineOrders();
  const fulfilledOrders = orders.filter(o => o.status === 'fulfilled' || o.status === 'partially_fulfilled');
  
  const totalSalesCount = fulfilledOrders.length;
  const totalSalesValue = fulfilledOrders.reduce((sum: number, order: any) => {
    return sum + (order.fulfillableValue || order.totalValue);
  }, 0);
  
  // Load production data
  const { loadWineLog } = await import('../../database/core/wineLogDB');
  const wineLog = await loadWineLog();

  const totalWinesProduced = wineLog.length;
  const totalBottlesProduced = wineLog.reduce((sum: number, wine: any) => sum + wine.quantity, 0);
  
  return {
    companyId,
    currentMoney: gameState.money || 0,
    currentPrestige: gameState.prestige || 0,
    companyAgeInYears,
    totalSalesCount,
    totalSalesValue,
    totalWinesProduced,
    totalBottlesProduced,
    vineyardCount: vineyards.length
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
      return {
        isMet: context.currentMoney >= (condition.threshold || 0),
        progress: context.currentMoney,
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
  unlock: AchievementUnlock
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
        achievementRarity: achievement.rarity,
        unlockedValue: unlock.metadata?.value
      }
    });
  }
  
  // Spawn vineyard prestige event
  if (achievement.prestige.vineyard) {
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'vineyard_achievement',
      amount_base: achievement.prestige.vineyard.baseAmount,
      created_game_week: currentWeek,
      decay_rate: achievement.prestige.vineyard.decayRate,
      source_id: achievement.prestige.vineyard.vineyardId || null,
      payload: {
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        event: 'achievement_unlock'
      }
    });
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
      rarity: achievement.rarity
    }
  });
  
  // Spawn prestige events
  await spawnAchievementPrestigeEvents(achievement, unlock);
  
  // Trigger global update for UI
  triggerGameUpdate();
  
  console.log(`🏆 Achievement Unlocked: ${achievement.name} (${achievement.icon})`);
  
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
    
    // Rarity
    if (!byRarity[achievement.rarity]) {
      byRarity[achievement.rarity] = { total: 0, unlocked: 0 };
    }
    byRarity[achievement.rarity].total++;
    if (achievement.isUnlocked) {
      byRarity[achievement.rarity].unlocked++;
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

