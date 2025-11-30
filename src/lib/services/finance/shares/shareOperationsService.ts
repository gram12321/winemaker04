
import type { GameDate } from '../../../types';
import { companyService } from '../../user/companyService';
import { getCurrentCompanyId } from '../../../utils/companyUtils';
import { addTransaction } from '../financeService';
import { TRANSACTION_CATEGORIES } from '../../../constants';
import { updateMarketValue } from '../../index';
import { getGameState } from '../../core/gameState';
import { triggerGameUpdate } from '../../../../hooks/useGameUpdates';
import { updatePlayerBalance } from '../../user/userBalanceService';
import { formatNumber } from '../../../utils/utils';
import type { ShareOperationResult } from '../../../types';
import { insertPrestigeEvent } from '../../../database/customers/prestigeEventsDB';
import { v4 as uuidv4 } from 'uuid';
import { DIVIDEND_CHANGE_PRESTIGE_CONFIG } from '../../../constants';
import { calculateAbsoluteWeeks } from '../../../utils/utils';
import { updateCompanyShares, getCompanyShares } from '../../../database/core/companySharesDB';
import { boardEnforcer, calculateFinancialData, calculateTotalOutstandingLoans, loadTransactions } from '@/lib/services';

/**
 * Check financial constraints for share buyback
 * Returns error message if constraint violated, null if allowed
 */
async function checkBuybackFinancialConstraints(
  shares: number,
  cost: number,
  outstandingShares: number,
  companyMoney: number
): Promise<string | null> {
  if (cost > companyMoney) {
    return 'Insufficient funds to buy back shares';
  }

  const gameState = getGameState();
  const currentYear = gameState.currentYear || 2024;
  
  const transactions = await loadTransactions();
  const buybackTransactions = transactions.filter(t => 
    t.description.includes('Stock Buyback') && 
    t.date.year === currentYear
  );
  
  let sharesBoughtBackThisYear = 0;
  buybackTransactions.forEach(t => {
    const sharesMatch = t.description.match(/([\d,]+)\s+shares/);
    if (sharesMatch) {
      sharesBoughtBackThisYear += parseInt(sharesMatch[1].replace(/,/g, ''), 10);
    }
  });
  
  const totalSharesThisYear = sharesBoughtBackThisYear + shares;
  const maxSharesPerYear = Math.floor(outstandingShares * 0.25);
  
  if (totalSharesThisYear > maxSharesPerYear) {
    const remaining = Math.max(0, maxSharesPerYear - sharesBoughtBackThisYear);
    return `Cannot buy back more than 25% of outstanding shares per year. Already bought back ${sharesBoughtBackThisYear.toLocaleString()} shares this year. Maximum allowed this year: ${maxSharesPerYear.toLocaleString()} shares. Remaining: ${remaining.toLocaleString()} shares`;
  }

  const financialData = await calculateFinancialData('year');
  const totalDebt = await calculateTotalOutstandingLoans();
  const debtRatio = financialData.totalAssets > 0 ? totalDebt / financialData.totalAssets : 0;
  
  if (debtRatio > 0.3) {
    return `Cannot buy back shares when debt ratio exceeds 30%. Current debt ratio: ${(debtRatio * 100).toFixed(1)}%`;
  }

  return null;
}

/**
 * Check financial constraints for dividend rate change
 * Returns error message if constraint violated, null if allowed
 */
async function checkDividendChangeFinancialConstraints(
  newRate: number,
  oldRate: number,
  totalShares: number,
  companyMoney: number
): Promise<string | null> {
  if (newRate < 0) {
    return 'Dividend rate cannot be negative';
  }

  const paymentPerSeason = newRate * totalShares;
  const requiredCash = paymentPerSeason * 4;
  
  if (companyMoney < requiredCash && newRate > 0) {
    return `Insufficient cash reserves. Required: ${formatNumber(requiredCash, { currency: true })} (1 year of dividend payments = 4 seasons), Available: ${formatNumber(companyMoney, { currency: true })}`;
  }

  // Only restrict decreases (10% limit). Increases are free (only limited by cash reserves).
  if (oldRate > 0 && newRate < oldRate) {
    const changeAmount = oldRate - newRate; // Decrease amount
    const changePercent = (changeAmount / oldRate) * 100;
    const smallChangeThreshold = 0.005;
    
    // Only enforce limit if it's a significant decrease
    if (changeAmount >= smallChangeThreshold && changePercent > 10) {
      const maxDecrease = oldRate * 0.1;
      const minAllowed = oldRate - maxDecrease;
      return `Cannot decrease dividends by more than 10% per season. Minimum allowed: ${formatNumber(minAllowed, { currency: true, decimals: 4 })} per share. Small decreases (< ${formatNumber(smallChangeThreshold, { currency: true, decimals: 4 })}) are always allowed.`;
    }
  }

  return null;
}

/**
 * Check financial constraints for share issuance
 * Returns error message if constraint violated, null if allowed
 */
async function checkIssuanceFinancialConstraints(
  shares: number,
  sharePrice: number,
  currentTotalShares: number
): Promise<string | null> {
  if (sharePrice < 0.10) {
    return 'Share price is too low to issue new shares. Minimum required: €0.10 per share';
  }

  const maxSharesPerIssuance = Math.floor(currentTotalShares * 0.5);
  if (shares > maxSharesPerIssuance) {
    return `Cannot issue more than 50% of current total shares in a single operation. Maximum allowed: ${maxSharesPerIssuance.toLocaleString()} shares`;
  }

  return null;
}

/**
 * Get maximum shares that can be issued (for UI display)
 * Returns max shares based on financial constraints only
 */
export async function getMaxIssuanceShares(): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) return 0;

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) return 0;

    // Max is 50% of current total shares
    return Math.floor(sharesData.totalShares * 0.5);
  } catch (error) {
    console.error('Error calculating max issuance shares:', error);
    return 0;
  }
}

/**
 * Get maximum shares that can be bought back (for UI display)
 * Returns max shares based on all financial constraints
 */
export async function getMaxBuybackShares(): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) return 0;

    const company = await companyService.getCompany(companyId);
    if (!company) return 0;

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) return 0;

    const outstandingShares = sharesData.outstandingShares;
    const currentMoney = company.money || 0;

    // Get share price
    const { updateMarketValue, getMarketValue } = await import('../../index');
    await updateMarketValue();
    const marketData = await getMarketValue();
    const sharePrice = marketData.sharePrice;

    if (sharePrice <= 0) return 0;

    // Max based on cash available
    const maxByCash = Math.floor(currentMoney / sharePrice);

    // Max based on yearly limit (25% per year)
    const gameState = getGameState();
    const currentYear = gameState.currentYear || 2024;
    const transactions = await loadTransactions();
    const buybackTransactions = transactions.filter(t => 
      t.description.includes('Stock Buyback') && 
      t.date.year === currentYear
    );

    let sharesBoughtBackThisYear = 0;
    buybackTransactions.forEach(t => {
      const sharesMatch = t.description.match(/([\d,]+)\s+shares/);
      if (sharesMatch) {
        sharesBoughtBackThisYear += parseInt(sharesMatch[1].replace(/,/g, ''), 10);
      }
    });

    const maxSharesPerYear = Math.floor(outstandingShares * 0.25);
    const remainingYearlyLimit = Math.max(0, maxSharesPerYear - sharesBoughtBackThisYear);

    // Check debt ratio constraint
    const financialData = await calculateFinancialData('year');
    const totalDebt = await calculateTotalOutstandingLoans();
    const debtRatio = financialData.totalAssets > 0 ? totalDebt / financialData.totalAssets : 0;
    const maxByDebtRatio = debtRatio > 0.3 ? 0 : outstandingShares;

    // Take minimum of all constraints
    const maxBuyback = Math.min(
      outstandingShares, // Can't buy back more than outstanding
      maxByCash, // Limited by cash
      remainingYearlyLimit, // Limited by yearly limit
      maxByDebtRatio // Limited by debt ratio
    );

    return Math.max(0, maxBuyback);
  } catch (error) {
    console.error('Error calculating max buyback shares:', error);
    return 0;
  }
}

/**
 * Get dividend rate limits (min/max) based on financial constraints (for UI display)
 * Returns { min: number, max: number } based on cash reserves and change limits
 * NOTE: Only decreases are restricted (10% limit). Increases are free (only limited by cash). */
export async function getDividendRateLimits(): Promise<{ min: number; max: number }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) return { min: 0, max: 0 };

    const company = await companyService.getCompany(companyId);
    if (!company) return { min: 0, max: 0 };

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) return { min: 0, max: 0 };

    const currentMoney = company.money || 0;
    const oldRate = sharesData.dividendRate;
    const totalShares = sharesData.totalShares;

    // Max based on cash reserves (must have 4x payment)
    // rate <= companyMoney / (4 * totalShares)
    const maxByCash = totalShares > 0 ? currentMoney / (4 * totalShares) : 0;

    // Min based on 10% decrease limit per season (with small change exception)
    // Only decreases are restricted - increases are free (only limited by cash)
    const smallChangeThreshold = 0.005;
    let minByChangeLimit = 0;

    if (oldRate > 0) {
      // Allow 10% decrease or small changes (whichever is larger)
      const minChange = oldRate * 0.1;
      minByChangeLimit = Math.max(0, oldRate - Math.max(minChange, smallChangeThreshold));
    } else {
      // If no current dividend, min is 0
      minByChangeLimit = 0;
    }

    // Max is only limited by cash (no increase restriction)
    // Users can freely increase dividends up to cash limit
    // If oldRate is already above cash limit, allow it to stay but not increase further
    const maxDividend = oldRate > maxByCash ? oldRate : maxByCash;

    return {
      min: minByChangeLimit,
      max: Math.max(0, maxDividend)
    };
  } catch (error) {
    console.error('Error calculating dividend rate limits:', error);
    return { min: 0, max: 0 };
  }
}

export async function issueStock(
  shares: number,
  price?: number
): Promise<ShareOperationResult & { capitalRaised?: number }> {
  try {
    const companyId = getCurrentCompanyId();

    if (shares <= 0) {
      return { success: false, error: 'Number of shares must be greater than 0' };
    }

    // Get current company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }

    let sharePrice = price;
    if (sharePrice === undefined) {
      const marketValue = await updateMarketValue();
      if (!marketValue.success || !marketValue.sharePrice) {
        return { success: false, error: 'Failed to determine share price' };
      }
      sharePrice = marketValue.sharePrice;
    }

    if (sharePrice <= 0) {
      return { success: false, error: 'Share price must be greater than 0' };
    }

    const financialCheck = await checkIssuanceFinancialConstraints(
      shares,
      sharePrice,
      sharesData.totalShares
    );
    if (financialCheck) {
      return { success: false, error: financialCheck };
    }

    const boardCheck = await boardEnforcer.isActionAllowed('share_issuance', shares);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for share issuance' };
    }

    const capitalRaised = shares * sharePrice;

    const currentTotalShares = sharesData.totalShares;
    const currentPlayerShares = sharesData.playerShares;
    const newTotalShares = currentTotalShares + shares;
    const newOutstandingShares = sharesData.outstandingShares + shares;
    const newPlayerShares = currentPlayerShares;
    const newPlayerOwnershipPct = (newPlayerShares / newTotalShares) * 100;

    const updateResult = await updateCompanyShares(companyId, {
      total_shares: newTotalShares,
      outstanding_shares: newOutstandingShares,
      player_shares: newPlayerShares
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update share structure' };
    }

    await addTransaction(
      capitalRaised,
      `Stock Issuance: ${shares.toLocaleString()} shares @ ${sharePrice.toFixed(2)}€ per share`,
      TRANSACTION_CATEGORIES.INITIAL_INVESTMENT,
      false,
      companyId
    );

    const { applyImmediateShareStructureAdjustment } = await import('./sharePriceService');
    await applyImmediateShareStructureAdjustment(
      companyId,
      currentTotalShares,
      newTotalShares,
      'issuance'
    );

    await updateMarketValue();
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

export async function buyBackStock(
  shares: number,
  price?: number
): Promise<ShareOperationResult> {
  try {
    const companyId = getCurrentCompanyId();

    if (shares <= 0) {
      return { success: false, error: 'Number of shares must be greater than 0' };
    }

    // Get current company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }

    const currentOutstandingShares = sharesData.outstandingShares;
    if (shares > currentOutstandingShares) {
      return { success: false, error: 'Cannot buy back more shares than are outstanding' };
    }

    let sharePrice = price;
    if (sharePrice === undefined) {
      const marketValue = await updateMarketValue();
      if (!marketValue.success || !marketValue.sharePrice) {
        return { success: false, error: 'Failed to determine share price' };
      }
      sharePrice = marketValue.sharePrice;
    }

    if (sharePrice <= 0) {
      return { success: false, error: 'Share price must be greater than 0' };
    }

    const cost = shares * sharePrice;
    const currentMoney = company.money || 0;

    const financialCheck = await checkBuybackFinancialConstraints(
      shares,
      cost,
      currentOutstandingShares,
      currentMoney
    );
    if (financialCheck) {
      return { success: false, error: financialCheck };
    }

    const boardCheck = await boardEnforcer.isActionAllowed('share_buyback', shares);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for share buyback' };
    }

    const currentTotalShares = sharesData.totalShares;
    const currentPlayerShares = sharesData.playerShares;
    const newTotalShares = currentTotalShares - shares;
    const newOutstandingShares = currentOutstandingShares - shares;
    const newPlayerShares = currentPlayerShares;
    const newPlayerOwnershipPct = newTotalShares > 0 ? (newPlayerShares / newTotalShares) * 100 : 100;

    const updateResult = await updateCompanyShares(companyId, {
      total_shares: newTotalShares,
      outstanding_shares: newOutstandingShares,
      player_shares: newPlayerShares
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update share structure' };
    }

    await addTransaction(
      -cost,
      `Stock Buyback: ${shares.toLocaleString()} shares @ ${sharePrice.toFixed(2)}€ per share`,
      TRANSACTION_CATEGORIES.OTHER,
      false,
      companyId
    );

    const { applyImmediateShareStructureAdjustment } = await import('./sharePriceService');
    await applyImmediateShareStructureAdjustment(
      companyId,
      currentTotalShares,
      newTotalShares,
      'buyback'
    );

    await updateMarketValue();
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

export async function calculateDividendPayment(): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return 0;
    }

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return 0;
    }

    const dividendRate = sharesData.dividendRate;
    const totalShares = sharesData.totalShares;
    const totalPayment = dividendRate * totalShares;

    return totalPayment;
  } catch (error) {
    console.error('Error calculating dividend payment:', error);
    return 0;
  }
}

export async function areDividendsDue(): Promise<boolean> {
  try {
    const companyId = getCurrentCompanyId();
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return false;
    }

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return false;
    }

    const dividendRate = sharesData.dividendRate;
    if (dividendRate <= 0) {
      return false;
    }

    const gameState = getGameState();
    const currentWeek = gameState.week || 1;
    const currentSeason = gameState.season || 'Spring';
    const currentYear = gameState.currentYear || 2024;

    if (currentWeek !== 1) {
      return false;
    }

    const lastPaidWeek = sharesData.lastDividendPaid?.week;
    const lastPaidSeason = sharesData.lastDividendPaid?.season;
    const lastPaidYear = sharesData.lastDividendPaid?.year;

    if (lastPaidWeek === 1 && lastPaidSeason === currentSeason && lastPaidYear === currentYear) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking if dividends are due:', error);
    return false;
  }
}

export async function updateDividendRate(
  rate: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const companyId = getCurrentCompanyId();

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }

    const oldRate = sharesData.dividendRate;
    const currentMoney = company.money || 0;

    const financialCheck = await checkDividendChangeFinancialConstraints(
      rate,
      oldRate,
      sharesData.totalShares,
      currentMoney
    );
    if (financialCheck) {
      return { success: false, error: financialCheck };
    }

    const boardCheck = await boardEnforcer.isActionAllowed('dividend_change', rate);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for dividend changes' };
    }
    const rateChange = rate - oldRate;

    const updateResult = await updateCompanyShares(companyId, {
      dividend_rate: rate
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update dividend rate' };
    }

    if (rateChange !== 0) {
      try {
        const gameState = getGameState();
        
        const rateChangePercent = oldRate > 0 ? (rateChange / oldRate) : (rate > 0 ? 1 : 0);
        const basePrestigeImpact = Math.abs(rateChangePercent) * 0.5;
        
        const prestigeAmount = rateChange < 0 
          ? -basePrestigeImpact * DIVIDEND_CHANGE_PRESTIGE_CONFIG.cutMultiplier
          : basePrestigeImpact * DIVIDEND_CHANGE_PRESTIGE_CONFIG.increaseMultiplier;
        
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
      }
    }

    triggerGameUpdate();

    return { success: true };
  } catch (error) {
    console.error('Error updating dividend rate:', error);
    return { success: false, error: 'Failed to update dividend rate' };
  }
}

export async function payDividends(): Promise<{
  success: boolean;
  error?: string;
  totalPayment?: number;
  playerPayment?: number;
  outstandingPayment?: number;
}> {
  try {
    const companyId = getCurrentCompanyId();
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }

    const dividendRate = sharesData.dividendRate;
    if (dividendRate <= 0) {
      return { success: false, error: 'Dividend rate is not set or is zero' };
    }

    const gameState = getGameState();
    const currentWeek = gameState.week || 1;
    const currentSeason = gameState.season || 'Spring';
    const currentYear = gameState.currentYear || 2024;

    if (currentWeek !== 1) {
      return { success: false, error: 'Dividends are only due on week 1 of each season' };
    }

    const lastPaidWeek = sharesData.lastDividendPaid?.week;
    const lastPaidSeason = sharesData.lastDividendPaid?.season;
    const lastPaidYear = sharesData.lastDividendPaid?.year;

    if (lastPaidWeek === 1 && lastPaidSeason === currentSeason && lastPaidYear === currentYear) {
      return { success: false, error: 'Dividends already paid for this season' };
    }

    const playerShares = sharesData.playerShares;
    const outstandingShares = sharesData.outstandingShares;
    const totalShares = sharesData.totalShares;

    const playerPayment = dividendRate * playerShares;
    const outstandingPayment = dividendRate * outstandingShares;
    const totalPayment = playerPayment + outstandingPayment;

    const currentMoney = company.money || 0;
    if (totalPayment > currentMoney) {
      return { success: false, error: 'Insufficient funds to pay dividends' };
    }

    const gameDate: GameDate = {
      week: currentWeek,
      season: (currentSeason || 'Spring') as any,
      year: currentYear
    };

    await addTransaction(
      -totalPayment,
      `Dividend Payment: ${formatNumber(dividendRate, { currency: true, decimals: 4 })} per share (${formatNumber(totalShares, { decimals: 0 })} shares)`,
      TRANSACTION_CATEGORIES.DIVIDEND_PAYMENT,
      false,
      companyId
    );

    if (company.userId && playerPayment > 0) {
      const balanceResult = await updatePlayerBalance(playerPayment, company.userId);
      if (!balanceResult.success) {
        console.warn('Failed to add player dividend to user balance:', balanceResult.error);
      }
    }

    await updateCompanyShares(companyId, {
      last_dividend_paid_week: gameDate.week,
      last_dividend_paid_season: gameDate.season,
      last_dividend_paid_year: gameDate.year
    });

    await updateMarketValue();
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

