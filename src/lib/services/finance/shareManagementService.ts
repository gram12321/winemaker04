import { GameDate, Transaction } from '../../types/types';
import { companyService } from '../user/companyService';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { addTransaction, calculateFinancialData, loadTransactions } from './financeService';
import { TRANSACTION_CATEGORIES } from '../../constants';
import { updateMarketValue, getMarketValue } from './shareValueService';
import { getGameState } from '../core/gameState';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
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

    // Recalculate market value after share issuance
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

    // Recalculate market value after buyback
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

    // Update company in database
    const updateResult = await companyService.updateCompany(companyId, {
      dividendRate: rate
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update dividend rate' };
    }

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
        creditRating: CREDIT_RATING.DEFAULT_RATING
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
        creditRating: CREDIT_RATING.DEFAULT_RATING
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

    return {
      assetPerShare,
      cashPerShare,
      debtPerShare,
      bookValuePerShare,
      revenuePerShare,
      earningsPerShare,
      dividendPerShareCurrentYear,
      dividendPerSharePreviousYear,
      creditRating
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
      creditRating: CREDIT_RATING.DEFAULT_RATING
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
    const currentMoney = company.money || 0;
    if (totalPayment > currentMoney) {
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
 * Calculates metrics for each season/year from transactions
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

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return [];
    }

    const gameState = getGameState();
    const currentYear = gameState.currentYear || 2024;
    const startYear = Math.max(2024, currentYear - yearsBack);
    const totalShares = company.totalShares || 0;

    if (totalShares === 0) {
      return [];
    }

    const historicalData: HistoricalShareMetric[] = [];
    const transactions = await loadTransactions();

    // Group transactions by year and season
    for (let year = startYear; year <= currentYear; year++) {
      const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
      
      for (const season of seasons) {
        // Get financial data for this period
        const financialData = await calculateFinancialData('season', { season, year });
        
        // Calculate metrics for this period
        const netIncome = financialData.netIncome;
        const totalAssets = financialData.totalAssets;
        const totalDebt = await calculateTotalOutstandingLoans();
        
        const bookValuePerShare = totalShares > 0 ? (totalAssets - totalDebt) / totalShares : 0;
        const earningsPerShare = totalShares > 0 ? netIncome / totalShares : 0;
        
        // Get dividends paid this season
        const dividendTransactions = transactions.filter(
          t => t.date.year === year && 
               t.date.season === season && 
               t.category === TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT
        );
        const dividendsPaid = dividendTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const dividendPerShare = totalShares > 0 ? dividendsPaid / totalShares : 0;
        
        // Get share price (use current market value for now, or calculate from market cap)
        const marketValue = await getMarketValue(companyId);
        const sharePrice = marketValue.sharePrice || 0;

        // Only add data point if we have meaningful data (not all zeros)
        if (year === currentYear || bookValuePerShare > 0 || earningsPerShare !== 0 || dividendPerShare > 0) {
          historicalData.push({
            year,
            season,
            week: 1, // Use week 1 of each season for consistency
            sharePrice,
            bookValuePerShare,
            earningsPerShare,
            dividendPerShare
          });
        }
      }
    }

    return historicalData;
  } catch (error) {
    console.error('Error calculating historical share metrics:', error);
    return [];
  }
}

