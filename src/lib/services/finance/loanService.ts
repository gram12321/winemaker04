import { v4 as uuidv4 } from 'uuid';
import { Loan, Lender, EconomyPhase, LenderType, GameDate, PendingLoanWarning } from '../../types/types';
import { ECONOMY_INTEREST_MULTIPLIERS, LENDER_TYPE_MULTIPLIERS, CREDIT_RATING, LOAN_DEFAULT, DURATION_INTEREST_MODIFIERS, LOAN_MISSED_PAYMENT_PENALTIES } from '../../constants/loanConstants';
import { TRANSACTION_CATEGORIES } from '../../constants';
import { getGameState, updateGameState } from '../core/gameState';
import { addTransaction } from './financeService';
import { insertLoan, loadActiveLoans, updateLoan } from '../../database/core/loansDB';
import { updateLenderBlacklist } from '../../database/core/lendersDB';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateCreditRating } from './creditRatingService';
import { insertPrestigeEvent } from '../../database/customers/prestigeEventsDB';
import { calculateAbsoluteWeeks, formatNumber } from '../../utils/utils';
import { loadVineyards, deleteVineyards } from '../../database/activities/vineyardDB';
import { setLoanWarning } from '../../database/core/loansDB';

/**
 * Calculate effective interest rate with all modifiers
 */
export function calculateEffectiveInterestRate(
  baseRate: number,
  economyPhase: EconomyPhase,
  lenderType: LenderType,
  creditRating: number, // 0-1 scale
  durationSeasons?: number
): number {
  const economyMultiplier = ECONOMY_INTEREST_MULTIPLIERS[economyPhase];
  const lenderMultiplier = LENDER_TYPE_MULTIPLIERS[lenderType];
  
  // Credit rating modifier: 0.8 + (0.7 * (1 - creditRating)) - now uses 0-1 scale
  const creditMultiplier = 0.8 + (0.7 * (1 - creditRating));
  
  // Duration modifier (longer loans get slightly lower rates)
  let durationMultiplier = 1.0;
  if (durationSeasons) {
    if (durationSeasons <= DURATION_INTEREST_MODIFIERS.SHORT_TERM.maxSeasons) {
      durationMultiplier = DURATION_INTEREST_MODIFIERS.SHORT_TERM.modifier;
    } else if (durationSeasons <= DURATION_INTEREST_MODIFIERS.MEDIUM_TERM.maxSeasons) {
      durationMultiplier = DURATION_INTEREST_MODIFIERS.MEDIUM_TERM.modifier;
    } else if (durationSeasons <= DURATION_INTEREST_MODIFIERS.LONG_TERM.maxSeasons) {
      durationMultiplier = DURATION_INTEREST_MODIFIERS.LONG_TERM.modifier;
    } else {
      durationMultiplier = DURATION_INTEREST_MODIFIERS.VERY_LONG_TERM.modifier;
    }
  }
  
  return baseRate * economyMultiplier * lenderMultiplier * creditMultiplier * durationMultiplier;
}

/**
 * Calculate credit rating modifier for interest rates
 * Updated to use comprehensive credit rating system (0-1 scale)
 */
export function calculateCreditRatingModifier(creditRating: number): number {
  // Credit rating is now in 0-1 scale (0.5 = 50% = BBB- rating)
  return 0.8 + (0.7 * (1 - creditRating));
}

/**
 * Get current comprehensive credit rating
 */
export async function getCurrentCreditRating(): Promise<number> {
  try {
    const creditBreakdown = await calculateCreditRating();
    return creditBreakdown.finalRating;
  } catch (error) {
    // Fallback to game state credit rating
    const gameState = getGameState();
    return gameState.creditRating || CREDIT_RATING.DEFAULT_RATING;
  }
}

/**
 * Apply for a loan from a specific lender
 */
export async function applyForLoan(
  lenderId: string,
  amount: number,
  durationSeasons: number,
  lender: Lender
): Promise<string> {
  try {
    const gameState = getGameState();
    const currentDate: GameDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };
    
    // Calculate effective interest rate
    const effectiveRate = calculateEffectiveInterestRate(
      lender.baseInterestRate,
      gameState.economyPhase || 'Recovery',
      lender.type,
      gameState.creditRating || CREDIT_RATING.DEFAULT_RATING,
      durationSeasons
    );
    
    // Calculate seasonal payment using loan amortization
    const seasonalPayment = calculateSeasonalPayment(amount, effectiveRate, durationSeasons);
    
    // Calculate origination fee
    const originationFee = calculateOriginationFee(amount, lender, gameState.creditRating || CREDIT_RATING.DEFAULT_RATING, durationSeasons);
    
    // Create loan object
    const loan: Loan = {
      id: uuidv4(),
      lenderId,
      lenderName: lender.name,
      lenderType: lender.type,
      principalAmount: amount,
      baseInterestRate: lender.baseInterestRate,
      economyPhaseAtCreation: gameState.economyPhase || 'Recovery',
      effectiveInterestRate: effectiveRate,
      originationFee,
      remainingBalance: amount,
      seasonalPayment,
      seasonsRemaining: durationSeasons,
      totalSeasons: durationSeasons,
      startDate: currentDate,
      nextPaymentDue: calculateNextPaymentDate(currentDate), // First payment due next season
      missedPayments: 0,
      status: 'active'
    };
    
    // Add loan to database
    await insertLoan(loan);
    
    // Add principal amount to company money
    await addTransaction(
      amount,
      `Loan received from ${lender.name}`,
      TRANSACTION_CATEGORIES.LOAN_RECEIVED,
      false
    );
    
    // Deduct origination fee from company money
    await addTransaction(
      -originationFee,
      `Origination fee for loan from ${lender.name}`,
      TRANSACTION_CATEGORIES.LOAN_ORIGINATION_FEE,
      false
    );
    
    // Trigger UI update
    triggerGameUpdate();
    
    return loan.id;
  } catch (error) {
    throw error;
  }
}

/**
 * Calculate seasonal payment using loan amortization
 */
export function calculateSeasonalPayment(principal: number, rate: number, seasons: number): number {
  if (rate === 0) {
    return principal / seasons;
  }
  
  const payment = principal * (rate * Math.pow(1 + rate, seasons)) / (Math.pow(1 + rate, seasons) - 1);
  return payment;
}

/**
 * Calculate comprehensive loan terms for a given lender and parameters
 */
export function calculateLoanTerms(
  lender: Lender,
  principalAmount: number,
  durationSeasons: number,
  creditRating: number,
  economyPhase: string
): {
  effectiveInterestRate: number;
  seasonalPayment: number;
  totalRepayment: number;
  totalInterest: number;
  originationFee: number;
  totalExpenses: number;
} {
  // Calculate effective interest rate
  const effectiveInterestRate = calculateEffectiveInterestRate(
    lender.baseInterestRate,
    economyPhase as any,
    lender.type,
    creditRating,
    durationSeasons
  );

  // Calculate seasonal payment
  const seasonalPayment = calculateSeasonalPayment(principalAmount, effectiveInterestRate, durationSeasons);

  // Calculate total repayment and interest
  const totalRepayment = seasonalPayment * durationSeasons;
  const totalInterest = totalRepayment - principalAmount;

  // Calculate origination fee
  const originationFee = calculateOriginationFee(principalAmount, lender, creditRating, durationSeasons);

  // Calculate total expenses
  const totalExpenses = originationFee + totalInterest;

  return {
    effectiveInterestRate,
    seasonalPayment,
    totalRepayment,
    totalInterest,
    originationFee,
    totalExpenses
  };
}

/**
 * Calculate loan origination fee based on lender's specific parameters, credit rating, and duration
 */
export function calculateOriginationFee(
  principalAmount: number,
  lender: Lender,
  creditRating: number, // 0-1 scale
  durationSeasons: number
): number {
  const feeConfig = lender.originationFee;
  
  // Calculate base fee as percentage of loan amount
  let baseFee = principalAmount * feeConfig.basePercent;
  
  // Apply credit rating modifier based on lender's specific modifier
  let creditModifier = 1.0;
  if (creditRating >= 0.8) { // 80-100% credit rating
    creditModifier = feeConfig.creditRatingModifier; // Use lender's specific modifier for excellent credit
  } else if (creditRating >= 0.6) { // 60-80% credit rating
    creditModifier = 0.9 + (feeConfig.creditRatingModifier - 0.9) * 0.5; // Interpolate for good credit
  } else if (creditRating >= 0.4) { // 40-60% credit rating
    creditModifier = 1.0; // No modifier for average credit
  } else if (creditRating >= 0.2) { // 20-40% credit rating
    creditModifier = 1.0 + (1.5 - feeConfig.creditRatingModifier) * 0.3; // Poor credit penalty
  } else { // 0-20% credit rating
    creditModifier = 1.0 + (1.5 - feeConfig.creditRatingModifier) * 0.6; // Very poor credit penalty
  }
  
  // Apply duration modifier based on lender's specific modifier
  let durationModifier = 1.0;
  if (durationSeasons <= 16) { // 0-4 years
    durationModifier = 0.9 + (feeConfig.durationModifier - 1.0) * 0.1; // Slight discount for short-term
  } else if (durationSeasons <= 40) { // 4-10 years
    durationModifier = 1.0; // No modifier for medium-term
  } else if (durationSeasons <= 80) { // 10-20 years
    durationModifier = 1.0 + (feeConfig.durationModifier - 1.0) * 0.5; // Partial premium for long-term
  } else { // 20-30 years
    durationModifier = feeConfig.durationModifier; // Full premium for very long-term
  }
  
  // Apply modifiers
  let finalFee = baseFee * creditModifier * durationModifier;
  
  // Apply min/max constraints
  finalFee = Math.max(feeConfig.minFee, Math.min(feeConfig.maxFee, finalFee));
  
  return Math.round(finalFee);
}

/**
 * Process seasonal loan payments for all active loans
 * Called during season changes (week 1 of each season)
 */
export async function processSeasonalLoanPayments(): Promise<void> {
  try {
    const activeLoans = await loadActiveLoans();
    const gameState = getGameState();
    const currentDate: GameDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };
    

    
    for (const loan of activeLoans) {
      // Check if payment is due
      if (isPaymentDue(loan.nextPaymentDue, currentDate)) {
        await processLoanPayment(loan, currentDate);
      }
    }
    // Ensure UI sees final state after all loan updates
    triggerGameUpdate();
  } catch (error) {
  }
}

/**
 * Check if a loan payment is due
 */
function isPaymentDue(paymentDate: GameDate, currentDate: GameDate): boolean {
  return paymentDate.year === currentDate.year && 
         paymentDate.season === currentDate.season;
}

/**
 * Process payment for a specific loan (3-strike warning system)
 */
async function processLoanPayment(loan: Loan, currentDate: GameDate): Promise<void> {
  try {
    const gameState = getGameState();
    const availableMoney = gameState.money || 0;
    
    if (availableMoney >= loan.seasonalPayment) {
      // Sufficient funds - make full payment
      await addTransaction(
        -loan.seasonalPayment,
        `Loan payment to ${loan.lenderName}`,
        TRANSACTION_CATEGORIES.LOAN_PAYMENT,
        false
      );
      
      // Update loan
      const newBalance = loan.remainingBalance - loan.seasonalPayment;
      const newSeasonsRemaining = loan.seasonsRemaining - 1;
      
      // Reduce missed payments (recovery from warnings)
      const newMissedPayments = Math.max(0, (loan.missedPayments || 0) - 1);
      
      if (newBalance <= 0 || newSeasonsRemaining <= 0) {
        // Loan paid off
        await updateLoan(loan.id, {
          remainingBalance: 0,
          seasonsRemaining: 0,
          status: 'paid_off',
          missedPayments: 0
        });
        
        await notificationService.addMessage(
          `Loan from ${loan.lenderName} has been paid off! Credit rating improved.`,
          'loan.paidOff',
          'Loan Update',
          NotificationCategory.FINANCE
        );
      } else {
        // Continue loan
        const nextPaymentDate = calculateNextPaymentDate(currentDate);
        await updateLoan(loan.id, {
          remainingBalance: newBalance,
          seasonsRemaining: newSeasonsRemaining,
          nextPaymentDue: nextPaymentDate,
          missedPayments: newMissedPayments
        });
        
        // Notify if recovered from warnings
        if (loan.missedPayments > 0 && newMissedPayments === 0) {
          await notificationService.addMessage(
            `You've caught up on payments for ${loan.lenderName}! Warning status cleared.`,
            'loan.warningCleared',
            'Loan Update',
            NotificationCategory.FINANCE
          );
        }
      }
    } else if (availableMoney > 0) {
      // Partial payment - use all available funds
      await addTransaction(
        -availableMoney,
        `Partial loan payment to ${loan.lenderName} (${formatNumber(availableMoney, { currency: true })} of ${formatNumber(loan.seasonalPayment, { currency: true })} due)`,
        TRANSACTION_CATEGORIES.LOAN_PAYMENT,
        false
      );
      
      // Update loan with partial payment
      const newBalance = loan.remainingBalance - availableMoney;
      const newSeasonsRemaining = loan.seasonsRemaining - 1;
      
      // Still count as missed payment since not full amount
      const newMissedPayments = (loan.missedPayments || 0) + 1;
      
      const nextPaymentDate = calculateNextPaymentDate(currentDate);
      await updateLoan(loan.id, {
        remainingBalance: newBalance,
        seasonsRemaining: newSeasonsRemaining,
        nextPaymentDue: nextPaymentDate,
        missedPayments: newMissedPayments
      });
      
      // Apply penalties based on warning level
      if (newMissedPayments === 1) {
        await applyWarning1Penalties(loan);
      } else if (newMissedPayments === 2) {
        await applyWarning2Penalties(loan);
      } else if (newMissedPayments === 3) {
        await applyWarning3Penalties(loan);
      } else {
        // missedPayments >= 4: Full default
        await applyFullDefault(loan);
      }
      
      await notificationService.addMessage(
        `Partial loan payment made to ${loan.lenderName}. ${formatNumber(loan.seasonalPayment - availableMoney, { currency: true })} still owed. Warning level: ${newMissedPayments}`,
        'loan.partialPayment',
        'Partial Loan Payment',
        NotificationCategory.FINANCE
      );
    } else {
      // No funds available - apply graduated penalties based on missed payments
      const newMissedPayments = (loan.missedPayments || 0) + 1;
      
      // Update loan with incremented missed payments
      await updateLoan(loan.id, {
        missedPayments: newMissedPayments,
        nextPaymentDue: calculateNextPaymentDate(currentDate)
      });
      
      // Apply penalties based on warning level
      if (newMissedPayments === 1) {
        await applyWarning1Penalties(loan);
      } else if (newMissedPayments === 2) {
        await applyWarning2Penalties(loan);
      } else if (newMissedPayments === 3) {
        await applyWarning3Penalties(loan);
      } else {
        // missedPayments >= 4: Full default
        await applyFullDefault(loan);
      }
    }
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Calculate next payment date (next season)
 */
function calculateNextPaymentDate(currentDate: GameDate): GameDate {
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
  const currentSeasonIndex = seasons.indexOf(currentDate.season);
  const nextSeasonIndex = (currentSeasonIndex + 1) % 4;
  const nextSeason = seasons[nextSeasonIndex] as 'Spring' | 'Summer' | 'Fall' | 'Winter';
  
  if (nextSeason === 'Spring') {
    return {
      week: 1,
      season: 'Spring',
      year: currentDate.year + 1
    };
  } else {
    return {
      week: 1,
      season: nextSeason,
      year: currentDate.year
    };
  }
}

/**
 * Calculate total interest that will be paid over the life of the loan
 */
export function calculateTotalInterest(loan: Loan): number {
  // Total interest = (seasonal payment * total seasons) - principal amount
  const totalPayments = loan.seasonalPayment * loan.totalSeasons;
  return totalPayments - loan.principalAmount;
}

/**
 * Calculate total expenses (origination fee + total interest)
 */
export function calculateTotalExpenses(loan: Loan): number {
  const totalInterest = calculateTotalInterest(loan);
  return loan.originationFee + totalInterest;
}

/**
 * Calculate remaining interest if loan is paid off early
 */
export function calculateRemainingInterest(loan: Loan): number {
  // Remaining interest = (seasonal payment * remaining seasons) - remaining balance
  const remainingPayments = loan.seasonalPayment * loan.seasonsRemaining;
  return remainingPayments - loan.remainingBalance;
}

/**
 * Calculate total outstanding loan balance across all active loans
 */
export async function calculateTotalOutstandingLoans(): Promise<number> {
  try {
    const activeLoans = await loadActiveLoans();
    return activeLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Repay loan in full (early payoff)
 */
export async function repayLoanInFull(loanId: string): Promise<void> {
  try {
    const activeLoans = await loadActiveLoans();
    const loan = activeLoans.find(l => l.id === loanId);
    
    if (!loan) {
      throw new Error('Loan not found');
    }
    
    const gameState = getGameState();
    const availableMoney = gameState.money || 0;
    
    if (availableMoney < loan.remainingBalance) {
      throw new Error('Insufficient funds to repay loan in full');
    }
    
    // Deduct remaining balance from company money
    await addTransaction(
      -loan.remainingBalance,
      `Early loan payoff to ${loan.lenderName}`,
      TRANSACTION_CATEGORIES.LOAN_PAYMENT,
      false
    );
    
    // Update loan status to paid off
    await updateLoan(loanId, {
      remainingBalance: 0,
      seasonsRemaining: 0,
      status: 'paid_off'
    });
    
    // Credit rating will be recalculated automatically with comprehensive system
    // Early payoff typically improves credit rating
    
    await notificationService.addMessage(
      `Loan from ${loan.lenderName} paid off early! Credit rating improved.`,
      'loan.earlyPayoff',
      'Loan Update',
      NotificationCategory.FINANCE
    );
    
    triggerGameUpdate();
  } catch (error) {
    throw error;
  }
}

/**
 * Queue a loan warning modal to be displayed to the player
 * Stores warning directly in database - no game state usage
 */
async function queueLoanWarningModal(warning: PendingLoanWarning): Promise<void> {
  try {
    // Store warning in database for persistence
    await setLoanWarning(warning.loanId, warning);
  } catch (error) {
    throw error;
  }
}

/**
 * Apply Warning #1 Penalties
 * - Late fee: 2% of seasonal payment added to balance
 * - Credit rating loss: -5%
 * - Bookkeeping work: +20 units
 */
async function applyWarning1Penalties(loan: Loan): Promise<void> {
  const penalties = LOAN_MISSED_PAYMENT_PENALTIES.WARNING_1;
  
  // Calculate late fee
  const lateFee = Math.round(loan.seasonalPayment * penalties.LATE_FEE_PERCENT);
  
  // Add late fee to loan balance
  await updateLoan(loan.id, {
    remainingBalance: loan.remainingBalance + lateFee
  });
  
  // Apply credit rating loss (will be handled by comprehensive credit rating system)
  // The penalty is automatically reflected through missedPayments tracking
  
  // Queue bookkeeping penalty work
  await queueLoanPenaltyWork(penalties.BOOKKEEPING_WORK, loan.lenderName, 1);
  
  // Queue warning modal
  const warning: PendingLoanWarning = {
    loanId: loan.id,
    lenderName: loan.lenderName,
    missedPayments: 1,
    severity: 'warning',
    title: 'Missed Loan Payment - Warning #1',
    message: `You failed to make your scheduled payment of ${formatNumber(loan.seasonalPayment, { currency: true })} to ${loan.lenderName}.`,
    details: `Penalties Applied:\n• Late fee of ${formatNumber(lateFee, { currency: true })} added to loan balance\n• Credit rating decreased by ${Math.abs(penalties.CREDIT_RATING_LOSS * 100).toFixed(0)}%\n• Additional ${penalties.BOOKKEEPING_WORK} work units added to next bookkeeping task\n\nNew loan balance: ${formatNumber(loan.remainingBalance + lateFee, { currency: true })}\n\n⚠️ If you miss 2 more payments, more severe penalties will apply including interest rate increases and prestige loss.`,
    penalties: {
      lateFee,
      creditRatingLoss: penalties.CREDIT_RATING_LOSS,
      bookkeepingWork: penalties.BOOKKEEPING_WORK
    }
  };
  
  await queueLoanWarningModal(warning);
  
  // Also send regular notification
  await notificationService.addMessage(
    `Missed payment to ${loan.lenderName}! Late fee of ${formatNumber(lateFee, { currency: true })} applied. WARNING #1 - check loan details.`,
    'loan.missedPayment1',
    'Loan Warning',
    NotificationCategory.FINANCE
  );
  
  // Trigger UI update to reflect balance changes
  triggerGameUpdate();
}

/**
 * Apply Warning #2 Penalties
 * - Interest rate increase: +0.5%
 * - Balance penalty: +5% of outstanding balance
 * - Credit rating loss: -5% (cumulative: -10% total)
 * - Prestige penalty: -25 (negative prestige event)
 * - Bookkeeping work: +50 units
 */
async function applyWarning2Penalties(loan: Loan): Promise<void> {
  const penalties = LOAN_MISSED_PAYMENT_PENALTIES.WARNING_2;
  const gameState = getGameState();
  
  // Increase interest rate
  const newInterestRate = loan.effectiveInterestRate + penalties.INTEREST_RATE_INCREASE;
  
  // Calculate balance penalty
  const balancePenalty = Math.round(loan.remainingBalance * penalties.BALANCE_PENALTY_PERCENT);
  
  // Update loan
  await updateLoan(loan.id, {
    effectiveInterestRate: newInterestRate,
    remainingBalance: loan.remainingBalance + balancePenalty
  });
  
  // Apply prestige penalty
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'company_finance',
    amount_base: penalties.PRESTIGE_PENALTY,
    created_game_week: calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!),
    decay_rate: penalties.PRESTIGE_DECAY_RATE,
    source_id: null,
    payload: {
      reason: 'Loan Payment Missed (Warning #2)',
      lenderName: loan.lenderName,
      lenderType: loan.lenderType,
      loanAmount: loan.principalAmount,
      missedPaymentAmount: loan.seasonalPayment
    }
  });
  
  // Queue bookkeeping penalty work
  await queueLoanPenaltyWork(penalties.BOOKKEEPING_WORK, loan.lenderName, 2);
  
  // Queue warning modal
  const warning: PendingLoanWarning = {
    loanId: loan.id,
    lenderName: loan.lenderName,
    missedPayments: 2,
    severity: 'error',
    title: 'Missed Loan Payment - Warning #2',
    message: `You have now missed 2 consecutive payments to ${loan.lenderName}. Severe penalties are being applied.`,
    details: `Penalties Applied:\n• Interest rate increased from ${(loan.effectiveInterestRate * 100).toFixed(2)}% to ${(newInterestRate * 100).toFixed(2)}%\n• Balance penalty of ${formatNumber(balancePenalty, { currency: true })} (5% of balance) added\n• Credit rating decreased by ${Math.abs(penalties.CREDIT_RATING_LOSS * 100).toFixed(0)}%\n• Company prestige reduced by ${Math.abs(penalties.PRESTIGE_PENALTY)}\n• Additional ${penalties.BOOKKEEPING_WORK} work units added to next bookkeeping\n\nNew loan balance: ${formatNumber(loan.remainingBalance + balancePenalty, { currency: true })}\n\n⚠️ WARNING: One more missed payment will result in forced vineyard seizure (up to 50% of your portfolio value)!`,
    penalties: {
      interestRateIncrease: penalties.INTEREST_RATE_INCREASE,
      balancePenalty,
      creditRatingLoss: penalties.CREDIT_RATING_LOSS,
      prestigeLoss: penalties.PRESTIGE_PENALTY,
      bookkeepingWork: penalties.BOOKKEEPING_WORK
    }
  };
  
  await queueLoanWarningModal(warning);
  
  await notificationService.addMessage(
    `Second missed payment to ${loan.lenderName}! Interest rate increased, ${formatNumber(balancePenalty, { currency: true })} penalty applied. WARNING #2 - CRITICAL!`,
    'loan.missedPayment2',
    'Loan Warning',
    NotificationCategory.FINANCE
  );
  
  // Trigger UI update to reflect interest rate change
  triggerGameUpdate();
}

/**
 * Apply Warning #3 Penalties
 * - Forced vineyard sale to cover debt (up to 50% of portfolio value)
 * - Credit rating loss: -10% (cumulative: -20% total)
 * - Bookkeeping work: +100 units
 */
async function applyWarning3Penalties(loan: Loan): Promise<void> {
  const penalties = LOAN_MISSED_PAYMENT_PENALTIES.WARNING_3;
  
  // Seize vineyards to cover debt (up to 50% of portfolio VALUE)
  const seizureResult = await seizeVineyardsForDebt(loan);
  
  // Now use ALL available money (including vineyard sale proceeds) to repay loan
  const gameState = getGameState();
  const availableMoney = gameState.money || 0;
  
  if (availableMoney > 0) {
    // Use all available money to repay loan
    const paymentAmount = Math.min(availableMoney, loan.remainingBalance);
    
    await addTransaction(
      -paymentAmount,
      `Emergency loan payment to ${loan.lenderName} using all available funds`,
      TRANSACTION_CATEGORIES.LOAN_PAYMENT,
      false
    );
    
    // Update loan balance
    const newBalance = Math.max(0, loan.remainingBalance - paymentAmount);
    await updateLoan(loan.id, {
      remainingBalance: newBalance
    });
    
    await notificationService.addMessage(
      `Emergency payment of ${formatNumber(paymentAmount, { currency: true })} made to ${loan.lenderName} using all available funds.`,
      'loan.emergencyPayment',
      'Emergency Loan Payment',
      NotificationCategory.FINANCE
    );
  }
  
  // Queue bookkeeping penalty work
  await queueLoanPenaltyWork(penalties.BOOKKEEPING_WORK, loan.lenderName, 3);
  
  // Queue warning modal
  const warning: PendingLoanWarning = {
    loanId: loan.id,
    lenderName: loan.lenderName,
    missedPayments: 3,
    severity: 'critical',
    title: 'Missed Loan Payment - Warning #3: VINEYARD SEIZURE',
    message: `You have missed 3 consecutive payments to ${loan.lenderName}. Emergency measures are being taken.`,
    details: `Penalties Applied:\n• ${seizureResult.vineyardsSeized > 0 ? `${seizureResult.vineyardsSeized} vineyard(s) forcibly sold` : 'Attempted to seize vineyards but none available'}\n• Vineyard value seized: ${formatNumber(seizureResult.valueRecovered, { currency: true })}\n• Sale proceeds (after 25% penalty): ${formatNumber(seizureResult.saleProceeds, { currency: true })}\n• Credit rating decreased by ${Math.abs(penalties.CREDIT_RATING_LOSS * 100).toFixed(0)}%\n• Additional ${penalties.BOOKKEEPING_WORK} work units added to next bookkeeping\n\n${seizureResult.vineyardNames.length > 0 ? `Vineyards Sold:\n${seizureResult.vineyardNames.map(name => `• ${name}`).join('\n')}` : 'No vineyards available for seizure'}\n\nRemaining loan balance: ${formatNumber(loan.remainingBalance, { currency: true })}\n\n🚨 FINAL WARNING: One more missed payment will result in FULL DEFAULT with permanent lender blacklist!`,
    penalties: {
      vineyardsSeized: seizureResult.vineyardsSeized,
      vineyardNames: seizureResult.vineyardNames,
      creditRatingLoss: penalties.CREDIT_RATING_LOSS,
      bookkeepingWork: penalties.BOOKKEEPING_WORK
    }
  };
  
  await queueLoanWarningModal(warning);
  
  await notificationService.addMessage(
    `THIRD missed payment to ${loan.lenderName}! ${seizureResult.vineyardsSeized} vineyard(s) forcibly sold for ${formatNumber(seizureResult.valueRecovered, { currency: true })}. WARNING #3 - FINAL WARNING!`,
    'loan.missedPayment3',
    'Loan Warning',
    NotificationCategory.FINANCE
  );
  
  // Trigger UI update to reflect vineyard seizure and other changes
  triggerGameUpdate();
}

/**
 * Apply Full Default (4+ missed payments)
 * - All Warning #3 penalties
 * - Lender blacklist
 * - Full default prestige penalty
 */
async function applyFullDefault(loan: Loan): Promise<void> {
  // Apply Warning #3 penalties first
  await applyWarning3Penalties(loan);
  
  // Then apply full default
  await defaultOnLoan(loan.id);
}

/**
 * Seize vineyards to recover loan debt
 * Sells vineyards (lowest value first) until 50% of portfolio VALUE is reached
 * Applies -25% penalty to sale proceeds and adds to user money
 * Returns details of seizure for modal display
 */
async function seizeVineyardsForDebt(loan: Loan): Promise<{
  vineyardsSeized: number;
  valueRecovered: number;
  vineyardNames: string[];
  saleProceeds: number;
}> {
  try {
    const vineyards = await loadVineyards();
    
    if (vineyards.length === 0) {
      return { vineyardsSeized: 0, valueRecovered: 0, vineyardNames: [], saleProceeds: 0 };
    }
    
    // Calculate total portfolio value and maximum seizure amount (50% of VALUE)
    const totalPortfolioValue = vineyards.reduce((sum, v) => sum + v.vineyardTotalValue, 0);
    const maxSeizureValue = totalPortfolioValue * LOAN_MISSED_PAYMENT_PENALTIES.WARNING_3.MAX_VINEYARD_SEIZURE_PERCENT;
    
    // Sort vineyards by value (lowest first - take least valuable ones)
    const sortedVineyards = [...vineyards].sort((a, b) => a.vineyardTotalValue - b.vineyardTotalValue);
    
    let valueRecovered = 0;
    const vineyardsToRemove: string[] = [];
    const vineyardNames: string[] = [];
    
    // Seize vineyards until 50% of portfolio VALUE is reached
    for (const vineyard of sortedVineyards) {
      if (valueRecovered >= maxSeizureValue) break;
      
      vineyardsToRemove.push(vineyard.id);
      vineyardNames.push(vineyard.name);
      valueRecovered += vineyard.vineyardTotalValue;
    }
    
    // Remove seized vineyards from database
    if (vineyardsToRemove.length > 0) {
      await deleteVineyards(vineyardsToRemove);
    }
    
    // Calculate sale proceeds with -25% penalty
    const saleProceeds = valueRecovered * 0.75; // -25% penalty
    
    // Add sale proceeds to user money
    if (saleProceeds > 0) {
      await addTransaction(
        saleProceeds,
        `Forced vineyard sale by ${loan.lenderName} - ${vineyardsToRemove.length} vineyard(s) sold (${formatNumber(valueRecovered, { currency: true })} value, ${formatNumber(saleProceeds, { currency: true })} after 25% penalty)`,
        TRANSACTION_CATEGORIES.VINEYARD_SALE,
        false
      );
    }
    
    return {
      vineyardsSeized: vineyardsToRemove.length,
      valueRecovered,
      vineyardNames,
      saleProceeds
    };
  } catch (error) {
    return { vineyardsSeized: 0, valueRecovered: 0, vineyardNames: [], saleProceeds: 0 };
  }
}

/**
 * Queue loan penalty work to be added to next bookkeeping task
 * Stores penalty work in game state to be picked up by bookkeeping manager
 */
async function queueLoanPenaltyWork(workUnits: number, lenderName: string, warningLevel: number): Promise<void> {
  const gameState = getGameState();
  const currentPenaltyWork = gameState.loanPenaltyWork || 0;
  const newPenaltyWork = currentPenaltyWork + workUnits;
  
  // Update game state with accumulated penalty work
  updateGameState({ ...gameState, loanPenaltyWork: newPenaltyWork });
  
  
  await notificationService.addMessage(
    `Additional ${workUnits} work units will be added to next bookkeeping task due to missed payment (${lenderName}, Warning #${warningLevel}).`,
    'loan.bookkeepingPenalty',
    'Bookkeeping Penalty',
    NotificationCategory.ADMINISTRATION
  );
}

/**
 * Handle loan default
 */
async function defaultOnLoan(loanId: string): Promise<void> {
  try {
    const gameState = getGameState();
    
    // Get loan details before updating
    const loan = await loadActiveLoans().then(loans => loans.find(l => l.id === loanId));
    if (!loan) {
      return;
    }
    
    // Update loan status
    await updateLoan(loanId, {
      status: 'defaulted',
      missedPayments: 1
    });
    
    // Create prestige penalty event (negative prestige with slow decay)
    
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'company_finance',
      amount_base: LOAN_DEFAULT.PRESTIGE_PENALTY,
      created_game_week: calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!),
      decay_rate: LOAN_DEFAULT.PRESTIGE_DECAY_RATE,
      source_id: null,
      payload: {
        reason: 'Loan Default',
        lenderName: loan.lenderName,
        lenderType: loan.lenderType,
        loanAmount: loan.principalAmount,
        missedPaymentAmount: loan.seasonalPayment
      }
    });
    
    // Credit rating will be recalculated automatically with comprehensive system
    // The new system includes more severe penalties for defaults and missed payments
    
    // Blacklist company with this lender
    await updateLenderBlacklist(loan.lenderId, true);
    
    await notificationService.addMessage(
      `Loan payment missed! You have been blacklisted by ${loan.lenderName}. Prestige and credit rating severely impacted.`,
      'loan.default',
      'Loan Default',
      NotificationCategory.FINANCE
    );
    
    triggerGameUpdate();
  } catch (error) {
    // Silent error handling
  }
}

