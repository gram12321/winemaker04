import { supabase } from './supabase';
import { Season } from '../../types/types';

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
}

/**
 * Map database row to Company
 */
function mapCompanyFromDB(dbCompany: any): Company {
  return {
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
    updatedAt: new Date(dbCompany.updated_at)
  };
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

