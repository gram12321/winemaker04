
import { getCurrentCompanyId } from '../../../utils/companyUtils';
import { companyService } from '../../user/companyService';
import { getGameState } from '../../core/gameState';
import { calculateFinancialData, loadTransactions, calculateFinancialDataRollingNWeeks } from '../financeService';
import { TRANSACTION_CATEGORIES } from '../../../constants';
import { calculateTotalOutstandingLoans } from '../loanService';
import { CREDIT_RATING } from '../../../constants/loanConstants';
import { calculateAbsoluteWeeks, calculateCompanyWeeks } from '../../../utils/utils';
import { getCompanyMetricsHistory } from '../../../database/core/companyMetricsHistoryDB';
import { getCompanyShares } from '../../../database/core/companySharesDB';
import type { ShareMetrics, ShareholderBreakdown, ShareHistoricalMetric } from '../../../types';
import type { Transaction } from '../../../types';

type FinancialSnapshot = Awaited<ReturnType<typeof calculateFinancialData>>;

async function calculateBasicPerShareMetrics(
  totalShares: number,
  financialData: FinancialSnapshot | null,
  company: any,
  totalDebt: number,
  marketCap?: number
): Promise<{
  assetPerShare: number;
  cashPerShare: number;
  debtPerShare: number;
  bookValuePerShare: number;
  revenuePerShare: number;
  earningsPerShare: number;
}> {
  const calculatedTotalAssets = financialData?.totalAssets ?? 0;
  const fallbackAssets = marketCap ?? company.money ?? 0;
  const totalAssets = calculatedTotalAssets > 0 ? calculatedTotalAssets : fallbackAssets;

  const calculatedCash = financialData?.cashMoney ?? null;
  const cashBalance = calculatedCash !== null && calculatedCash >= 0 ? calculatedCash : (company.money ?? 0);

  const revenueYTD = financialData?.income ?? 0;
  const netIncome = financialData?.netIncome ?? 0;

  return {
    assetPerShare: totalShares > 0 ? totalAssets / totalShares : 0,
    cashPerShare: totalShares > 0 ? cashBalance / totalShares : 0,
    debtPerShare: totalShares > 0 ? totalDebt / totalShares : 0,
    bookValuePerShare: totalShares > 0 ? (totalAssets - totalDebt) / totalShares : 0,
    revenuePerShare: totalShares > 0 ? revenueYTD / totalShares : 0,
    earningsPerShare: totalShares > 0 ? netIncome / totalShares : 0
  };
}

async function calculateProfitabilityMetrics(
  financialData: FinancialSnapshot | null,
  currentYear: number
): Promise<{
  profitMargin: number;
  revenueGrowth: number;
}> {
  const revenueYTD = financialData?.income ?? 0;
  const netIncome = financialData?.netIncome ?? 0;
  const profitMargin = revenueYTD > 0 ? netIncome / revenueYTD : 0;

  // Calculate revenue growth (year-over-year percentage)
  let revenueGrowth = 0;
  try {
    const previousYearData = await calculateFinancialData('year', { year: currentYear - 1 });
    const previousYearRevenue = previousYearData.income;
    
    if (previousYearRevenue > 0) {
      revenueGrowth = (revenueYTD - previousYearRevenue) / previousYearRevenue;
    } else if (revenueYTD > 0) {
      revenueGrowth = 1.0; // 100% growth if previous year was zero/negative
    }
  } catch (error) {
    console.error('Error calculating revenue growth for share metrics:', error);
  }

  return { profitMargin, revenueGrowth };
}

function calculateDividendMetrics(
  transactions: Transaction[],
  totalShares: number,
  currentYear: number
): {
  dividendPerShareCurrentYear: number;
  dividendPerSharePreviousYear: number;
} {
  const dividendTransactions = transactions.filter(
    (transaction) => transaction.category === TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT
  );

  const sumDividendsForYear = (year: number): number =>
    dividendTransactions
      .filter((transaction) => transaction.date.year === year)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const dividendsCurrentYear = sumDividendsForYear(currentYear);
  const dividendsPreviousYear = sumDividendsForYear(currentYear - 1);

  return {
    dividendPerShareCurrentYear: totalShares > 0 ? dividendsCurrentYear / totalShares : 0,
    dividendPerSharePreviousYear: totalShares > 0 ? dividendsPreviousYear / totalShares : 0
  };
}

async function calculate48WeekRollingMetrics(
  companyId: string,
  totalShares: number,
  transactions: Transaction[],
  company: any
): Promise<{
  earningsPerShare48Weeks?: number;
  revenuePerShare48Weeks?: number;
  revenueGrowth48Weeks?: number;
  profitMargin48Weeks?: number;
  dividendPerShare48Weeks?: number;
}> {
  try {
    const gameState = getGameState();
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
    const earningsPerShare48Weeks = totalShares > 0 ? netIncome48Weeks / totalShares : 0;
    const revenuePerShare48Weeks = totalShares > 0 ? revenue48Weeks / totalShares : 0;
    const profitMargin48Weeks = revenue48Weeks > 0 ? netIncome48Weeks / revenue48Weeks : 0;
    
    // Calculate revenue growth: compare last 48 weeks to previous 48 weeks
    const companyWeeksForGrowth = calculateCompanyWeeks(
      company.foundedYear || currentDate.year,
      currentDate.week,
      currentDate.season,
      currentDate.year
    );
    
    let revenueGrowth48Weeks = 0;
    if (companyWeeksForGrowth > 48) {
      // We have enough history - compare last 48 weeks to previous 48 weeks
      const financialData96Weeks = await calculateFinancialDataRollingNWeeks(96, companyId);
      const revenuePrevious48Weeks = financialData96Weeks.income - revenue48Weeks;
      
      if (revenuePrevious48Weeks > 0) {
        revenueGrowth48Weeks = (revenue48Weeks - revenuePrevious48Weeks) / revenuePrevious48Weeks;
      } else if (revenue48Weeks > 0) {
        revenueGrowth48Weeks = 1.0; // 100% growth if previous period was zero
      }
    }
    
    // Calculate dividends paid in last 48 weeks
    const currentAbsoluteWeeks = calculateAbsoluteWeeks(
      currentDate.week,
      currentDate.season,
      currentDate.year,
      1, 'Spring', 2024
    );
    
    const dividendTransactions48Weeks = transactions.filter(t => {
      if (t.category !== TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT) return false;
      
      const transAbsoluteWeeks = calculateAbsoluteWeeks(
        t.date.week,
        t.date.season,
        t.date.year,
        1, 'Spring', 2024
      );
      
      return transAbsoluteWeeks >= (currentAbsoluteWeeks - 48) && transAbsoluteWeeks <= currentAbsoluteWeeks;
    });
    
    const dividends48Weeks = dividendTransactions48Weeks.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const dividendPerShare48Weeks = totalShares > 0 ? dividends48Weeks / totalShares : 0;
    
    return {
      earningsPerShare48Weeks,
      revenuePerShare48Weeks,
      revenueGrowth48Weeks,
      profitMargin48Weeks,
      dividendPerShare48Weeks
    };
  } catch (error) {
    console.error('Error calculating rolling 48-week metrics:', error);
    return {};
  }
}

export async function getShareMetrics(): Promise<ShareMetrics> {
  try {
    const companyId = getCurrentCompanyId();
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

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
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

    const totalShares = sharesData.totalShares;
    const gameState = getGameState();
    const currentYear = gameState.currentYear || 2024;

    // Load data in parallel where possible
    const [transactions, totalDebt, financialData] = await Promise.all([
      loadTransactions().catch(() => [] as Transaction[]),
      calculateTotalOutstandingLoans().catch(() => 0),
      calculateFinancialData('year', { year: currentYear }).catch(() => null)
    ]);

    // Calculate basic metrics
    const basicMetrics = await calculateBasicPerShareMetrics(
      totalShares,
      financialData,
      company,
      totalDebt,
      sharesData.marketCap
    );

    // Calculate profitability metrics
    const profitabilityMetrics = await calculateProfitabilityMetrics(financialData, currentYear);

    // Calculate dividend metrics
    const dividendMetrics = calculateDividendMetrics(transactions, totalShares, currentYear);

    // Calculate 48-week rolling metrics
    const rolling48WeekMetrics = await calculate48WeekRollingMetrics(
      companyId,
      totalShares,
      transactions,
      company
    );

    const creditRating = gameState.creditRating ?? CREDIT_RATING.DEFAULT_RATING;

    return {
      ...basicMetrics,
      ...profitabilityMetrics,
      ...dividendMetrics,
      creditRating,
      ...rolling48WeekMetrics
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

export async function getShareholderBreakdown(): Promise<ShareholderBreakdown> {
  try {
    const companyId = getCurrentCompanyId();
    const company = await companyService.getCompany(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Get share data
    const sharesDataForBreakdown = await getCompanyShares(companyId);
    if (!sharesDataForBreakdown) {
      throw new Error('Share data not found');
    }

    const totalShares = sharesDataForBreakdown.totalShares;
    const playerShares = sharesDataForBreakdown.playerShares;
    const nonPlayerShares = Math.max(totalShares - playerShares, 0);

    // Get initial equity contributions to calculate family vs public investor split
    const financialData = await calculateFinancialData('all');
    const familyContribution = financialData.familyContribution;
    const outsideInvestment = financialData.outsideInvestment;
    
    // Calculate family and public investor shares based on their initial equity proportions
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
    const nonPlayerOwnershipPct = familyPct + outsidePct; // All non-player ownership (family + public investors)

    return {
      playerShares,
      familyShares,
      outsideShares,
      playerPct,
      familyPct,
      outsidePct,
      nonPlayerOwnershipPct
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

export async function getHistoricalShareMetrics(
  companyId?: string,
  yearsBack: number = 2
): Promise<ShareHistoricalMetric[]> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return [];
    }

    // Get historical snapshots from database
    const weeksBack = yearsBack * 48; // Convert years to weeks
    const snapshots = await getCompanyMetricsHistory(companyId, weeksBack);

    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    const historicalData: ShareHistoricalMetric[] = snapshots.map(snapshot => ({
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

