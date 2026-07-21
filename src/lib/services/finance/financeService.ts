import { getGameState, syncPersistedMoney } from '../core/gameState';
import type { GameState, Season, Transaction } from '@/lib/types/types';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { loadWineBatches } from '../../database/activities/inventoryDB';
import { SEASON_ORDER, TRANSACTION_CATEGORIES, WEEKS_PER_SEASON, WEEKS_PER_YEAR } from '@/lib/constants';
import { CAPITAL_FLOW_TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { insertTransaction as insertTransactionDB, insertTransactionWithFundsCheck, loadTransactions as loadTransactionsDB, type TransactionData } from '@/lib/database';
import { loanLenderFeature } from '@/lib/features/loanLender';
import { calculateAbsoluteWeeks } from '@/lib/utils/utils';
import { calculateLandValuePriceMultiplier } from '../wine/winescore/wineScoreCalculation';
import { companyFeature } from '@/lib/features/company';

export interface FinancialData {
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
  contributedCapital: number;
  retainedEarnings: number;
  totalEquity: number;
}

const transactionsCacheByCompany = new Map<string, Transaction[]>();
const transactionsLoadPromiseByCompany = new Map<string, Promise<Transaction[]>>();

export interface PersistedTransactionRow {
  id: string;
  week: number;
  season: Season;
  year: number;
  amount: number;
  description: string;
  category: string;
  recurring: boolean;
  money: number;
  money_version?: number;
}

let moneySyncTail: Promise<void> = Promise.resolve();

export async function syncPersistedTransaction(row: PersistedTransactionRow): Promise<string> {
  const sync = moneySyncTail.then(() => syncPersistedMoney(row.money, row.money_version));
  moneySyncTail = sync.catch(() => undefined);
  await sync;
  const transaction: Transaction = {
    id: row.id,
    date: { week: row.week, season: row.season, year: row.year },
    amount: row.amount,
    description: row.description,
    category: row.category,
    recurring: row.recurring,
    money: row.money,
  };
  const companyId = getCurrentCompanyId();
  const companyTransactions = companyId ? transactionsCacheByCompany.get(companyId) : undefined;
  if (companyTransactions && !companyTransactions.some((cached) => cached.id === transaction.id)) {
    companyTransactions.push(transaction);
  }
  if (companyTransactions) companyTransactions.sort((a, b) => {
    if (a.date.year !== b.date.year) return b.date.year - a.date.year;
    if (a.date.season !== b.date.season) return SEASON_ORDER.indexOf(b.date.season) - SEASON_ORDER.indexOf(a.date.season);
    if (a.date.week !== b.date.week) return b.date.week - a.date.week;
    return b.id.localeCompare(a.id);
  });
  triggerGameUpdate();
  return row.id;
}

// Add a new transaction to the system
export const addTransaction = async (
  amount: number,
  description: string,
  category: string,
  recurring = false,
  companyId?: string,
  requireFunds = false,
): Promise<string> => {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    if (!companyId) throw new Error('No active company selected.');
    
    const gameState = getGameState();
    
    const transactionData: TransactionData = {
      company_id: companyId,
      amount,
      description,
      category,
      recurring,
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024,
      created_at: new Date().toISOString()
    };
    
    const result = requireFunds
      ? await insertTransactionWithFundsCheck(transactionData)
      : await insertTransactionDB(transactionData);
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to insert transaction');
    }
    return await syncPersistedTransaction(result.data);
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

// Load transactions from database
// OPTIMIZATION: Uses promise-based caching to prevent parallel database calls
export const loadTransactions = async (companyId?: string): Promise<Transaction[]> => {
  const targetCompanyId = companyId || getCurrentCompanyId();
  const inFlight = transactionsLoadPromiseByCompany.get(targetCompanyId);
  if (inFlight) {
    return inFlight;
  }
  
  const cached = transactionsCacheByCompany.get(targetCompanyId);
  if (cached) {
    return cached;
  }
  
  const loadPromise = (async () => {
    try {
      const transactions = await loadTransactionsDB(targetCompanyId);
      transactionsCacheByCompany.set(targetCompanyId, transactions);
      transactionsLoadPromiseByCompany.delete(targetCompanyId);
      return transactions;
    } catch (error) {
      console.error('Error loading transactions:', error);
      transactionsLoadPromiseByCompany.delete(targetCompanyId);
      return [];
    }
  })();
  transactionsLoadPromiseByCompany.set(targetCompanyId, loadPromise);

  return loadPromise;
};

// Get transactions from cache or load from Supabase if cache is empty
export const getTransactions = (): Transaction[] => {
  const companyId = getCurrentCompanyId();
  const transactions = transactionsCacheByCompany.get(companyId);
  if (!transactions) {
    loadTransactions(companyId).catch(console.error);
    return [];
  }

  return transactions;
};

// Clear transactions cache (useful when transactions are modified externally)
export const clearTransactionsCache = (companyId?: string): void => {
  if (companyId) {
    transactionsCacheByCompany.delete(companyId);
    transactionsLoadPromiseByCompany.delete(companyId);
    return;
  }

  transactionsCacheByCompany.clear();
  transactionsLoadPromiseByCompany.clear();
};

/** Lifecycle hook called after the active company changes. */
export const onCompanyActivated = (companyId: string): void => {
  clearTransactionsCache(companyId);
};

companyFeature.lifecycle.registerActivationHook(onCompanyActivated);

// Calculate company value (total assets - total liabilities)
export const calculateCompanyValue = async (companyId?: string): Promise<number> => {
  try {
    const financialData = await calculateFinancialData('year', { companyId });
    const totalOutstandingLoans = await loanLenderFeature.metrics.calculateTotalOutstandingLoans(companyId);
    return financialData.totalAssets - totalOutstandingLoans;
  } catch (error) {
    console.error('Error calculating company value:', error);
    return 0;
  }
};

export async function getCompanyFinancialSnapshot(
  companyId: string,
  state: Pick<GameState, 'week' | 'season' | 'currentYear' | 'money'>
): Promise<{
  financialData: FinancialData;
  companyValue: number;
  transactions: Transaction[];
}> {
  const financialData = await calculateFinancialData('year', {
    week: state.week,
    season: state.season,
    year: state.currentYear,
    companyId,
    cashMoney: state.money,
  });
  const [totalOutstandingLoans, transactions] = await Promise.all([
    loanLenderFeature.metrics.calculateTotalOutstandingLoans(companyId),
    loadTransactions(companyId),
  ]);

  return {
    financialData,
    companyValue: financialData.totalAssets - totalOutstandingLoans,
    transactions,
  };
}

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
  options: {
    week?: number;
    season?: string;
    year?: number;
    companyId?: string;
    cashMoney?: number;
  } = {}
): Promise<FinancialData> => {
  const gameState = getGameState();
  
  const [transactions, vineyards, wineBatches] = await Promise.all([
    loadTransactions(options.companyId),
    loadVineyards(options.companyId),
    loadWineBatches(options.companyId)
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

    // Estimated price already includes wine score and land-value effects; don't multiply quality again.
    return sum + (batch.quantity * stageMultiplier * (batch.estimatedPrice || 10));
  }, 0);
  
  const grapesValue = wineBatches.reduce((sum, batch) => {
    if (batch.state !== 'grapes') return sum;

    // Use static terroir influence for grape-stage valuation.
    const landValuePriceMultiplier = calculateLandValuePriceMultiplier(batch);
    return sum + (batch.quantity * landValuePriceMultiplier * 5);
  }, 0);
  
  const cashMoney = options.cashMoney ?? gameState.money ?? 0;
  const fixedAssets = buildingsValue + allVineyardsValue;
  const currentAssets = wineValue + grapesValue;
  const totalAssets = cashMoney + fixedAssets + currentAssets;
  
  // Contributed capital is tracked as positive initial-investment transactions.
  const contributedCapital = transactions.reduce((sum, transaction) => {
    if (transaction.category !== TRANSACTION_CATEGORIES.INITIAL_INVESTMENT) return sum;
    if (transaction.amount <= 0) return sum;
    return sum + transaction.amount;
  }, 0);
  
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
  const totalEquity = contributedCapital + retainedEarnings;
  
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
    contributedCapital,
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
  _companyId?: string
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

    // Estimated price already includes wine score and land-value effects; don't multiply quality again.
    return sum + (batch.quantity * stageMultiplier * (batch.estimatedPrice || 10));
  }, 0);
  
  const grapesValue = wineBatches.reduce((sum, batch) => {
    if (batch.state !== 'grapes') return sum;

    // Use static terroir influence for grape-stage valuation.
    const landValuePriceMultiplier = calculateLandValuePriceMultiplier(batch);
    return sum + (batch.quantity * landValuePriceMultiplier * 5);
  }, 0);
  
  const cashMoney = gameState.money || 0;
  const fixedAssets = buildingsValue + allVineyardsValue;
  const currentAssets = wineValue + grapesValue;
  const totalAssets = cashMoney + fixedAssets + currentAssets;
  
  // Contributed capital is tracked as positive initial-investment transactions.
  const contributedCapital = transactions.reduce((sum, transaction) => {
    if (transaction.category !== TRANSACTION_CATEGORIES.INITIAL_INVESTMENT) return sum;
    if (transaction.amount <= 0) return sum;
    return sum + transaction.amount;
  }, 0);
  
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
  const totalEquity = contributedCapital + retainedEarnings;
  
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
    contributedCapital,
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
