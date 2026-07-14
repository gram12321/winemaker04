import { supabase } from './supabase';
import { Season, Transaction } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { SEASON_ORDER } from '@/lib/constants';
import { buildGameDate } from '../dbMapperUtils';

const TRANSACTIONS_TABLE = 'transactions';

/**
 * Transactions Database Operations
 * Pure CRUD operations for transaction data persistence
 */

export interface TransactionData {
  id?: string;
  company_id: string;
  amount: number;
  description: string;
  category: string;
  recurring: boolean;
  week: number;
  season: Season;
  year: number;
  created_at?: string;
}

/**
 * Map database row to Transaction
 */
function mapTransactionFromDB(row: any): Transaction {
  return {
    id: row.id,
    date: buildGameDate(row.week, row.season, row.year) || {
      week: 1,
      season: 'Spring' as Season,
      year: 2024
    },
    amount: row.amount,
    description: row.description,
    category: row.category,
    recurring: row.recurring || false,
    money: row.money
  };
}

async function recordCompanyTransaction(transactionData: TransactionData, requireFunds: boolean): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('record_company_transaction', {
      p_company_id: transactionData.company_id,
      p_amount: transactionData.amount,
      p_description: transactionData.description,
      p_category: transactionData.category,
      p_recurring: transactionData.recurring,
      p_week: transactionData.week,
      p_season: transactionData.season,
      p_year: transactionData.year,
      p_require_funds: requireFunds,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) return { success: false, error: requireFunds ? 'Insufficient funds.' : 'Could not record transaction.' };

    return { success: true, data };
  } catch (error: any) {
    console.error('Error inserting transaction:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export const insertTransaction = (transactionData: TransactionData) => recordCompanyTransaction(transactionData, false);

export const insertTransactionWithFundsCheck = (transactionData: TransactionData) => recordCompanyTransaction(transactionData, true);

export const loadTransactions = async (companyId?: string): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from(TRANSACTIONS_TABLE)
      .select('*')
      .eq('company_id', companyId || getCurrentCompanyId());

    if (error) throw error;
    
    // Map to Transaction objects first, preserving the created_at field
    const transactions = (data || []).map(row => ({
      ...mapTransactionFromDB(row),
      created_at: row.created_at
    }));
    
    // Sort in JavaScript to ensure proper ordering
    return transactions.sort((a, b) => {
      if (a.date.year !== b.date.year) return b.date.year - a.date.year;
      if (a.date.season !== b.date.season) {
        return SEASON_ORDER.indexOf(b.date.season) - SEASON_ORDER.indexOf(a.date.season);
      }
      if (a.date.week !== b.date.week) return b.date.week - a.date.week;
      // For same week transactions, sort by created_at timestamp
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // Fallback to ID comparison if created_at is not available
      return b.id.localeCompare(a.id);
    });
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
};

