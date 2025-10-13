import { supabase } from './supabase';
import { Season, Transaction } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';

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
  money: number;
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
  };
}

export const insertTransaction = async (transactionData: TransactionData): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from(TRANSACTIONS_TABLE)
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error inserting transaction:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

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
    return (data || []).map(mapTransactionFromDB);
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
};

