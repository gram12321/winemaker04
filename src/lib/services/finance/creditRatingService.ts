import { calculateFinancialData, calculateCompanyValue } from './financeService';
import { loadActiveLoans } from '../../database/core/loansDB';
import { loadTransactions } from './financeService';
import { calculateCompanyWeeks, clamp01 } from '@/lib/utils';
import { getCurrentCompany } from '../core/gameState';
import { vineyardAgePrestigeModifier } from '@/lib/utils/calculator';
import { calculateConsistencyScore } from '@/lib/utils/consistencyUtils';
import { CREDIT_RATING_WEIGHTS, CREDIT_RATING_CONSTANTS } from '@/lib/constants';


// Credit rating calculation interfaces
export interface CreditRatingBreakdown {
  baseRating: number;
  assetHealth: {
    debtToAssetRatio: number; // Raw ratio
    assetCoverage: number; // Raw ratio
    liquidityRatio: number; // Raw ratio
    fixedAssetRatio: number; // Raw ratio (fixed assets / total assets)
    // Normalized components (0-1)
    normalizedDebtToAsset: number; // 0-1 (lower debt = higher score)
    normalizedAssetCoverage: number; // 0-1 (higher coverage = higher score)
    normalizedLiquidity: number; // 0-1 (higher liquidity = higher score)
    normalizedFixedAssets: number; // 0-1 (higher fixed assets = higher score)
    score: number; // 0-1 (weighted average of normalized components)
  };
  paymentHistory: {
    onTimePayments: number;
    loanPayoffs: number;
    missedPayments: number;
    consecutiveMissedPayments: number;
    // Normalized components (0-1)
    normalizedOnTimePayments: number; // 0-1
    normalizedLoanPayoffs: number; // 0-1
    normalizedMissedPayments: number; // 0-1 (inverse, lower missed = higher score)
    score: number; // 0-1 (weighted average of normalized components)
  };
  companyStability: {
    companyAge: number; // in years
    profitConsistency: number; // Raw consistency metric
    expenseEfficiency: number; // Raw efficiency metric
    // Normalized components (0-1)
    normalizedAge: number; // 0-1 (0 years = 0.0, 10+ years = 1.0)
    normalizedProfitConsistency: number; // 0-1
    normalizedExpenseEfficiency: number; // 0-1
    score: number; // 0-1 (weighted average of normalized components)
  };
  negativeBalance: {
    consecutiveWeeksNegative: number;
    penaltyPerWeek: number;
    normalizedWeeks: number; // 0-1 (0 weeks = 0.0, 15+ weeks = 1.0)
    score: number; // 0 to -1 (penalty, normalized)
  };
  finalRating: number;
}

export interface ProfitHistory {
  seasonal: Array<{
    year: number;
    season: string;
    profit: number;
  }>;
  yearly: Array<{
    year: number;
    profit: number;
  }>;
  last4Seasons: number[];
  last10Years: number[];
}


/**
 * Calculate comprehensive credit rating with all factors
 * 
 * IMPORTANT: Credit Rating vs Share Price Separation
 * This service calculates CREDIT RATING which is focused on RISK and CREDITWORTHINESS.
 * Share price valuation (in shareValuationService.ts) uses credit rating as ONE input among many,
 * but uses different metrics for PERFORMANCE and VALUE.
 * 
 * Components kept in Credit Rating Only (risk-focused):
 * - Asset health (debt-to-asset, liquidity) - risk indicators
 * - Payment history - creditworthiness signal
 * - Negative balance penalties - risk signal
 * 
 * Components used differently in Share Price:
 * - Profit consistency (credit) → Profit margin + growth trends (share price)
 * - Expense efficiency (credit) → Profit margin (share price)
 * - Company age (credit) → Used in both (stability signal)
 */
export async function calculateCreditRating(): Promise<CreditRatingBreakdown> {
  const company = getCurrentCompany();
  
  if (!company) {
    throw new Error('No active company found');
  }

  // Get financial data and outstanding loans
  const [financialData, activeLoans, transactions] = await Promise.all([
    calculateFinancialData('year'),
    loadActiveLoans(),
    loadTransactions()
  ]);

  // Calculate outstanding loan amount
  const outstandingLoans = activeLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);

  const assetHealth = calculateAssetHealth(financialData.totalAssets, outstandingLoans, financialData.cashMoney, financialData.currentAssets, financialData.fixedAssets);
  const paymentHistory = await calculatePaymentHistory(activeLoans, transactions);
  const companyStability = await calculateCompanyStability(company, transactions);
  const negativeBalance = await calculateNegativeBalancePenalty(company.money);

  const finalRating = Math.max(
    CREDIT_RATING_CONSTANTS.MIN_RATING,
    Math.min(
      CREDIT_RATING_CONSTANTS.MAX_RATING,
      CREDIT_RATING_CONSTANTS.BASE_RATING + 
      (assetHealth.score * CREDIT_RATING_WEIGHTS.assetHealth) + 
      (paymentHistory.score * CREDIT_RATING_WEIGHTS.paymentHistory) + 
      (companyStability.score * CREDIT_RATING_WEIGHTS.companyStability) +
      negativeBalance.score
    )
  );

  return {
    baseRating: CREDIT_RATING_CONSTANTS.BASE_RATING,
    assetHealth,
    paymentHistory,
    companyStability,
    negativeBalance,
    finalRating
  };
}

/**
 * Normalize debt-to-asset ratio to 0-1 (lower debt = higher score)
 * Uses smooth continuous function: 0% = 1.0, 100% = 0.0
 * Heavily penalizes high debt ratios using exponential decay
 */
function normalizeDebtToAssetRatio(ratio: number): number {
  if (ratio <= 0) return 1.0;
  if (ratio >= 1.0) return 0.0;
  
  return clamp01(1 - Math.pow(ratio, 1.5));
}

/**
 * Normalize asset coverage to 0-1 (higher coverage = higher score)
 * 0x = 0.0, 2x = 0.33, 3x = 0.67, 5x+ = 1.0
 */
function normalizeAssetCoverage(coverage: number): number {
  if (coverage >= 999) return 1.0;
  if (coverage >= CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_EXCELLENT) return 1.0;
  if (coverage >= CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_GOOD) {
    return 0.67 + ((coverage - CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_GOOD) / 
                   (CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_EXCELLENT - CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_GOOD)) * 0.33;
  }
  if (coverage >= CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_FAIR) {
    return 0.33 + ((coverage - CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_FAIR) / 
                   (CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_GOOD - CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_FAIR)) * 0.34;
  }
  return Math.max(0, (coverage / CREDIT_RATING_CONSTANTS.ASSET_COVERAGE_FAIR) * 0.33);
}

/**
 * Normalize liquidity ratio to 0-1 (higher liquidity = higher score)
 * 0x = 0.0, 0.5x = 0.17, 1x = 0.5, 2x+ = 1.0
 */
function normalizeLiquidityRatio(liquidity: number): number {
  if (liquidity >= 999) return 1.0;
  if (liquidity >= CREDIT_RATING_CONSTANTS.LIQUIDITY_EXCELLENT) return 1.0;
  if (liquidity >= CREDIT_RATING_CONSTANTS.LIQUIDITY_GOOD) {
    return 0.5 + ((liquidity - CREDIT_RATING_CONSTANTS.LIQUIDITY_GOOD) / 
                 (CREDIT_RATING_CONSTANTS.LIQUIDITY_EXCELLENT - CREDIT_RATING_CONSTANTS.LIQUIDITY_GOOD)) * 0.5;
  }
  if (liquidity >= CREDIT_RATING_CONSTANTS.LIQUIDITY_FAIR) {
    return 0.17 + ((liquidity - CREDIT_RATING_CONSTANTS.LIQUIDITY_FAIR) / 
                   (CREDIT_RATING_CONSTANTS.LIQUIDITY_GOOD - CREDIT_RATING_CONSTANTS.LIQUIDITY_FAIR)) * 0.33;
  }
  return Math.max(0, (liquidity / CREDIT_RATING_CONSTANTS.LIQUIDITY_FAIR) * 0.17);
}

/**
 * Normalize fixed asset ratio to 0-1 (higher fixed assets = higher score)
 * 0% = 0.0, 20% = 0.33, 40% = 0.67, 60%+ = 1.0
 */
function normalizeFixedAssetRatio(ratio: number): number {
  if (ratio >= 0.6) return 1.0;
  if (ratio >= 0.4) {
    return 0.67 + ((ratio - 0.4) / 0.2) * 0.33;
  }
  if (ratio >= 0.2) {
    return 0.33 + ((ratio - 0.2) / 0.2) * 0.34;
  }
  return Math.max(0, (ratio / 0.2) * 0.33);
}

/**
 * Calculate asset health factors with normalized 0-1 components
 */
function calculateAssetHealth(
  totalAssets: number, 
  outstandingLoans: number, 
  cash: number, 
  liquidAssets: number,
  fixedAssets: number
): CreditRatingBreakdown['assetHealth'] {
  const debtToAssetRatio = outstandingLoans > 0 ? outstandingLoans / totalAssets : 0;
  const assetCoverage = outstandingLoans > 0 ? totalAssets / outstandingLoans : 999;
  const liquidityRatio = outstandingLoans > 0 ? (cash + liquidAssets) / outstandingLoans : 999;
  const fixedAssetRatio = totalAssets > 0 ? fixedAssets / totalAssets : 0;
  
  const normalizedDebtToAsset = clamp01(normalizeDebtToAssetRatio(debtToAssetRatio));
  const normalizedAssetCoverage = clamp01(normalizeAssetCoverage(assetCoverage));
  const normalizedLiquidity = clamp01(normalizeLiquidityRatio(liquidityRatio));
  const normalizedFixedAssets = clamp01(normalizeFixedAssetRatio(fixedAssetRatio));
  
  const score = 
    (normalizedDebtToAsset * CREDIT_RATING_WEIGHTS.assetHealth_debtToAsset) +
    (normalizedAssetCoverage * CREDIT_RATING_WEIGHTS.assetHealth_assetCoverage) +
    (normalizedLiquidity * CREDIT_RATING_WEIGHTS.assetHealth_liquidity) +
    (normalizedFixedAssets * CREDIT_RATING_WEIGHTS.assetHealth_fixedAssets);
  
  return {
    debtToAssetRatio,
    assetCoverage,
    liquidityRatio,
    fixedAssetRatio,
    normalizedDebtToAsset,
    normalizedAssetCoverage,
    normalizedLiquidity,
    normalizedFixedAssets,
    score: clamp01(score)
  };
}

/**
 * Normalize payment history components to 0-1
 */
function normalizeOnTimePayments(count: number): number {
  const reference = CREDIT_RATING_CONSTANTS.PAYMENT_HISTORY_REFERENCE_PAYMENTS;
  return clamp01(count / reference);
}

function normalizeLoanPayoffs(count: number): number {
  const reference = CREDIT_RATING_CONSTANTS.PAYMENT_HISTORY_REFERENCE_PAYOFFS;
  return clamp01(count / reference);
}

function normalizeMissedPayments(count: number): number {
  if (count === 0) return 1.0;
  if (count === 1) return 0.5;
  if (count === 2) return 0.25;
  return 0.0;
}

/**
 * Calculate payment history factors with normalized 0-1 components
 */
async function calculatePaymentHistory(
  activeLoans: any[], 
  transactions: any[]
): Promise<CreditRatingBreakdown['paymentHistory']> {
  const loanTransactions = transactions.filter(t => 
    t.category === 'Loan Payment' || t.category === 'Loan Received'
  );
  
  let onTimePayments = 0;
  let loanPayoffs = 0;
  let missedPayments = 0;
  let consecutiveMissedPayments = 0;
  
  onTimePayments = loanTransactions.filter(t => t.amount < 0).length;
  loanPayoffs = Math.floor(onTimePayments / 4);
  missedPayments = activeLoans.reduce((sum, loan) => sum + (loan.missedPayments || 0), 0);
  consecutiveMissedPayments = activeLoans.reduce((sum, loan) => {
    return sum + Math.max(0, (loan.missedPayments || 0) - 1);
  }, 0);
  
  const normalizedOnTimePayments = normalizeOnTimePayments(onTimePayments);
  const normalizedLoanPayoffs = normalizeLoanPayoffs(loanPayoffs);
  const normalizedMissedPayments = normalizeMissedPayments(missedPayments);
  
  const score = 
    (normalizedOnTimePayments * CREDIT_RATING_WEIGHTS.paymentHistory_onTime) +
    (normalizedLoanPayoffs * CREDIT_RATING_WEIGHTS.paymentHistory_payoffs) +
    ((1 - normalizedMissedPayments) * CREDIT_RATING_WEIGHTS.paymentHistory_missed);
  
  return {
    onTimePayments,
    loanPayoffs,
    missedPayments,
    consecutiveMissedPayments,
    normalizedOnTimePayments,
    normalizedLoanPayoffs,
    normalizedMissedPayments,
    score: clamp01(score)
  };
}

/**
 * Normalize company age to 0-1 using vineyard age prestige modifier pattern
 * Maps 0-200 years to 0-1, with heavy weighting toward early years (<40, <60)
 * This reflects that older wine companies are more stable, but most growth happens early
 */
function normalizeCompanyAge(age: number): number {
  return vineyardAgePrestigeModifier(age);
}

/**
 * Normalize profit consistency to 0-1
 * The raw consistency score is already 0-0.03, normalize to 0-1
 */
function normalizeProfitConsistency(rawScore: number, maxScore: number = 0.03): number {
  return clamp01(rawScore / maxScore);
}

/**
 * Normalize expense efficiency to 0-1
 * The raw efficiency score is already 0-0.02, normalize to 0-1
 */
function normalizeExpenseEfficiency(rawScore: number, maxScore: number = 0.02): number {
  return clamp01(rawScore / maxScore);
}

/**
 * Calculate company stability factors with normalized 0-1 components
 */
async function calculateCompanyStability(
  company: any, 
  transactions: any[]
): Promise<CreditRatingBreakdown['companyStability']> {
  // Calculate company age in years
  const currentDate = {
    week: company.currentWeek,
    season: company.currentSeason,
    year: company.currentYear
  };
  
  const companyAge = calculateCompanyWeeks(
    company.foundedYear,
    currentDate.week,
    currentDate.season,
    currentDate.year
  ) / 52; // Convert weeks to years
  
  // Calculate profit history and consistency
  const profitHistory = await calculateProfitHistory(transactions);
  const rawProfitConsistency = calculateProfitConsistency(profitHistory);
  const rawExpenseEfficiency = calculateExpenseEfficiency(transactions, currentDate);
  
  const normalizedAge = normalizeCompanyAge(companyAge);
  const normalizedProfitConsistency = normalizeProfitConsistency(rawProfitConsistency);
  const normalizedExpenseEfficiency = normalizeExpenseEfficiency(rawExpenseEfficiency);
  
  const score = 
    (normalizedAge * CREDIT_RATING_WEIGHTS.stability_age) +
    (normalizedProfitConsistency * CREDIT_RATING_WEIGHTS.stability_profitConsistency) +
    (normalizedExpenseEfficiency * CREDIT_RATING_WEIGHTS.stability_expenseEfficiency);
  
  return {
    companyAge,
    profitConsistency: rawProfitConsistency,
    expenseEfficiency: rawExpenseEfficiency,
    normalizedAge,
    normalizedProfitConsistency,
    normalizedExpenseEfficiency,
    score: clamp01(score)
  };
}

/**
 * Calculate profit history for the last 10 years
 */
async function calculateProfitHistory(
  transactions: any[]
): Promise<ProfitHistory> {
  const seasonal: Array<{ year: number; season: string; profit: number }> = [];
  const yearly: Array<{ year: number; profit: number }> = [];
  
  const seasonalProfits: { [key: string]: number } = {};
  const yearlyProfits: { [key: number]: number } = {};
  
  transactions.forEach(transaction => {
    const seasonKey = `${transaction.date.year}-${transaction.date.season}`;
    const year = transaction.date.year;
    
    if (!seasonalProfits[seasonKey]) seasonalProfits[seasonKey] = 0;
    if (!yearlyProfits[year]) yearlyProfits[year] = 0;
    
    seasonalProfits[seasonKey] += transaction.amount;
    yearlyProfits[year] += transaction.amount;
  });
  
  Object.entries(seasonalProfits).forEach(([key, profit]) => {
    const [year, season] = key.split('-');
    seasonal.push({ year: parseInt(year), season, profit });
  });
  
  Object.entries(yearlyProfits).forEach(([year, profit]) => {
    yearly.push({ year: parseInt(year), profit });
  });
  
  seasonal.sort((a, b) => a.year - b.year || a.season.localeCompare(b.season));
  yearly.sort((a, b) => a.year - b.year);
  
  const last4Seasons = seasonal.slice(-4).map(s => s.profit);
  const last10Years = yearly.slice(-10).map(y => y.profit);
  
  return {
    seasonal,
    yearly,
    last4Seasons,
    last10Years
  };
}

/**
 * Calculate profit consistency score using shared consistency utility
 * Returns 0-0.03 range, where 0.03 = perfect consistency
 * This is then normalized to 0-1 in normalizeProfitConsistency()
 */
function calculateProfitConsistency(profitHistory: ProfitHistory): number {
  if (profitHistory.last4Seasons.length < 2) return 0;
  
  const currentValue = profitHistory.last4Seasons[profitHistory.last4Seasons.length - 1];
  const historicalValues = profitHistory.last4Seasons.slice(0, -1);
  
  const consistencyScore01 = calculateConsistencyScore(
    historicalValues,
    currentValue,
    2,
    0.7,
    0.3
  );
  
  const maxScore = 0.03;
  return consistencyScore01 * maxScore;
}

/**
 * Calculate expense efficiency score (raw, will be normalized to 0-1)
 * Returns 0-0.02 range, where 0.02 = perfect efficiency (0% expense ratio)
 */
function calculateExpenseEfficiency(
  transactions: any[], 
  currentDate: { week: number; season: string; year: number }
): number {
  const lastYearTransactions = transactions.filter(t => 
    t.date.year === currentDate.year
  );
  
  let totalIncome = 0;
  let totalExpenses = 0;
  
  lastYearTransactions.forEach(transaction => {
    if (transaction.amount >= 0) {
      totalIncome += transaction.amount;
    } else {
      totalExpenses += Math.abs(transaction.amount);
    }
  });
  
  if (totalIncome === 0) return 0;
  
  const expenseRatio = totalExpenses / totalIncome;
  const maxScore = 0.02;
  const efficiencyScore = Math.max(0, (1 - expenseRatio) * maxScore);
  
  return efficiencyScore;
}


/**
 * Calculate negative balance penalty
 * Penalty increases for each consecutive week with negative balance
 * Returns normalized penalty (0 to -1, where -1 = max penalty)
 * 
 * IMPORTANT: Scales with company value to avoid unfairly punishing small companies
 */
async function calculateNegativeBalancePenalty(
  currentMoney: number
): Promise<CreditRatingBreakdown['negativeBalance']> {
  if (currentMoney >= 0) {
    return {
      consecutiveWeeksNegative: 0,
      penaltyPerWeek: CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_PENALTY / CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_WEEKS,
      normalizedWeeks: 0,
      score: 0
    };
  }

  const companyValue = await calculateCompanyValue();
  const negativeAmount = Math.abs(currentMoney);
  const companyValueThreshold = Math.max(10000, companyValue * 0.05);
  const weeksEstimate = negativeAmount / companyValueThreshold;
  
  const estimatedWeeksNegative = Math.min(
    Math.ceil(weeksEstimate),
    CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_WEEKS
  );

  const normalizedWeeks = clamp01(estimatedWeeksNegative / CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_WEEKS);
  const penaltyPerWeek = CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_PENALTY / CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_WEEKS;
  const totalPenalty = normalizedWeeks * CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_PENALTY;

  return {
    consecutiveWeeksNegative: estimatedWeeksNegative,
    penaltyPerWeek,
    normalizedWeeks,
    score: totalPenalty
  };
}


