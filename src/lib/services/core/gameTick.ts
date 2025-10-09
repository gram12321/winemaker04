// Game tick service - handles time progression and automatic game events
import { getGameState, updateGameState } from './gameState';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { generateSophisticatedWineOrders } from '../sales/salesOrderService';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { progressActivities } from '../activity/activitymanagers/activityManager';
import { updateVineyardRipeness, updateVineyardAges, updateVineyardVineYields } from '../vineyard/vineyardManager';
import { checkAndTriggerBookkeeping } from '../activity/activitymanagers/bookkeepingManager';
import { processWeeklyFermentation } from '../wine/winery/fermentationManager';
import { processSeasonalWages } from '../user/wageService';
import { getAllStaff } from '../user/staffService';

/**
 * Enhanced time advancement with automatic game events
 * This replaces the simple incrementWeek() function with a more sophisticated system
 */
export const processGameTick = async (): Promise<void> => {
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
      await notificationService.addMessage(`A new year has begun! Welcome to ${currentYear}!`, 'gameTick.newYear', 'New Year Events', 'time & calendar');
    }
    
    // Process season change
    await onSeasonChange(previousSeason, season);
    await notificationService.addMessage(`The season has changed to ${season}!`, 'gameTick.seasonChange', 'Season Changes', 'time & calendar');
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
  
  // Log the time advancement
  await notificationService.addMessage(`Time advanced to Week ${week}, ${season}, ${currentYear}`, 'gameTick.timeAdvancement', 'Time Advancement', 'time & calendar');
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
 */
const processWeeklyEffects = async (): Promise<void> => {
  const gameState = getGameState();
  const currentWeek = gameState.week || 1;
  
  // Weekly decay is now handled by the unified prestige hook
  // No need to call decay functions here

  // Enhanced automatic customer acquisition and sophisticated order generation
  try {
    const result = await generateSophisticatedWineOrders(); // Generate customer event and orders
    
    if (result.totalOrdersCreated > 0) {
      console.log(`[Weekly Orders] Generated ${result.totalOrdersCreated} orders from ${result.customersGenerated} customers`);
      
      // Show summary notification for significant activity
      if (result.totalOrdersCreated > 1) {
        const totalValue = result.orders.reduce((sum, order) => sum + order.totalValue, 0);
        await notificationService.addMessage(`${result.totalOrdersCreated} new orders received from ${result.customersGenerated} customers (€${totalValue.toFixed(2)})`, 'gameTick.orderGeneration', 'Order Generation', 'sales & orders');
      } else if (result.orders.length > 0) {
        const order = result.orders[0];
        await notificationService.addMessage(`New order received: ${order.wineName} from ${order.customerName} (${order.customerCountry})`, 'gameTick.orderGeneration', 'Order Generation', 'sales & orders');
      }
    }
  } catch (error) {
    console.warn('Error during sophisticated order generation:', error);
    // No fallback - sophisticated system is the only system now
  }
  
  // Process weekly fermentation effects for all fermenting batches
  try {
    await processWeeklyFermentation();
  } catch (error) {
    console.warn('Error during weekly fermentation processing:', error);
  }
  
  // Process seasonal wage payments (at the start of each season - week 1)
  if (currentWeek === 1) {
    try {
      const staff = getAllStaff();
      await processSeasonalWages(staff);
    } catch (error) {
      console.warn('Error during seasonal wage processing:', error);
    }
  }
  
  // TODO: Add other weekly effects when ready
  // - Bottle Wine aging effects. Oxidation risk. Maybe some small risk of oxidation everygametick, higher in different stages (HIgher doing must_fermenting, than doing bottle_aging. ) We could do something like the v1, with a 0-1 value that increment doing wineprogression.
};

