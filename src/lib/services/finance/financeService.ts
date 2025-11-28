import { getGameState, updateGameState } from '../core/gameState';
import type { Transaction } from '@/lib/types/types';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { loadWineBatches } from '../../database/activities/inventoryDB';
import { SEASON_ORDER, TRANSACTION_CATEGORIES, WEEKS_PER_SEASON, WEEKS_PER_YEAR } from '@/lib/constants';
import { CAPITAL_FLOW_TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { companyService } from '../user/companyService';
import { insertTransaction as insertTransactionDB, loadTransactions as loadTransactionsDB, type TransactionData } from '@/lib/database';
import { calculateTotalOutstandingLoans } from './loanService';
import { calculateAbsoluteWeeks } from '@/lib/utils/utils';

interface FinancialData {
  income: number;
  expenses: number;
  netIncome: number;
  incomeDetails: { description: string; amount: number }[];
  expenseDetails: { description: string; amount: number }[];
  cashMoney: number;
  totalAssets: number;
  fixedAssets: number;
  currentAssets: number;
  buildingsValue: number;
  allVineyardsValue: number;
  wineValue: number;
  grapesValue: number;
  // Equity components
  playerContribution: number;
  familyContribution: number;
  outsideInvestment: number;
  retainedEarnings: number;
  totalEquity: number;
}

let transactionsCache: Transaction[] = [];

// Add a new transaction to the system
export const addTransaction = async (
  amount: number,
  description: string,
  category: string,
  recurring = false,
  companyId?: string
): Promise<string> => {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    let currentMoney = 0;
    if (companyId) {
      const company = await companyService.getCompany(companyId);
      if (company) {
        currentMoney = company.money;
      }
    } else {
      const gameState = getGameState();
      currentMoney = gameState.money || 0;
    }
    
    const newMoney = currentMoney + amount;
    
    const gameState = getGameState();
    
    const transactionData: TransactionData = {
      company_id: companyId,
      amount,
      description,
      category,
      recurring,
      money: newMoney,
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024,
      created_at: new Date().toISOString()
    };
    
    await updateGameState({ money: newMoney });
    
    triggerGameUpdate();
    
    const result = await insertTransactionDB(transactionData);
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to insert transaction');
    }
    
    const newTransaction: Transaction = {
      id: result.data.id,
      date: {
        week: result.data.week,
        season: result.data.season,
        year: result.data.year
      },
      amount: result.data.amount,
      description: result.data.description,
      category: result.data.category,
      recurring: result.data.recurring,
      money: result.data.money
    };
    
    transactionsCache.push(newTransaction);
    
    transactionsCache.sort((a, b) => {
      if (a.date.year !== b.date.year) return b.date.year - a.date.year;
      if (a.date.season !== b.date.season) {
        return SEASON_ORDER.indexOf(b.date.season) - SEASON_ORDER.indexOf(a.date.season);
      }
      if (a.date.week !== b.date.week) return b.date.week - a.date.week;
      // For same week transactions, sort by ID (newer transactions have higher IDs)
      return b.id.localeCompare(a.id);
    });
    
    return result.data.id;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

// Load transactions from database
export const loadTransactions = async (): Promise<Transaction[]> => {
  try {
    const transactions = await loadTransactionsDB();
    transactionsCache = transactions;
    return transactions;
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
};

// Get transactions from cache or load from Supabase if cache is empty
export const getTransactions = (): Transaction[] => {
  if (transactionsCache.length === 0) {
    loadTransactions().catch(console.error);
    return [];
  }
  
  return transactionsCache;
};

// Calculate company value (total assets - total liabilities)
export const calculateCompanyValue = async (): Promise<number> => {
  try {
    const financialData = await calculateFinancialData('year');
    const totalOutstandingLoans = await calculateTotalOutstandingLoans();
    return financialData.totalAssets - totalOutstandingLoans;
  } catch (error) {
    console.error('Error calculating company value:', error);
    return 0;
  }
};

// Legacy export for backwards compatibility (deprecated - use calculateCompanyValue)
export const calculateNetWorth = calculateCompanyValue;

export const calculateTotalAssets = async (): Promise<number> => {
  try {
    const financialData = await calculateFinancialData('year');
    return financialData.totalAssets;
  } catch (error) {
    console.error('Error calculating total assets:', error);
    return 0;
  }
};

// Calculate financial data for income statement and balance sheet
export const calculateFinancialData = async (
  period: 'weekly' | 'season' | 'year' | 'all',
  options: { week?: number; season?: string; year?: number } = {}
): Promise<FinancialData> => {
  const gameState = getGameState();
  
  const [transactions, vineyards, wineBatches] = await Promise.all([
    loadTransactions(),
    loadVineyards(),
    loadWineBatches()
  ]);
  
  const currentDate = {
    week: gameState.week || 1,
    season: gameState.season || 'Spring',
    year: gameState.currentYear || 2024
  };
  
  const filterDate = {
    week: options.week ?? currentDate.week,
    season: options.season ?? currentDate.season,
    year: options.year ?? currentDate.year
  };
  
  const filteredTransactions = transactions.filter(transaction =>
    filterTransactionByPeriod(transaction, period, filterDate, options)
  );
  
  let income = 0;
  let expenses = 0;
  const incomeDetails: { description: string; amount: number }[] = [];
  const expenseDetails: { description: string; amount: number }[] = [];
  
  const categorizedTransactions: Record<string, { total: number; transactions: Transaction[] }> = {};
  
  filteredTransactions.forEach(transaction => {
    const isCapitalFlow = CAPITAL_FLOW_TRANSACTION_CATEGORIES.has(transaction.category);

    if (!isCapitalFlow) {
      if (!categorizedTransactions[transaction.category]) {
        categorizedTransactions[transaction.category] = { total: 0, transactions: [] };
      }
      
      categorizedTransactions[transaction.category].total += transaction.amount;
      categorizedTransactions[transaction.category].transactions.push(transaction);
    }
    
    if (!isCapitalFlow) {
      if (transaction.amount >= 0) {
        income += transaction.amount;
      } else {
        expenses += Math.abs(transaction.amount);
      }
    }
  });
  
  Object.entries(categorizedTransactions).forEach(([category, data]) => {
    if (data.total >= 0) {
      incomeDetails.push({
        description: category,
        amount: data.total
      });
    } else {
      expenseDetails.push({
        description: category,
        amount: Math.abs(data.total)
      });
    }
  });
  
  incomeDetails.sort((a, b) => b.amount - a.amount);
  expenseDetails.sort((a, b) => b.amount - a.amount);
  
  const buildingsValue = 0;
  
  const allVineyardsValue = vineyards.reduce((sum, vineyard) => {
    return sum + vineyard.vineyardTotalValue;
  }, 0);
  
  const wineValue = wineBatches.reduce((sum, batch) => {
    const stageMultiplier = batch.state === 'bottled' ? 1 :
                            batch.state === 'must_ready' || batch.state === 'must_fermenting' ? 0.5 : 0.3;
    const qualityMultiplier = batch.grapeQuality || 0.5;
    
    return sum + (batch.quantity * stageMultiplier * qualityMultiplier * (batch.estimatedPrice || 10));
  }, 0);
  
  const grapesValue = wineBatches.reduce((sum, batch) => {
    if (batch.state !== 'grapes') return sum;
    
    const qualityMultiplier = batch.grapeQuality || 0.5;
    return sum + (batch.quantity * qualityMultiplier * 5);
  }, 0);
  
  const cashMoney = gameState.money || 0;
  const fixedAssets = buildingsValue + allVineyardsValue;
  const currentAssets = wineValue + grapesValue;
  const totalAssets = cashMoney + fixedAssets + currentAssets;
  
  // Calculate equity components from all transactions (not filtered by period)
  let playerContribution = 0;
  let outsideInvestment = 0;
  
  transactions.forEach(transaction => {
    const description = transaction.description || '';
    const isInitialInvestmentCategory = transaction.category === TRANSACTION_CATEGORIES.INITIAL_INVESTMENT;
    const isPositiveCapital = transaction.amount > 0;

    const isPlayerContribution =
      description === 'Initial Capital: Player cash contribution' ||
      (isInitialInvestmentCategory && description.includes('Player cash contribution'));

    if (isPlayerContribution) {
      playerContribution += transaction.amount;
      return;
    }

    const isOutsideInvestment =
      description === 'Outside investment committed' ||
      (isInitialInvestmentCategory && description.includes('Outside investment')) ||
      (isInitialInvestmentCategory && description.startsWith('Stock Issuance'));

    if (isOutsideInvestment && isPositiveCapital) {
      outsideInvestment += transaction.amount;
    }
  });
  
  // Family contribution is the initial vineyard value at company creation
  // Get it from company metadata, or calculate from first vineyards if not stored
  const company = await companyService.getCompany(getCurrentCompanyId() || '');
  let familyContribution = 0;
  
  if (company && company.initialVineyardValue) {
    // Use stored initial vineyard value
    familyContribution = company.initialVineyardValue;
  } else {
    // Fallback: use current vineyard value for companies created before this tracking was added
    // This is a reasonable approximation for existing companies
    familyContribution = allVineyardsValue;
  }
  
  // Calculate retained earnings: all-time net income (excluding initial investments and loans)
  let allTimeIncome = 0;
  let allTimeExpenses = 0;
  
  transactions.forEach(transaction => {
    const isCapitalFlow = CAPITAL_FLOW_TRANSACTION_CATEGORIES.has(transaction.category);
    
    if (!isCapitalFlow) {
      if (transaction.amount >= 0) {
        allTimeIncome += transaction.amount;
      } else {
        allTimeExpenses += Math.abs(transaction.amount);
      }
    }
  });
  
  const retainedEarnings = allTimeIncome - allTimeExpenses;
  const totalEquity = playerContribution + familyContribution + outsideInvestment + retainedEarnings;
  
  return {
    income,
    expenses,
    netIncome: income - expenses,
    incomeDetails,
    expenseDetails,
    cashMoney,
    totalAssets,
    fixedAssets,
    currentAssets,
    buildingsValue,
    allVineyardsValue,
    wineValue,
    grapesValue,
    playerContribution,
    familyContribution,
    outsideInvestment,
    retainedEarnings,
    totalEquity
  };
};

/**
 * Subtract weeks from a GameDate, returning the resulting date
 */
function subtractWeeksFromGameDate(
  date: { week: number; season: string; year: number },
  weeksToSubtract: number
): { week: number; season: string; year: number } {
  // Convert to absolute weeks from game start (2024, Week 1, Spring)
  const currentAbsoluteWeeks = calculateAbsoluteWeeks(
    date.week,
    date.season,
    date.year,
    1, // start week
    'Spring', // start season
    2024 // start year
  );
  
  // Subtract weeks
  const targetAbsoluteWeeks = Math.max(1, currentAbsoluteWeeks - weeksToSubtract);
  
  // Convert back to GameDate
  const targetYear = 2024 + Math.floor((targetAbsoluteWeeks - 1) / WEEKS_PER_YEAR);
  const weeksIntoYear = ((targetAbsoluteWeeks - 1) % WEEKS_PER_YEAR);
  const targetSeasonIndex = Math.floor(weeksIntoYear / WEEKS_PER_SEASON);
  const targetWeek = (weeksIntoYear % WEEKS_PER_SEASON) + 1;
  const targetSeason = SEASON_ORDER[targetSeasonIndex] || 'Spring';
  
  return {
    week: targetWeek,
    season: targetSeason,
    year: targetYear
  };
}

/**
 * Check if a transaction date is within a date range (inclusive)
 */
function isTransactionInDateRange(
  transaction: Transaction,
  startDate: { week: number; season: string; year: number },
  endDate: { week: number; season: string; year: number }
): boolean {
  const transAbsoluteWeeks = calculateAbsoluteWeeks(
    transaction.date.week,
    transaction.date.season,
    transaction.date.year,
    1,
    'Spring',
    2024
  );
  
  const startAbsoluteWeeks = calculateAbsoluteWeeks(
    startDate.week,
    startDate.season,
    startDate.year,
    1,
    'Spring',
    2024
  );
  
  const endAbsoluteWeeks = calculateAbsoluteWeeks(
    endDate.week,
    endDate.season,
    endDate.year,
    1,
    'Spring',
    2024
  );
  
  return transAbsoluteWeeks >= startAbsoluteWeeks && transAbsoluteWeeks <= endAbsoluteWeeks;
}

/**
 * Filter transactions for the last N weeks (rolling window)
 */
function filterTransactionsLastNWeeks(
  transactions: Transaction[],
  currentDate: { week: number; season: string; year: number },
  weeksBack: number
): Transaction[] {
  const startDate = subtractWeeksFromGameDate(currentDate, weeksBack);
  return transactions.filter(transaction => 
    isTransactionInDateRange(transaction, startDate, currentDate)
  );
}

/**
 * Calculate financial data for the last N weeks (rolling window)
 * More efficient than calling calculateFinancialData multiple times
 */
export async function calculateFinancialDataRollingNWeeks(
  weeksBack: number = 48,
  companyId?: string
): Promise<FinancialData> {
  const gameState = getGameState();
  const currentDate = {
    week: gameState.week || 1,
    season: gameState.season || 'Spring',
    year: gameState.currentYear || 2024
  };
  
  const [transactions, vineyards, wineBatches] = await Promise.all([
    loadTransactions(),
    loadVineyards(),
    loadWineBatches()
  ]);
  
  // Filter transactions for the rolling window
  const filteredTransactions = filterTransactionsLastNWeeks(transactions, currentDate, weeksBack);
  
  let income = 0;
  let expenses = 0;
  const incomeDetails: { description: string; amount: number }[] = [];
  const expenseDetails: { description: string; amount: number }[] = [];
  
  const categorizedTransactions: Record<string, { total: number; transactions: Transaction[] }> = {};
  
  filteredTransactions.forEach(transaction => {
    const isCapitalFlow = CAPITAL_FLOW_TRANSACTION_CATEGORIES.has(transaction.category);

    if (!isCapitalFlow) {
      if (!categorizedTransactions[transaction.category]) {
        categorizedTransactions[transaction.category] = { total: 0, transactions: [] };
      }
      
      categorizedTransactions[transaction.category].total += transaction.amount;
      categorizedTransactions[transaction.category].transactions.push(transaction);
    }
    
    if (!isCapitalFlow) {
      if (transaction.amount >= 0) {
        income += transaction.amount;
      } else {
        expenses += Math.abs(transaction.amount);
      }
    }
  });
  
  Object.entries(categorizedTransactions).forEach(([category, data]) => {
    if (data.total >= 0) {
      incomeDetails.push({
        description: category,
        amount: data.total
      });
    } else {
      expenseDetails.push({
        description: category,
        amount: Math.abs(data.total)
      });
    }
  });
  
  incomeDetails.sort((a, b) => b.amount - a.amount);
  expenseDetails.sort((a, b) => b.amount - a.amount);
  
  // Note: Assets are current snapshot values, not historical, so we use current values
  const buildingsValue = 0;
  
  const allVineyardsValue = vineyards.reduce((sum, vineyard) => {
    return sum + vineyard.vineyardTotalValue;
  }, 0);
  
  const wineValue = wineBatches.reduce((sum, batch) => {
    const stageMultiplier = batch.state === 'bottled' ? 1 :
                            batch.state === 'must_ready' || batch.state === 'must_fermenting' ? 0.5 : 0.3;
    const qualityMultiplier = batch.grapeQuality || 0.5;
    
    return sum + (batch.quantity * stageMultiplier * qualityMultiplier * (batch.estimatedPrice || 10));
  }, 0);
  
  const grapesValue = wineBatches.reduce((sum, batch) => {
    if (batch.state !== 'grapes') return sum;
    
    const qualityMultiplier = batch.grapeQuality || 0.5;
    return sum + (batch.quantity * qualityMultiplier * 5);
  }, 0);
  
  const cashMoney = gameState.money || 0;
  const fixedAssets = buildingsValue + allVineyardsValue;
  const currentAssets = wineValue + grapesValue;
  const totalAssets = cashMoney + fixedAssets + currentAssets;
  
  // Calculate equity components from all transactions (not filtered by period)
  let playerContribution = 0;
  let outsideInvestment = 0;
  
  transactions.forEach(transaction => {
    const description = transaction.description || '';
    const isInitialInvestmentCategory = transaction.category === TRANSACTION_CATEGORIES.INITIAL_INVESTMENT;
    const isPositiveCapital = transaction.amount > 0;

    const isPlayerContribution =
      description === 'Initial Capital: Player cash contribution' ||
      (isInitialInvestmentCategory && description.includes('Player cash contribution'));

    if (isPlayerContribution) {
      playerContribution += transaction.amount;
      return;
    }

    const isOutsideInvestment =
      description === 'Outside investment committed' ||
      (isInitialInvestmentCategory && description.includes('Outside investment')) ||
      (isInitialInvestmentCategory && description.startsWith('Stock Issuance'));

    if (isOutsideInvestment && isPositiveCapital) {
      outsideInvestment += transaction.amount;
    }
  });
  
  const company = await companyService.getCompany(companyId || getCurrentCompanyId() || '');
  let familyContribution = 0;
  
  if (company && company.initialVineyardValue) {
    familyContribution = company.initialVineyardValue;
  } else {
    familyContribution = allVineyardsValue;
  }
  
  // Calculate retained earnings: all-time net income (excluding initial investments and loans)
  let allTimeIncome = 0;
  let allTimeExpenses = 0;
  
  transactions.forEach(transaction => {
    const isCapitalFlow = CAPITAL_FLOW_TRANSACTION_CATEGORIES.has(transaction.category);
    
    if (!isCapitalFlow) {
      if (transaction.amount >= 0) {
        allTimeIncome += transaction.amount;
      } else {
        allTimeExpenses += Math.abs(transaction.amount);
      }
    }
  });
  
  const retainedEarnings = allTimeIncome - allTimeExpenses;
  const totalEquity = playerContribution + familyContribution + outsideInvestment + retainedEarnings;
  
  return {
    income,
    expenses,
    netIncome: income - expenses,
    incomeDetails,
    expenseDetails,
    cashMoney,
    totalAssets,
    fixedAssets,
    currentAssets,
    buildingsValue,
    allVineyardsValue,
    wineValue,
    grapesValue,
    playerContribution,
    familyContribution,
    outsideInvestment,
    retainedEarnings,
    totalEquity
  };
}

// Helper function to filter transactions by time period
function filterTransactionByPeriod(
  transaction: Transaction,
  period: 'weekly' | 'season' | 'year' | 'all',
  currentDate: { week: number; season: string; year: number },
  options: { week?: number; season?: string; year?: number }
): boolean {
  switch (period) {
    case 'weekly':
      return transaction.date.week === (options.week ?? currentDate.week) &&
             transaction.date.season === (options.season ?? currentDate.season) &&
             transaction.date.year === (options.year ?? currentDate.year);
    case 'season':
      return transaction.date.season === (options.season ?? currentDate.season) &&
             transaction.date.year === (options.year ?? currentDate.year);
    case 'year':
      return transaction.date.year === (options.year ?? currentDate.year);
    case 'all':
      return true;
    default:
      return false;
  }
}
