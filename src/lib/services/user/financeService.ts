import { getGameState } from '../core/gameState';
import { Transaction } from '../../types/types';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { loadWineBatches } from '../../database/activities/inventoryDB';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { getCurrentCompany, updateGameState } from '../core/gameState';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { companyService } from './companyService';
import { TRANSACTION_CATEGORIES } from '../../constants/financeConstants';
import { insertTransaction as insertTransactionDB, loadTransactions as loadTransactionsDB, type TransactionData } from '@/lib/database';

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
}

let transactionsCache: Transaction[] = [];

// Initialize starting capital for new games
export const initializeStartingCapital = async (companyId?: string): Promise<void> => {
  try {
    if (!companyId) {
      const currentCompany = getCurrentCompany();
      if (!currentCompany) {
        return;
      }
      companyId = currentCompany.id;
    }
    
    const existingTransactions = await loadTransactions();
    const hasStartingCapital = existingTransactions.some(t => 
      t.description === 'Starting Capital' && t.category === TRANSACTION_CATEGORIES.INITIAL_INVESTMENT
    );
    
    if (hasStartingCapital) {
      return; // Already initialized
    }
    
    await addTransaction(
      GAME_INITIALIZATION.STARTING_MONEY,
      'Starting Capital',
      TRANSACTION_CATEGORIES.INITIAL_INVESTMENT,
      false,
      companyId
    );
    
  } catch (error) {
    console.error('Error initializing starting capital:', error);
  }
};

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
        const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
        return seasons.indexOf(b.date.season) - seasons.indexOf(a.date.season);
      }
      return b.date.week - a.date.week;
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

// Calculate financial data for income statement and balance sheet
export const calculateFinancialData = async (period: 'weekly' | 'season' | 'year'): Promise<FinancialData> => {
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
  
  const filteredTransactions = transactions.filter(transaction => 
    filterTransactionByPeriod(transaction, currentDate, period)
  );
  
  let income = 0;
  let expenses = 0;
  const incomeDetails: { description: string; amount: number }[] = [];
  const expenseDetails: { description: string; amount: number }[] = [];
  
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
    const qualityMultiplier = batch.quality || 0.5;
    
    return sum + (batch.quantity * stageMultiplier * qualityMultiplier * (batch.estimatedPrice || 10));
  }, 0);
  
  const grapesValue = wineBatches.reduce((sum, batch) => {
    if (batch.state !== 'grapes') return sum;
    
    const qualityMultiplier = batch.quality || 0.5;
    return sum + (batch.quantity * qualityMultiplier * 5);
  }, 0);
  
  const cashMoney = gameState.money || 0;
  const fixedAssets = buildingsValue + allVineyardsValue;
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
    allVineyardsValue,
    wineValue,
    grapesValue
  };
};

// Helper function to filter transactions by time period
function filterTransactionByPeriod(
  transaction: Transaction,
  currentDate: { week: number; season: string; year: number },
  period: 'weekly' | 'season' | 'year'
): boolean {
  switch (period) {
    case 'weekly':
      return transaction.date.week === currentDate.week &&
             transaction.date.season === currentDate.season &&
             transaction.date.year === currentDate.year;
    case 'season':
      return transaction.date.season === currentDate.season &&
             transaction.date.year === currentDate.year;
    case 'year':
      return transaction.date.year === currentDate.year;
    default:
      return false;
  }
}
