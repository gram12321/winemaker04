import { getGameState, updateGameState, getCurrentCompany } from '@/lib/services';
import { generateSophisticatedWineOrders, notificationService, progressActivities, checkAndTriggerBookkeeping, processEconomyPhaseTransition, processSeasonalLoanPayments, highscoreService, checkAllAchievements, updateCellarCollectionPrestige, calculateNetWorth, updateVineyardRipeness, updateVineyardAges, updateVineyardVineYields, updateVineyardHealthDegradation, getAllStaff, processWeeklyFeatureRisks, processWeeklyFermentation, processSeasonalWages, enforceEmergencyQuickLoanIfNeeded, restructureForcedLoansIfNeeded } from '@/lib/services';
import { applyFeatureEffectsToBatch } from '@/lib/services/wine/features/featureService';
import { triggerGameUpdate } from '@/hooks/useGameUpdates';
import { NotificationCategory, calculateAbsoluteWeeks, hasMinimizedModals, restoreAllMinimizedModals } from '@/lib/utils';
import { GAME_INITIALIZATION, SEASON_ORDER, WEEKS_PER_SEASON } from '@/lib/constants';
import { WineBatch } from '@/lib/types/types';
import { bulkUpdateWineBatches, loadWineBatches } from '@/lib/database/activities/inventoryDB';

// Prevent concurrent game tick execution
let isProcessingGameTick = false;

// Throttle configuration for expensive, non-critical checks
const ACHIEVEMENT_CHECK_INTERVAL_WEEKS = 4; // run every 4 weeks
let lastAchievementCheckAbsoluteWeek = -1;

/**
 * Enhanced time advancement with automatic game events
 * This replaces the simple incrementWeek() function with a more sophisticated system
 * Includes protection against concurrent execution to prevent race conditions
 * Also prevents time advancement when modals are minimized
 */
export const processGameTick = async (): Promise<void> => {
  // Prevent concurrent execution - if already processing, return early
  if (isProcessingGameTick) {
    console.warn('Game tick already in progress, skipping duplicate call to prevent race conditions');
    return;
  }

  // Block time advancement if modals are minimized - restore them but don't advance time
  if (hasMinimizedModals()) {
    restoreAllMinimizedModals();
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
let newSeason: string | undefined;
  let economyPhaseMessage: string | null = null;
  
  // Increment week
  week += 1;
  
  // Check if season changes (every WEEKS_PER_SEASON weeks)
  if (week > WEEKS_PER_SEASON) {
    week = 1;
    const currentSeasonIndex = SEASON_ORDER.indexOf(season);
    const nextSeasonIndex = (currentSeasonIndex + 1) % SEASON_ORDER.length;
    season = SEASON_ORDER[nextSeasonIndex];
    newSeason = season; // Store the new season for combined notification
    
    // If we're back to Spring, increment year
    if (season === 'Spring') {
      currentYear += 1;
      await onNewYear(previousYear, currentYear);
      await notificationService.addMessage(`A new year has begun! Welcome to ${currentYear}!`, 'time.newYear', 'New Year Events', NotificationCategory.TIME_CALENDAR);
    }
    
    // Process season change (collect economy phase notification if season changed)
    economyPhaseMessage = await onSeasonChange(previousSeason, season, true);
    // Season change notification will be combined with bookkeeping notification below
  }
  
  // Update game state with new time values
  await updateGameState({ week, season, currentYear });
  
  // Progress all activities based on assigned staff work contribution
  await progressActivities();
  
  // Process weekly effects (wage payment will be handled here, but we'll suppress it if season changed)
  const wageMessage = await processWeeklyEffects(!!newSeason);
  
  // Check for bookkeeping activity creation (week 1 of any season)
  // Pass season change info and all collected messages if we just changed seasons
  await checkAndTriggerBookkeeping(newSeason, economyPhaseMessage, wageMessage);
  
  // Update vineyard ripeness and status based on current season and week
  await updateVineyardRipeness(season, week);
  
  // Apply health degradation to vineyards
  await updateVineyardHealthDegradation(season, week);
  
  // Log the time advancement
  await notificationService.addMessage(`Time advanced to Week ${week}, ${season}, ${currentYear}`, 'time.advancement', 'Time Advancement', NotificationCategory.TIME_CALENDAR);

  // Submit highscores for company progress assessment (weekly)
  await submitWeeklyHighscores();

  const isNewYearTick = newSeason === 'Spring' && week === 1;

  if (isNewYearTick) {
    triggerGameUpdate();
    await restructureForcedLoansIfNeeded();
  }

  // Trigger final UI refresh after all weekly effects are processed
  // This ensures components reload data that was updated during processWeeklyEffects()
  // (e.g., wine batch feature risks, fermentation progress, etc.)
  triggerGameUpdate();
};

/**
 * Handle effects that happen on season change
 * @param skipNotification If true, returns notification text instead of sending it
 * @returns Notification message text if economy phase changed (and skipNotification is true), null otherwise
 */
const onSeasonChange = async (_previousSeason: string, _newSeason: string, skipNotification: boolean = false): Promise<string | null> => {
  // Season change notification is handled in the main processGameTick function
  
  // Process economy phase transition
  return await processEconomyPhaseTransition(skipNotification);
  
  // TODO: Add other seasonal effects when vineyard system is ready
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
 * @param suppressWageNotification If true, returns wage notification text instead of sending it
 * @returns Wage notification message text if wages were paid (and suppressWageNotification is true), null otherwise
 */
const processWeeklyEffects = async (suppressWageNotification: boolean = false): Promise<string | null> => {
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
        await generateSophisticatedWineOrders();
        
        // Order notifications are handled inside salesOrderService
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
    
    // Apply feature effects directly to wine batches (modify grapeQuality/balance)
    (async () => {
      try {
        await applyWeeklyFeatureEffects();
      } catch (error) {
        console.warn('Error during weekly feature effect application:', error);
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
  let wageMessage: string | null = null;
  if (currentWeek === 1) {
    // Process wages synchronously if we need to capture the notification
    if (suppressWageNotification) {
      try {
        const staff = getAllStaff();
        wageMessage = await processSeasonalWages(staff, true);
      } catch (error) {
        console.warn('Error during seasonal wage processing:', error);
      }
    } else {
      weeklyTasks.push(
        (async () => {
          try {
            const staff = getAllStaff();
            await processSeasonalWages(staff, false);
          } catch (error) {
            console.warn('Error during seasonal wage processing:', error);
          }
        })()
      );
    }
    
    // Process seasonal loan payments (at the start of each season - week 1)
    weeklyTasks.push(
      (async () => {
        try {
          await processSeasonalLoanPayments();
        } catch (error) {
          console.warn('Error during seasonal loan payments:', error);
        }
      })()
    );
  }
  
  // OPTIMIZATION: Wait for all tasks to complete in parallel
  await Promise.all(weeklyTasks);
  
  try {
    await enforceEmergencyQuickLoanIfNeeded();
  } catch (error) {
    console.warn('Error enforcing emergency quick loan:', error);
  }
  
  return wageMessage;
};

/**
 * Apply feature effects directly to wine batches
 * Updates grapeQuality and balance based on present features
 * Called after processWeeklyFeatureRisks to ensure features are up-to-date
 * Skips sold-out bottled wines (quantity === 0) as they should not continue developing
 */
async function applyWeeklyFeatureEffects(): Promise<void> {
  const batches = await loadWineBatches();
  
  if (batches.length === 0) return;
  
  // Filter out sold-out bottled wines (they should not continue developing)
  const activeBatches = batches.filter(batch => {
    // Skip sold-out bottled wines (they should not continue developing)
    if (batch.state === 'bottled' && batch.quantity === 0) return false;
    return true;
  });
  
  if (activeBatches.length === 0) return;
  
  // Apply feature effects to each active batch
  const updates = activeBatches
    .map(batch => applyFeatureEffectsToBatch(batch))
    .filter((updatedBatch, index) => {
      // Only include batches that actually changed
      const originalBatch = activeBatches[index];
      return updatedBatch.grapeQuality !== originalBatch.grapeQuality || 
             updatedBatch.balance !== originalBatch.balance;
    })
    .map(updatedBatch => ({
      id: updatedBatch.id,
      updates: {
        grapeQuality: updatedBatch.grapeQuality,
        balance: updatedBatch.balance
      }
    }));
  
  if (updates.length > 0) {
    await bulkUpdateWineBatches(updates);
  }
}

/**
 * Update aging progress for all bottled wines
 * Increments agingProgress by 1 week for each wine in bottled state
 * Skips sold-out wines (quantity === 0) as they should not continue developing
 * OPTIMIZED: Uses bulk update instead of individual saves
 */
async function updateBottledWineAging(): Promise<void> {
  const batches = await loadWineBatches();
  // Filter to only bottled wines that still have inventory (quantity > 0)
  const bottledWines = batches.filter((batch: WineBatch) => 
    batch.state === 'bottled' && batch.quantity > 0
  );
  
  if (bottledWines.length === 0) return;
  
  // OPTIMIZATION: Collect all updates for bulk operation
  const updates = bottledWines.map((batch: WineBatch) => ({
    id: batch.id,
    updates: {
      agingProgress: (batch.agingProgress || 0) + 1
    }
  }));
  
  // OPTIMIZATION: Single bulk update instead of N individual saves
  await bulkUpdateWineBatches(updates);
};

/**
 * Submit weekly highscores for company progress assessment
 * This runs at the end of each game tick to assess company performance
 */
async function submitWeeklyHighscores(): Promise<void> {
  try {
    const currentCompany = getCurrentCompany();
    if (!currentCompany) return;

    // Calculate company value using centralized net worth calculation
    const companyValue = await calculateNetWorth();

    // Use the highscoreService method that handles business logic
    await highscoreService.submitCompanyHighscores(
      currentCompany.id,
      currentCompany.name,
      currentCompany.currentWeek || 1,
      currentCompany.currentSeason || 'Spring',
      currentCompany.currentYear || 2024,
      currentCompany.foundedYear,
      companyValue,
      GAME_INITIALIZATION.STARTING_MONEY
    );
  } catch (error) {
    console.error('Failed to submit weekly highscores:', error);
  }
}

