import { authService } from './authService';
import { Season } from '../../types/types';
import { GAME_INITIALIZATION } from '../../constants/constants';
import {
  insertCompany,
  insertUser,
  getCompanyById,
  getCompanyByName,
  getUserCompanies,
  getAllCompanies as loadAllCompanies,
  updateCompany as updateCompanyInDB,
  deleteCompany as deleteCompanyFromDB,
  getCompanyStats as loadCompanyStats,
  checkCompanyNameExists,
  type Company,
  type CompanyData
} from '@/lib/database';
import { initializeLenders } from '../finance/lenderService';

export interface CompanyCreateData {
  name: string;
  associateWithUser?: boolean;
  userName?: string;
  userId?: string; // Optional: directly specify userId to associate with (takes precedence over associateWithUser)
}

export interface CompanyUpdateData {
  currentWeek?: number;
  currentSeason?: Season;
  currentYear?: number;
  money?: number;
  prestige?: number;
  startingCountry?: string;
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

      if (data.userId) {
        userId = data.userId;
      } else if (data.associateWithUser && data.userName) {
        const userResult = await insertUser({
          name: data.userName,
          created_at: new Date().toISOString()
        });

        if (!userResult.success) {
          return { success: false, error: `Failed to create user: ${userResult.error}` };
        }

        userId = userResult.data.id;
      } else if (data.associateWithUser) {
        const currentUser = authService.getCurrentUser();
        userId = currentUser ? currentUser.id : null;
      }

      const nameExists = await checkCompanyNameExists(data.name);
      if (nameExists) {
        return { success: false, error: 'Company name already exists' };
      }

      const companyData: CompanyData = {
        name: data.name,
        user_id: userId,
        founded_year: 2024,
        current_week: 1,
        current_season: 'Spring',
        current_year: 2024,
        money: 0,
        prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
      };

      const result = await insertCompany(companyData);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const company = await getCompanyById(result.data.id);

      if (company) {
        try {
          await initializeLenders(company.id);
        } catch (error) {
          console.warn('Failed to initialize lenders for new company:', error);
        }
      }

      return { success: true, company: company ?? undefined };
    } catch (error) {
      console.error('Error creating company:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async getCompany(companyId: string): Promise<Company | null> {
    return await getCompanyById(companyId);
  }

  public async getCompanyByName(name: string): Promise<Company | null> {
    return await getCompanyByName(name);
  }

  public async getUserCompanies(userId: string): Promise<Company[]> {
    return await getUserCompanies(userId);
  }

  public async getAllCompanies(limit: number = 50): Promise<Company[]> {
    return await loadAllCompanies(limit);
  }

  public async updateCompany(companyId: string, updates: CompanyUpdateData): Promise<{ success: boolean; error?: string }> {
    const companyUpdateData: any = {};
    if (updates.currentWeek !== undefined) companyUpdateData.current_week = updates.currentWeek;
    if (updates.currentSeason !== undefined) companyUpdateData.current_season = updates.currentSeason;
    if (updates.currentYear !== undefined) companyUpdateData.current_year = updates.currentYear;
    if (updates.money !== undefined) companyUpdateData.money = updates.money;
    if (updates.prestige !== undefined) companyUpdateData.prestige = updates.prestige;
    if (updates.startingCountry !== undefined) companyUpdateData.starting_country = updates.startingCountry;

    if (Object.keys(companyUpdateData).length === 0) {
      return { success: true };
    }

    return await updateCompanyInDB(companyId, companyUpdateData);
  }

  public async deleteCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
    const result = await deleteCompanyFromDB(companyId);
    if (result.success) {
      console.log('Company deleted successfully');
    }
    return result;
  }

  public async getCompanyStats(userId?: string): Promise<CompanyStats> {
    try {
      const companies = await loadCompanyStats(userId);

      if (!companies || companies.length === 0) {
        return { totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 };
      }

      const totalCompanies = companies.length;
      const totalGold = companies.reduce((sum: number, company: any) => sum + company.money, 0);
      const totalValue = totalGold;
      const totalWeeks = companies.reduce((sum: number, company: any) => {
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
}

export const companyService = new CompanyService();
export default companyService;
