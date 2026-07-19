import { Activity, WorkCategory, NotificationCategory } from '@/lib/types/types';
import { getGameState, updateGameState } from '../../core/gameState';
import { createActivity } from './activityManager';
import { notificationService, addTransaction, calculateLandSearchCost, generateVineyardSearchResults, LandSearchOptions, getAllVineyards } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateLandSearchWork } from '../workcalculators/landSearchWorkCalculator';
import { formatNumber } from '@/lib/utils/utils';
import {
  buildVineyardCapacityState,
  getLandSearchPenaltyReferenceRangeFromCapacity,
  getMaxSearchableHectares,
  MIN_SEARCHABLE_HECTARES
} from '@/lib/services/vineyard/vineyardCapacityService';
import { researchUpgradeFeature } from '@/lib/features/researchUpgrade';

/**
 * Start a land search activity
 */
export async function startLandSearch(options: LandSearchOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    const [vineyards, unlockedPerVineyardValues, unlockedTotalHectareValues, unlockedVineyardCountValues] = await Promise.all([
      getAllVineyards(),
      researchUpgradeFeature.unlocks.getUnlockedItems('vineyard_size'),
      researchUpgradeFeature.unlocks.getUnlockedItems('total_vineyard_hectares'),
      researchUpgradeFeature.unlocks.getUnlockedItems('vineyard_count')
    ]);

    const vineyardCapacity = buildVineyardCapacityState({
      currentTotalHectares: vineyards.reduce((sum, vineyard) => sum + (vineyard.hectares || 0), 0),
      currentVineyardCount: vineyards.length,
      unlockedPerVineyardValues,
      unlockedTotalHectareValues,
      unlockedVineyardCountValues
    });

    const safeMaxSearchableHectares = Math.max(MIN_SEARCHABLE_HECTARES, getMaxSearchableHectares(vineyardCapacity));
    const normalizedMinHectares = Math.min(options.hectareRange[0], safeMaxSearchableHectares);
    const normalizedMaxHectares = Math.min(options.hectareRange[1], safeMaxSearchableHectares);

    const normalizedOptions: LandSearchOptions = {
      ...options,
      hectareRange: [
        Math.min(normalizedMinHectares, normalizedMaxHectares),
        Math.max(normalizedMinHectares, normalizedMaxHectares)
      ],
      hectarePenaltyReferenceRange: getLandSearchPenaltyReferenceRangeFromCapacity(vineyardCapacity)
    };

    const searchCost = calculateLandSearchCost(normalizedOptions, gameState.prestige || 0);
    const { totalWork } = calculateLandSearchWork(normalizedOptions, gameState.prestige || 0);

    // Check if we have enough money
    const currentMoney = gameState.money || 0;
    if (currentMoney < searchCost) {
      await notificationService.addMessage(
        `Insufficient funds for land search. Need ${formatNumber(searchCost, { currency: true, decimals: 2 })}, have ${formatNumber(currentMoney, { currency: true, decimals: 2 })}`,
        'landSearchManager.startLandSearch',
        'Insufficient Funds',
        NotificationCategory.FINANCE_AND_STAFF
      );
      return null;
    }

    // Deduct search cost immediately
    await addTransaction(
      -searchCost,
      `Land search for ${normalizedOptions.numberOfOptions} propert${normalizedOptions.numberOfOptions > 1 ? 'ies' : 'y'} (${normalizedOptions.regions.length > 0 ? normalizedOptions.regions.join(', ') : 'all regions'})`,
      TRANSACTION_CATEGORIES.LAND_SEARCH,
      false
    );

    // Create the search activity
    const title = 'Land Search';

    const activityId = await createActivity({
      category: WorkCategory.LAND_SEARCH,
      title,
      totalWork,
      activityDetails: `Cost: ${formatNumber(searchCost, { currency: true, decimals: 2 })}`,
      params: {
        searchOptions: normalizedOptions,
        searchCost,
        companyPrestige: gameState.prestige
      },
      isCancellable: true
    });

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
