import { authService } from './authService';
import { Season } from '../../types/types';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { insertCompany, insertUser, getCompanyById, getCompanyByName, getUserCompanies, getAllCompanies as loadAllCompanies, updateCompany as updateCompanyInDB, deleteCompany as deleteCompanyFromDB, getCompanyStats as loadCompanyStats, checkCompanyNameExists, type Company, type CompanyData } from '@/lib/database';
import { initializeLenders } from '../finance/lenderService';
import { calculateInitialShareCount } from '../../constants/financeConstants';
import { createCompanyShares, updateCompanyShares } from '../../database/core/companySharesDB';

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
  // Growth trend tracking
  growthTrendMultiplier?: number;
  lastGrowthTrendUpdateWeek?: number;
  lastGrowthTrendUpdateSeason?: Season;
  lastGrowthTrendUpdateYear?: number;
  // Incremental share price tracking
  lastSharePriceUpdateWeek?: number;
  lastSharePriceUpdateSeason?: Season;
  lastSharePriceUpdateYear?: number;
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
        prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
        // Share fields removed - now in company_shares table
      };

      const result = await insertCompany(companyData);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Create company_shares record
      const companyId = result.data.id;
      const sharesResult = await createCompanyShares(companyId, {
        total_shares: TOTAL_SHARES,
        outstanding_shares: outstandingShares,
        player_shares: playerShares,
        initial_ownership_pct: playerOwnershipPct,
        dividend_rate: 0.001, // Fixed per share in euros
        market_cap: 0,
        share_price: 0
      });

      if (!sharesResult.success) {
        console.error('Failed to create company shares record:', sharesResult.error);
        // Don't fail company creation if shares creation fails - migration will handle it
      }

      // Fetch the complete company with share data from company_shares table
      const company = await getCompanyById(companyId);

      // Initialize lenders for the new company
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
    // Separate company updates from share updates
    const companyUpdateData: any = {};
    if (updates.currentWeek !== undefined) companyUpdateData.current_week = updates.currentWeek;
    if (updates.currentSeason !== undefined) companyUpdateData.current_season = updates.currentSeason;
    if (updates.currentYear !== undefined) companyUpdateData.current_year = updates.currentYear;
    if (updates.money !== undefined) companyUpdateData.money = updates.money;
    if (updates.prestige !== undefined) companyUpdateData.prestige = updates.prestige;
    if (updates.startingCountry !== undefined) companyUpdateData.starting_country = updates.startingCountry;
    if (updates.initialVineyardValue !== undefined) companyUpdateData.initial_vineyard_value = updates.initialVineyardValue;

    // Share-related updates go to company_shares table
    const sharesUpdateData: any = {};
    if (updates.totalShares !== undefined) sharesUpdateData.total_shares = updates.totalShares;
    if (updates.outstandingShares !== undefined) sharesUpdateData.outstanding_shares = updates.outstandingShares;
    if (updates.playerShares !== undefined) sharesUpdateData.player_shares = updates.playerShares;
    if (updates.initialOwnershipPct !== undefined) sharesUpdateData.initial_ownership_pct = updates.initialOwnershipPct;
    if (updates.dividendRate !== undefined) sharesUpdateData.dividend_rate = updates.dividendRate;
    if (updates.lastDividendPaidWeek !== undefined) sharesUpdateData.last_dividend_paid_week = updates.lastDividendPaidWeek;
    if (updates.lastDividendPaidSeason !== undefined) sharesUpdateData.last_dividend_paid_season = updates.lastDividendPaidSeason;
    if (updates.lastDividendPaidYear !== undefined) sharesUpdateData.last_dividend_paid_year = updates.lastDividendPaidYear;
    if (updates.marketCap !== undefined) sharesUpdateData.market_cap = updates.marketCap;
    if (updates.sharePrice !== undefined) sharesUpdateData.share_price = updates.sharePrice;
    if (updates.growthTrendMultiplier !== undefined) sharesUpdateData.growth_trend_multiplier = updates.growthTrendMultiplier;
    if (updates.lastGrowthTrendUpdateWeek !== undefined) sharesUpdateData.last_growth_trend_update_week = updates.lastGrowthTrendUpdateWeek;
    if (updates.lastGrowthTrendUpdateSeason !== undefined) sharesUpdateData.last_growth_trend_update_season = updates.lastGrowthTrendUpdateSeason;
    if (updates.lastGrowthTrendUpdateYear !== undefined) sharesUpdateData.last_growth_trend_update_year = updates.lastGrowthTrendUpdateYear;
    if (updates.lastSharePriceUpdateWeek !== undefined) sharesUpdateData.last_share_price_update_week = updates.lastSharePriceUpdateWeek;
    if (updates.lastSharePriceUpdateSeason !== undefined) sharesUpdateData.last_share_price_update_season = updates.lastSharePriceUpdateSeason;
    if (updates.lastSharePriceUpdateYear !== undefined) sharesUpdateData.last_share_price_update_year = updates.lastSharePriceUpdateYear;

    // Update company table (if there are non-share updates)
    let companyResult = { success: true };
    if (Object.keys(companyUpdateData).length > 0) {
      companyResult = await updateCompanyInDB(companyId, companyUpdateData);
      if (!companyResult.success) {
        return companyResult;
      }
    }

    // Update company_shares table (if there are share updates)
    if (Object.keys(sharesUpdateData).length > 0) {
      const sharesResult = await updateCompanyShares(companyId, sharesUpdateData);
      if (!sharesResult.success) {
        return sharesResult;
      }
    }

    return { success: true };
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
