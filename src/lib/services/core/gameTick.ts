// Game tick service - handles time progression and automatic game events
import { getGameState, updateGameState } from './gameState';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { generateSophisticatedWineOrders } from '../sales/salesOrderService';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { progressActivities } from '../activity/activityManager';
import { updateVineyardRipeness, updateVineyardAges, updateVineyardVineYields } from '../wine/vineyardManager';

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
    }
    
    // Process season change
    await onSeasonChange(previousSeason, season);
  }
  
  // Update game state with new time values
  await updateGameState({ week, season, currentYear });
  
  // Progress all activities by 50 work units
  await progressActivities(50);
  
  // Process weekly effects
  await processWeeklyEffects();
  
  // Update vineyard ripeness and status based on current season and week
  await updateVineyardRipeness(season, week);
  
  // Log the time advancement
  notificationService.info(`Time advanced to Week ${week}, ${season}, ${currentYear}`);
};

/**
 * Handle effects that happen on season change
 */
const onSeasonChange = async (_previousSeason: string, newSeason: string): Promise<void> => {

  notificationService.info(`The season has changed to ${newSeason}!`);
  
  // TODO: Add seasonal effects when vineyard system is ready

};

/**
 * Handle effects that happen at the start of a new year
 */
const onNewYear = async (_previousYear: number, newYear: number): Promise<void> => {

  notificationService.info(`A new year has begun! Welcome to ${newYear}!`);
  
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
        notificationService.info(`${result.totalOrdersCreated} new orders received from ${result.customersGenerated} customers (€${totalValue.toFixed(2)})`);
      } else if (result.orders.length > 0) {
        const order = result.orders[0];
        notificationService.info(`New order received: ${order.wineName} from ${order.customerName} (${order.customerCountry})`);
      }
    }
  } catch (error) {
    console.warn('Error during sophisticated order generation:', error);
    // No fallback - sophisticated system is the only system now
  }
  
  // TODO: Add other weekly effects when ready
  // - Wine aging effects
  // - Financial transactions
};

