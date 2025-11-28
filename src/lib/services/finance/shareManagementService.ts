import { GameDate, Transaction } from '../../types/types';
import { companyService } from '../user/companyService';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { addTransaction, calculateFinancialData, loadTransactions, calculateFinancialDataRollingNWeeks } from './financeService';
import { TRANSACTION_CATEGORIES } from '../../constants';
import { updateMarketValue } from './shareValuationService';
import { getGameState } from '../core/gameState';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { calculateAbsoluteWeeks, calculateCompanyWeeks } from '@/lib/utils/utils';
import { updatePlayerBalance } from '../user/userBalanceService';
import { formatNumber } from '../../utils/utils';
import { calculateTotalOutstandingLoans } from './loanService';
import { CREDIT_RATING } from '../../constants/loanConstants';

/**
 * Issue new shares (dilutes player ownership)
 * 
 * @param shares - Number of shares to issue
 * @param price - Price per share (optional, uses current market price if not provided)
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Success status and updated share structure
 */
export interface ShareMetrics {
  assetPerShare: number;
  cashPerShare: number;
  debtPerShare: number;
  bookValuePerShare: number;
  revenuePerShare: number;
  earningsPerShare: number;
  dividendPerShareCurrentYear: number;
  dividendPerSharePreviousYear: number;
  creditRating: number;
  profitMargin: number;      // Net income / Revenue ratio
  revenueGrowth: number;     // Year-over-year revenue growth percentage
  earningsPerShare48Weeks?: number;
  revenuePerShare48Weeks?: number;  // Revenue per share over last 48 weeks
  revenueGrowth48Weeks?: number;  // Revenue growth comparing last 48 weeks to previous 48 weeks
  profitMargin48Weeks?: number;   // Profit margin over last 48 weeks
  dividendPerShare48Weeks?: number; // Dividends paid in last 48 weeks
}

export interface ShareholderBreakdown {
  playerShares: number;
  familyShares: number;
  outsideShares: number;
  playerPct: number;
  familyPct: number;
  outsidePct: number;
}

type FinancialSnapshot = Awaited<ReturnType<typeof calculateFinancialData>>;

export async function issueStock(
  shares: number,
  price?: number,
  companyId?: string
): Promise<{
  success: boolean;
  error?: string;
  totalShares?: number;
  outstandingShares?: number;
  playerShares?: number;
  playerOwnershipPct?: number;
  capitalRaised?: number;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    if (shares <= 0) {
      return { success: false, error: 'Number of shares must be greater than 0' };
    }

    // Get current company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get current share price if not provided
    let sharePrice = price;
    if (sharePrice === undefined) {
      const marketValue = await updateMarketValue(companyId);
      if (!marketValue.success || !marketValue.sharePrice) {
        return { success: false, error: 'Failed to determine share price' };
      }
      sharePrice = marketValue.sharePrice;
    }

    if (sharePrice <= 0) {
      return { success: false, error: 'Share price must be greater than 0' };
    }

    // Calculate capital raised
    const capitalRaised = shares * sharePrice;

    // Update share structure
    const currentTotalShares = company.totalShares || 1000000;
    const currentPlayerShares = company.playerShares || currentTotalShares;
    const newTotalShares = currentTotalShares + shares;
    const newOutstandingShares = (company.outstandingShares || 0) + shares;
    const newPlayerShares = currentPlayerShares; // Player shares stay the same (dilution)
    const newPlayerOwnershipPct = (newPlayerShares / newTotalShares) * 100;

    // Update company in database
    const updateResult = await companyService.updateCompany(companyId, {
      totalShares: newTotalShares,
      outstandingShares: newOutstandingShares,
      playerShares: newPlayerShares
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update share structure' };
    }

    // Add capital raised to company money
    await addTransaction(
      capitalRaised,
      `Stock Issuance: ${shares.toLocaleString()} shares @ ${sharePrice.toFixed(2)}€ per share`,
      TRANSACTION_CATEGORIES.INITIAL_INVESTMENT, // Using initial investment category for now
      false,
      companyId
    );

    // Apply immediate price adjustment for dilution effect
    const { applyImmediateShareStructureAdjustment } = await import('./sharePriceIncrementService');
    await applyImmediateShareStructureAdjustment(
      companyId,
      currentTotalShares,
      newTotalShares,
      'issuance'
    );

    // Update market cap (share price already adjusted above)
    await updateMarketValue(companyId);

    // Trigger game update
    triggerGameUpdate();

    return {
      success: true,
      totalShares: newTotalShares,
      outstandingShares: newOutstandingShares,
      playerShares: newPlayerShares,
      playerOwnershipPct: newPlayerOwnershipPct,
      capitalRaised
    };
  } catch (error) {
    console.error('Error issuing stock:', error);
    return { success: false, error: 'Failed to issue stock' };
  }
}

/**
 * Buy back shares (increases player ownership)
 * 
 * @param shares - Number of shares to buy back
 * @param price - Price per share (optional, uses current market price if not provided)
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Success status and updated share structure
 */
export async function buyBackStock(
  shares: number,
  price?: number,
  companyId?: string
): Promise<{
  success: boolean;
  error?: string;
  totalShares?: number;
  outstandingShares?: number;
  playerShares?: number;
  playerOwnershipPct?: number;
  cost?: number;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    if (shares <= 0) {
      return { success: false, error: 'Number of shares must be greater than 0' };
    }

    // Get current company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    const currentOutstandingShares = company.outstandingShares || 0;
    if (shares > currentOutstandingShares) {
      return { success: false, error: 'Cannot buy back more shares than are outstanding' };
    }

    // Get current share price if not provided
    let sharePrice = price;
    if (sharePrice === undefined) {
      const marketValue = await updateMarketValue(companyId);
      if (!marketValue.success || !marketValue.sharePrice) {
        return { success: false, error: 'Failed to determine share price' };
      }
      sharePrice = marketValue.sharePrice;
    }

    if (sharePrice <= 0) {
      return { success: false, error: 'Share price must be greater than 0' };
    }

    // Calculate total cost
    const cost = shares * sharePrice;

    // Check if company has enough cash
    const currentMoney = company.money || 0;
    if (cost > currentMoney) {
      return { success: false, error: 'Insufficient funds to buy back shares' };
    }

    // Update share structure
    const currentTotalShares = company.totalShares || 1000000;
    const currentPlayerShares = company.playerShares || currentTotalShares;
    const newTotalShares = currentTotalShares - shares;
    const newOutstandingShares = currentOutstandingShares - shares;
    const newPlayerShares = currentPlayerShares; // Player shares stay the same (concentration)
    const newPlayerOwnershipPct = newTotalShares > 0 ? (newPlayerShares / newTotalShares) * 100 : 100;

    // Update company in database
    const updateResult = await companyService.updateCompany(companyId, {
      totalShares: newTotalShares,
      outstandingShares: newOutstandingShares,
      playerShares: newPlayerShares
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update share structure' };
    }

    // Deduct cost from company money
    await addTransaction(
      -cost,
      `Stock Buyback: ${shares.toLocaleString()} shares @ ${sharePrice.toFixed(2)}€ per share`,
      TRANSACTION_CATEGORIES.OTHER,
      false,
      companyId
    );

    // Apply immediate price adjustment for concentration effect
    const { applyImmediateShareStructureAdjustment } = await import('./sharePriceIncrementService');
    await applyImmediateShareStructureAdjustment(
      companyId,
      currentTotalShares,
      newTotalShares,
      'buyback'
    );

    // Update market cap (share price already adjusted above)
    await updateMarketValue(companyId);

    // Trigger game update
    triggerGameUpdate();

    return {
      success: true,
      totalShares: newTotalShares,
      outstandingShares: newOutstandingShares,
      playerShares: newPlayerShares,
      playerOwnershipPct: newPlayerOwnershipPct,
      cost
    };
  } catch (error) {
    console.error('Error buying back stock:', error);
    return { success: false, error: 'Failed to buy back stock' };
  }
}

/**
 * Update dividend rate (fixed per share in euros)
 * 
 * @param rate - New dividend rate per share in euros
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Success status
 */
export async function updateDividendRate(
  rate: number,
  companyId?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    if (rate < 0) {
      return { success: false, error: 'Dividend rate cannot be negative' };
    }

    // Get current company
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get old rate for comparison
    const oldRate = company.dividendRate || 0;
    const rateChange = rate - oldRate;

    // Update company in database
    const updateResult = await companyService.updateCompany(companyId, {
      dividendRate: rate
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update dividend rate' };
    }

    // Create prestige event for dividend change (asymmetric impact)
    if (rateChange !== 0) {
      try {
        const { insertPrestigeEvent } = await import('../../database/customers/prestigeEventsDB');
        const { v4: uuidv4 } = await import('uuid');
        const { DIVIDEND_CHANGE_PRESTIGE_CONFIG } = await import('../../constants/shareValuationConstants');
        const gameState = getGameState();
        
        // Calculate prestige impact (asymmetric: cuts more negative than increases positive)
        const rateChangePercent = oldRate > 0 ? (rateChange / oldRate) : (rate > 0 ? 1 : 0);
        const basePrestigeImpact = Math.abs(rateChangePercent) * 0.5; // Scale impact by change magnitude
        
        const prestigeAmount = rateChange < 0 
          ? -basePrestigeImpact * DIVIDEND_CHANGE_PRESTIGE_CONFIG.cutMultiplier  // Negative for cuts
          : basePrestigeImpact * DIVIDEND_CHANGE_PRESTIGE_CONFIG.increaseMultiplier; // Smaller positive for increases
        
        // Only create event if impact is meaningful (avoid noise from tiny changes)
        if (Math.abs(prestigeAmount) >= 0.001) {
          await insertPrestigeEvent({
            id: uuidv4(),
            type: 'penalty',
            amount_base: prestigeAmount,
            created_game_week: calculateAbsoluteWeeks(
              gameState.week || 1,
              gameState.season || 'Spring',
              gameState.currentYear || 2024
            ),
            decay_rate: DIVIDEND_CHANGE_PRESTIGE_CONFIG.decayRate,
            description: rateChange < 0 
              ? `Dividend cut: ${formatNumber(Math.abs(rateChangePercent) * 100, { decimals: 1 })}% reduction`
              : `Dividend increase: ${formatNumber(rateChangePercent * 100, { decimals: 1 })}% increase`,
            source_id: null,
            payload: {
              event: 'dividend_change',
              oldRate,
              newRate: rate,
              rateChange,
              rateChangePercent,
              prestigeImpact: prestigeAmount
            }
          });
        }
      } catch (prestigeError) {
        console.error('Error creating dividend change prestige event:', prestigeError);
        // Don't fail the dividend update if prestige event creation fails
      }
    }

    // Share price adjusts incrementally via dividendPerShare delta on next tick
    // Prestige impact also affects share price through the prestige metric in incremental system

    // Trigger game update
    triggerGameUpdate();

    return { success: true };
  } catch (error) {
    console.error('Error updating dividend rate:', error);
    return { success: false, error: 'Failed to update dividend rate' };
  }
}

/**
 * Calculate total dividend payment for all shares (player + outstanding)
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Total dividend payment amount
 */
export async function calculateDividendPayment(companyId?: string): Promise<number> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return 0;
    }

    // Get company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return 0;
    }

    const dividendRate = company.dividendRate || 0;
    const totalShares = company.totalShares || 0;

    // Calculate total dividend payment (fixed per share) for all shares
    const totalPayment = dividendRate * totalShares;

    return totalPayment;
  } catch (error) {
    console.error('Error calculating dividend payment:', error);
    return 0;
  }
}

/**
 * Check if dividends are due (1st week of each season)
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns True if dividends are due, false otherwise
 */
export async function areDividendsDue(companyId?: string): Promise<boolean> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return false;
    }

    // Get company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return false;
    }

    const dividendRate = company.dividendRate || 0;
    if (dividendRate <= 0) {
      return false; // No dividends set
    }

    // Get current game state
    const gameState = getGameState();
    const currentWeek = gameState.week || 1;
    const currentSeason = gameState.season || 'Spring';
    const currentYear = gameState.currentYear || 2024;

    // Dividends are due on week 1 of each season
    if (currentWeek !== 1) {
      return false;
    }

    // Check if dividends have already been paid for this season
    const lastPaidWeek = company.lastDividendPaid?.week;
    const lastPaidSeason = company.lastDividendPaid?.season;
    const lastPaidYear = company.lastDividendPaid?.year;

    // If dividends were already paid this season, they're not due
    if (lastPaidWeek === 1 && lastPaidSeason === currentSeason && lastPaidYear === currentYear) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking if dividends are due:', error);
    return false;
  }
}

/**
 * Check and trigger dividend payment notification if dividends are due
 * Called during game tick on week 1 of each season
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns True if dividends were due and notification was sent, false otherwise
 */
export async function checkAndNotifyDividendsDue(companyId?: string): Promise<boolean> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return false;
    }

    const isDue = await areDividendsDue(companyId);
    if (!isDue) {
      return false;
    }

    // Get company data for notification
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return false;
    }

    const dividendPayment = await calculateDividendPayment(companyId);

    // Send notification
    await notificationService.addMessage(
      `Dividends are due! Pay ${formatNumber(dividendPayment, { currency: true })} to shareholders (${formatNumber(company.dividendRate || 0, { currency: true, decimals: 4 })} per share).`,
      'dividend.due',
      'Dividend Payment Due',
      NotificationCategory.FINANCE_AND_STAFF
    );

    return true;
  } catch (error) {
    console.error('Error checking and notifying dividends due:', error);
    return false;
  }
}

export async function getShareMetrics(companyId?: string): Promise<ShareMetrics> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }

    if (!companyId) {
      return {
        assetPerShare: 0,
        cashPerShare: 0,
        debtPerShare: 0,
        bookValuePerShare: 0,
        revenuePerShare: 0,
        earningsPerShare: 0,
        dividendPerShareCurrentYear: 0,
        dividendPerSharePreviousYear: 0,
        creditRating: CREDIT_RATING.DEFAULT_RATING,
        profitMargin: 0,
        revenueGrowth: 0
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return {
        assetPerShare: 0,
        cashPerShare: 0,
        debtPerShare: 0,
        bookValuePerShare: 0,
        revenuePerShare: 0,
        earningsPerShare: 0,
        dividendPerShareCurrentYear: 0,
        dividendPerSharePreviousYear: 0,
        creditRating: CREDIT_RATING.DEFAULT_RATING,
        profitMargin: 0,
        revenueGrowth: 0
      };
    }

    const totalShares = company.totalShares || 1000000;
    const gameState = getGameState();
    const currentYear = gameState.currentYear || 2024;
    const previousYear = currentYear - 1;

    let transactions: Transaction[] = [];
    try {
      transactions = await loadTransactions();
    } catch (error) {
      console.error('Error loading transactions for share metrics:', error);
    }

    let totalDebt = 0;
    try {
      totalDebt = await calculateTotalOutstandingLoans();
    } catch (error) {
      console.error('Error calculating outstanding loans for share metrics:', error);
    }

    let financialData: FinancialSnapshot | null = null;
    try {
      financialData = await calculateFinancialData('year', { year: currentYear });
    } catch (error) {
      console.error('Error calculating financial data for share metrics:', error);
    }

    const calculatedTotalAssets = financialData?.totalAssets ?? 0;
    const fallbackAssets = company.marketCap ?? company.money ?? 0;
    const totalAssets = calculatedTotalAssets > 0 ? calculatedTotalAssets : fallbackAssets;

    const calculatedCash = financialData?.cashMoney ?? null;
    const cashBalance =
      calculatedCash !== null && calculatedCash >= 0 ? calculatedCash : (company.money ?? 0);

    const revenueYTD = financialData?.income ?? 0;
    const netIncome = financialData?.netIncome ?? 0;

    const assetPerShare = totalShares > 0 ? totalAssets / totalShares : 0;
    const cashPerShare = totalShares > 0 ? cashBalance / totalShares : 0;
    const debtPerShare = totalShares > 0 ? totalDebt / totalShares : 0;
    const bookValuePerShare = totalShares > 0 ? (totalAssets - totalDebt) / totalShares : 0;
    const revenuePerShare = totalShares > 0 ? revenueYTD / totalShares : 0;
    const earningsPerShare = totalShares > 0 ? netIncome / totalShares : 0;

    // Calculate profit margin (net income / revenue)
    const profitMargin = revenueYTD > 0 ? netIncome / revenueYTD : 0;

    // Calculate revenue growth (year-over-year percentage)
    let revenueGrowth = 0;
    try {
      const previousYearData = await calculateFinancialData('year', { year: previousYear });
      const previousYearRevenue = previousYearData.income;
      
      if (previousYearRevenue > 0) {
        revenueGrowth = (revenueYTD - previousYearRevenue) / previousYearRevenue;
      } else if (revenueYTD > 0) {
        revenueGrowth = 1.0; // 100% growth if previous year was zero/negative
      }
    } catch (error) {
      console.error('Error calculating revenue growth for share metrics:', error);
    }

    const dividendTransactions = transactions.filter(
      (transaction) => transaction.category === TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT
    );

    const sumDividendsForYear = (year: number): number =>
      dividendTransactions
        .filter((transaction) => transaction.date.year === year)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

    const dividendsCurrentYear = sumDividendsForYear(currentYear);
    const dividendsPreviousYear = sumDividendsForYear(previousYear);

    const dividendPerShareCurrentYear =
      totalShares > 0 ? dividendsCurrentYear / totalShares : 0;
    const dividendPerSharePreviousYear =
      totalShares > 0 ? dividendsPreviousYear / totalShares : 0;

    const creditRating = gameState.creditRating ?? CREDIT_RATING.DEFAULT_RATING;

    // Calculate rolling 48-week metrics
    let earningsPerShare48Weeks: number | undefined;
    let revenuePerShare48Weeks: number | undefined;
    let revenueGrowth48Weeks: number | undefined;
    let profitMargin48Weeks: number | undefined;
    let dividendPerShare48Weeks: number | undefined;
    
    try {
      const currentDate = {
        week: gameState.week || 1,
        season: gameState.season || 'Spring',
        year: gameState.currentYear || 2024
      };
      
      // Get financial data for last 48 weeks
      const financialData48Weeks = await calculateFinancialDataRollingNWeeks(48, companyId);
      const revenue48Weeks = financialData48Weeks.income;
      const netIncome48Weeks = financialData48Weeks.netIncome;
      
      // Calculate EPS, revenue per share, and profit margin for last 48 weeks
      earningsPerShare48Weeks = totalShares > 0 ? netIncome48Weeks / totalShares : 0;
      revenuePerShare48Weeks = totalShares > 0 ? revenue48Weeks / totalShares : 0;
      profitMargin48Weeks = revenue48Weeks > 0 ? netIncome48Weeks / revenue48Weeks : 0;
      
      // Calculate revenue growth: compare last 48 weeks to previous 48 weeks (96 weeks ago to 48 weeks ago)
      // Special handling: Only calculate if we have enough history (more than 48 weeks of data)
      const companyWeeksForGrowth = calculateCompanyWeeks(
        company.foundedYear || currentDate.year,
        currentDate.week,
        currentDate.season,
        currentDate.year
      );
      
      if (companyWeeksForGrowth > 48) {
        // We have enough history - compare last 48 weeks to previous 48 weeks
        const financialData96Weeks = await calculateFinancialDataRollingNWeeks(96, companyId);
        const revenuePrevious48Weeks = financialData96Weeks.income - revenue48Weeks; // Previous 48 weeks (weeks 49-96 ago)
        
        if (revenuePrevious48Weeks > 0) {
          revenueGrowth48Weeks = (revenue48Weeks - revenuePrevious48Weeks) / revenuePrevious48Weeks;
        } else if (revenue48Weeks > 0) {
          revenueGrowth48Weeks = 1.0; // 100% growth if previous period was zero
        } else {
          revenueGrowth48Weeks = 0;
        }
      } else {
        // Not enough history yet - set to 0 (grace period, won't affect share price)
        revenueGrowth48Weeks = 0;
      }
      
      // Calculate dividends paid in last 48 weeks
      // Special handling: If in first season and no dividends paid yet, initialize with expected dividend
      const currentAbsoluteWeeks = calculateAbsoluteWeeks(
        currentDate.week,
        currentDate.season,
        currentDate.year,
        1, 'Spring', 2024
      );
      
      const companyWeeks = calculateCompanyWeeks(
        company.foundedYear || currentDate.year,
        currentDate.week,
        currentDate.season,
        currentDate.year
      );
      const isFirstSeason = companyWeeks <= 12; // First 12 weeks (first season)
      
      const dividendTransactions48Weeks = transactions.filter(t => {
        if (t.category !== TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT) return false;
        
        // Check if transaction is in last 48 weeks
        const transAbsoluteWeeks = calculateAbsoluteWeeks(
          t.date.week,
          t.date.season,
          t.date.year,
          1, 'Spring', 2024
        );
        
        return transAbsoluteWeeks >= (currentAbsoluteWeeks - 48) && transAbsoluteWeeks <= currentAbsoluteWeeks;
      });
      
      let dividends48Weeks = dividendTransactions48Weeks.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      // Initialize first season: If we're in the first season and have a dividend rate but no payments,
      // simulate that a dividend was paid (so rolling calculation starts properly from season 2)
      if (isFirstSeason && (company.dividendRate || 0) > 0 && dividends48Weeks === 0) {
        dividends48Weeks = (company.dividendRate || 0) * totalShares;
      }
      
      dividendPerShare48Weeks = totalShares > 0 ? dividends48Weeks / totalShares : 0;
    } catch (error) {
      console.error('Error calculating rolling 48-week metrics:', error);
      // Leave as undefined if calculation fails
    }

    return {
      assetPerShare,
      cashPerShare,
      debtPerShare,
      bookValuePerShare,
      revenuePerShare,
      earningsPerShare,
      dividendPerShareCurrentYear,
      dividendPerSharePreviousYear,
      creditRating,
      profitMargin,
      revenueGrowth,
      earningsPerShare48Weeks,
      revenuePerShare48Weeks,
      revenueGrowth48Weeks,
      profitMargin48Weeks,
      dividendPerShare48Weeks
    };
  } catch (error) {
    console.error('Error calculating share metrics:', error);
    return {
      assetPerShare: 0,
      cashPerShare: 0,
      debtPerShare: 0,
      bookValuePerShare: 0,
      revenuePerShare: 0,
      earningsPerShare: 0,
      dividendPerShareCurrentYear: 0,
      dividendPerSharePreviousYear: 0,
      creditRating: CREDIT_RATING.DEFAULT_RATING,
      profitMargin: 0,
      revenueGrowth: 0
    };
  }
}

/**
 * Get shareholder breakdown (Player/Family/Outside)
 * Calculates share distribution based on initial equity contributions
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Shareholder breakdown with shares and percentages
 */
export async function getShareholderBreakdown(companyId?: string): Promise<ShareholderBreakdown> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return {
        playerShares: 0,
        familyShares: 0,
        outsideShares: 0,
        playerPct: 0,
        familyPct: 0,
        outsidePct: 0
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return {
        playerShares: 0,
        familyShares: 0,
        outsideShares: 0,
        playerPct: 0,
        familyPct: 0,
        outsidePct: 0
      };
    }

    const totalShares = company.totalShares || 0;
    const playerShares = company.playerShares || 0;
    const nonPlayerShares = Math.max(totalShares - playerShares, 0);

    // Get initial equity contributions to calculate family vs outside split
    const financialData = await calculateFinancialData('all');
    const familyContribution = financialData.familyContribution;
    const outsideInvestment = financialData.outsideInvestment;
    // Calculate family and outside shares based on their initial equity proportions
    // If no initial equity data, assume all outstanding shares are "other investors"
    let familyShares = 0;
    let outsideShares = nonPlayerShares;

    const totalNonPlayerEquity = Math.max(familyContribution, 0) + Math.max(outsideInvestment, 0);

    if (totalNonPlayerEquity > 0 && nonPlayerShares > 0) {
      const familyShareRatio = Math.max(familyContribution, 0) / totalNonPlayerEquity;
      familyShares = Math.round(nonPlayerShares * familyShareRatio);
      outsideShares = Math.max(nonPlayerShares - familyShares, 0);
    }

    const playerPct = totalShares > 0 ? (playerShares / totalShares) * 100 : 0;
    const familyPct = totalShares > 0 ? (familyShares / totalShares) * 100 : 0;
    const outsidePct = totalShares > 0 ? (outsideShares / totalShares) * 100 : 0;

    return {
      playerShares,
      familyShares,
      outsideShares,
      playerPct,
      familyPct,
      outsidePct: outsidePct // Explicitly return to avoid unused warning
    };
  } catch (error) {
    console.error('Error calculating shareholder breakdown:', error);
    return {
      playerShares: 0,
      familyShares: 0,
      outsideShares: 0,
      playerPct: 0,
      familyPct: 0,
      outsidePct: 0
    };
  }
}

/**
 * Pay dividends to shareholders
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Success status and payment details
 */
export async function payDividends(companyId?: string): Promise<{
  success: boolean;
  error?: string;
  totalPayment?: number;
  playerPayment?: number;
  outstandingPayment?: number;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    // Get company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    const dividendRate = company.dividendRate || 0;
    if (dividendRate <= 0) {
      return { success: false, error: 'Dividend rate is not set or is zero' };
    }

    // Calculate payments
    const playerShares = company.playerShares || 0;
    const outstandingShares = company.outstandingShares || 0;
    const totalShares = company.totalShares || 1000000;

    const playerPayment = dividendRate * playerShares;
    const outstandingPayment = dividendRate * outstandingShares;
    const totalPayment = playerPayment + outstandingPayment;

    // Check if company has enough cash
    // For automatic payments (called from game tick), skip if insufficient funds instead of erroring
    const currentMoney = company.money || 0;
    if (totalPayment > currentMoney) {
      // Silently skip payment if insufficient funds (automatic payment from game tick)
      return { success: false, error: 'Insufficient funds to pay dividends' };
    }

    // Get current game date
    const gameState = getGameState();
    const gameDate: GameDate = {
      week: gameState.week || 1,
      season: (gameState.season || 'Spring') as any,
      year: gameState.currentYear || 2024
    };

    // Deduct total payment from company money
    await addTransaction(
      -totalPayment,
      `Dividend Payment: ${formatNumber(dividendRate, { currency: true, decimals: 4 })} per share (${formatNumber(totalShares, { decimals: 0 })} shares)`,
      TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT,
      false,
      companyId
    );

    // Add player's dividend payment to user balance (if company has a user)
    // For anonymous companies, player dividends are not added anywhere
    if (company.userId && playerPayment > 0) {
      const balanceResult = await updatePlayerBalance(playerPayment, company.userId);
      if (!balanceResult.success) {
        console.warn('Failed to add player dividend to user balance:', balanceResult.error);
        // Continue with the payment even if user balance update fails
      }
    }

    // Update last dividend paid date
    await companyService.updateCompany(companyId, {
      lastDividendPaidWeek: gameDate.week,
      lastDividendPaidSeason: gameDate.season,
      lastDividendPaidYear: gameDate.year
    });

    // Recalculate market value after dividend payment
    await updateMarketValue(companyId);

    // Trigger game update
    triggerGameUpdate();

    return {
      success: true,
      totalPayment,
      playerPayment,
      outstandingPayment
    };
  } catch (error) {
    console.error('Error paying dividends:', error);
    return { success: false, error: 'Failed to pay dividends' };
  }
}

/**
 * Historical share metric data point
 */
export interface HistoricalShareMetric {
  year: number;
  season: string;
  week: number;
  sharePrice: number;
  bookValuePerShare: number;
  earningsPerShare: number;
  dividendPerShare: number;
}

/**
 * Get historical share metrics for trend graph
 * Queries snapshots from company_metrics_history table (much faster than recalculating)
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @param yearsBack - Number of years to look back (default: 2)
 * @returns Array of historical metric data points
 */
export async function getHistoricalShareMetrics(
  companyId?: string,
  yearsBack: number = 2
): Promise<HistoricalShareMetric[]> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return [];
    }

    // Get historical snapshots from database (much faster than recalculating)
    const { getCompanyMetricsHistory } = await import('../../database/core/companyMetricsHistoryDB');
    const weeksBack = yearsBack * 48; // Convert years to weeks
    const snapshots = await getCompanyMetricsHistory(companyId, weeksBack);

    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    // Convert snapshots to HistoricalShareMetric format
    // Use all weekly snapshots for detailed historical tracking
    const historicalData: HistoricalShareMetric[] = snapshots.map(snapshot => ({
      year: snapshot.year,
      season: snapshot.season,
      week: snapshot.week,
      sharePrice: snapshot.sharePrice,
      bookValuePerShare: snapshot.bookValuePerShare,
      earningsPerShare: snapshot.earningsPerShare48W,
      dividendPerShare: snapshot.dividendPerShare48W
    }));

    // Sort by year, season, and week (chronologically)
    historicalData.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const seasonOrder = ['Spring', 'Summer', 'Fall', 'Winter'];
      const seasonDiff = seasonOrder.indexOf(a.season) - seasonOrder.indexOf(b.season);
      if (seasonDiff !== 0) return seasonDiff;
      return a.week - b.week;
    });

    return historicalData;
  } catch (error) {
    console.error('Error getting historical share metrics:', error);
    return [];
  }
}

