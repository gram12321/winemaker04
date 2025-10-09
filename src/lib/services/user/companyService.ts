import { supabase } from '../../database/core/supabase';
import { authService } from './authService';
// Removed notificationService import - company operations use console.log instead
import { Season } from '../../types/types';
import { GAME_INITIALIZATION } from '../../constants/constants';

export interface Company {
  id: string;
  name: string;
  userId?: string;
  foundedYear: number;
  currentWeek: number;
  currentSeason: Season;
  currentYear: number;
  money: number; // in euros
  prestige: number;
  lastPlayed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyCreateData {
  name: string;
  associateWithUser?: boolean;
  userName?: string;
}

export interface CompanyUpdateData {
  currentWeek?: number;
  currentSeason?: Season;
  currentYear?: number;
  money?: number;
  prestige?: number;
}

export interface CompanyStats {
  totalCompanies: number;
  totalGold: number;
  totalValue: number;
  avgWeeks: number;
}

class CompanyService {
  public async createCompany(data: CompanyCreateData): Promise<{ success: boolean; company?: Company; error?: string }> {
    try {
      let userId: string | null = null;

      // If user creation is requested, create a user first
      if (data.associateWithUser && data.userName) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .insert({
            name: data.userName,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (userError) {
          return { success: false, error: `Failed to create user: ${userError.message}` };
        }

        userId = user.id;
      } else if (data.associateWithUser) {
        // If associateWithUser is true but no userName provided, use current user
        const currentUser = authService.getCurrentUser();
        userId = currentUser ? currentUser.id : null;
      }

      // Check if company name already exists
      const { data: existingCompanies, error: checkError } = await supabase
        .from('companies')
        .select('name')
        .eq('name', data.name);

      if (checkError) {
        console.error('Error checking company name:', checkError);
        return { success: false, error: 'Failed to check company name availability' };
      }

      if (existingCompanies && existingCompanies.length > 0) {
        return { success: false, error: 'Company name already exists' };
      }

      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          name: data.name,
          user_id: userId,
          founded_year: 2024,
          current_week: 1,
          current_season: 'Spring',
          current_year: 2024,
          money: 0, // Starting money will be set by finance system transactions
          prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const mappedCompany = this.mapDatabaseCompany(company);
      return { success: true, company: mappedCompany };
    } catch (error) {
      console.error('Error creating company:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async getCompany(companyId: string): Promise<Company | null> {
    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error || !company) {
        return null;
      }

      return this.mapDatabaseCompany(company);
    } catch (error) {
      console.error('Error getting company:', error);
      return null;
    }
  }

  public async getCompanyByName(name: string): Promise<Company | null> {
    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('name', name)
        .single();

      if (error || !company) {
        return null;
      }

      return this.mapDatabaseCompany(company);
    } catch (error) {
      console.error('Error getting company by name:', error);
      return null;
    }
  }

  public async getUserCompanies(userId: string): Promise<Company[]> {
    try {
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', userId)
        .order('last_played', { ascending: false });

      if (error) {
        console.error('Error getting user companies:', error);
        return [];
      }

      return companies.map(this.mapDatabaseCompany);
    } catch (error) {
      console.error('Error getting user companies:', error);
      return [];
    }
  }

  public async getAllCompanies(limit: number = 50): Promise<Company[]> {
    try {
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .order('last_played', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting all companies:', error);
        return [];
      }

      return companies.map(this.mapDatabaseCompany);
    } catch (error) {
      console.error('Error getting all companies:', error);
      return [];
    }
  }

  public async updateCompany(companyId: string, updates: CompanyUpdateData): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        last_played: new Date().toISOString()
      };

      if (updates.currentWeek !== undefined) updateData.current_week = updates.currentWeek;
      if (updates.currentSeason !== undefined) updateData.current_season = updates.currentSeason;
      if (updates.currentYear !== undefined) updateData.current_year = updates.currentYear;
      if (updates.money !== undefined) updateData.money = updates.money;
      if (updates.prestige !== undefined) updateData.prestige = updates.prestige;

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating company:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async deleteCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) {
        return { success: false, error: error.message };
      }

      console.log('Company deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Error deleting company:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async getCompanyStats(userId?: string): Promise<CompanyStats> {
    try {
      let query = supabase.from('companies').select('money, current_week, current_year');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: companies, error } = await query;

      if (error || !companies) {
        return { totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 };
      }

      const totalCompanies = companies.length;
      const totalGold = companies.reduce((sum, company) => sum + company.money, 0);
      const totalValue = totalGold; // For now, company value = money (will be enhanced later)
      const totalWeeks = companies.reduce((sum, company) => {
        // Calculate weeks elapsed since start
        const weeksElapsed = (company.current_year - 2024) * 52 + company.current_week;
        return sum + Math.max(1, weeksElapsed);
      }, 0);
      const avgWeeks = totalCompanies > 0 ? Math.round(totalWeeks / totalCompanies) : 0;

      return {
        totalCompanies,
        totalGold,
        totalValue,
        avgWeeks
      };
    } catch (error) {
      console.error('Error getting company stats:', error);
      return { totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 };
    }
  }

  private mapDatabaseCompany(dbCompany: any): Company {
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
}

export const companyService = new CompanyService();
export default companyService;
