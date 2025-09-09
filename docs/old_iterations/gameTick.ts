/**
 * GameTick System
 * Handles progression of game time (weeks, seasons, years)
 * and applies relevant changes to game state
 */

import { getGameState, updateGameState, updatePlayerMoney } from '@/gameState';
import { consoleService } from '@/components/layout/Console';
import { saveGameState } from '@/lib/database/gameStateDB';
import { Vineyard } from './vineyard';
import displayManager from './displayManager';
import { processActivitiesTick } from './activityManager';
import { Season, SEASONS, WEEKS_PER_SEASON, STARTING_WEEK, STARTING_SEASON, STARTING_YEAR, RIPENESS_INCREASE, ORGANIC_CERTIFICATION_YEARS, ORGANIC_HEALTH_IMPROVEMENT } from '@/lib/core/constants';

/**
 * Initialize game time with default values if not present
 */
export const initializeGameTime = () => {
  const gameState = getGameState();
  
  if (!gameState.week || !gameState.season) {
    updateGameState({
      week: STARTING_WEEK,
      season: STARTING_SEASON,
      currentYear: gameState.currentYear || STARTING_YEAR
    });
    
    consoleService.info(`Game time initialized: Week ${STARTING_WEEK}, ${STARTING_SEASON}, ${gameState.currentYear}`);
    displayManager.updateAllDisplays();
  }
};

/**
 * Increment the week and handle season/year changes
 * @returns The updated game state
 */
export const incrementWeek = async (): Promise<ReturnType<typeof getGameState>> => {
  const gameState = getGameState();
  let { week = STARTING_WEEK, season = STARTING_SEASON, currentYear = STARTING_YEAR } = gameState;
  let currentSeasonIndex = SEASONS.indexOf(season);
  
  // Pre-tick processing
  processActivitiesTick();
  
  // Increment the week
  week += 1;
  
  // Check if the week exceeds WEEKS_PER_SEASON, which indicates a change of season
  if (week > WEEKS_PER_SEASON) {
    week = 1;
    currentSeasonIndex = (currentSeasonIndex + 1) % SEASONS.length;
    season = SEASONS[currentSeasonIndex];
    
    // If we're at the start of Spring, increment the year
    if (currentSeasonIndex === 0) {
      currentYear += 1;
      onNewYear(); // Call new year logic BEFORE season change logic for the new year
    }
    
    // Season change processing
    onSeasonChange(season);
  }
  
  // Update game state with new time values
  updateGameState({
    week,
    season,
    currentYear
  });
  
  // Log the change to console
  consoleService.info(`Advanced to: Week ${week}, ${season}, ${currentYear}`);
  
  // Process gameplay effects for the new week
  processWeekEffects();
  
  // Process financial transactions
  // TODO: Implement recurring transactions
  
  // Update all UI components
  displayManager.updateAllDisplays();
  
  // Save the game state after each tick
  await saveGameState();
  
  return getGameState();
};

/**
 * Handle effects that happen on season change
 * @param newSeason The season that just started
 */
const onSeasonChange = (newSeason: Season) => {
  consoleService.info(`The season has changed to ${newSeason}!`);
  
  const gameState = getGameState();
  let updatedVineyards = [...gameState.vineyards]; // Create a mutable copy
  
  // Different effects based on the new season
  switch (newSeason) {
    case 'Spring':
      consoleService.info("Spring has arrived. Time to prepare for planting!");
      // Update planted vineyards from dormancy/first year to growing
      updatedVineyards = updatedVineyards.map(vineyard => {
        if (vineyard.grape && (vineyard.status === 'Dormancy' || vineyard.status === 'No yield in first season')) {
          return {
            ...vineyard,
            status: 'Growing',
            ripeness: 0 // Reset ripeness at the start of spring
          };
        }
        return vineyard;
      });
      break;

    case 'Summer':
      consoleService.info("Summer heat is affecting your vineyards.");
      // Update growing vineyards to ripening (only if older than 0 years)
      updatedVineyards = updatedVineyards.map(vineyard => {
        if (vineyard.grape && vineyard.status === 'Growing' && vineyard.vineAge > 0) {
          return {
            ...vineyard,
            status: 'Ripening'
          };
        }
        return vineyard;
      });
      // Apply ripeness increase (handled in processWeekEffects)
      break;

    case 'Fall':
      consoleService.info("Fall has come. Harvest season approaches!");
      // Update ripening vineyards to ready for harvest (only if older than 0 years)
      updatedVineyards = updatedVineyards.map(vineyard => {
        if (vineyard.grape && vineyard.status === 'Ripening' && vineyard.vineAge > 0) {
          return {
            ...vineyard,
            status: 'Ready for Harvest'
          };
        }
        return vineyard;
      });
       // Apply ripeness increase (handled in processWeekEffects)
      break;

    case 'Winter':
      consoleService.info("Winter has arrived. Vineyards enter dormancy.");
      // Set all planted vineyards to dormancy or first-year status and reset ripeness
      updatedVineyards = updatedVineyards.map(vineyard => {
        if (vineyard.grape) {
          // Preserve harvest/planting progress status
          if (vineyard.status.includes('Harvesting') || vineyard.status.includes('Planting')) {
            return {
              ...vineyard,
              ripeness: 0 // Reset ripeness even if activity is ongoing
            };
          }
          // Set to Dormancy or First Year status
          return {
            ...vineyard,
            status: vineyard.vineAge === 0 ? 'No yield in first season' : 'Dormancy',
            ripeness: 0
          };
        }
        return vineyard;
      });
      break;
  }
  // Update game state only once after all modifications
  updateGameState({ vineyards: updatedVineyards });
};

/**
 * Handle effects that happen at the start of a new year
 */
const onNewYear = () => {
  consoleService.info("A new year has begun!");
  
  const gameState = getGameState();
  
  // Update vineyard age and annual factors
  const updatedVineyards = gameState.vineyards.map(vineyard => {
    // Skip non-planted vineyards
    if (!vineyard.grape) {
      return vineyard;
    }
    
    // Create new vineyard object with updated values
    const updatedVineyard: Vineyard = {
      ...vineyard,
      vineAge: vineyard.vineAge + 1,
      // Keep existing random calculation for factors, can be refined later
      annualYieldFactor: (0.75 + Math.random()),
      annualQualityFactor: Math.random(),
      remainingYield: null, // Reset remaining yield at the start of the year
      // Reset completed clearing tasks for the new year
      completedClearingTasks: [], 
      // Status update for first-year vineyards happens in Spring season change
      // status: vineyard.status === 'No yield in first season' ? 'Growing' : vineyard.status
    };
    
    // Handle organic farming progression
    if (vineyard.farmingMethod === 'Non-Conventional' || vineyard.farmingMethod === 'Ecological') {
      updatedVineyard.organicYears = (vineyard.organicYears || 0) + 1;
      
      // Convert to ecological after required years
      if (updatedVineyard.farmingMethod === 'Non-Conventional' && updatedVineyard.organicYears >= ORGANIC_CERTIFICATION_YEARS) {
        updatedVineyard.farmingMethod = 'Ecological';
        consoleService.info(`${vineyard.name} is now certified Ecological after ${updatedVineyard.organicYears} years of organic farming!`);
      }
      
      // Organic farming improves vineyard health
      updatedVineyard.vineyardHealth = Math.min(1.0, vineyard.vineyardHealth + ORGANIC_HEALTH_IMPROVEMENT);
    } else {
      // Reset organic years if conventional
      updatedVineyard.organicYears = 0;
    }
    
    return updatedVineyard;
  });
  
  // Update game state with updated vineyards
  updateGameState({
    vineyards: updatedVineyards
  });
  
  // TODO: Process yearly financial summary
};

/**
 * Process effects that happen every week
 */
const processWeekEffects = () => {
  const gameState = getGameState();
  const { week, season } = gameState;
  
  // Update vineyard ripeness based on season
  const ripenessIncrease = RIPENESS_INCREASE[season];
  
  if (ripenessIncrease > 0) {
    updateVineyardRipeness(ripenessIncrease);
  }
  
  // TODO: Process random events based on week/season
  
  // TODO: Generate wine orders or contracts
};

/**
 * Update the ripeness of all planted vineyards
 * @param amount Amount to increase ripeness by
 */
const updateVineyardRipeness = (amount: number) => {
  const gameState = getGameState();
  
  // Update ripeness for vineyards that are planted and growing/ripening
  const updatedVineyards = gameState.vineyards.map(vineyard => {
    if (!vineyard.grape) return vineyard;

    // Allow ripening during relevant statuses, including ongoing activities
    const canRipen = [
      'Growing',
      'Ripening',
      'Ready for Harvest'
    ].includes(vineyard.status) || vineyard.status.includes('Harvesting:') || vineyard.status.includes('Planting:');

    if (canRipen) {
      const newRipeness = Math.min(1.0, vineyard.ripeness + amount);
      return {
        ...vineyard,
        ripeness: newRipeness
      };
    }
    return vineyard;
  });
  
  // Update game state with updated vineyards
  updateGameState({
    vineyards: updatedVineyards
  });
}; 