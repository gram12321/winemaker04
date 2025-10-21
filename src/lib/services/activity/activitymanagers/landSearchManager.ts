import { Activity, WorkCategory, NotificationCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '../../core/gameState';
import { createActivity } from './activityManager';
import { notificationService, addTransaction, calculateLandSearchCost, generateVineyardSearchResults, LandSearchOptions } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateLandSearchWork } from '../workcalculators/landSearchWorkCalculator';

/**
 * Start a land search activity
 */
export async function startLandSearch(options: LandSearchOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    const searchCost = calculateLandSearchCost(options, gameState.prestige || 0);
    const { totalWork } = calculateLandSearchWork(options, gameState.prestige || 0);
    
    // Check if we have enough money
    const currentMoney = gameState.money || 0;
    if (currentMoney < searchCost) {
      await notificationService.addMessage(
        `Insufficient funds for land search. Need €${searchCost.toFixed(2)}, have €${currentMoney.toFixed(2)}`,
        'landSearchManager.startLandSearch',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      return null;
    }
    
    // Deduct search cost immediately
    await addTransaction(
      -searchCost,
      `Land search for ${options.numberOfOptions} propert${options.numberOfOptions > 1 ? 'ies' : 'y'} (${options.regions.length > 0 ? options.regions.join(', ') : 'all regions'})`,
      TRANSACTION_CATEGORIES.LAND_SEARCH,
      false
    );
    
    // Create the search activity
    const regionText = options.regions.length > 0 ? ` in ${options.regions.join(', ')}` : '';
    const title = `Land Search${regionText}`;
    
    const activityId = await createActivity({
      category: WorkCategory.LAND_SEARCH,
      title,
      totalWork,
      params: {
        searchOptions: options,
        searchCost,
        companyPrestige: gameState.prestige
      },
      isCancellable: true
    });
    
    if (activityId) {
      await notificationService.addMessage(
        `Land search started! Cost: €${searchCost.toFixed(2)}`,
        'landSearchManager.startLandSearch',
        'Land Search Started',
        NotificationCategory.ACTIVITIES_TASKS
      );
    }
    
    return activityId;
  } catch (error) {
    console.error('Error starting land search:', error);
    return null;
  }
}

/**
 * Complete land search activity
 */
export async function completeLandSearch(activity: Activity): Promise<void> {
  try {
    const searchOptions = activity.params.searchOptions as LandSearchOptions;
    const companyPrestige = activity.params.companyPrestige as number;
    
    if (!searchOptions) {
      console.error('No search options found in activity params');
      return;
    }
    
    // Generate results based on search parameters
    const results = generateVineyardSearchResults(searchOptions, companyPrestige);
    
    // Store results in game state for modal to access
    updateGameState({
      pendingLandSearchResults: {
        activityId: activity.id,
        options: results,
        searchOptions,
        timestamp: Date.now()
      }
    });
    
    await notificationService.addMessage(
      `Land search complete! Found ${results.length} propert${results.length > 1 ? 'ies' : 'y'} matching your criteria.`,
      'landSearchManager.completeLandSearch',
      'Land Search Complete',
      NotificationCategory.ACTIVITIES_TASKS
    );
  } catch (error) {
    console.error('Error completing land search:', error);
    await notificationService.addMessage(
      `Land search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'landSearchManager.completeLandSearch',
      'Land Search Failed',
      NotificationCategory.ACTIVITIES_TASKS
    );
  }
}

/**
 * Clear pending land search results
 */
export function clearPendingLandSearchResults(): void {
  updateGameState({
    pendingLandSearchResults: undefined
  });
}
