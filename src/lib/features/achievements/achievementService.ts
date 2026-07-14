import { AchievementConfig, AchievementWithStatus, AchievementUnlock, GameState, Transaction, WineOrder } from '@/lib/types/types';
import { ALL_ACHIEVEMENTS } from './achievementDefinitions';
import { unlockAchievement, getAllAchievementUnlocks, isAchievementUnlocked, getAchievementUnlock } from '@/lib/database/core/achievementsDB';
import {
  insertPrestigeEventIfAbsentBySource,
  insertVineyardAchievementPrestigeEventIfAbsent,
} from '@/lib/database/customers/prestigeEventsDB';
import { getGameState } from '@/lib/services/core/gameState';
import { getCompanyFinancialSnapshot } from '@/lib/services/finance/financeService';
import { calculateAbsoluteWeeks } from '@/lib/utils';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import { getWineProductionSummary, loadWineLogByVineyard } from '@/lib/database/core/wineLogDB';
import { v4 as uuidv4 } from 'uuid';
import { triggerGameUpdate } from '@/hooks/useGameUpdates';
import { notificationService } from '@/lib/services/core/notificationService';
import { NotificationCategory } from '@/lib/types/types';
import { resolveWineLogAchievementScore } from './achievementScoreUtils';
import { getSalesSummary, loadWineOrders } from '@/lib/database/customers/salesDB';
import { loadWineContracts } from '@/lib/database/sales/contractDB';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import type { AchievementStats, AchievementWorkspace } from './featureTypes';
import { ACHIEVEMENT_DEADLINE_YEARS } from '@/lib/constants';

const EXCLUDED_REVENUE_DESCRIPTIONS = new Set(['Starting Capital', 'Starting Capital Adjustment']);
const BULK_GRAPE_SALE_MARKER = 'Grape Sale:';
const BULK_GRAPE_BUYER_MARKER = '→ Bulk Grape Merchant';

function parseBulkGrapeSaleKg(description: string): number {
  if (!description.includes(BULK_GRAPE_SALE_MARKER) || !description.includes(BULK_GRAPE_BUYER_MARKER)) {
    return 0;
  }

  const match = description.match(/Grape Sale:\s*([\d,]+)\s*kg/i);
  if (!match) return 0;

  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBulkGrapeSaleMultiplier(description: string): number {
  if (!description.includes(BULK_GRAPE_SALE_MARKER) || !description.includes(BULK_GRAPE_BUYER_MARKER)) {
    return 0;
  }

  const match = description.match(/\(([\d.]+)x\s+multiplier\)/i);
  if (!match) return 0;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSalePricePercentages(orders: WineOrder[]): {
  bestSalePriceOverAskingPercent: number;
  bestSalePriceUnderAskingPercent: number;
} {
  return orders.reduce(
    (result, order) => {
      const askingPrice = order.askingPriceAtOrderTime;
      if (!askingPrice || askingPrice <= 0) return result;

      const percentageDifference = ((order.offeredPrice - askingPrice) / askingPrice) * 100;
      return {
        bestSalePriceOverAskingPercent: Math.max(result.bestSalePriceOverAskingPercent, percentageDifference),
        bestSalePriceUnderAskingPercent: Math.max(result.bestSalePriceUnderAskingPercent, -percentageDifference),
      };
    },
    { bestSalePriceOverAskingPercent: 0, bestSalePriceUnderAskingPercent: 0 }
  );
}

function calculateAdjustedYearlyRevenue(
  baseIncome: number,
  transactions: Transaction[],
  currentYear?: number
): number {
  if (!transactions?.length) {
    return baseIncome;
  }

  const targetYear = currentYear ?? new Date().getFullYear();
  const excludedRevenue = transactions.reduce((sum, transaction) => {
    if (
      transaction.amount > 0 &&
      EXCLUDED_REVENUE_DESCRIPTIONS.has(transaction.description) &&
      transaction.date?.year === targetYear
    ) {
      return sum + transaction.amount;
    }
    return sum;
  }, 0);

  return Math.max(0, baseIncome - excludedRevenue);
}

// ===== ACHIEVEMENT BUSINESS LOGIC FUNCTIONS =====

/**
 * Achievement condition checker context
 * Contains all data needed to evaluate achievement conditions
 */
interface AchievementCheckContext {
  companyId: string;
  currentMoney: number;
  companyValue: number;
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
  bulkGrapeSalesCount: number;
  bulkGrapeKgSold: number;
  bulkGrapeBestMultiplier: number;
  largestFulfilledContractQuantity: number;
  largestFulfilledContractValue: number;
  bestSalePriceOverAskingPercent: number;
  bestSalePriceUnderAskingPercent: number;
  gameState: Pick<GameState, 'week' | 'season' | 'currentYear' | 'foundedYear' | 'money' | 'prestige'>;
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
    tasteQualityIndex: number;
    structureIndex: number;
    wineScore?: number;
    estimatedPrice: number;
    vintage: number;
  }>;
}

function captureAchievementEvaluationScope(
  companyId = getCurrentCompanyId(),
  state: Partial<GameState> = getGameState()
): {
  companyId: string;
  gameState: AchievementCheckContext['gameState'];
} {
  if (
    state.week === undefined ||
    state.season === undefined ||
    state.currentYear === undefined ||
    state.foundedYear === undefined ||
    state.money === undefined ||
    state.prestige === undefined
  ) {
    throw new Error('Achievement evaluation requires a fully initialized active company state.');
  }

  return {
    companyId,
    gameState: {
      week: state.week,
      season: state.season,
      currentYear: state.currentYear,
      foundedYear: state.foundedYear,
      money: state.money,
      prestige: state.prestige,
    },
  };
}

/**
 * Build achievement check context from current game state
 */
async function buildAchievementContext(
  companyId: string,
  gameState: Pick<GameState, 'week' | 'season' | 'currentYear' | 'foundedYear' | 'money' | 'prestige'>
): Promise<AchievementCheckContext> {
  const [vineyards, wineOrders, wineContracts, wineBatches] = await Promise.all([
    loadVineyards(companyId),
    loadWineOrders(undefined, companyId),
    loadWineContracts(companyId),
    loadWineBatches(companyId),
  ]);
  
  // Calculate company age
  const companyAgeInYears = gameState.currentYear! - gameState.foundedYear!;
  
  // Load financial data
  const [financialSnapshot, salesSummary, productionSummary] = await Promise.all([
    getCompanyFinancialSnapshot(companyId, gameState),
    getSalesSummary(companyId),
    getWineProductionSummary(companyId)
  ]);
  const { financialData, companyValue, transactions } = financialSnapshot;
  
  const totalSalesCount = salesSummary.totalSalesCount;
  const totalSalesValue = salesSummary.totalSalesValue;
  const totalWinesProduced = productionSummary.totalWinesProduced;
  const totalBottlesProduced = productionSummary.totalBottlesProduced;
  const bulkGrapeSales = transactions.filter(tx => tx.amount > 0 && tx.description?.includes(BULK_GRAPE_BUYER_MARKER));
  const bulkGrapeSalesCount = bulkGrapeSales.length;
  const bulkGrapeKgSold = bulkGrapeSales.reduce((sum, tx) => sum + parseBulkGrapeSaleKg(tx.description || ''), 0);
  const bulkGrapeBestMultiplier = bulkGrapeSales.reduce(
    (max, tx) => Math.max(max, parseBulkGrapeSaleMultiplier(tx.description || '')),
    0
  );
  const fulfilledContracts = wineContracts.filter((contract) => contract.status === 'fulfilled');
  const largestFulfilledContractQuantity = Math.max(
    ...fulfilledContracts.map((contract) => contract.requestedQuantity),
    0
  );
  const largestFulfilledContractValue = Math.max(
    ...fulfilledContracts.map((contract) => contract.totalValue),
    0
  );
  const fulfilledOrders = wineOrders.filter((order) =>
    order.status === 'fulfilled' || order.status === 'partially_fulfilled'
  );
  const { bestSalePriceOverAskingPercent, bestSalePriceUnderAskingPercent } = getSalePricePercentages(fulfilledOrders);
  
  // Load wine log entries for quality/structure index/price tracking
  const allWineLogEntries = [];
  for (const vineyard of vineyards) {
    try {
      const vineyardEntries = await loadWineLogByVineyard(vineyard.id, companyId);
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
  const completedAchievements = await getAllAchievementUnlocks(companyId);
  
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
    
    const vineyardBatchIds = new Set(
      wineBatches.filter((batch) => batch.vineyardId === vineyard.id).map((batch) => batch.id)
    );
    const vineyardSales = fulfilledOrders.filter((order) => vineyardBatchIds.has(order.wineBatchId));
    
    // Get unique grape varieties produced from this vineyard
    const grapeVarietiesProduced = [...new Set(vineyardWines.map((wine: any) => wine.grape))];
    
    // Use actual vineyard prestige from the vineyard data
    const vineyardPrestige = vineyard.vineyardPrestige || 0;
    
    return {
      id: vineyard.id,
      name: vineyard.name,
      grape: vineyard.grape,
      yearsWithSameGrape: 0,
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
    companyValue,
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
    yearlyRevenue: calculateAdjustedYearlyRevenue(financialData.income, transactions, gameState.currentYear),
    completedAchievementsCount,
    totalAchievementsCount,
    bulkGrapeSalesCount,
    bulkGrapeKgSold,
    bulkGrapeBestMultiplier,
    largestFulfilledContractQuantity,
    largestFulfilledContractValue,
    bestSalePriceOverAskingPercent,
    bestSalePriceUnderAskingPercent,
    gameState,
    vineyards: vineyardData,
    wineLogEntries: allWineLogEntries.map(entry => ({
      tasteQualityIndex: entry.tasteQualityIndex,
      structureIndex: entry.structureIndex,
      wineScore: entry.wineScore,
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
  if (currentYear < requiredYear) {
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
      const outstandingLoans = context.totalAssets - context.companyValue;
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
      return { isMet: false, progress: 0, target: condition.threshold, unit: 'years' };
      
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
      return {
        isMet: context.largestFulfilledContractQuantity >= (condition.threshold || 0),
        progress: context.largestFulfilledContractQuantity,
        target: condition.threshold,
        unit: 'bottles'
      };
      
    case 'single_contract_value':
      return {
        isMet: context.largestFulfilledContractValue >= (condition.threshold || 0),
        progress: context.largestFulfilledContractValue,
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
      // Check if company value meets threshold (assets minus liabilities)
      return {
        isMet: context.companyValue >= (condition.threshold || 0),
        progress: context.companyValue,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'vineyard_value':
      // Check if any individual vineyard value meets threshold
      const maxSingleVineyardValue = Math.max(
        ...context.vineyards.map(v => v.vineyardTotalValue),
        0
      );
      return {
        isMet: maxSingleVineyardValue >= (condition.threshold || 0),
        progress: maxSingleVineyardValue,
        target: condition.threshold,
        unit: 'euros'
      };
      
    case 'total_vineyard_value':
      // Check if combined vineyard value meets threshold
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
      
    case 'wine_taste_quality_index_threshold':
      // Check if produced a wine with taste quality >= threshold
      const maxQuality = Math.max(...context.wineLogEntries.map(e => e.tasteQualityIndex), 0);
      return {
        isMet: maxQuality >= (condition.threshold || 0),
        progress: maxQuality,
        target: condition.threshold,
        unit: 'quality'
      };
      
    case 'wine_structure_index_threshold':
      // Check if produced a wine with structure index >= threshold
      const maxStructureIndex = Math.max(...context.wineLogEntries.map(e => e.structureIndex), 0);
      return {
        isMet: maxStructureIndex >= (condition.threshold || 0),
        progress: maxStructureIndex,
        target: condition.threshold,
        unit: 'structure'
      };
      
    case 'wine_score_threshold':
      // Check if produced a wine with wine score >= threshold
      const maxWineScore = Math.max(...context.wineLogEntries.map(resolveWineLogAchievementScore), 0);
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
      const isUnderAskingAchievement = achievement.id.startsWith('sales_price_under_');
      const salesPricePercentage = isUnderAskingAchievement
        ? context.bestSalePriceUnderAskingPercent
        : context.bestSalePriceOverAskingPercent;
      return {
        isMet: salesPricePercentage >= (condition.threshold || 0),
        progress: salesPricePercentage,
        target: condition.threshold,
        unit: '%'
      };

    case 'bulk_grape_sales_count':
      return {
        isMet: context.bulkGrapeSalesCount >= (condition.threshold || 0),
        progress: context.bulkGrapeSalesCount,
        target: condition.threshold,
        unit: 'sales'
      };

    case 'bulk_grape_kg_sold':
      return {
        isMet: context.bulkGrapeKgSold >= (condition.threshold || 0),
        progress: context.bulkGrapeKgSold,
        target: condition.threshold,
        unit: 'kg'
      };

    case 'bulk_grape_multiplier_threshold':
      return {
        isMet: context.bulkGrapeBestMultiplier >= (condition.threshold || 0),
        progress: context.bulkGrapeBestMultiplier,
        target: condition.threshold,
        unit: 'x'
      };
      
    case 'prestige_by_year':
      return checkYearBasedAchievement(
        context.companyAgeInYears, ACHIEVEMENT_DEADLINE_YEARS.prestige, context.currentPrestige, condition.threshold || 0, 'prestige'
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
      return checkYearBasedAchievement(
        context.companyAgeInYears, ACHIEVEMENT_DEADLINE_YEARS.assets, context.companyValue, condition.threshold || 0, 'euros'
      );
      
    case 'hectares_by_year':
      const totalHectaresByYear = context.vineyards.reduce((sum, v) => sum + v.hectares, 0);
      return checkYearBasedAchievement(
        context.companyAgeInYears, ACHIEVEMENT_DEADLINE_YEARS.hectares, totalHectaresByYear, condition.threshold || 0, 'hectares'
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
  if (!achievement.prestige || !context) return;

  const gameState = context.gameState;
  const currentWeek = calculateAbsoluteWeeks(
    gameState.week,
    gameState.season,
    gameState.currentYear
  );
  
  // Spawn company prestige event
  if (achievement.prestige.company) {
    await insertPrestigeEventIfAbsentBySource({
      id: uuidv4(),
      type: 'achievement',
      amount_base: achievement.prestige.company.baseAmount,
      created_game_week: currentWeek,
      decay_rate: achievement.prestige.company.decayRate,
      source_id: `achievement:${achievement.id}`,
      payload: {
        event: 'achievement_unlock',
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementIcon: achievement.icon,
        achievementCategory: achievement.category,
        achievementLevel: achievement.achievementLevel,
        unlockedValue: unlock.metadata?.value
      }
    }, unlock.companyId);
  }
  
  // Spawn vineyard prestige events for ALL qualifying vineyards (one per vineyard that meets the condition)
  if (achievement.prestige.vineyard) {
    // Find ALL qualifying vineyards for this achievement type (not just the best one)
    const qualifyingVineyards: typeof context.vineyards = [];
    
    if (achievement.condition.type.includes('vineyard_time_same_grape')) {
      const threshold = achievement.condition.threshold || 0;
      qualifyingVineyards.push(...context.vineyards.filter(v => v.yearsWithSameGrape >= threshold));
    } else if (achievement.condition.type.includes('vineyard_wine_variety_count')) {
      const threshold = achievement.condition.threshold || 0;
      qualifyingVineyards.push(...context.vineyards.filter(v => v.grapeVarietiesProduced.length >= threshold));
    } else if (achievement.condition.type.includes('vineyard_bottles_produced')) {
      const threshold = achievement.condition.threshold || 0;
      qualifyingVineyards.push(...context.vineyards.filter(v => v.bottlesProduced >= threshold));
    } else if (achievement.condition.type.includes('vineyard_sales_count')) {
      const threshold = achievement.condition.threshold || 0;
      qualifyingVineyards.push(...context.vineyards.filter(v => v.salesCount >= threshold));
    } else if (achievement.condition.type.includes('vineyard_prestige_threshold')) {
      const threshold = achievement.condition.threshold || 0;
      qualifyingVineyards.push(...context.vineyards.filter(v => v.prestige >= threshold));
    }
    
    // The database uniqueness constraint handles overlapping checks safely.
    for (const vineyard of qualifyingVineyards) {
      await insertVineyardAchievementPrestigeEventIfAbsent({
        id: uuidv4(),
        type: 'vineyard_achievement',
        amount_base: achievement.prestige.vineyard.baseAmount,
        created_game_week: currentWeek,
        decay_rate: achievement.prestige.vineyard.decayRate,
        source_id: vineyard.id,
        payload: {
          achievementId: achievement.id,
          achievementName: achievement.name,
          achievementIcon: achievement.icon,
          achievementCategory: achievement.category,
          achievementLevel: achievement.achievementLevel,
          vineyardId: vineyard.id,
          vineyardName: vineyard.name,
          event: 'achievement_unlock'
        }
      }, unlock.companyId);
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
): Promise<AchievementUnlock | null> {
  const gameState = context.gameState;
  const currentWeek = calculateAbsoluteWeeks(
    gameState.week,
    gameState.season,
    gameState.currentYear
  );
  
  // Create unlock record
  const unlockResult = await unlockAchievement({
    achievementId: achievement.id,
    achievementName: achievement.name,
    description: achievement.description,
    companyId: context.companyId,
    unlockedAt: {
      week: gameState.week,
      season: gameState.season,
      year: gameState.currentYear
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
  const { unlock, created } = unlockResult;
  
  // Spawn prestige events
  await spawnAchievementPrestigeEvents(achievement, unlock, context);

  if (!created) return null;
  
  // Trigger global update for UI
  triggerGameUpdate();
  
  // User-facing notification
  await notificationService.addMessage(
    `🏆 Achievement Unlocked: ${achievement.name} (${achievement.icon})`,
    'achievements.unlock',
    'Achievements',
    NotificationCategory.SYSTEM,
    {
      companyId: context.companyId,
      gameDate: {
        week: gameState.week,
        season: gameState.season,
        year: gameState.currentYear,
      },
    }
  );
  
  return unlock;
}

/**
 * Check and unlock a specific achievement
 */
export async function checkAndUnlockAchievement(
  achievementId: string
): Promise<AchievementUnlock | null> {
  const achievement = getAchievementConfig(achievementId);
  if (!achievement) {
    console.warn(`Achievement ${achievementId} not found`);
    return null;
  }
  
  const { companyId: targetCompanyId, gameState } = captureAchievementEvaluationScope();
  // Check if already unlocked
  const existingUnlock = await getAchievementUnlock(achievementId, targetCompanyId);
  if (existingUnlock) {
    const context = await buildAchievementContext(targetCompanyId, gameState);
    await spawnAchievementPrestigeEvents(achievement, existingUnlock, context);
    return null;
  }
  
  // Build context and check condition
  const context = await buildAchievementContext(targetCompanyId, gameState);
  const conditionResult = checkAchievementCondition(achievement, context);
  
  if (conditionResult.isMet) {
    return await unlockAchievementWithPrestige(achievement, context, conditionResult);
  }
  
  return null;
}

/**
 * Check all achievements and unlock any that are met
 * Also checks for new qualifying vineyards on already-unlocked vineyard achievements
 */
export async function checkAllAchievements(
  companyId?: string,
  state?: Partial<GameState>
): Promise<AchievementUnlock[]> {
  const { companyId: targetCompanyId, gameState } = captureAchievementEvaluationScope(companyId, state);
  
  const context = await buildAchievementContext(targetCompanyId, gameState);
  const newUnlocks: AchievementUnlock[] = [];
  
  for (const achievement of ALL_ACHIEVEMENTS) {
    const alreadyUnlocked = await isAchievementUnlocked(achievement.id, targetCompanyId);
    
    if (alreadyUnlocked) {
      // Achievement already unlocked - check for new qualifying vineyards
      const existingUnlock = await getAchievementUnlock(achievement.id, targetCompanyId);
      if (existingUnlock) {
        // Retry any missing company reward and check for new qualifying vineyards.
        await spawnAchievementPrestigeEvents(achievement, existingUnlock, context);
      }
      continue;
    }
    
    // Check condition for new achievement unlock
    const conditionResult = checkAchievementCondition(achievement, context);
    
    if (conditionResult.isMet) {
      const unlock = await unlockAchievementWithPrestige(achievement, context, conditionResult);
      if (unlock) newUnlocks.push(unlock);
    }
  }
  
  return newUnlocks;
}

/**
 * Get all achievements with unlock status for UI
 */
export async function getAllAchievementsWithStatus(): Promise<AchievementWithStatus[]> {
  return (await getAchievementWorkspace()).achievements;
}

export async function getUnlockedAchievementIds(): Promise<Set<string>> {
  const companyId = getCurrentCompanyId();
  const unlocks = await getAllAchievementUnlocks(companyId);
  return new Set(unlocks.map((unlock) => unlock.achievementId));
}

function buildAchievementStats(achievementsWithStatus: AchievementWithStatus[]): AchievementStats {
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

export async function getAchievementWorkspace(): Promise<AchievementWorkspace> {
  const { companyId: targetCompanyId, gameState } = captureAchievementEvaluationScope();
  const [context, unlocks] = await Promise.all([
    buildAchievementContext(targetCompanyId, gameState),
    getAllAchievementUnlocks(targetCompanyId),
  ]);
  const unlockMap = new Map(unlocks.map((unlock) => [unlock.achievementId, unlock]));
  const achievements = ALL_ACHIEVEMENTS.map((achievement) => {
    const unlock = unlockMap.get(achievement.id);
    const conditionResult = checkAchievementCondition(achievement, context);

    return {
      ...achievement,
      isUnlocked: Boolean(unlock),
      unlockedAt: unlock?.unlockedAt,
      progress: conditionResult.progress !== undefined ? {
        current: conditionResult.progress,
        target: conditionResult.target || 0,
        unit: conditionResult.unit || ''
      } : undefined
    };
  });

  return { achievements, stats: buildAchievementStats(achievements) };
}

/** Get achievement statistics for the active company. */
export async function getAchievementStats(): Promise<AchievementStats> {
  return (await getAchievementWorkspace()).stats;
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

