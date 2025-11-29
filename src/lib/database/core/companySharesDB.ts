/**
 * Company Shares Database Operations
 * 
 * Handles all share-related data operations for the normalized company_shares table.
 * This table has a one-to-one relationship with companies.
 */

import { supabase } from './supabase';
import { Season, GameDate } from '../../types/types';
import { toOptionalNumber, buildGameDate } from '../dbMapperUtils';

const COMPANY_SHARES_TABLE = 'company_shares';

export interface CompanyShares {
  companyId: string;
  // Share structure
  totalShares: number;
  outstandingShares: number;
  playerShares: number;
  initialOwnershipPct?: number;
  // Dividends
  dividendRate: number;
  lastDividendPaid?: GameDate;
  // Pricing
  marketCap: number;
  sharePrice: number;
  // Growth trend tracking
  growthTrendMultiplier: number;
  lastGrowthTrendUpdate?: GameDate;
  // Incremental share price tracking
  lastSharePriceUpdate?: GameDate;
  // Initial family contribution (vineyard value at company creation)
  initialVineyardValue: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanySharesData {
  company_id: string;
  // Share structure
  total_shares?: number;
  outstanding_shares?: number;
  player_shares?: number;
  initial_ownership_pct?: number;
  // Dividends
  dividend_rate?: number;
  last_dividend_paid_week?: number;
  last_dividend_paid_season?: Season;
  last_dividend_paid_year?: number;
  // Pricing
  market_cap?: number;
  share_price?: number;
  // Growth trend tracking
  growth_trend_multiplier?: number;
  last_growth_trend_update_week?: number;
  last_growth_trend_update_season?: Season;
  last_growth_trend_update_year?: number;
  // Incremental share price tracking
  last_share_price_update_week?: number;
  last_share_price_update_season?: Season;
  last_share_price_update_year?: number;
}

/**
 * Map database row to CompanyShares
 */
function mapCompanySharesFromDB(dbShares: any): CompanyShares {
  return {
    companyId: dbShares.company_id,
    totalShares: Number(dbShares.total_shares ?? 1000000),
    outstandingShares: Number(dbShares.outstanding_shares ?? 0),
    playerShares: Number(dbShares.player_shares ?? 1000000),
    initialOwnershipPct: toOptionalNumber(dbShares.initial_ownership_pct),
    dividendRate: Number(dbShares.dividend_rate ?? 0),
    lastDividendPaid: buildGameDate(
      dbShares.last_dividend_paid_week,
      dbShares.last_dividend_paid_season,
      dbShares.last_dividend_paid_year
    ),
    marketCap: Number(dbShares.market_cap ?? 0),
    sharePrice: Number(dbShares.share_price ?? 0),
    growthTrendMultiplier: Number(dbShares.growth_trend_multiplier ?? 1.0),
    lastGrowthTrendUpdate: buildGameDate(
      dbShares.last_growth_trend_update_week,
      dbShares.last_growth_trend_update_season,
      dbShares.last_growth_trend_update_year
    ),
    lastSharePriceUpdate: buildGameDate(
      dbShares.last_share_price_update_week,
      dbShares.last_share_price_update_season,
      dbShares.last_share_price_update_year
    ),
    initialVineyardValue: Number(dbShares.initial_vineyard_value ?? 0),
    createdAt: new Date(dbShares.created_at),
    updatedAt: new Date(dbShares.updated_at)
  };
}

/**
 * Get company shares data by company ID
 * Also fetches initial_vineyard_value from companies table
 */
export async function getCompanyShares(companyId: string): Promise<CompanyShares | null> {
  try {
    // Fetch company_shares data
    const { data: sharesData, error: sharesError } = await supabase
      .from(COMPANY_SHARES_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (sharesError || !sharesData) return null;

    // Fetch initial_vineyard_value from companies table
    const { data: companyData } = await supabase
      .from('companies')
      .select('initial_vineyard_value')
      .eq('id', companyId)
      .single();

    // Map the data, including initial_vineyard_value from companies table
    const mappedData = mapCompanySharesFromDB({
      ...sharesData,
      initial_vineyard_value: companyData?.initial_vineyard_value ?? 0
    });
    
    return mappedData;
  } catch (error) {
    console.error('Error getting company shares:', error);
    return null;
  }
}

/**
 * Create company shares record (called when company is created)
 */
export async function createCompanyShares(companyId: string, sharesData: Partial<CompanySharesData>): Promise<{ success: boolean; error?: string }> {
  try {
    const sharesDataToInsert: CompanySharesData = {
      company_id: companyId,
      total_shares: sharesData.total_shares ?? 1000000,
      outstanding_shares: sharesData.outstanding_shares ?? 0,
      player_shares: sharesData.player_shares ?? 1000000,
      initial_ownership_pct: sharesData.initial_ownership_pct ?? 100.0,
      dividend_rate: sharesData.dividend_rate ?? 0,
      last_dividend_paid_week: sharesData.last_dividend_paid_week,
      last_dividend_paid_season: sharesData.last_dividend_paid_season,
      last_dividend_paid_year: sharesData.last_dividend_paid_year,
      market_cap: sharesData.market_cap ?? 0,
      share_price: sharesData.share_price ?? 0,
      growth_trend_multiplier: sharesData.growth_trend_multiplier ?? 1.0,
      last_growth_trend_update_week: sharesData.last_growth_trend_update_week,
      last_growth_trend_update_season: sharesData.last_growth_trend_update_season,
      last_growth_trend_update_year: sharesData.last_growth_trend_update_year,
      last_share_price_update_week: sharesData.last_share_price_update_week,
      last_share_price_update_season: sharesData.last_share_price_update_season,
      last_share_price_update_year: sharesData.last_share_price_update_year
    };

    const { error } = await supabase
      .from(COMPANY_SHARES_TABLE)
      .insert(sharesDataToInsert);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating company shares:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Update company shares data
 */
export async function updateCompanyShares(companyId: string, updates: Partial<CompanySharesData>): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
      ...updates
    };

    const { error } = await supabase
      .from(COMPANY_SHARES_TABLE)
      .update(updateData)
      .eq('company_id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error updating company shares:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Delete company shares (called when company is deleted)
 */
export async function deleteCompanyShares(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(COMPANY_SHARES_TABLE)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting company shares:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

