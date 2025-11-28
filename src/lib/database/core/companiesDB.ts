import { supabase } from './supabase';
import { Season, GameDate } from '../../types/types';
import { toOptionalNumber, toOptionalString, buildGameDate } from '../dbMapperUtils';

const COMPANIES_TABLE = 'companies';

export interface Company {
  id: string;
  name: string;
  userId?: string;
  foundedYear: number;
  currentWeek: number;
  currentSeason: Season;
  currentYear: number;
  money: number;
  prestige: number;
  lastPlayed: Date;
  createdAt: Date;
  updatedAt: Date;
  startingCountry?: string; // Starting country for companies using new starting conditions system
  // Public company fields
  totalShares?: number;
  outstandingShares?: number;
  playerShares?: number;
  initialOwnershipPct?: number;
  dividendRate?: number; // Fixed per share in euros
  lastDividendPaid?: GameDate;
  marketCap?: number;
  sharePrice?: number;
  initialVineyardValue?: number; // Initial family contribution (vineyard value at company creation)
  // Growth trend tracking for share valuation
  growthTrendMultiplier?: number; // Multiplier adjusting expected values based on historical performance (default: 1.0)
  lastGrowthTrendUpdate?: GameDate; // When growth trend was last updated
  // Incremental share price tracking
  lastSharePriceUpdate?: GameDate; // When share price was last adjusted incrementally
  // Base values for expected value calculations (future: NPC/Board room controlled)
  baseRevenueGrowth?: number; // Default: 0.10 (10%)
  baseProfitMargin?: number; // Default: 0.15 (15%)
  baseExpectedReturnOnBookValue?: number; // Default: 0.10 (10%)
}

/**
 * Map database row to Company
 */
function mapCompanyFromDB(dbCompany: any): Company {
  // Core company fields
  const company: Company = {
    id: dbCompany.id,
    name: dbCompany.name,
    userId: dbCompany.user_id,
    foundedYear: dbCompany.founded_year,
    currentWeek: dbCompany.current_week,
    currentSeason: dbCompany.current_season as Season,
    currentYear: dbCompany.current_year,
    money: dbCompany.money,
    prestige: dbCompany.prestige,
    lastPlayed: dbCompany.last_played ? new Date(dbCompany.last_played) : new Date(),
    createdAt: new Date(dbCompany.created_at),
    updatedAt: new Date(dbCompany.updated_at),
    startingCountry: toOptionalString(dbCompany.starting_country)
  };

  // Public company fields - shares
  company.totalShares = toOptionalNumber(dbCompany.total_shares);
  company.outstandingShares = toOptionalNumber(dbCompany.outstanding_shares);
  company.playerShares = toOptionalNumber(dbCompany.player_shares);
  company.initialOwnershipPct = toOptionalNumber(dbCompany.initial_ownership_pct);
  company.dividendRate = toOptionalNumber(dbCompany.dividend_rate);
  company.lastDividendPaid = buildGameDate(
    dbCompany.last_dividend_paid_week,
    dbCompany.last_dividend_paid_season,
    dbCompany.last_dividend_paid_year
  );

  // Public company fields - valuation
  company.marketCap = toOptionalNumber(dbCompany.market_cap);
  company.sharePrice = toOptionalNumber(dbCompany.share_price);
  company.initialVineyardValue = toOptionalNumber(dbCompany.initial_vineyard_value);

  // Growth trend tracking
  company.growthTrendMultiplier = toOptionalNumber(dbCompany.growth_trend_multiplier);
  company.lastGrowthTrendUpdate = buildGameDate(
    dbCompany.last_growth_trend_update_week,
    dbCompany.last_growth_trend_update_season,
    dbCompany.last_growth_trend_update_year
  );

  // Share price tracking
  company.lastSharePriceUpdate = buildGameDate(
    dbCompany.last_share_price_update_week,
    dbCompany.last_share_price_update_season,
    dbCompany.last_share_price_update_year
  );

  // Base values for expected value calculations
  company.baseRevenueGrowth = toOptionalNumber(dbCompany.base_revenue_growth);
  company.baseProfitMargin = toOptionalNumber(dbCompany.base_profit_margin);
  company.baseExpectedReturnOnBookValue = toOptionalNumber(dbCompany.base_expected_return_on_book_value);

  return company;
}

/**
 * Companies Database Operations
 * Pure CRUD operations for company data persistence
 */

export interface CompanyData {
  id?: string;
  name: string;
  user_id?: string | null;
  founded_year: number;
  current_week: number;
  current_season: Season;
  current_year: number;
  money: number;
  prestige: number;
  last_played?: string;
  starting_country?: string;
  // Public company fields
  total_shares?: number;
  outstanding_shares?: number;
  player_shares?: number;
  initial_ownership_pct?: number;
  dividend_rate?: number; // Fixed per share in euros
  last_dividend_paid_week?: number;
  last_dividend_paid_season?: Season;
  last_dividend_paid_year?: number;
  market_cap?: number;
  share_price?: number;
  initial_vineyard_value?: number;
  // Growth trend tracking
  growth_trend_multiplier?: number;
  last_growth_trend_update_week?: number;
  last_growth_trend_update_season?: Season;
  last_growth_trend_update_year?: number;
  // Incremental share price tracking
  last_share_price_update_week?: number;
  last_share_price_update_season?: Season;
  last_share_price_update_year?: number;
  // Base values for expected value calculations
  base_revenue_growth?: number;
  base_profit_margin?: number;
  base_expected_return_on_book_value?: number;
}

export const insertCompany = async (companyData: CompanyData): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from(COMPANIES_TABLE)
      .insert(companyData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error inserting company:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const getCompanyById = async (companyId: string): Promise<Company | null> => {
  try {
    const { data, error } = await supabase
      .from(COMPANIES_TABLE)
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) return null;
    return data ? mapCompanyFromDB(data) : null;
  } catch (error) {
    console.error('Error getting company by ID:', error);
    return null;
  }
};

export const getCompanyByName = async (name: string): Promise<Company | null> => {
  try {
    const { data, error } = await supabase
      .from(COMPANIES_TABLE)
      .select('*')
      .eq('name', name)
      .single();

    if (error) return null;
    return data ? mapCompanyFromDB(data) : null;
  } catch (error) {
    console.error('Error getting company by name:', error);
    return null;
  }
};

export const checkCompanyNameExists = async (name: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from(COMPANIES_TABLE)
      .select('name')
      .eq('name', name);

    if (error) return false;
    return (data && data.length > 0);
  } catch (error) {
    console.error('Error checking company name:', error);
    return false;
  }
};

export const getUserCompanies = async (userId: string): Promise<Company[]> => {
  try {
    const { data, error } = await supabase
      .from(COMPANIES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('last_played', { ascending: false });

    if (error) return [];
    return (data || []).map(mapCompanyFromDB);
  } catch (error) {
    console.error('Error getting user companies:', error);
    return [];
  }
};

export const getAllCompanies = async (limit: number = 50): Promise<Company[]> => {
  try {
    const { data, error} = await supabase
      .from(COMPANIES_TABLE)
      .select('*')
      .order('last_played', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map(mapCompanyFromDB);
  } catch (error) {
    console.error('Error getting all companies:', error);
    return [];
  }
};

export const updateCompany = async (companyId: string, updates: Partial<CompanyData>): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = {
      last_played: new Date().toISOString(),
      ...updates
    };

    const { error } = await supabase
      .from(COMPANIES_TABLE)
      .update(updateData)
      .eq('id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error updating company:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const deleteCompany = async (companyId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from(COMPANIES_TABLE)
      .delete()
      .eq('id', companyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting company:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const getCompanyStats = async (userId?: string): Promise<any[]> => {
  try {
    let query = supabase.from(COMPANIES_TABLE).select('money, current_week, current_year');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) return [];
    return data || [];
  } catch (error) {
    console.error('Error getting company stats:', error);
    return [];
  }
};

