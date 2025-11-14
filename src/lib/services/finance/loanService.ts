import { v4 as uuidv4 } from 'uuid';
import { Loan, LoanCategory, Lender, EconomyPhase, LenderType, GameDate, PendingLoanWarning, ForcedLoanRestructureOffer, ForcedLoanRestructureStep } from '../../types/types';
import { ECONOMY_INTEREST_MULTIPLIERS, LENDER_TYPE_MULTIPLIERS, CREDIT_RATING, LOAN_DEFAULT, DURATION_INTEREST_MODIFIERS, LOAN_MISSED_PAYMENT_PENALTIES, EMERGENCY_QUICK_LOAN, EMERGENCY_RESTRUCTURE, LOAN_EXTRA_PAYMENT, ADMINISTRATION_LOAN_PENALTIES, LOAN_PREPAYMENT } from '../../constants/loanConstants';
import { TRANSACTION_CATEGORIES, SEASON_ORDER } from '@/lib/constants';
import { getGameState, updateGameState } from '../core/gameState';
import { addTransaction, calculateTotalAssets } from './financeService';
import { insertLoan, loadActiveLoans, updateLoan, clearLoanWarning } from '../../database/core/loansDB';
import { loadLenders, updateLenderBlacklist } from '../../database/core/lendersDB';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateCreditRating } from './creditRatingService';
import { calculateLenderAvailability } from './lenderService';
import { insertPrestigeEvent } from '../../database/customers/prestigeEventsDB';
import { calculateAbsoluteWeeks, formatNumber, formatPercent } from '../../utils/utils';
import { loadVineyards, deleteVineyards } from '../../database/activities/vineyardDB';
import { loadWineBatches, bulkUpdateWineBatches } from '../../database/activities/inventoryDB';
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

const LOAN_LIMIT_SCALING = {
  MIN_ASSET_FACTOR: 0.2,
  MAX_ASSET_FACTOR: 0.65,
  MIN_RATING_MULTIPLIER: 0.8,
  MAX_RATING_MULTIPLIER: 1.5,
  ROUNDING_STEP: 1000
} as const;

export interface LoanAmountLimit {
  maxAllowed: number;
  assetCap: number;
  ratingCap: number;
  totalAssets: number;
}

interface LoanAmountLimitOptions {
  totalAssets?: number;
  roundingStep?: number;
}

export async function getScaledLoanAmountLimit(
  lender: Lender,
  creditRating: number,
  options: LoanAmountLimitOptions = {}
): Promise<LoanAmountLimit> {
  const normalizedRating = Math.max(0, Math.min(1, creditRating));
  const roundingStep = options.roundingStep ?? LOAN_LIMIT_SCALING.ROUNDING_STEP;

  let totalAssets = options.totalAssets;
  if (totalAssets === undefined) {
    totalAssets = await calculateTotalAssets();
  }

  const safeTotalAssets = Math.max(0, totalAssets ?? 0);

  const assetFactor =
    LOAN_LIMIT_SCALING.MIN_ASSET_FACTOR +
    (LOAN_LIMIT_SCALING.MAX_ASSET_FACTOR - LOAN_LIMIT_SCALING.MIN_ASSET_FACTOR) * normalizedRating;

  const assetCap = Math.max(
    lender.minLoanAmount,
    safeTotalAssets * assetFactor
  );

  const ratingMultiplier =
    LOAN_LIMIT_SCALING.MIN_RATING_MULTIPLIER +
    (LOAN_LIMIT_SCALING.MAX_RATING_MULTIPLIER - LOAN_LIMIT_SCALING.MIN_RATING_MULTIPLIER) * normalizedRating;

  const ratingCap = Math.max(
    lender.minLoanAmount,
    lender.maxLoanAmount * ratingMultiplier
  );

  const rawMax = Math.min(ratingCap, assetCap);
  const roundedMax =
    roundingStep > 0
      ? Math.floor(rawMax / roundingStep) * roundingStep
      : rawMax;

  const maxAllowed = Math.max(lender.minLoanAmount, roundedMax);

  return {
    maxAllowed,
    assetCap,
    ratingCap,
    totalAssets: safeTotalAssets
  };
}

/**
 * Apply for a loan from a specific lender
 */
export async function applyForLoan(
  lenderId: string,
  amount: number,
  durationSeasons: number,
  lender: Lender,
  options: {
    isForced?: boolean;
    skipAdministrationPenalty?: boolean;
    loanCategory?: LoanCategory;
    skipTransactions?: boolean;
    overrideBaseRate?: number;
    overrideEffectiveRate?: number;
    skipLimitCheck?: boolean;
  } = {}
): Promise<string> {
  try {
    const gameState = getGameState();
    const creditRating = gameState.creditRating ?? CREDIT_RATING.DEFAULT_RATING;
    const currentDate: GameDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };

    const requestedAmount = amount;
    let principalAmount = requestedAmount;

    // Only apply scaling limits for normal loans (not forced, not starting conditions)
    if (!options.skipLimitCheck && !options.isForced) {
      const limitInfo = await getScaledLoanAmountLimit(lender, creditRating);

      if (requestedAmount > limitInfo.maxAllowed) {
        throw new Error(
          [
            `Requested loan amount ${formatNumber(requestedAmount, { currency: true })} exceeds your current borrowing limit of ${formatNumber(limitInfo.maxAllowed, { currency: true })}.`,
            `The limit is determined by your credit rating (${formatPercent(creditRating)}) and total assets of ${formatNumber(limitInfo.totalAssets, { currency: true })}.`
          ].join(' ')
        );
      }

      principalAmount = Math.min(requestedAmount, limitInfo.maxAllowed);
    }
    
    // Calculate effective interest rate
    const baseInterestRate = options.overrideBaseRate ?? lender.baseInterestRate;

    const effectiveRate = options.overrideEffectiveRate ?? calculateEffectiveInterestRate(
      baseInterestRate,
      gameState.economyPhase || 'Stable',
      lender.type,
      creditRating,
      durationSeasons
    );
    
    // Calculate seasonal payment using loan amortization
    const seasonalPayment = calculateSeasonalPayment(principalAmount, effectiveRate, durationSeasons);
    
    // Calculate origination fee
    const originationFee = calculateOriginationFee(principalAmount, lender, creditRating, durationSeasons);
    
    // Create loan object
    const derivedCategory: LoanCategory = options.loanCategory
      ? options.loanCategory
      : options.isForced
        ? 'emergency'
        : 'standard';

    const loan: Loan = {
      id: uuidv4(),
      lenderId,
      lenderName: lender.name,
      lenderType: lender.type,
      principalAmount: principalAmount,
      baseInterestRate: baseInterestRate,
      economyPhaseAtCreation: gameState.economyPhase || 'Stable',
      effectiveInterestRate: effectiveRate,
      originationFee,
      remainingBalance: principalAmount,
      seasonalPayment,
      seasonsRemaining: durationSeasons,
      totalSeasons: durationSeasons,
      startDate: currentDate,
      nextPaymentDue: calculateNextPaymentDate(currentDate), // First payment due next season
      missedPayments: 0,
      status: 'active',
      isForced: options.isForced ?? false,
      loanCategory: derivedCategory
    };
    
    // Add loan to database
    await insertLoan(loan);
    
    if (!options.skipTransactions) {
      // Add principal amount to company money
      await addTransaction(
        principalAmount,
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
    }
    
    // Trigger UI update
    triggerGameUpdate();
    
    if (!options.skipAdministrationPenalty) {
      await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_TAKEN);
    }
    
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

async function addLoanAdministrationBurden(units: number): Promise<void> {
  if (!units || units <= 0) {
    return;
  }
  const gameState = getGameState();
  const currentPenalty = gameState.loanPenaltyWork || 0;
  await updateGameState({
    ...gameState,
    loanPenaltyWork: currentPenalty + units
  });
}

/**
 * Enforce an emergency quick loan when company balance goes negative
 */
export async function enforceEmergencyQuickLoanIfNeeded(): Promise<void> {
  const gameState = getGameState();
  const currentMoney = gameState.money ?? 0;

  if (currentMoney >= 0) {
    return;
  }

  const allLenders = await loadLenders();
  const quickLenders = allLenders.filter(lender => lender.type === 'QuickLoan' && !lender.blacklisted);

  if (quickLenders.length === 0) {
    return;
  }

  const selectedLender = quickLenders[Math.floor(Math.random() * quickLenders.length)];
  const creditRating = await getCurrentCreditRating();
  const prestige = gameState.prestige || 0;

  const availability = calculateLenderAvailability(
    selectedLender,
    creditRating * 100,
    prestige
  );

  const interestPenaltyMultiplier = availability.isAvailable
    ? EMERGENCY_QUICK_LOAN.BASE_INTEREST_PENALTY_MULTIPLIER
    : EMERGENCY_QUICK_LOAN.DISQUALIFIED_INTEREST_PENALTY_MULTIPLIER;

  const penalizedLender: Lender = {
    ...selectedLender,
    baseInterestRate: selectedLender.baseInterestRate * interestPenaltyMultiplier,
    originationFee: {
      basePercent: selectedLender.originationFee.basePercent * EMERGENCY_QUICK_LOAN.ORIGINATION_FEE_PENALTY_MULTIPLIER,
      minFee: selectedLender.originationFee.minFee * EMERGENCY_QUICK_LOAN.ORIGINATION_FEE_PENALTY_MULTIPLIER,
      maxFee: selectedLender.originationFee.maxFee * EMERGENCY_QUICK_LOAN.ORIGINATION_FEE_PENALTY_MULTIPLIER,
      creditRatingModifier: selectedLender.originationFee.creditRatingModifier,
      durationModifier: selectedLender.originationFee.durationModifier
    }
  };

  const negativeBalance = Math.abs(currentMoney);
  let principalAmount = Math.ceil(
    negativeBalance * (1 + EMERGENCY_QUICK_LOAN.NEGATIVE_BALANCE_BUFFER)
  );

  principalAmount = Math.max(principalAmount, penalizedLender.minLoanAmount);
  principalAmount = Math.min(principalAmount, penalizedLender.maxLoanAmount);

  const durationRange = penalizedLender.maxDurationSeasons - penalizedLender.minDurationSeasons;
  const durationSeasons = Math.max(
    penalizedLender.minDurationSeasons,
    Math.min(
      penalizedLender.maxDurationSeasons,
      Math.round(
        penalizedLender.minDurationSeasons + (durationRange > 0 ? Math.random() * durationRange : 0)
      )
    )
  );

  let attempts = 0;

  while (attempts < EMERGENCY_QUICK_LOAN.MAX_ADJUSTMENT_ITERATIONS) {
    const originationFee = calculateOriginationFee(
      principalAmount,
      penalizedLender,
      creditRating,
      durationSeasons
    );
    const netDeposit = principalAmount - originationFee;

    if (netDeposit >= negativeBalance) {
      break;
    }

    if (principalAmount >= penalizedLender.maxLoanAmount) {
      principalAmount = penalizedLender.maxLoanAmount;
      break;
    }

    const deficit = negativeBalance - netDeposit;
    const additionalPrincipal = Math.ceil(deficit * (1 + EMERGENCY_QUICK_LOAN.NEGATIVE_BALANCE_BUFFER));
    principalAmount = Math.min(
      penalizedLender.maxLoanAmount,
      principalAmount + additionalPrincipal
    );

    attempts += 1;
  }

  const effectiveRate = calculateEffectiveInterestRate(
    penalizedLender.baseInterestRate,
    gameState.economyPhase || 'Stable',
    penalizedLender.type,
    creditRating,
    durationSeasons
  );
  const originationFee = calculateOriginationFee(principalAmount, penalizedLender, creditRating, durationSeasons);

  await applyForLoan(
    penalizedLender.id,
    principalAmount,
    durationSeasons,
    penalizedLender,
    { isForced: true, skipAdministrationPenalty: true, loanCategory: 'emergency' }
  );

  const netDeposit = principalAmount - originationFee;
  const availabilityMessage = availability.isAvailable
    ? 'Credit check passed'
    : 'Credit check failed – emergency override applied';

  await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_FORCED);

  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'company_finance',
    amount_base: EMERGENCY_QUICK_LOAN.PRESTIGE_PENALTY,
    created_game_week: calculateAbsoluteWeeks(gameState.week || 1, gameState.season || 'Spring', gameState.currentYear || 2024),
    decay_rate: EMERGENCY_QUICK_LOAN.PRESTIGE_DECAY_RATE,
    source_id: null,
    payload: {
      reason: 'Emergency Quick Loan',
      lenderName: penalizedLender.name,
      lenderType: penalizedLender.type,
      loanAmount: principalAmount,
      missedPaymentAmount: negativeBalance
    }
  });

  await notificationService.addMessage(
    [
      `Emergency quick loan secured from ${penalizedLender.name}.`,
      `Principal: ${formatNumber(principalAmount, { currency: true })}, Interest: ${formatPercent(effectiveRate)}.`,
      `Origination fee: ${formatNumber(originationFee, { currency: true })} (net deposit ${formatNumber(netDeposit, { currency: true })}).`,
      availabilityMessage
    ].join(' '),
    'loan.emergencyQuickLoan',
    'Emergency Loan Applied',
    NotificationCategory.FINANCE
  );
}

/**
 * Attempt to liquidate bottled cellar inventory for forced debt repayment
 */
type SimCellarBatch = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type SimVineyardEntry = {
  id: string;
  name: string;
  value: number;
};

type SimCellarStepResult = {
  valueRecovered: number;
  saleProceeds: number;
  lots: Array<{
    id: string;
    name: string;
    quantity: number;
    valueRecovered: number;
    saleProceeds: number;
  }>;
};

type SimVineyardStepResult = {
  valueRecovered: number;
  saleProceeds: number;
  vineyard?: {
    id: string;
    name: string;
    valueRecovered: number;
    saleProceeds: number;
  };
};

interface ForcedLoanRestructureExecutionResult {
  totalForcedBalance: number;
  totalValueRecovered: number;
  totalSaleProceeds: number;
  consolidatedPrincipal: number;
  consolidatedLoanId: string | null;
  lenderName?: string | null;
  lenderType?: LenderType | null;
  lenderInterestRate?: number | null;
  lenderDurationSeasons?: number | null;
  lenderOriginationFee?: number | null;
  cellarSummaries: string[];
  vineyardSummaries: string[];
  isEmergencyOverride: boolean;
}

async function selectRestructureLender(
  amount: number,
  lenders?: Lender[]
): Promise<{ lender: Lender | null; isEmergencyOverride: boolean }> {
  const source = lenders ?? await loadLenders();
  const candidatePool = source.filter(
    lender => !lender.blacklisted && (lender.type === 'Bank' || lender.type === 'Investment Fund')
  );

  if (candidatePool.length === 0) {
    return { lender: null, isEmergencyOverride: false };
  }

  const pickRandom = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

  const withinRange = candidatePool.filter(
    lender => amount >= lender.minLoanAmount && amount <= lender.maxLoanAmount
  );

  if (withinRange.length > 0) {
    const bankMatches = withinRange.filter(l => l.type === 'Bank');
    if (bankMatches.length > 0) {
      return { lender: pickRandom(bankMatches), isEmergencyOverride: false };
    }
    return { lender: pickRandom(withinRange), isEmergencyOverride: false };
  }

  return { lender: pickRandom(candidatePool), isEmergencyOverride: true };
}

function simulateCellarLiquidationStep(
  batches: SimCellarBatch[],
  targetValue: number,
  penaltyRate: number
): SimCellarStepResult {
  if (targetValue <= 0 || batches.length === 0) {
    return { valueRecovered: 0, saleProceeds: 0, lots: [] };
  }

  const sorted = [...batches].sort((a, b) => (b.unitPrice * b.quantity) - (a.unitPrice * a.quantity));
  const lots: SimCellarStepResult['lots'] = [];
  let totalRecovered = 0;
  let totalProceeds = 0;
  let remainingTarget = targetValue;

  for (const batch of sorted) {
    if (remainingTarget <= 1) {
      break;
    }

    if (batch.quantity <= 0 || batch.unitPrice <= 0) {
      continue;
    }

    const batchValue = batch.unitPrice * batch.quantity;
    if (batchValue <= 0) {
      continue;
    }

    let quantityToSell = batch.quantity;
    if (batchValue > remainingTarget && batch.quantity > 1) {
      const ratio = Math.min(1, remainingTarget / batchValue);
      quantityToSell = Math.max(1, Math.floor(batch.quantity * ratio));
    }

    if (quantityToSell <= 0) {
      continue;
    }

    const recoveredValue = batch.unitPrice * quantityToSell;
    const proceeds = recoveredValue * (1 - penaltyRate);

    lots.push({
      id: batch.id,
      name: batch.name,
      quantity: quantityToSell,
      valueRecovered: recoveredValue,
      saleProceeds: proceeds
    });

    totalRecovered += recoveredValue;
    totalProceeds += proceeds;
    remainingTarget = Math.max(0, targetValue - totalRecovered);

    batch.quantity = Math.max(0, batch.quantity - quantityToSell);
  }

  return {
    valueRecovered: totalRecovered,
    saleProceeds: totalProceeds,
    lots
  };
}

function simulateVineyardSeizureStep(
  vineyards: SimVineyardEntry[],
  maxValue: number,
  penaltyRate: number
): SimVineyardStepResult {
  if (maxValue <= 0 || vineyards.length === 0) {
    return { valueRecovered: 0, saleProceeds: 0 };
  }

  const sorted = [...vineyards].sort((a, b) => a.value - b.value);
  const target = sorted.find(v => v.value > 0 && v.value <= maxValue);

  if (!target) {
    return { valueRecovered: 0, saleProceeds: 0 };
  }

  const saleProceeds = target.value * (1 - penaltyRate);

  const index = vineyards.findIndex(v => v.id === target.id);
  if (index >= 0) {
    vineyards.splice(index, 1);
  }

  return {
    valueRecovered: target.value,
    saleProceeds,
    vineyard: {
      id: target.id,
      name: target.name,
      valueRecovered: target.value,
      saleProceeds
    }
  };
}

async function liquidateBottledInventory(
  targetValue: number,
  penaltyRate: number,
  transactionLabel: string
): Promise<{ valueRecovered: number; saleProceeds: number; batchSummaries: string[] }> {
  const batches = await loadWineBatches();
  const eligibleBatches = batches.filter(batch => batch.state === 'bottled' && batch.quantity > 0);

  if (eligibleBatches.length === 0) {
    return { valueRecovered: 0, saleProceeds: 0, batchSummaries: [] };
  }

  const totalInventoryValue = eligibleBatches.reduce((sum, batch) => {
    const unitPrice = batch.estimatedPrice ?? batch.askingPrice ?? 10;
    return sum + unitPrice * batch.quantity;
  }, 0);
  const inventoryAllowance =
    totalInventoryValue * LOAN_MISSED_PAYMENT_PENALTIES.WARNING_3.MAX_VINEYARD_SEIZURE_PERCENT;
  const cappedTarget = Math.min(targetValue, inventoryAllowance);

  if (cappedTarget <= 0) {
    return { valueRecovered: 0, saleProceeds: 0, batchSummaries: [] };
  }

  const sortedBatches = [...eligibleBatches].sort((a, b) => {
    const priceA = a.estimatedPrice ?? a.askingPrice ?? 10;
    const priceB = b.estimatedPrice ?? b.askingPrice ?? 10;
    return (priceB * b.quantity) - (priceA * a.quantity);
  });

  const updates: Array<{ id: string; quantity: number }> = [];
  const soldEntries: Array<{ summary: string; proceeds: number }> = [];
  let remainingTarget = cappedTarget;
  let totalRecovered = 0;
  let totalProceeds = 0;

  for (const batch of sortedBatches) {
    if (remainingTarget <= 1) {
      break;
    }

    const unitPrice = batch.estimatedPrice ?? batch.askingPrice ?? 10;
    if (unitPrice <= 0) {
      continue;
    }

    const batchValue = unitPrice * batch.quantity;
    if (batchValue <= 0) {
      continue;
    }

    let quantityToSell = batch.quantity;
    if (batchValue > remainingTarget && batch.quantity > 1) {
      const ratio = Math.min(1, remainingTarget / batchValue);
      quantityToSell = Math.max(1, Math.floor(batch.quantity * ratio));
    }

    if (quantityToSell <= 0) {
      continue;
    }

    const recoveredValue = unitPrice * quantityToSell;
    const proceeds = recoveredValue * (1 - penaltyRate);

    totalRecovered += recoveredValue;
    totalProceeds += proceeds;
    remainingTarget = Math.max(0, cappedTarget - totalRecovered);

    updates.push({
      id: batch.id,
      quantity: Math.max(0, batch.quantity - quantityToSell)
    });

    soldEntries.push({
      summary: `${batch.vineyardName ?? 'Cellar Batch'} (${quantityToSell} units, proceeds ${formatNumber(proceeds, { currency: true })})`,
      proceeds
    });
  }

  if (updates.length > 0) {
    await bulkUpdateWineBatches(
      updates.map(update => ({
        id: update.id,
        updates: { quantity: update.quantity }
      }))
    );

    for (const entry of soldEntries) {
      await addTransaction(
        entry.proceeds,
        `${transactionLabel}: ${entry.summary}`,
        TRANSACTION_CATEGORIES.WINE_SALES,
        false
      );
    }
  }

  return {
    valueRecovered: totalRecovered,
    saleProceeds: totalProceeds,
    batchSummaries: soldEntries.map(entry => entry.summary)
  };
}

async function seizeVineyardForRestructure(
  maxValue: number,
  penaltyRate: number
): Promise<{ valueRecovered: number; saleProceeds: number; vineyardName?: string }> {
  if (maxValue <= 0) {
    return { valueRecovered: 0, saleProceeds: 0 };
  }

  const vineyards = await loadVineyards();
  if (vineyards.length === 0) {
    return { valueRecovered: 0, saleProceeds: 0 };
  }

  const sorted = [...vineyards].sort((a, b) => a.vineyardTotalValue - b.vineyardTotalValue);
  const target = sorted[0];

  if (!target || target.vineyardTotalValue <= 0 || target.vineyardTotalValue > maxValue) {
    return { valueRecovered: 0, saleProceeds: 0 };
  }

  await deleteVineyards([target.id]);

  const valueRecovered = target.vineyardTotalValue;
  const saleProceeds = valueRecovered * (1 - penaltyRate);

  await addTransaction(
    saleProceeds,
    `Forced vineyard seizure: ${target.name}`,
    TRANSACTION_CATEGORIES.VINEYARD_SALE,
    false
  );

  return {
    valueRecovered,
    saleProceeds,
    vineyardName: target.name
  };
}

function buildRestructureOfferDetails(offer: ForcedLoanRestructureOffer): { message: string; details: string } {
  const baseMessage = offer.lender
    ? offer.lender.isEmergencyOverride
      ? `No lender would normally approve this balance, but a ${offer.lender.type} (${offer.lender.name}) is willing to consolidate it under punitive emergency terms.`
      : `A ${offer.lender.type} (${offer.lender.name}) is willing to consolidate your forced quick loans with harsh terms.`
    : 'Asset liquidation alone may cover the forced quick loans.';

  const summaryLines = offer.summaryLines.length
    ? offer.summaryLines.map(line => `• ${line}`)
    : [];

  const stepLines = offer.steps.length
    ? [
        'Proposed sequence:',
        ...offer.steps.map(step =>
          `  ${step.order}. ${step.description} → recovers ${formatNumber(step.valueRecovered, { currency: true })} (${formatNumber(step.saleProceeds, { currency: true })} after penalties)`
        )
      ]
    : ['Proposed sequence:', '  1. No qualifying assets found for liquidation.'];

  const cellarLines = offer.estimatedCellarLots.length
    ? [
        'Targeted cellar lots:',
        ...offer.estimatedCellarLots.map(lot =>
          `  • ${lot.label} → proceeds ${formatNumber(lot.proceeds, { currency: true })}`
        )
      ]
    : ['Targeted cellar lots: none available.'];

  const vineyardLines = offer.estimatedVineyards.length
    ? [
        'Vineyards at risk:',
        ...offer.estimatedVineyards.map(vineyard =>
          `  • ${vineyard.name} → value ${formatNumber(vineyard.valueRecovered, { currency: true })} (${formatNumber(vineyard.saleProceeds, { currency: true })} after penalties)`
        )
      ]
    : ['Vineyards at risk: none within seizure threshold.'];

  const decisionLines = [
    '',
    'Accept → Liquidate assets and consolidate debt under the proposed loan.',
    'Decline → Keep the forced quick loans active and continue managing warnings manually.'
  ];

  return {
    message: `${baseMessage} Decide whether to accept the restructure or keep managing the forced loans yourself.`,
    details: [
      'Offer summary:',
      ...summaryLines,
      '',
      ...stepLines,
      '',
      ...cellarLines,
      '',
      ...vineyardLines,
      ...decisionLines
    ].join('\n')
  };
}

async function createForcedLoanRestructureOffer(forcedLoans: Loan[]): Promise<ForcedLoanRestructureOffer | null> {
  if (forcedLoans.length === 0) {
    return null;
  }

  const totalForcedBalance = forcedLoans.reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0);
  if (totalForcedBalance <= 0) {
    return null;
  }

  const {
    CELLAR_STEP_PERCENT_OF_DEBT,
    MAX_SEIZURE_PERCENT_OF_DEBT,
    SALE_PENALTY_RATE,
    CONSOLIDATED_DURATION_SEASONS,
    INTEREST_PENALTY_MULTIPLIER,
    ORIGINATION_PENALTY_MULTIPLIER,
    PRESTIGE_PENALTY
  } = EMERGENCY_RESTRUCTURE;

  const gameState = getGameState();
  const creditRating = gameState.creditRating ?? CREDIT_RATING.DEFAULT_RATING;
  const economyPhase = (gameState.economyPhase as EconomyPhase) ?? 'Stable';

  const wineBatches = await loadWineBatches();
  const vineyards = await loadVineyards();

  const cellarPool: SimCellarBatch[] = wineBatches
    .filter(batch => batch.state === 'bottled' && batch.quantity > 0)
    .map(batch => ({
      id: batch.id,
      name: batch.vineyardName ?? 'Cellar Batch',
      quantity: batch.quantity,
      unitPrice: batch.estimatedPrice ?? batch.askingPrice ?? 10
    }));

  const vineyardPool: SimVineyardEntry[] = vineyards
    .filter(vineyard => vineyard.vineyardTotalValue > 0)
    .map(vineyard => ({
      id: vineyard.id,
      name: vineyard.name,
      value: vineyard.vineyardTotalValue
    }));

  const totalInventoryValue = cellarPool.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
  const inventoryAllowance =
    totalInventoryValue * LOAN_MISSED_PAYMENT_PENALTIES.WARNING_3.MAX_VINEYARD_SEIZURE_PERCENT;
  const totalPortfolioValue = vineyardPool.reduce((sum, entry) => sum + entry.value, 0);
  const portfolioAllowance =
    totalPortfolioValue * LOAN_MISSED_PAYMENT_PENALTIES.WARNING_3.MAX_VINEYARD_SEIZURE_PERCENT;
  const debtAllowance = totalForcedBalance * MAX_SEIZURE_PERCENT_OF_DEBT;
  const maxSeizureValue = Math.max(0, Math.min(debtAllowance, portfolioAllowance));
  let remainingAllowance = maxSeizureValue;
  let totalValueRecovered = 0;
  let totalSaleProceeds = 0;
  let stepIndex = 0;
  let consecutiveMisses = 0;

  const steps: ForcedLoanRestructureStep[] = [];
  const estimatedCellarLots: ForcedLoanRestructureOffer['estimatedCellarLots'] = [];
  const estimatedVineyards: ForcedLoanRestructureOffer['estimatedVineyards'] = [];

  while (remainingAllowance > 1 && consecutiveMisses < 2) {
    if (stepIndex % 2 === 0) {
      const target = Math.min(remainingAllowance, totalForcedBalance * CELLAR_STEP_PERCENT_OF_DEBT);
      const result = simulateCellarLiquidationStep(cellarPool, target, SALE_PENALTY_RATE);

      if (result.valueRecovered > 0) {
        totalValueRecovered += result.valueRecovered;
        totalSaleProceeds += result.saleProceeds;
        remainingAllowance = Math.max(0, maxSeizureValue - totalValueRecovered);
        steps.push({
          order: steps.length + 1,
          type: 'cellar',
          description: `Liquidate bottled cellar inventory (target ${formatNumber(target, { currency: true })})`,
          valueRecovered: result.valueRecovered,
          saleProceeds: result.saleProceeds
        });
        result.lots.forEach(lot => {
          estimatedCellarLots.push({
            label: `${lot.name} (${lot.quantity} units)`,
            proceeds: lot.saleProceeds,
            valueRecovered: lot.valueRecovered
          });
        });
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += 1;
      }
    } else {
      const result = simulateVineyardSeizureStep(vineyardPool, remainingAllowance, SALE_PENALTY_RATE);

      if (result.valueRecovered > 0 && result.vineyard) {
        totalValueRecovered += result.valueRecovered;
        totalSaleProceeds += result.saleProceeds;
        remainingAllowance = Math.max(0, maxSeizureValue - totalValueRecovered);
        steps.push({
          order: steps.length + 1,
          type: 'vineyard',
          description: `Seize lowest-value vineyard (${result.vineyard.name})`,
          valueRecovered: result.valueRecovered,
          saleProceeds: result.saleProceeds
        });
        estimatedVineyards.push({
          id: result.vineyard.id,
          name: result.vineyard.name,
          valueRecovered: result.vineyard.valueRecovered,
          saleProceeds: result.vineyard.saleProceeds
        });
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += 1;
      }
    }

    if (remainingAllowance <= 1) {
      break;
    }

    stepIndex += 1;
  }

  const consolidatedPrincipalEstimate = Math.max(0, totalForcedBalance - totalSaleProceeds);

  const lenders = await loadLenders();

  let lenderSummary: ForcedLoanRestructureOffer['lender'] = null;

  if (consolidatedPrincipalEstimate > 0) {
    const { lender: restructureLender, isEmergencyOverride } = await selectRestructureLender(
      consolidatedPrincipalEstimate,
      lenders
    );

    if (restructureLender) {
      const interestMultiplier =
        INTEREST_PENALTY_MULTIPLIER *
        (isEmergencyOverride ? EMERGENCY_RESTRUCTURE.OVERRIDE_INTEREST_MULTIPLIER : 1);
      const originationMultiplier =
        ORIGINATION_PENALTY_MULTIPLIER *
        (isEmergencyOverride ? EMERGENCY_RESTRUCTURE.OVERRIDE_ORIGINATION_MULTIPLIER : 1);

      const penalizedLender: Lender = {
        ...restructureLender,
        baseInterestRate: restructureLender.baseInterestRate * interestMultiplier,
        originationFee: {
          ...restructureLender.originationFee,
          basePercent: restructureLender.originationFee.basePercent * originationMultiplier,
          minFee: restructureLender.originationFee.minFee * originationMultiplier,
          maxFee: restructureLender.originationFee.maxFee * originationMultiplier
        }
      };

      const targetDuration = isEmergencyOverride
        ? Math.max(CONSOLIDATED_DURATION_SEASONS, EMERGENCY_RESTRUCTURE.OVERRIDE_DURATION_SEASONS)
        : CONSOLIDATED_DURATION_SEASONS;

      const durationSeasons = Math.min(
        Math.max(penalizedLender.minDurationSeasons, targetDuration),
        penalizedLender.maxDurationSeasons
      );

      const effectiveRate = calculateEffectiveInterestRate(
        penalizedLender.baseInterestRate,
        economyPhase,
        penalizedLender.type,
        creditRating,
        durationSeasons
      );

      const originationEstimate = calculateOriginationFee(
        Math.round(consolidatedPrincipalEstimate),
        penalizedLender,
        creditRating,
        durationSeasons
      );

      lenderSummary = {
        id: penalizedLender.id,
        name: penalizedLender.name,
        type: penalizedLender.type,
        effectiveRate,
        durationSeasons,
        originationFeeEstimate: originationEstimate,
        isEmergencyOverride
      };
    }
  }

  const summaryLines: string[] = [
    `Total forced loan balance: ${formatNumber(totalForcedBalance, { currency: true })}`,
    `Asset seizure cap (50%): ${formatNumber(maxSeizureValue, { currency: true })}`,
    `Estimated liquidation proceeds: ${formatNumber(totalSaleProceeds, { currency: true })}`,
    consolidatedPrincipalEstimate > 0
      ? `Remaining debt to consolidate: ${formatNumber(consolidatedPrincipalEstimate, { currency: true })}`
      : 'Remaining debt to consolidate: 0 (assets expected to cover balance)'
  ];

  summaryLines.push(
    `Seizure cap factors — debt allowance: ${formatNumber(debtAllowance, { currency: true })}, ` +
    `portfolio allowance: ${formatNumber(portfolioAllowance, { currency: true })}, ` +
    `inventory allowance: ${formatNumber(inventoryAllowance, { currency: true })}`
  );

  if (lenderSummary) {
    const years = Math.round((lenderSummary.durationSeasons / 4) * 10) / 10;
    summaryLines.push(
      `Proposed lender: ${lenderSummary.name} (${lenderSummary.type}) at ${formatPercent(lenderSummary.effectiveRate)} over approximately ${years} years`
    );
    summaryLines.push(
      `Estimated origination fee: ${formatNumber(lenderSummary.originationFeeEstimate, { currency: true })}`
    );
    if (lenderSummary.isEmergencyOverride) {
      summaryLines.push('Emergency override applied: lender is only willing to proceed with more punitive rates, extended duration, and amplified fees.');
    }
  } else {
    summaryLines.push('No bank or investment fund qualified; forced loans remain active and must be managed manually.');
  }

  summaryLines.push(`Prestige impact if accepted: ${PRESTIGE_PENALTY}`);

  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    forcedLoanIds: forcedLoans.map(loan => loan.id),
    totalForcedBalance,
    maxSeizureValue,
    steps,
    estimatedCellarLots,
    estimatedVineyards,
    consolidatedPrincipalEstimate,
    lender: lenderSummary,
    prestigePenalty: PRESTIGE_PENALTY,
    summaryLines
  };
}

async function executeForcedLoanRestructure(offer: ForcedLoanRestructureOffer): Promise<ForcedLoanRestructureExecutionResult> {
  const activeLoans = await loadActiveLoans();
  const forcedLoans = activeLoans.filter(loan => loan.isForced);

  if (forcedLoans.length === 0) {
    throw new Error('No forced loans available for restructure.');
  }

  const totalForcedBalance = forcedLoans.reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0);
  if (totalForcedBalance <= 0) {
    await Promise.all(
      forcedLoans.map(loan =>
        updateLoan(loan.id, {
          status: 'paid_off',
          remainingBalance: 0,
          seasonsRemaining: 0,
          missedPayments: 0,
          isForced: false
        })
      )
    );

    return {
      totalForcedBalance,
      totalValueRecovered: 0,
      totalSaleProceeds: 0,
      consolidatedPrincipal: 0,
      consolidatedLoanId: null,
      cellarSummaries: [],
      vineyardSummaries: [],
      isEmergencyOverride: false
    };
  }

  const {
    CELLAR_STEP_PERCENT_OF_DEBT,
    MAX_SEIZURE_PERCENT_OF_DEBT,
    SALE_PENALTY_RATE,
    CONSOLIDATED_DURATION_SEASONS,
    INTEREST_PENALTY_MULTIPLIER,
    ORIGINATION_PENALTY_MULTIPLIER,
    PRESTIGE_PENALTY,
    PRESTIGE_DECAY_RATE
  } = EMERGENCY_RESTRUCTURE;

  const portfolioVineyards = await loadVineyards();
  const totalPortfolioValue = portfolioVineyards.reduce((sum, vineyard) => sum + vineyard.vineyardTotalValue, 0);
  const portfolioAllowance =
    totalPortfolioValue * LOAN_MISSED_PAYMENT_PENALTIES.WARNING_3.MAX_VINEYARD_SEIZURE_PERCENT;
  const debtAllowance = totalForcedBalance * MAX_SEIZURE_PERCENT_OF_DEBT;
  const maxSeizureValue = Math.max(0, Math.min(debtAllowance, portfolioAllowance));

  let remainingAllowance = maxSeizureValue;
  let totalValueRecovered = 0;
  let totalSaleProceeds = 0;
  const cellarSummaries: string[] = [];
  const vineyardSummaries: string[] = [];
  let stepIndex = 0;
  let consecutiveMisses = 0;

  while (remainingAllowance > 1 && consecutiveMisses < 2) {
    if (stepIndex % 2 === 0) {
      const cellarTarget = Math.min(remainingAllowance, totalForcedBalance * CELLAR_STEP_PERCENT_OF_DEBT);
      const cellarResult = await liquidateBottledInventory(
        cellarTarget,
        SALE_PENALTY_RATE,
        'Forced cellar liquidation'
      );

      if (cellarResult.valueRecovered > 0) {
        totalValueRecovered += cellarResult.valueRecovered;
        totalSaleProceeds += cellarResult.saleProceeds;
        remainingAllowance = Math.max(0, maxSeizureValue - totalValueRecovered);
        cellarSummaries.push(...cellarResult.batchSummaries);
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += 1;
      }
    } else {
      const vineyardResult = await seizeVineyardForRestructure(remainingAllowance, SALE_PENALTY_RATE);

      if (vineyardResult.valueRecovered > 0) {
        totalValueRecovered += vineyardResult.valueRecovered;
        totalSaleProceeds += vineyardResult.saleProceeds;
        remainingAllowance = Math.max(0, maxSeizureValue - totalValueRecovered);
        if (vineyardResult.vineyardName) {
          vineyardSummaries.push(
            `${vineyardResult.vineyardName} (${formatNumber(vineyardResult.saleProceeds, { currency: true })})`
          );
        }
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += 1;
      }
    }

    if (remainingAllowance <= 1) {
      break;
    }

    stepIndex += 1;
  }

  const consolidatedPrincipal = Math.max(0, totalForcedBalance - totalSaleProceeds);
  let effectiveConsolidatedPrincipal = consolidatedPrincipal;

  await Promise.all(
    forcedLoans.map(async loan => {
      await updateLoan(loan.id, {
        status: 'paid_off',
        remainingBalance: 0,
        seasonsRemaining: 0,
        missedPayments: 0,
        isForced: false
      });
      await clearLoanWarning(loan.id).catch(() => undefined);
    })
  );

  let consolidatedLoanId: string | null = null;
  let lenderName: string | null = null;
  let lenderType: LenderType | null = null;
  let lenderInterestRate: number | null = null;
  let lenderDurationSeasons: number | null = null;
  let lenderOriginationFee: number | null = null;
  let isEmergencyOverride = offer.lender?.isEmergencyOverride ?? false;

  if (consolidatedPrincipal > 0) {
    const lenders = await loadLenders();
    let restructureLender: Lender | null = null;

    if (offer.lender?.id) {
      restructureLender = lenders.find(l => l.id === offer.lender?.id) ?? null;
    }

    if (!restructureLender) {
      const selection = await selectRestructureLender(consolidatedPrincipal, lenders);
      restructureLender = selection.lender;
      if (selection.lender) {
        isEmergencyOverride = offer.lender?.isEmergencyOverride ? true : selection.isEmergencyOverride;
      }
    }

    if (restructureLender) {
      const creditRating = getGameState().creditRating ?? CREDIT_RATING.DEFAULT_RATING;
      const economyPhase = (getGameState().economyPhase as EconomyPhase) ?? 'Stable';

      const interestMultiplier =
        INTEREST_PENALTY_MULTIPLIER *
        (isEmergencyOverride ? EMERGENCY_RESTRUCTURE.OVERRIDE_INTEREST_MULTIPLIER : 1);
      const originationMultiplier =
        ORIGINATION_PENALTY_MULTIPLIER *
        (isEmergencyOverride ? EMERGENCY_RESTRUCTURE.OVERRIDE_ORIGINATION_MULTIPLIER : 1);

      const penalizedLender: Lender = {
        ...restructureLender,
        baseInterestRate: restructureLender.baseInterestRate * interestMultiplier,
        originationFee: {
          ...restructureLender.originationFee,
          basePercent: restructureLender.originationFee.basePercent * originationMultiplier,
          minFee: restructureLender.originationFee.minFee * originationMultiplier,
          maxFee: restructureLender.originationFee.maxFee * originationMultiplier
        }
      };

      const targetDuration = isEmergencyOverride
        ? Math.max(CONSOLIDATED_DURATION_SEASONS, EMERGENCY_RESTRUCTURE.OVERRIDE_DURATION_SEASONS)
        : CONSOLIDATED_DURATION_SEASONS;

      const durationSeasons = Math.min(
        Math.max(penalizedLender.minDurationSeasons, targetDuration),
        penalizedLender.maxDurationSeasons
      );

      let adjustedPrincipal = Math.round(consolidatedPrincipal);
      if (!isEmergencyOverride) {
        adjustedPrincipal = Math.min(
          penalizedLender.maxLoanAmount,
          Math.max(penalizedLender.minLoanAmount, adjustedPrincipal)
        );
      } else {
        adjustedPrincipal = Math.min(
          penalizedLender.maxLoanAmount,
          Math.max(penalizedLender.minLoanAmount, adjustedPrincipal)
        );
      }

      effectiveConsolidatedPrincipal = adjustedPrincipal;

      lenderInterestRate = calculateEffectiveInterestRate(
        penalizedLender.baseInterestRate,
        economyPhase,
        penalizedLender.type,
        creditRating,
        durationSeasons
      );

      lenderOriginationFee = calculateOriginationFee(
        adjustedPrincipal,
        penalizedLender,
        creditRating,
        durationSeasons
      );

      consolidatedLoanId = await applyForLoan(
        penalizedLender.id,
        adjustedPrincipal,
        durationSeasons,
        penalizedLender,
        { skipAdministrationPenalty: true, loanCategory: 'restructured' }
      );

      lenderName = penalizedLender.name;
      lenderType = penalizedLender.type;
      lenderDurationSeasons = durationSeasons;
    }
  }

  const gameState = getGameState();
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'company_finance',
    amount_base: PRESTIGE_PENALTY,
    created_game_week: calculateAbsoluteWeeks(gameState.week || 1, gameState.season || 'Spring', gameState.currentYear || 2024),
    decay_rate: PRESTIGE_DECAY_RATE,
    source_id: null,
    payload: {
      reason: 'Forced Loan Restructure',
      lenderName: consolidatedLoanId ? lenderName ?? 'Consolidated Lender' : 'Asset Liquidation',
      lenderType: lenderType ?? 'Bank',
      loanAmount: consolidatedPrincipal,
      missedPaymentAmount: totalForcedBalance
    }
  });

  await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_RESTRUCTURE);

  triggerGameUpdate();

  return {
    totalForcedBalance,
    totalValueRecovered,
    totalSaleProceeds,
    consolidatedPrincipal: effectiveConsolidatedPrincipal,
    consolidatedLoanId,
    lenderName,
    lenderType,
    lenderInterestRate,
    lenderDurationSeasons,
    lenderOriginationFee,
    cellarSummaries,
    vineyardSummaries,
    isEmergencyOverride
  };
}

function buildRestructureCompletionMessage(
  result: ForcedLoanRestructureExecutionResult,
  prestigePenalty: number
): string {
  const lines: string[] = [
    'Restructure accepted. Summary:',
    `• Forced loan balance entering restructure: ${formatNumber(result.totalForcedBalance, { currency: true })}`,
    `• Assets liquidated: ${formatNumber(result.totalSaleProceeds, { currency: true })} (pre-penalty value ${formatNumber(result.totalValueRecovered, { currency: true })})`
  ];

  if (result.cellarSummaries.length > 0) {
    lines.push('• Cellar lots sold:');
    result.cellarSummaries.forEach(summary => {
      lines.push(`   ◦ ${summary}`);
    });
  } else {
    lines.push('• Cellar lots sold: none');
  }

  if (result.vineyardSummaries.length > 0) {
    lines.push('• Vineyards seized:');
    result.vineyardSummaries.forEach(summary => {
      lines.push(`   ◦ ${summary}`);
    });
  } else {
    lines.push('• Vineyards seized: none');
  }

  if (result.consolidatedLoanId) {
    const years = result.lenderDurationSeasons
      ? Math.round((result.lenderDurationSeasons / 4) * 10) / 10
      : null;
    const rateLabel = result.lenderInterestRate !== null && result.lenderInterestRate !== undefined
      ? formatPercent(result.lenderInterestRate)
      : null;

    lines.push(
      `• Consolidated loan: ${formatNumber(result.consolidatedPrincipal, { currency: true })}` +
        (result.lenderName ? ` with ${result.lenderName}` : '') +
        (rateLabel ? ` at ${rateLabel}` : '') +
        (years ? ` over ≈${years} years` : '') +
        (result.lenderType ? ` (${result.lenderType})` : '')
    );

    if (result.lenderOriginationFee) {
      lines.push(`• Origination fee charged: ${formatNumber(result.lenderOriginationFee, { currency: true })}`);
    }
    if (result.isEmergencyOverride) {
      lines.push('• Emergency override terms applied: lender proceeded only with punitive rates, extended duration, and amplified fees.');
    }
  } else {
    lines.push('• All forced debt cleared via asset liquidation.');
  }

  lines.push(`• Prestige impact applied: ${prestigePenalty}`);

  return lines.join('\n');
}

/**
 * Offer a forced loan restructure to the player (triggered at New Year)
 */
export async function restructureForcedLoansIfNeeded(): Promise<void> {
  const activeLoans = await loadActiveLoans();
  const forcedLoans = activeLoans.filter(loan => loan.isForced);
  const gameState = getGameState();
  const existingOffer = gameState.pendingForcedLoanRestructure;

  if (forcedLoans.length === 0) {
    if (existingOffer) {
      await updateGameState({ pendingForcedLoanRestructure: null });
    }
    return;
  }

  const offer = await createForcedLoanRestructureOffer(forcedLoans);

  if (!offer) {
    await updateGameState({ pendingForcedLoanRestructure: null });
    return;
  }

  if (!existingOffer || existingOffer.id !== offer.id) {
    await updateGameState({ pendingForcedLoanRestructure: offer });

    const { message, details } = buildRestructureOfferDetails(offer);
    const primaryLoan = forcedLoans[0];

    await queueLoanWarningModal({
      loanId: primaryLoan.id,
      lenderName: primaryLoan.lenderName,
      missedPayments: primaryLoan.missedPayments ?? 0,
      severity: 'error',
      title: 'Emergency Restructure Offer',
      message,
      details,
      decision: {
        type: 'forcedLoanRestructure',
        offerId: offer.id
      },
      penalties: {}
    });
  }
}

export async function acceptForcedLoanRestructure(offerId: string): Promise<void> {
  const gameState = getGameState();
  const offer = gameState.pendingForcedLoanRestructure;

  if (!offer || offer.id !== offerId) {
    await notificationService.addMessage(
      'No restructure offer is currently available. Forced loans remain active.',
      'loan.emergencyRestructureMissing',
      'Forced Loan Restructure',
      NotificationCategory.FINANCE
    );
    return;
  }

  try {
    const result = await executeForcedLoanRestructure(offer);
    await updateGameState({ pendingForcedLoanRestructure: null });

    const summaryMessage = buildRestructureCompletionMessage(result, offer.prestigePenalty);

    await notificationService.addMessage(
      summaryMessage,
      'loan.emergencyRestructureAccepted',
      'Forced Loan Restructure',
      NotificationCategory.FINANCE
    );
  } catch (error) {
    console.error('Error applying forced loan restructure:', error);
    await notificationService.addMessage(
      'Restructure failed to apply. Forced quick loans remain active.',
      'loan.emergencyRestructureFailed',
      'Forced Loan Restructure',
      NotificationCategory.FINANCE
    );
  }
}

export async function declineForcedLoanRestructure(offerId: string): Promise<void> {
  const gameState = getGameState();
  const offer = gameState.pendingForcedLoanRestructure;

  if (!offer || offer.id !== offerId) {
    return;
  }

  await updateGameState({ pendingForcedLoanRestructure: null });

  await notificationService.addMessage(
    'You declined the restructuring offer. Forced quick loans remain active and will progress through the normal warning cycle.',
    'loan.emergencyRestructureDeclined',
    'Forced Loan Restructure',
    NotificationCategory.FINANCE
  );
}

/**
 * Make an extra seasonal loan payment (plus administration fee) to clear warnings
 */
export async function makeExtraLoanPayment(loanId: string): Promise<void> {
  const activeLoans = await loadActiveLoans();
  const loan = activeLoans.find(l => l.id === loanId);

  if (!loan) {
    throw new Error('Loan not found');
  }

  if (loan.status !== 'active') {
    throw new Error('Only active loans accept extra payments');
  }

  const gameState = getGameState();
  const availableMoney = gameState.money || 0;

  const administrationFee = Math.max(
    Math.round(loan.seasonalPayment * LOAN_EXTRA_PAYMENT.ADMIN_FEE_RATE),
    LOAN_EXTRA_PAYMENT.MIN_ADMIN_FEE
  );

  const totalPayment = Math.round(loan.seasonalPayment) + administrationFee;

  if (availableMoney < totalPayment) {
    throw new Error('Insufficient funds to apply extra payment');
  }

  // Apply payment transactions
  await addTransaction(
    -Math.round(loan.seasonalPayment),
    `Extra payment to ${loan.lenderName}`,
    TRANSACTION_CATEGORIES.LOAN_PAYMENT,
    false
  );

  await addTransaction(
    -administrationFee,
    `Administration fee for extra payment to ${loan.lenderName}`,
    TRANSACTION_CATEGORIES.LOAN_EXTRA_PAYMENT_FEE,
    false
  );

  const newBalance = Math.max(0, loan.remainingBalance - Math.round(loan.seasonalPayment));
  const updateData: Partial<Loan> = {
    remainingBalance: newBalance,
    missedPayments: 0
  };

  if (loan.seasonsRemaining > 0) {
    updateData.seasonsRemaining = Math.max(0, loan.seasonsRemaining - 1);
  }

  if (newBalance <= 0) {
    updateData.status = 'paid_off';
    updateData.seasonsRemaining = 0;
  }

  await updateLoan(loan.id, updateData);
  await clearLoanWarning(loan.id).catch(() => undefined);

  await notificationService.addMessage(
    `Extra payment of ${formatNumber(totalPayment, { currency: true })} applied to ${loan.lenderName}. Loan warnings cleared.`,
    'loan.extraPayment',
    'Loan Extra Payment',
    NotificationCategory.FINANCE
  );

  await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_EXTRA_PAYMENT);

  triggerGameUpdate();
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
  const currentSeasonIndex = SEASON_ORDER.indexOf(currentDate.season);
  const nextSeasonIndex = (currentSeasonIndex + 1) % SEASON_ORDER.length;
  const nextSeason = SEASON_ORDER[nextSeasonIndex];
  const wrapsToNextYear = nextSeasonIndex === 0;

  return {
    week: 1,
    season: nextSeason,
    year: currentDate.year + (wrapsToNextYear ? 1 : 0)
  };
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

export function estimatePrepaymentPenalty(loan: Loan): number {
  const remainingInterest = Math.max(0, calculateRemainingInterest(loan));
  return calculatePrepaymentPenalty(remainingInterest);
}

function calculatePrepaymentPenalty(remainingInterest: number): number {
  if (remainingInterest <= 0) {
    return 0;
  }

  const rawPenalty = remainingInterest * LOAN_PREPAYMENT.REMAINING_INTEREST_FACTOR;
  const boundedPenalty = Math.min(
    remainingInterest,
    Math.max(LOAN_PREPAYMENT.MIN_PENALTY, rawPenalty)
  );

  return Math.round(boundedPenalty);
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
    const remainingInterest = Math.max(0, calculateRemainingInterest(loan));
    const prepaymentPenalty = calculatePrepaymentPenalty(remainingInterest);
    const totalPayoffCost = loan.remainingBalance + prepaymentPenalty;
    
    if (availableMoney < totalPayoffCost) {
      const shortfall = totalPayoffCost - availableMoney;
      await notificationService.addMessage(
        [
          `Unable to repay loan from ${loan.lenderName}.`,
          `You are short by ${formatNumber(shortfall, { currency: true })}.`,
          'Add funds or wait for additional income before attempting a full payoff.'
        ].join(' '),
        'loan.earlyPayoffInsufficientFunds',
        'Insufficient Balance',
        NotificationCategory.FINANCE
      );
      return;
    }
    
    // Deduct remaining balance from company money
    await addTransaction(
      -loan.remainingBalance,
      `Early loan payoff to ${loan.lenderName}`,
      TRANSACTION_CATEGORIES.LOAN_PAYMENT,
      false
    );

    if (prepaymentPenalty > 0) {
      await addTransaction(
        -prepaymentPenalty,
        `Early payoff indemnity for ${loan.lenderName}`,
        TRANSACTION_CATEGORIES.LOAN_PREPAYMENT_FEE,
        false
      );
    }
    
    // Update loan status to paid off
    await updateLoan(loanId, {
      remainingBalance: 0,
      seasonsRemaining: 0,
      status: 'paid_off'
    });
    
    // Credit rating will be recalculated automatically with comprehensive system
    // Early payoff typically improves credit rating
    
    await notificationService.addMessage(
      [
        `Loan from ${loan.lenderName} paid off early!`,
        prepaymentPenalty > 0
          ? `Prepayment indemnity charged: ${formatNumber(prepaymentPenalty, { currency: true })}.`
          : '',
        'Credit rating improved.'
      ].filter(Boolean).join(' '),
      'loan.earlyPayoff',
      'Loan Update',
      NotificationCategory.FINANCE
    );
    
    await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_FULL_REPAYMENT);
    
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

  const inventoryResult = await liquidateBottledInventory(
    loan.remainingBalance * penalties.MAX_VINEYARD_SEIZURE_PERCENT,
    EMERGENCY_RESTRUCTURE.SALE_PENALTY_RATE,
    'Forced cellar liquidation'
  );

  // Seize vineyards to cover debt (up to 50% of portfolio VALUE)
  const seizureResult = await seizeVineyardsForDebt(loan);

  // Now use ALL available money (including liquidation proceeds) to repay loan
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

  const inventoryDetails =
    inventoryResult.valueRecovered > 0
      ? `• Cellar lots sold: ${inventoryResult.batchSummaries.join('; ')}`
      : '• No bottled inventory available for liquidation';

  const vineyardDetails =
    seizureResult.vineyardsSeized > 0
      ? `• ${seizureResult.vineyardsSeized} vineyard(s) forcibly sold`
      : '• Attempted to seize vineyards but none available';

  // Queue warning modal
  const warning: PendingLoanWarning = {
    loanId: loan.id,
    lenderName: loan.lenderName,
    missedPayments: 3,
    severity: 'critical',
    title: 'Missed Loan Payment - Warning #3: VINEYARD SEIZURE',
    message: `You have missed 3 consecutive payments to ${loan.lenderName}. Emergency measures are being taken.`,
    details: `Penalties Applied:\n${inventoryDetails}\n${vineyardDetails}\n• Vineyard value seized: ${formatNumber(seizureResult.valueRecovered, { currency: true })}\n• Sale proceeds (after 25% penalty): ${formatNumber(seizureResult.saleProceeds, { currency: true })}\n• Credit rating decreased by ${Math.abs(penalties.CREDIT_RATING_LOSS * 100).toFixed(0)}%\n• Additional ${penalties.BOOKKEEPING_WORK} work units added to next bookkeeping\n\n${inventoryResult.batchSummaries.length > 0 ? `Cellar Lots Liquidated:\n${inventoryResult.batchSummaries.map(summary => `• ${summary}`).join('\n')}` : 'No bottled inventory liquidated'}\n\n${seizureResult.vineyardNames.length > 0 ? `Vineyards Sold:\n${seizureResult.vineyardNames.map(name => `• ${name}`).join('\n')}` : 'No vineyards available for seizure'}\n\nRemaining loan balance: ${formatNumber(loan.remainingBalance, { currency: true })}\n\n🚨 FINAL WARNING: One more missed payment will result in FULL DEFAULT with permanent lender blacklist!`,
    penalties: {
      vineyardsSeized: seizureResult.vineyardsSeized,
      vineyardNames: seizureResult.vineyardNames,
      creditRatingLoss: penalties.CREDIT_RATING_LOSS,
      bookkeepingWork: penalties.BOOKKEEPING_WORK
    }
  };

  await queueLoanWarningModal(warning);

  const inventorySummary =
    inventoryResult.valueRecovered > 0
      ? `${inventoryResult.batchSummaries.length} cellar lot(s) liquidated for ${formatNumber(inventoryResult.saleProceeds, { currency: true })}`
      : 'No bottled inventory available for liquidation';

  await notificationService.addMessage(
    `THIRD missed payment to ${loan.lenderName}! ${inventorySummary}. ${seizureResult.vineyardsSeized} vineyard(s) forcibly sold for ${formatNumber(seizureResult.valueRecovered, { currency: true })}. WARNING #3 - FINAL WARNING!`,
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

