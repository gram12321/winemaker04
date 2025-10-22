import { calculateFinancialData } from './financeService';
import { loadActiveLoans } from '../../database/core/loansDB';
import { loadTransactions } from './financeService';
import { calculateCompanyWeeks } from '@/lib/utils';
import { getCurrentCompany } from '../core/gameState';

// Credit rating calculation interfaces
export interface CreditRatingBreakdown {
  baseRating: number;
  assetHealth: {
    debtToAssetRatio: number;
    assetCoverage: number;
    liquidityRatio: number;
    score: number; // 0-0.20
  };
  paymentHistory: {
    onTimePayments: number;
    loanPayoffs: number;
    missedPayments: number;
    consecutiveMissedPayments: number;
    score: number; // 0-0.15
  };
  companyStability: {
    companyAge: number; // in years
    ageScore: number; // 0-0.05
    profitConsistency: number; // 0-0.03
    expenseEfficiency: number; // 0-0.02
    score: number; // 0-0.10
  };
  negativeBalance: {
    consecutiveWeeksNegative: number;
    penaltyPerWeek: number;
    score: number; // 0 to -0.30 (penalty)
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

// Credit rating constants
const CREDIT_RATING_CONSTANTS = {
  BASE_RATING: 0.50,
  MAX_RATING: 1.00,
  MIN_RATING: 0.00,
  
  // Asset health weights (max 0.20)
  ASSET_HEALTH_MAX: 0.20,
  
  // Payment history weights (max 0.15)
  PAYMENT_HISTORY_MAX: 0.15,
  ON_TIME_PAYMENT_BONUS: 0.005,
  LOAN_PAYOFF_BONUS: 0.05,
  FIRST_MISSED_PENALTY: -0.10,
  ADDITIONAL_MISSED_PENALTY: -0.05,
  
  // Company stability weights (max 0.10)
  STABILITY_MAX: 0.10,
  AGE_BONUS_PER_YEAR: 0.005, // 0.5% per year, max 5% at 10 years
  PROFIT_CONSISTENCY_MAX: 0.03,
  EXPENSE_EFFICIENCY_MAX: 0.02,
  
  // Negative balance penalties (max -0.30)
  NEGATIVE_BALANCE_PENALTY_PER_WEEK: -0.02, // -2% per week negative
  NEGATIVE_BALANCE_MAX_PENALTY: -0.30, // Max -30% penalty
  NEGATIVE_BALANCE_WEEKS_FOR_MAX: 15, // 15 weeks = max penalty
  
  // Future: Outstanding Shares & Dividends (planned for future update)
  // SHARE_PERFORMANCE_MAX: 0.05,
  // DIVIDEND_HISTORY_MAX: 0.03,
} as const;

/**
 * Calculate comprehensive credit rating with all factors
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

  // Calculate asset health
  const assetHealth = calculateAssetHealth(financialData.totalAssets, outstandingLoans, financialData.cashMoney, financialData.currentAssets);

  // Calculate payment history
  const paymentHistory = await calculatePaymentHistory(activeLoans, transactions);

  // Calculate company stability
  const companyStability = await calculateCompanyStability(company, transactions);

  // Calculate negative balance penalty
  const negativeBalance = calculateNegativeBalancePenalty(company.money);

  // Calculate final rating
  const finalRating = Math.max(
    CREDIT_RATING_CONSTANTS.MIN_RATING,
    Math.min(
      CREDIT_RATING_CONSTANTS.MAX_RATING,
      CREDIT_RATING_CONSTANTS.BASE_RATING + 
      assetHealth.score + 
      paymentHistory.score + 
      companyStability.score +
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
 * Calculate asset health factors
 */
function calculateAssetHealth(
  totalAssets: number, 
  outstandingLoans: number, 
  cash: number, 
  liquidAssets: number
): CreditRatingBreakdown['assetHealth'] {
  // Debt-to-Asset Ratio: Outstanding Loans / Total Company Assets
  const debtToAssetRatio = outstandingLoans > 0 ? outstandingLoans / totalAssets : 0;
  
  // Asset Coverage: Total Assets / Outstanding Loans
  const assetCoverage = outstandingLoans > 0 ? totalAssets / outstandingLoans : 999; // High value when no debt
  
  // Liquidity Ratio: Cash + Liquid Assets / Outstanding Loans
  const liquidityRatio = outstandingLoans > 0 ? (cash + liquidAssets) / outstandingLoans : 999; // High value when no debt
  
  // Calculate score based on ratios
  let score = 0;
  
  // Debt-to-asset ratio scoring (lower is better)
  if (debtToAssetRatio <= 0.1) score += 0.08; // Excellent (≤10%)
  else if (debtToAssetRatio <= 0.3) score += 0.06; // Good (≤30%)
  else if (debtToAssetRatio <= 0.5) score += 0.04; // Fair (≤50%)
  else if (debtToAssetRatio <= 0.7) score += 0.02; // Poor (≤70%)
  // >70% gets no points
  
  // Asset coverage scoring (higher is better)
  if (assetCoverage >= 5) score += 0.06; // Excellent (5x+ coverage)
  else if (assetCoverage >= 3) score += 0.04; // Good (3x+ coverage)
  else if (assetCoverage >= 2) score += 0.02; // Fair (2x+ coverage)
  // <2x gets no points
  
  // Liquidity scoring (higher is better)
  if (liquidityRatio >= 2) score += 0.06; // Excellent (2x+ liquidity)
  else if (liquidityRatio >= 1) score += 0.04; // Good (1x+ liquidity)
  else if (liquidityRatio >= 0.5) score += 0.02; // Fair (0.5x+ liquidity)
  // <0.5x gets no points
  
  return {
    debtToAssetRatio,
    assetCoverage,
    liquidityRatio,
    score: Math.min(score, CREDIT_RATING_CONSTANTS.ASSET_HEALTH_MAX)
  };
}

/**
 * Calculate payment history factors
 */
async function calculatePaymentHistory(
  activeLoans: any[], 
  transactions: any[]
): Promise<CreditRatingBreakdown['paymentHistory']> {
  // Count on-time payments and loan payoffs from transactions
  const loanTransactions = transactions.filter(t => 
    t.category === 'Loan Payment' || t.category === 'Loan Received'
  );
  
  let onTimePayments = 0;
  let loanPayoffs = 0;
  let missedPayments = 0;
  let consecutiveMissedPayments = 0;
  
  // Analyze active loans for payment patterns
  // Count total loan payments made (negative amounts in transactions)
  onTimePayments = loanTransactions.filter(t => t.amount < 0).length;
  
  // Count loan payoffs by checking for loans that were paid off
  // This is tracked by looking for loans that are no longer active
  // For now, we'll estimate based on transaction patterns
  loanPayoffs = Math.floor(onTimePayments / 4); // Rough estimate: every 4 payments = 1 payoff
  
  // Count missed payments by analyzing loan status
  // Check active loans for missed payment indicators
  missedPayments = activeLoans.reduce((sum, loan) => sum + (loan.missedPayments || 0), 0);
  
  // Calculate consecutive missed payments
  consecutiveMissedPayments = activeLoans.reduce((sum, loan) => {
    return sum + Math.max(0, (loan.missedPayments || 0) - 1);
  }, 0);
  
  // Calculate score
  let score = 0;
  score += onTimePayments * CREDIT_RATING_CONSTANTS.ON_TIME_PAYMENT_BONUS;
  score += loanPayoffs * CREDIT_RATING_CONSTANTS.LOAN_PAYOFF_BONUS;
  score += missedPayments * CREDIT_RATING_CONSTANTS.FIRST_MISSED_PENALTY;
  score += consecutiveMissedPayments * CREDIT_RATING_CONSTANTS.ADDITIONAL_MISSED_PENALTY;
  
  return {
    onTimePayments,
    loanPayoffs,
    missedPayments,
    consecutiveMissedPayments,
    score: Math.max(0, Math.min(score, CREDIT_RATING_CONSTANTS.PAYMENT_HISTORY_MAX))
  };
}

/**
 * Calculate company stability factors
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
  
  // Age score (max 0.05 at 10+ years)
  const ageScore = Math.min(
    companyAge * CREDIT_RATING_CONSTANTS.AGE_BONUS_PER_YEAR,
    0.05
  );
  
  // Calculate profit history and consistency
  const profitHistory = await calculateProfitHistory(transactions);
  
  // Profit consistency (lower variance = higher score)
  const profitConsistency = calculateProfitConsistency(profitHistory);
  
  // Expense efficiency (lower expense ratio = higher score)
  const expenseEfficiency = calculateExpenseEfficiency(transactions, currentDate);
  
  const score = ageScore + profitConsistency + expenseEfficiency;
  
  return {
    companyAge,
    ageScore,
    profitConsistency,
    expenseEfficiency,
    score: Math.min(score, CREDIT_RATING_CONSTANTS.STABILITY_MAX)
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
  
  // Group transactions by season and year
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
  
  // Convert to arrays and sort
  Object.entries(seasonalProfits).forEach(([key, profit]) => {
    const [year, season] = key.split('-');
    seasonal.push({ year: parseInt(year), season, profit });
  });
  
  Object.entries(yearlyProfits).forEach(([year, profit]) => {
    yearly.push({ year: parseInt(year), profit });
  });
  
  seasonal.sort((a, b) => a.year - b.year || a.season.localeCompare(b.season));
  yearly.sort((a, b) => a.year - b.year);
  
  // Get last 4 seasons and last 10 years
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
 * Calculate profit consistency score
 */
function calculateProfitConsistency(profitHistory: ProfitHistory): number {
  if (profitHistory.last4Seasons.length < 2) return 0;
  
  // Calculate variance in last 4 seasons
  const mean = profitHistory.last4Seasons.reduce((sum, profit) => sum + profit, 0) / profitHistory.last4Seasons.length;
  const variance = profitHistory.last4Seasons.reduce((sum, profit) => sum + Math.pow(profit - mean, 2), 0) / profitHistory.last4Seasons.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Lower standard deviation = higher consistency = higher score
  const consistencyScore = Math.max(0, 0.03 - (standardDeviation / Math.abs(mean || 1)) * 0.03);
  
  return Math.min(consistencyScore, CREDIT_RATING_CONSTANTS.PROFIT_CONSISTENCY_MAX);
}

/**
 * Calculate expense efficiency score
 */
function calculateExpenseEfficiency(
  transactions: any[], 
  currentDate: { week: number; season: string; year: number }
): number {
  // Calculate expense ratio for the last year
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
  
  // Lower expense ratio = higher efficiency = higher score
  const efficiencyScore = Math.max(0, (1 - expenseRatio) * CREDIT_RATING_CONSTANTS.EXPENSE_EFFICIENCY_MAX);
  
  return Math.min(efficiencyScore, CREDIT_RATING_CONSTANTS.EXPENSE_EFFICIENCY_MAX);
}


/**
 * Calculate negative balance penalty
 * Penalty increases for each consecutive week with negative balance
 */
function calculateNegativeBalancePenalty(
  currentMoney: number
): {
  consecutiveWeeksNegative: number;
  penaltyPerWeek: number;
  score: number;
} {
  // If balance is positive, no penalty
  if (currentMoney >= 0) {
    return {
      consecutiveWeeksNegative: 0,
      penaltyPerWeek: CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_PENALTY_PER_WEEK,
      score: 0
    };
  }

  // Calculate consecutive weeks negative
  // This is a simplified calculation - in a real system, you'd track this in the database
  // For now, we'll estimate based on how negative the balance is
  const negativeAmount = Math.abs(currentMoney);
  
  // Estimate consecutive weeks based on negative amount
  // More negative = longer time in negative territory
  const estimatedWeeksNegative = Math.min(
    Math.ceil(negativeAmount / 10000), // Rough estimate: 10k per week
    CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_WEEKS_FOR_MAX
  );

  // Calculate penalty
  const penaltyPerWeek = CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_PENALTY_PER_WEEK;
  const totalPenalty = Math.min(
    estimatedWeeksNegative * penaltyPerWeek,
    CREDIT_RATING_CONSTANTS.NEGATIVE_BALANCE_MAX_PENALTY
  );

  return {
    consecutiveWeeksNegative: estimatedWeeksNegative,
    penaltyPerWeek,
    score: totalPenalty
  };
}

// Future: Outstanding Shares & Dividends
// TODO: Implement share performance tracking and dividend history
// This will add additional credit rating factors:
// - Share price stability and growth
// - Consistent dividend payments
// - Market capitalization
// - Investor confidence metrics
