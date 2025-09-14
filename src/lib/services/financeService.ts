import { getGameState } from './gameState';
import { Transaction } from '../types';
import { supabase } from '../database/supabase';
import { loadVineyards, loadWineBatches } from '../database/database';
import { GAME_INITIALIZATION } from '../constants';
import { getCurrentCompany, updateGameState } from './gameState';
import { getCurrentCompanyId } from '../utils/companyUtils';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { companyService } from './companyService';

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
  farmlandValue: number;
  wineValue: number;
  grapesValue: number;
}

// Table name
const TRANSACTIONS_TABLE = 'transactions';

// In-memory cache of transactions for performance
let transactionsCache: Transaction[] = [];

/**
 * Initialize starting capital as a transaction for new games
 * This should be called when starting a new game to ensure the starting money
 * is properly recorded in the finance system
 */
export const initializeStartingCapital = async (companyId?: string): Promise<void> => {
  try {
    // Get the current company ID if not provided
    if (!companyId) {
      const currentCompany = getCurrentCompany();
      if (!currentCompany) {
        return;
      }
      companyId = currentCompany.id;
    }
    
    // Check if starting capital transaction already exists for this company
    const existingTransactions = await loadTransactions();
    const hasStartingCapital = existingTransactions.some(t => 
      t.description === 'Starting Capital' && t.category === 'Initial Investment'
    );
    
    if (hasStartingCapital) {
      return; // Already initialized
    }
    
    // Create starting capital transaction
    await addTransaction(
      GAME_INITIALIZATION.STARTING_MONEY,
      'Starting Capital',
      'Initial Investment',
      false,
      companyId
    );
    
    // Note: triggerGameUpdate() is already called by addTransaction()
  } catch (error) {
    console.error('Error initializing starting capital:', error);
    // Don't throw - allow game to continue even if finance system fails
  }
};

/**
 * Add a new transaction to the system
 * @param amount Transaction amount (positive for income, negative for expense)
 * @param description Transaction description
 * @param category Transaction category
 * @param recurring Whether this is a recurring transaction
 * @returns Promise resolving to the transaction ID
 */
export const addTransaction = async (
  amount: number,
  description: string,
  category: string,
  recurring = false,
  companyId?: string
): Promise<string> => {
  try {
    // Get current company ID if not provided
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    // Get current company money directly from database
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
    
    // Calculate new money amount
    const newMoney = currentMoney + amount;
    
    // Get game state for date information
    const gameState = getGameState();
    
    // Create transaction object
    const transaction = {
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
    
    // Update company money in the system
    await updateGameState({ money: newMoney });
    
    // Trigger game update to notify components
    triggerGameUpdate();
    
    // Add to Supabase
    const { data, error } = await supabase
      .from(TRANSACTIONS_TABLE)
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    
    // Update cache with the new transaction
    const newTransaction: Transaction = {
      id: data.id,
      date: {
        week: data.week,
        season: data.season,
        year: data.year
      },
      amount: data.amount,
      description: data.description,
      category: data.category,
      recurring: data.recurring,
      money: data.money
    };
    
    transactionsCache.push(newTransaction);
    
    // Sort the cache by date (newest first)
    transactionsCache.sort((a, b) => {
      if (a.date.year !== b.date.year) return b.date.year - a.date.year;
      if (a.date.season !== b.date.season) {
        const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
        return seasons.indexOf(b.date.season) - seasons.indexOf(a.date.season);
      }
      return b.date.week - a.date.week;
    });
    
    // Transaction added successfully
    return data.id;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

/**
 * Load transactions from Supabase
 * @returns Promise resolving to array of transactions
 */
export const loadTransactions = async (): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from(TRANSACTIONS_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .order('year', { ascending: false })
      .order('season', { ascending: false })  
      .order('week', { ascending: false });
    
    if (error) throw error;
    
    const transactions: Transaction[] = (data || []).map(row => ({
      id: row.id,
      date: {
        week: row.week || 1,
        season: row.season || 'Spring',
        year: row.year || 2024
      },
      amount: row.amount,
      description: row.description,
      category: row.category,
      recurring: row.recurring || false,
      money: row.money
    }));
    
    // Update the cache
    transactionsCache = transactions;
    
    return transactions;
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
};

/**
 * Get transactions from cache or load from Supabase if cache is empty
 * @returns Array of transactions
 */
export const getTransactions = (): Transaction[] => {
  // If cache is empty, load transactions from Supabase (but return empty array for now)
  if (transactionsCache.length === 0) {
    loadTransactions().catch(console.error);
    return [];
  }
  
  return transactionsCache;
};

/**
 * Calculate financial data for income statement and balance sheet
 * @param period The time period to calculate for ('weekly', 'season', 'year')
 * @returns Financial data object
 */
export const calculateFinancialData = async (period: 'weekly' | 'season' | 'year'): Promise<FinancialData> => {
  const gameState = getGameState();
  
  // Load fresh data
  const [transactions, vineyards, wineBatches] = await Promise.all([
    loadTransactions(),
    loadVineyards(),
    loadWineBatches()
  ]);
  
  // Filter transactions by period
  const filteredTransactions = transactions.filter(transaction => {
    const currentDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };
    
    if (period === 'weekly') {
      return transaction.date.week === currentDate.week &&
             transaction.date.season === currentDate.season &&
             transaction.date.year === currentDate.year;
    } else if (period === 'season') {
      return transaction.date.season === currentDate.season &&
             transaction.date.year === currentDate.year;
    } else { // year
      return transaction.date.year === currentDate.year;
    }
  });
  
  // Calculate income and expenses
  let income = 0;
  let expenses = 0;
  const incomeDetails: { description: string; amount: number }[] = [];
  const expenseDetails: { description: string; amount: number }[] = [];
  
  // Group by category
  const categorizedTransactions: Record<string, { total: number; transactions: Transaction[] }> = {};
  
  filteredTransactions.forEach(transaction => {
    if (!categorizedTransactions[transaction.category]) {
      categorizedTransactions[transaction.category] = { total: 0, transactions: [] };
    }
    
    categorizedTransactions[transaction.category].total += transaction.amount;
    categorizedTransactions[transaction.category].transactions.push(transaction);
    
    if (transaction.amount >= 0) {
      income += transaction.amount;
    } else {
      expenses += Math.abs(transaction.amount);
    }
  });
  
  // Create income and expense details
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
  
  // Sort details by amount (highest first)
  incomeDetails.sort((a, b) => b.amount - a.amount);
  expenseDetails.sort((a, b) => b.amount - a.amount);
  
  // Calculate asset values
  const buildingsValue = 0; // Placeholder for buildings - not implemented yet
  
  const farmlandValue = vineyards.reduce((sum, vineyard) => {
    // Basic estimate for farmland value
    const baseValue = vineyard.acres * 10000; // €10k per acre
    return sum + baseValue;
  }, 0);
  
  const wineValue = wineBatches.reduce((sum, batch) => {
    // Estimate wine value based on stage, quality, and quantity
    const stageMultiplier = batch.stage === 'bottled' ? 1 :
                            batch.stage === 'wine' ? 0.8 :
                            batch.stage === 'must' ? 0.5 : 0.3;
    const qualityMultiplier = batch.quality || 0.5;
    
    return sum + (batch.quantity * stageMultiplier * qualityMultiplier * (batch.finalPrice || 10));
  }, 0);
  
  const grapesValue = wineBatches.reduce((sum, batch) => {
    // Only count batches in grape stage
    if (batch.stage !== 'grapes') return sum;
    
    const qualityMultiplier = batch.quality || 0.5;
    return sum + (batch.quantity * qualityMultiplier * 5);
  }, 0);
  
  // Calculate totals
  const cashMoney = gameState.money || 0;
  const fixedAssets = buildingsValue + farmlandValue;
  const currentAssets = wineValue + grapesValue;
  const totalAssets = cashMoney + fixedAssets + currentAssets;
  
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
    farmlandValue,
    wineValue,
    grapesValue
  };
};
