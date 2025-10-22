import { v4 as uuidv4 } from 'uuid';
import { Loan, Lender, EconomyPhase, LenderType, GameDate } from '../../types/types';
import { ECONOMY_INTEREST_MULTIPLIERS, LENDER_TYPE_MULTIPLIERS, CREDIT_RATING, LOAN_DEFAULT, TRANSACTION_CATEGORIES, DURATION_INTEREST_MODIFIERS } from '../../constants';
import { getGameState } from '../core/gameState';
import { addTransaction } from './financeService';
import { insertLoan, loadActiveLoans, updateLoan } from '../../database/core/loansDB';
import { updateLenderBlacklist } from '../../database/core/lendersDB';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateCreditRating } from './creditRatingService';
import { insertPrestigeEvent } from '../../database/customers/prestigeEventsDB';
import { calculateAbsoluteWeeks } from '../../utils/utils';

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
    console.error('Error calculating credit rating:', error);
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
    console.error('Error applying for loan:', error);
    throw error;
  }
}

/**
 * Calculate seasonal payment using loan amortization
 */
function calculateSeasonalPayment(principal: number, rate: number, seasons: number): number {
  if (rate === 0) {
    return principal / seasons;
  }
  
  const payment = principal * (rate * Math.pow(1 + rate, seasons)) / (Math.pow(1 + rate, seasons) - 1);
  return payment;
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
    console.error('Error processing seasonal loan payments:', error);
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
 * Process payment for a specific loan
 */
async function processLoanPayment(loan: Loan, currentDate: GameDate): Promise<void> {
  try {
    const gameState = getGameState();
    const availableMoney = gameState.money || 0;
    
    if (availableMoney >= loan.seasonalPayment) {
      // Sufficient funds - make payment
      await addTransaction(
        -loan.seasonalPayment,
        `Loan payment to ${loan.lenderName}`,
        TRANSACTION_CATEGORIES.LOAN_PAYMENT,
        false
      );
      
      // Update loan
      const newBalance = loan.remainingBalance - loan.seasonalPayment;
      const newSeasonsRemaining = loan.seasonsRemaining - 1;
      
      if (newBalance <= 0 || newSeasonsRemaining <= 0) {
        // Loan paid off
        await updateLoan(loan.id, {
          remainingBalance: 0,
          seasonsRemaining: 0,
          status: 'paid_off'
        });
        
        // Credit rating will be recalculated automatically with comprehensive system
        // No need for manual credit rating updates here
        
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
          nextPaymentDue: nextPaymentDate
        });
        
        // Credit rating will be recalculated automatically with comprehensive system
        // No need for manual credit rating updates here
      }
    } else {
      // Insufficient funds - default on loan
      await defaultOnLoan(loan.id);
    }
  } catch (error) {
    console.error('Error processing loan payment:', error);
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
    console.error('Error calculating total outstanding loans:', error);
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
    console.error('Error repaying loan in full:', error);
    throw error;
  }
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
      console.error('Loan not found for default:', loanId);
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
    console.error('Error handling loan default:', error);
  }
}

