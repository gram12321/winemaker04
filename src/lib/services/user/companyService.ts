import { authService } from './authService';
import { Season } from '../../types/types';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { insertCompany, insertUser, getCompanyById, getCompanyByName, getUserCompanies, getAllCompanies as loadAllCompanies, updateCompany as updateCompanyInDB, deleteCompany as deleteCompanyFromDB, getCompanyStats as loadCompanyStats, checkCompanyNameExists, type Company, type CompanyData } from '@/lib/database';
import { initializeLenders } from '../finance/lenderService';
import { calculateInitialShareCount } from '../../constants/financeConstants';

export interface CompanyCreateData {
  name: string;
  associateWithUser?: boolean;
  userName?: string;
  userId?: string; // Optional: directly specify userId to associate with (takes precedence over associateWithUser)
  outsideInvestmentAmount?: number; // Outside investment in euros (0 to 1,000,000)
}

export interface CompanyUpdateData {
  currentWeek?: number;
  currentSeason?: Season;
  currentYear?: number;
  money?: number;
  prestige?: number;
  startingCountry?: string;
  totalShares?: number;
  outstandingShares?: number;
  playerShares?: number;
  initialOwnershipPct?: number;
  dividendRate?: number;
  lastDividendPaidWeek?: number;
  lastDividendPaidSeason?: Season;
  lastDividendPaidYear?: number;
  marketCap?: number;
  sharePrice?: number;
  initialVineyardValue?: number; // Initial family contribution (vineyard value at company creation)
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

      // If userId is directly provided, use it (takes precedence)
      if (data.userId) {
        userId = data.userId;
      }
      // If user creation is requested, create a user first
      else if (data.associateWithUser && data.userName) {
        const userResult = await insertUser({
          name: data.userName,
          created_at: new Date().toISOString()
        });

        if (!userResult.success) {
          return { success: false, error: `Failed to create user: ${userResult.error}` };
        }

        userId = userResult.data.id;
      } else if (data.associateWithUser) {
        // If associateWithUser is true but no userName provided, use current user
        const currentUser = authService.getCurrentUser();
        userId = currentUser ? currentUser.id : null;
      }

      // Check if company name already exists
      const nameExists = await checkCompanyNameExists(data.name);
      if (nameExists) {
        return { success: false, error: 'Company name already exists' };
      }

      // Calculate share structure based on outside investment
      const FIXED_PLAYER_INVESTMENT = 100000; // Fixed at 100,000€
      const outsideInvestment = data.outsideInvestmentAmount ?? 0;
      const totalCapital = FIXED_PLAYER_INVESTMENT + outsideInvestment;
      const playerOwnershipPct = totalCapital > 0 ? (FIXED_PLAYER_INVESTMENT / totalCapital) * 100 : 100;
      
      // Calculate share count based on total capital and target share price (€50)
      const TOTAL_SHARES = calculateInitialShareCount(totalCapital);
      const playerShares = Math.round(TOTAL_SHARES * (playerOwnershipPct / 100));
      const outstandingShares = TOTAL_SHARES - playerShares;

      const companyData: CompanyData = {
        name: data.name,
        user_id: userId,
        founded_year: 2024,
        current_week: 1,
        current_season: 'Spring',
        current_year: 2024,
        money: 0,
        prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
        // Public company fields
        total_shares: TOTAL_SHARES,
        outstanding_shares: outstandingShares,
        player_shares: playerShares,
        initial_ownership_pct: playerOwnershipPct,
        dividend_rate: 0.001, // Fixed per share in euros
        market_cap: 0,
        share_price: 0
      };

      const result = await insertCompany(companyData);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Map the returned data to Company type
      const company = result.data ? {
        id: result.data.id,
        name: result.data.name,
        userId: result.data.user_id,
        foundedYear: result.data.founded_year,
        currentWeek: result.data.current_week,
        currentSeason: result.data.current_season as Season,
        currentYear: result.data.current_year,
        money: result.data.money,
        prestige: result.data.prestige,
        lastPlayed: new Date(),
        createdAt: new Date(result.data.created_at),
        updatedAt: new Date(result.data.updated_at),
        // Public company fields
        totalShares: result.data.total_shares ? Number(result.data.total_shares) : undefined,
        outstandingShares: result.data.outstanding_shares ? Number(result.data.outstanding_shares) : undefined,
        playerShares: result.data.player_shares ? Number(result.data.player_shares) : undefined,
        initialOwnershipPct: result.data.initial_ownership_pct ? Number(result.data.initial_ownership_pct) : undefined,
        dividendRate: result.data.dividend_rate ? Number(result.data.dividend_rate) : undefined,
        lastDividendPaid: (result.data.last_dividend_paid_week && result.data.last_dividend_paid_season && result.data.last_dividend_paid_year) ? {
          week: result.data.last_dividend_paid_week,
          season: result.data.last_dividend_paid_season as Season,
          year: result.data.last_dividend_paid_year
        } : undefined,
        marketCap: result.data.market_cap ? Number(result.data.market_cap) : undefined,
        sharePrice: result.data.share_price ? Number(result.data.share_price) : undefined
      } as Company : undefined;

      // Initialize lenders for the new company
      if (company) {
        try {
          await initializeLenders(company.id);
        } catch (error) {
          console.warn('Failed to initialize lenders for new company:', error);
        }
      }

      return { success: true, company };
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
    const updateData: any = {};
    if (updates.currentWeek !== undefined) updateData.current_week = updates.currentWeek;
    if (updates.currentSeason !== undefined) updateData.current_season = updates.currentSeason;
    if (updates.currentYear !== undefined) updateData.current_year = updates.currentYear;
    if (updates.money !== undefined) updateData.money = updates.money;
    if (updates.prestige !== undefined) updateData.prestige = updates.prestige;
    if (updates.startingCountry !== undefined) updateData.starting_country = updates.startingCountry;
    if (updates.totalShares !== undefined) updateData.total_shares = updates.totalShares;
    if (updates.outstandingShares !== undefined) updateData.outstanding_shares = updates.outstandingShares;
    if (updates.playerShares !== undefined) updateData.player_shares = updates.playerShares;
    if (updates.initialOwnershipPct !== undefined) updateData.initial_ownership_pct = updates.initialOwnershipPct;
    if (updates.dividendRate !== undefined) updateData.dividend_rate = updates.dividendRate;
    if (updates.lastDividendPaidWeek !== undefined) updateData.last_dividend_paid_week = updates.lastDividendPaidWeek;
    if (updates.lastDividendPaidSeason !== undefined) updateData.last_dividend_paid_season = updates.lastDividendPaidSeason;
    if (updates.lastDividendPaidYear !== undefined) updateData.last_dividend_paid_year = updates.lastDividendPaidYear;
    if (updates.marketCap !== undefined) updateData.market_cap = updates.marketCap;
    if (updates.sharePrice !== undefined) updateData.share_price = updates.sharePrice;
    if (updates.initialVineyardValue !== undefined) updateData.initial_vineyard_value = updates.initialVineyardValue;

    return await updateCompanyInDB(companyId, updateData);
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
