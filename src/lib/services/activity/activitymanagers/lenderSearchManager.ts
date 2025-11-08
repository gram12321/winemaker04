import { v4 as uuidv4 } from 'uuid';
import { Activity, WorkCategory, NotificationCategory, LenderSearchOptions, LoanOffer } from '@/lib/types/types';
import { getGameState, updateGameState } from '../../core/gameState';
import { createActivity } from './activityManager';
import { notificationService, addTransaction } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { LENDER_TYPE_DISTRIBUTION } from '@/lib/constants/loanConstants';
import { calculateLenderSearchWork, calculateLenderSearchCost } from '../workcalculators/lenderSearchWorkCalculator';
import { loadLenders } from '../../../database/core/lendersDB';
import { calculateLenderAvailability } from '../../finance/lenderService';
import { calculateEffectiveInterestRate, calculateOriginationFee, getCurrentCreditRating } from '../../finance/loanService';
import { triggerGameUpdate } from '@/hooks/useGameUpdates';

/**
 * Start a lender search activity
 */
export async function startLenderSearch(options: LenderSearchOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    const searchCost = calculateLenderSearchCost(options);
    const { totalWork } = calculateLenderSearchWork(options);
    
    // Check if we have enough money (skip for free searches)
    const currentMoney = gameState.money || 0;
    if (searchCost > 0 && currentMoney < searchCost) {
      await notificationService.addMessage(
        `Insufficient funds for lender search. Need €${searchCost.toFixed(2)}, have €${currentMoney.toFixed(2)}`,
        'lenderSearchManager.startLenderSearch',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      return null;
    }
    
    // Deduct search cost immediately (only when cost > 0)
    if (searchCost > 0) {
      await addTransaction(
        -searchCost,
        `Lender search for ${options.numberOfOffers} offer${options.numberOfOffers > 1 ? 's' : ''} (${options.lenderTypes.length > 0 ? options.lenderTypes.join(', ') : 'all types'})`,
        TRANSACTION_CATEGORIES.LENDER_SEARCH,
        false
      );
    }
    
    // Create the search activity
    const title = 'Lender Search';
    
    const activityId = await createActivity({
      category: WorkCategory.LENDER_SEARCH,
      title,
      totalWork,
      activityDetails: searchCost > 0 ? `Cost: €${searchCost.toFixed(2)}` : 'Cost: €0 (QuickLoan fast-track)',
      params: {
        searchOptions: options,
        searchCost
      },
      isCancellable: true
    });
    
    return activityId;
  } catch (error) {
    console.error('Error starting lender search:', error);
    return null;
  }
}

/**
 * Complete lender search activity
 * Generate loan offers from available lenders
 */
export async function completeLenderSearch(activity: Activity): Promise<void> {
  try {
    const searchOptions = activity.params.searchOptions as LenderSearchOptions;
    
    if (!searchOptions) {
      console.error('No search options found in activity params');
      return;
    }
    
    // Generate loan offers
    const offers = await generateLoanOffers(searchOptions);
    
    // Store results in game state for modal to access
    updateGameState({
      pendingLenderSearchResults: {
        activityId: activity.id,
        offers,
        searchOptions,
        timestamp: Date.now()
      }
    });
    
    // Trigger UI update to open results modal
    triggerGameUpdate();
    
    const availableCount = offers.filter(o => o.isAvailable).length;
    
    await notificationService.addMessage(
      `Lender search complete! Found ${availableCount} of ${offers.length} lender${offers.length > 1 ? 's' : ''} willing to offer loans.`,
      'lenderSearchManager.completeLenderSearch',
      'Lender Search Complete',
      NotificationCategory.ACTIVITIES_TASKS
    );
  } catch (error) {
    console.error('Error completing lender search:', error);
    await notificationService.addMessage(
      `Lender search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'lenderSearchManager.completeLenderSearch',
      'Lender Search Failed',
      NotificationCategory.ACTIVITIES_TASKS
    );
  }
}

/**
 * Generate loan offers from available lenders
 */
async function generateLoanOffers(options: LenderSearchOptions): Promise<LoanOffer[]> {
  const gameState = getGameState();
  const allLenders = await loadLenders();
  
  // Filter by lender types if specified
  let eligibleLenders = allLenders;
  const totalLenderTypes = Object.keys(LENDER_TYPE_DISTRIBUTION).length;
  if (options.lenderTypes.length > 0 && options.lenderTypes.length < totalLenderTypes) {
    eligibleLenders = allLenders.filter(lender => options.lenderTypes.includes(lender.type));
  }
  
  // Randomly select lenders
  const numberOfOffers = Math.min(options.numberOfOffers, eligibleLenders.length);
  const shuffled = [...eligibleLenders].sort(() => Math.random() - 0.5);
  const selectedLenders = shuffled.slice(0, numberOfOffers);
  
  // Get current credit rating
  const creditRating = await getCurrentCreditRating();
  
  // Generate offers
  const offers: LoanOffer[] = [];
  
  for (const lender of selectedLenders) {
    // Check if lender is available (credit check)
    const availability = calculateLenderAvailability(lender, creditRating * 100, gameState.prestige || 0);
    
    // Generate random loan parameters within lender's ranges AND user constraints
    const minAmount = Math.max(lender.minLoanAmount, options.loanAmountRange[0]);
    const maxAmount = Math.min(lender.maxLoanAmount, options.loanAmountRange[1]);
    const minDuration = Math.max(lender.minDurationSeasons, options.durationRange[0]);
    const maxDuration = Math.min(lender.maxDurationSeasons, options.durationRange[1]);
    
    // Check if there's any overlap between lender ranges and user constraints
    if (minAmount > maxAmount || minDuration > maxDuration) {
      // No overlap - skip this lender
      continue;
    }
    
    const principalAmount = Math.round(
      minAmount + Math.random() * (maxAmount - minAmount)
    );
    
    const durationSeasons = Math.round(
      minDuration + Math.random() * (maxDuration - minDuration)
    );
    
    // Calculate loan terms
    const effectiveRate = calculateEffectiveInterestRate(
      lender.baseInterestRate,
      gameState.economyPhase || 'Stable',
      lender.type,
      creditRating,
      durationSeasons
    );
    
    const seasonalPayment = calculateSeasonalPayment(principalAmount, effectiveRate, durationSeasons);
    const originationFee = calculateOriginationFee(principalAmount, lender, creditRating, durationSeasons);
    const totalInterest = (seasonalPayment * durationSeasons) - principalAmount;
    const totalExpenses = originationFee + totalInterest;
    
    offers.push({
      id: uuidv4(),
      lender,
      principalAmount,
      durationSeasons,
      effectiveInterestRate: effectiveRate,
      seasonalPayment,
      originationFee,
      totalInterest,
      totalExpenses,
      isAvailable: availability.isAvailable && !lender.blacklisted,
      unavailableReason: lender.blacklisted 
        ? 'Blacklisted due to previous default' 
        : !availability.isAvailable 
          ? `Credit rating too low (need ${Math.round(availability.adjustedRequirement)}%, have ${Math.round(creditRating * 100)}%)` 
          : undefined
    });
  }
  
  return offers;
}

/**
 * Calculate seasonal payment using loan amortization
 */
function calculateSeasonalPayment(principal: number, rate: number, seasons: number): number {
  if (rate === 0) {
    return principal / seasons;
  }
  return principal * (rate * Math.pow(1 + rate, seasons)) / (Math.pow(1 + rate, seasons) - 1);
}

/**
 * Clear pending lender search results
 */
export function clearPendingLenderSearchResults(): void {
  updateGameState({
    pendingLenderSearchResults: undefined
  });
}

