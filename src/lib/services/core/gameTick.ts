// Game tick service - handles time progression and automatic game events
import { getGameState, updateGameState } from './gameState';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { generateSophisticatedWineOrders } from '../sales/salesOrderService';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { NotificationCategory } from '../../../lib/types/types';
import { progressActivities } from '../activity/activitymanagers/activityManager';
import { updateVineyardRipeness, updateVineyardAges, updateVineyardVineYields, updateVineyardHealthDegradation } from '../vineyard/vineyardManager';
import { checkAndTriggerBookkeeping } from '../activity/activitymanagers/bookkeepingManager';
import { processWeeklyFermentation } from '../wine/winery/fermentationManager';
import { processSeasonalWages } from '../user/wageService';
import { getAllStaff } from '../user/staffService';
import { processWeeklyFeatureRisks } from '../wine/features/featureRiskService';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { updateCellarCollectionPrestige } from '../prestige/prestigeService';
import { loadWineBatches, bulkUpdateWineBatches } from '../../database/activities/inventoryDB';
import { checkAllAchievements } from '../user/achievementService';
import { calculateAbsoluteWeeks } from '../../utils/utils';

// Prevent concurrent game tick execution
let isProcessingGameTick = false;

// Throttle configuration for expensive, non-critical checks
const ACHIEVEMENT_CHECK_INTERVAL_WEEKS = 4; // run every 4 weeks
let lastAchievementCheckAbsoluteWeek = -1;

/**
 * Enhanced time advancement with automatic game events
 * This replaces the simple incrementWeek() function with a more sophisticated system
 * Includes protection against concurrent execution to prevent race conditions
 */
export const processGameTick = async (): Promise<void> => {
  // Prevent concurrent execution - if already processing, return early
  if (isProcessingGameTick) {
    console.warn('Game tick already in progress, skipping duplicate call to prevent race conditions');
    return;
  }

  try {
    isProcessingGameTick = true;
    await executeGameTick();
  } finally {
    isProcessingGameTick = false;
  }
};

/**
 * Internal function that performs the actual game tick logic
 */
const executeGameTick = async (): Promise<void> => {
  const currentState = getGameState();
  let { 
    week = GAME_INITIALIZATION.STARTING_WEEK, 
    season = GAME_INITIALIZATION.STARTING_SEASON, 
    currentYear = GAME_INITIALIZATION.STARTING_YEAR 
  } = currentState;
  
  const previousSeason = season;
  const previousYear = currentYear;
  
  // Increment week
  week += 1;
  
  // Check if season changes (every 12 weeks)
  if (week > 12) {
    week = 1;
    const currentSeasonIndex = ['Spring', 'Summer', 'Fall', 'Winter'].indexOf(season);
    const nextSeasonIndex = (currentSeasonIndex + 1) % 4;
    season = ['Spring', 'Summer', 'Fall', 'Winter'][nextSeasonIndex] as 'Spring' | 'Summer' | 'Fall' | 'Winter';
    
    // If we're back to Spring, increment year
    if (season === 'Spring') {
      currentYear += 1;
      await onNewYear(previousYear, currentYear);
      await notificationService.addMessage(`A new year has begun! Welcome to ${currentYear}!`, 'time.newYear', 'New Year Events', NotificationCategory.TIME_CALENDAR);
    }
    
    // Process season change
    await onSeasonChange(previousSeason, season);
    await notificationService.addMessage(`The season has changed to ${season}!`, 'time.seasonChange', 'Season Changes', NotificationCategory.TIME_CALENDAR);
  }
  
  // Update game state with new time values
  await updateGameState({ week, season, currentYear });
  
  // Progress all activities based on assigned staff work contribution
  await progressActivities();
  
  // Check for bookkeeping activity creation (week 1 of any season)
  await checkAndTriggerBookkeeping();
  
  // Process weekly effects
  await processWeeklyEffects();
  
  // Update vineyard ripeness and status based on current season and week
  await updateVineyardRipeness(season, week);
  
  // Apply health degradation to vineyards
  await updateVineyardHealthDegradation(season, week);
  
  // Log the time advancement
  await notificationService.addMessage(`Time advanced to Week ${week}, ${season}, ${currentYear}`, 'time.advancement', 'Time Advancement', NotificationCategory.TIME_CALENDAR);
  
  // Trigger final UI refresh after all weekly effects are processed
  // This ensures components reload data that was updated during processWeeklyEffects()
  // (e.g., wine batch feature risks, fermentation progress, etc.)
  triggerGameUpdate();
};

/**
 * Handle effects that happen on season change
 */
const onSeasonChange = async (_previousSeason: string, _newSeason: string): Promise<void> => {
  // Season change notification is handled in the main processGameTick function
  // TODO: Add seasonal effects when vineyard system is ready
};

/**
 * Handle effects that happen at the start of a new year
 */
const onNewYear = async (_previousYear: number, _newYear: number): Promise<void> => {
  // New year notification is handled in the main processGameTick function
  
  // Update vineyard ages
  await updateVineyardAges();
  
  // Update vineyard vine yields
  await updateVineyardVineYields();
  
  // TODO: Add other yearly effects when ready
  // - Annual financial summaries
  // - Prestige adjustments
};


/**
 * Process effects that happen every week
 * OPTIMIZED: Runs independent operations in parallel
 */
const processWeeklyEffects = async (): Promise<void> => {
  const gameState = getGameState();
  const currentWeek = gameState.week || 1;
  
  // Weekly decay is now handled by the unified prestige hook
  // No need to call decay functions here

  // OPTIMIZATION: Run all independent weekly operations in parallel
  // These operations don't depend on each other and can execute concurrently
  const weeklyTasks = [
    // Enhanced automatic customer acquisition and sophisticated order generation
    (async () => {
      try {
        const result = await generateSophisticatedWineOrders();
        
        if (result.totalOrdersCreated > 0) {
          console.log(`[Weekly Orders] Generated ${result.totalOrdersCreated} orders from ${result.customersGenerated} customers`);
          
          // Show summary notification for significant activity
          if (result.totalOrdersCreated > 1) {
            const totalValue = result.orders.reduce((sum, order) => sum + order.totalValue, 0);
            await notificationService.addMessage(`${result.totalOrdersCreated} new orders received from ${result.customersGenerated} customers (€${totalValue.toFixed(2)})`, 'sales.orders', 'New Orders', NotificationCategory.SALES_ORDERS);
          } else if (result.orders.length > 0) {
            const order = result.orders[0];
            await notificationService.addMessage(`New order received: ${order.wineName} from ${order.customerName} (${order.customerCountry})`, 'sales.orders', 'New Orders', NotificationCategory.SALES_ORDERS);
          }
        }
      } catch (error) {
        console.warn('Error during sophisticated order generation:', error);
      }
    })(),
    
    // Process weekly fermentation effects for all fermenting batches
    (async () => {
      try {
        await processWeeklyFermentation();
      } catch (error) {
        console.warn('Error during weekly fermentation processing:', error);
      }
    })(),
    
    // Process weekly feature risks for all wine batches (oxidation, terroir, etc.)
    (async () => {
      try {
        await processWeeklyFeatureRisks();
      } catch (error) {
        console.warn('Error during weekly feature risk processing:', error);
      }
    })(),
    
    // Update aging progress for all bottled wines
    (async () => {
      try {
        await updateBottledWineAging();
      } catch (error) {
        console.warn('Error during wine aging progress update:', error);
      }
    })(),
    
    // Update cellar collection prestige (permanent event recalculation)
    (async () => {
      try {
        await updateCellarCollectionPrestige();
      } catch (error) {
        console.warn('Error during cellar collection prestige update:', error);
      }
    })()
  ];
  
  // Throttled, non-blocking achievement checks (decoupled from tick critical path)
  try {
    const absWeek = calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!);
    const shouldRunAchievements =
      lastAchievementCheckAbsoluteWeek < 0 ||
      absWeek - lastAchievementCheckAbsoluteWeek >= ACHIEVEMENT_CHECK_INTERVAL_WEEKS;

    if (shouldRunAchievements) {
      lastAchievementCheckAbsoluteWeek = absWeek;
      // Fire-and-forget; do not await to keep tick latency low
      void (async () => {
        try {
          await checkAllAchievements();
        } catch (error) {
          console.warn('Error during throttled achievement checking:', error);
        }
      })();
    }
  } catch (error) {
    console.warn('Failed to schedule achievement checks:', error);
  }

  // Process seasonal wage payments (at the start of each season - week 1)
  if (currentWeek === 1) {
    weeklyTasks.push(
      (async () => {
        try {
          const staff = getAllStaff();
          await processSeasonalWages(staff);
        } catch (error) {
          console.warn('Error during seasonal wage processing:', error);
        }
      })()
    );
  }
  
  // OPTIMIZATION: Wait for all tasks to complete in parallel
  await Promise.all(weeklyTasks);
};

/**
 * Update aging progress for all bottled wines
 * Increments agingProgress by 1 week for each wine in bottled state
 * OPTIMIZED: Uses bulk update instead of individual saves
 */
async function updateBottledWineAging(): Promise<void> {
  const batches = await loadWineBatches();
  const bottledWines = batches.filter(batch => batch.state === 'bottled');
  
  if (bottledWines.length === 0) return;
  
  // OPTIMIZATION: Collect all updates for bulk operation
  const updates = bottledWines.map(batch => ({
    id: batch.id,
    updates: {
      agingProgress: (batch.agingProgress || 0) + 1
    }
  }));
  
  // OPTIMIZATION: Single bulk update instead of N individual saves
  await bulkUpdateWineBatches(updates);
};

