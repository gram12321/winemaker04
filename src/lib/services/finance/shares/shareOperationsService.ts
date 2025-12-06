
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
import type { BaseConstraintInfo } from '../../../types/constraintTypes';
import { insertPrestigeEvent } from '../../../database/customers/prestigeEventsDB';
import { v4 as uuidv4 } from 'uuid';
import { DIVIDEND_CHANGE_PRESTIGE_CONFIG } from '../../../constants';
import { calculateAbsoluteWeeks } from '../../../utils/utils';
import { updateCompanyShares, getCompanyShares, getYearlyShareOperations, incrementYearlyShareOperations } from '../../../database/core/companySharesDB';
import { boardEnforcer, calculateFinancialData, calculateTotalOutstandingLoans, getShareMetrics, getShareholderBreakdown } from '@/lib/services';

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

  const companyId = getCurrentCompanyId();
  const yearlyOps = await getYearlyShareOperations(companyId);
  const sharesBoughtBackThisYear = yearlyOps.sharesBoughtBackThisYear;
  
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

  // Per-operation limit: 50% of current total shares
  const maxSharesPerIssuance = Math.floor(currentTotalShares * 0.5);
  if (shares > maxSharesPerIssuance) {
    return `Cannot issue more than 50% of current total shares in a single operation. Maximum allowed: ${maxSharesPerIssuance.toLocaleString()} shares`;
  }

  // Yearly limit: 100% of current total shares per year (can double shares in a year)
  const companyId = getCurrentCompanyId();
  const yearlyOps = await getYearlyShareOperations(companyId);
  const sharesIssuedThisYear = yearlyOps.sharesIssuedThisYear;
  
  const totalSharesThisYear = sharesIssuedThisYear + shares;
  const maxSharesPerYear = Math.floor(currentTotalShares * 1.0); // 100% of current total shares
  
  if (totalSharesThisYear > maxSharesPerYear) {
    const remaining = Math.max(0, maxSharesPerYear - sharesIssuedThisYear);
    return `Cannot issue more than 100% of current total shares per year. Already issued ${sharesIssuedThisYear.toLocaleString()} shares this year. Maximum allowed this year: ${maxSharesPerYear.toLocaleString()} shares. Remaining: ${remaining.toLocaleString()} shares`;
  }

  return null;
}

// Constraint info types removed - use BaseConstraintInfo directly
// Functions return BaseConstraintInfo + additional fields as plain objects

/**
 * Get maximum shares that can be issued (for UI display)
 * Returns max shares based on all financial constraints (per-operation and yearly) AND board constraints
 */
export async function getMaxIssuanceShares(options?: {
  sharePrice?: number;
  shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
  boardSatisfaction?: number;
}): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) return 0;

    const company = await companyService.getCompany(companyId);
    if (!company) return 0;

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) return 0;

    const currentTotalShares = sharesData.totalShares;

    // Max per operation: 50% of current total shares
    const maxByOperation = Math.floor(currentTotalShares * 0.5);

    // Max per year: 100% of current total shares
    const yearlyOps = await getYearlyShareOperations(companyId);
    const sharesIssuedThisYear = yearlyOps.sharesIssuedThisYear;

    const maxSharesPerYear = Math.floor(currentTotalShares * 1.0); // 100% of current total shares
    const remainingYearlyLimit = Math.max(0, maxSharesPerYear - sharesIssuedThisYear);

    // Hard limit: minimum of per-operation and yearly limits
    const hardLimit = Math.min(maxByOperation, remainingYearlyLimit);

    // Check board constraint limit
    try {
      // Use provided sharePrice or get from database (don't update market value)
      let sharePrice = options?.sharePrice;
      if (sharePrice === undefined) {
        const { getMarketValue } = await import('../../index');
        const marketData = await getMarketValue();
        sharePrice = marketData.sharePrice;
      }

      const financialContext = {
        outstandingShares: sharesData.outstandingShares,
        totalShares: sharesData.totalShares,
        sharePrice: sharePrice,
        sharesIssuedThisYear: sharesIssuedThisYear
      };

      const boardLimitResult = await boardEnforcer.getActionLimit(
        'share_issuance',
        currentTotalShares,
        financialContext,
        {
          shareholderBreakdown: options?.shareholderBreakdown,
          satisfaction: options?.boardSatisfaction
        }
      );
      
      if (boardLimitResult && boardLimitResult.limit !== null) {
        // Board limit is per-year, so we need to account for already issued shares
        const boardYearlyLimit = boardLimitResult.limit;
        const remainingBoardLimit = Math.max(0, boardYearlyLimit - sharesIssuedThisYear);
        
        // Return the minimum of hard limit and board limit
        return Math.min(hardLimit, remainingBoardLimit);
      }
    } catch (boardError) {
      console.error('Error checking board constraint for issuance:', boardError);
      // If board check fails, return hard limit
    }

    // If no board constraint or check failed, return hard limit
    return hardLimit;
  } catch (error) {
    console.error('Error calculating max issuance shares:', error);
    return 0;
  }
}

/**
 * Get maximum shares that can be bought back (for UI display)
 * Returns max shares based on all financial constraints AND board constraints
 */
export async function getMaxBuybackShares(options?: {
  sharePrice?: number;
  shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
  boardSatisfaction?: number;
}): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) return 0;

    const company = await companyService.getCompany(companyId);
    if (!company) return 0;

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) return 0;

    const outstandingShares = sharesData.outstandingShares;
    const currentMoney = company.money || 0;

    // Get share price (use provided or get from database, don't update)
    let sharePrice = options?.sharePrice;
    if (sharePrice === undefined) {
      const { getMarketValue } = await import('../../index');
      const marketData = await getMarketValue();
      sharePrice = marketData.sharePrice;
    }

    if (sharePrice <= 0) return 0;

    // Max based on cash available
    const maxByCash = Math.floor(currentMoney / sharePrice);

    // Max based on yearly limit (25% per year)
    const yearlyOps = await getYearlyShareOperations(companyId);
    const sharesBoughtBackThisYear = yearlyOps.sharesBoughtBackThisYear;

    const maxSharesPerYear = Math.floor(outstandingShares * 0.25);
    const remainingYearlyLimit = Math.max(0, maxSharesPerYear - sharesBoughtBackThisYear);

    // Check debt ratio constraint
    const financialData = await calculateFinancialData('year');
    const totalDebt = await calculateTotalOutstandingLoans();
    const debtRatio = financialData.totalAssets > 0 ? totalDebt / financialData.totalAssets : 0;
    const maxByDebtRatio = debtRatio > 0.3 ? 0 : outstandingShares;

    // Hard limit: minimum of all financial constraints
    const hardLimit = Math.min(
      outstandingShares, // Can't buy back more than outstanding
      maxByCash, // Limited by cash
      remainingYearlyLimit, // Limited by yearly limit
      maxByDebtRatio // Limited by debt ratio
    );

    // Check board constraint limit
    try {
      const financialContext = {
        cashMoney: currentMoney,
        totalAssets: financialData.totalAssets,
        debtRatio: debtRatio,
        outstandingShares: outstandingShares,
        totalShares: sharesData.totalShares,
        sharePrice: sharePrice,
        sharesBoughtBackThisYear: sharesBoughtBackThisYear
      };

      const boardLimitResult = await boardEnforcer.getActionLimit('share_buyback', outstandingShares, financialContext);
      
      if (boardLimitResult && boardLimitResult.limit !== null) {
        // Board limit is per-year, so we need to account for already bought back shares
        const boardYearlyLimit = boardLimitResult.limit;
        const remainingBoardLimit = Math.max(0, boardYearlyLimit - sharesBoughtBackThisYear);
        
        // Return the minimum of hard limit and board limit
        return Math.min(hardLimit, remainingBoardLimit);
      }
    } catch (boardError) {
      console.error('Error checking board constraint for buyback:', boardError);
      // If board check fails, return hard limit
    }

    // If no board constraint or check failed, return hard limit
    return Math.max(0, hardLimit);
  } catch (error) {
    console.error('Error calculating max buyback shares:', error);
    return 0;
  }
}

/**
 * Get dividend rate limits (min/max) based on financial constraints AND board constraints (for UI display)
 * Returns { min: number, max: number } based on cash reserves, change limits, and board approval
 * NOTE: Only decreases are restricted (10% limit). Increases are free (only limited by cash and board). */
export async function getDividendRateLimits(options?: {
  shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
  boardSatisfaction?: number;
}): Promise<{ min: number; max: number }> {
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
    const hardMaxDividend = oldRate > maxByCash ? oldRate : maxByCash;
    const hardMinDividend = minByChangeLimit;

    // Check board constraint limit
    try {
      const financialData = await calculateFinancialData('year');
      const shareMetrics = await getShareMetrics();
      const profitMargin = shareMetrics.profitMargin || 0;
      
      const financialContext = {
        cashMoney: currentMoney,
        totalAssets: financialData.totalAssets,
        profitMargin: profitMargin,
        totalShares: totalShares,
        oldRate: oldRate
      };

      // For dividend changes, the board constraint returns different values for increases vs decreases
      // We need to check both directions to get the full range
      // The formula uses newRate to determine if it's an increase or decrease
      
      let boardMax = hardMaxDividend;
      let boardMin = hardMinDividend;
      
      // Check increase limit: use a rate clearly higher than current to get max allowed increase
      // Use maxByCash as test rate (or oldRate * 1.2 if higher) to get the board's max allowed increase
      const testIncreaseRate = oldRate > 0 
        ? Math.max(oldRate * 1.2, maxByCash * 0.9) // Slightly below maxByCash to avoid cash constraint in test
        : maxByCash * 0.9;
      
      if (testIncreaseRate > oldRate) {
        const boardIncreaseResult = await boardEnforcer.getActionLimit(
          'dividend_change',
          testIncreaseRate,
          financialContext,
          {
            shareholderBreakdown: options?.shareholderBreakdown,
            satisfaction: options?.boardSatisfaction
          }
        );
        if (boardIncreaseResult && boardIncreaseResult.limit !== null) {
          // Board limit for increases (this is the maximum allowed rate)
          boardMax = Math.min(hardMaxDividend, boardIncreaseResult.limit);
        }
      }
      
      // Check decrease limit: use a rate clearly lower than current to get min allowed decrease
      // Use oldRate * 0.5 as test rate to get the board's min allowed decrease
      if (oldRate > 0) {
        const testDecreaseRate = oldRate * 0.5;
        const boardDecreaseResult = await boardEnforcer.getActionLimit(
          'dividend_change',
          testDecreaseRate,
          financialContext,
          {
            shareholderBreakdown: options?.shareholderBreakdown,
            satisfaction: options?.boardSatisfaction
          }
        );
        if (boardDecreaseResult && boardDecreaseResult.limit !== null) {
          // Board limit for decreases (this is the minimum allowed rate)
          boardMin = Math.max(hardMinDividend, boardDecreaseResult.limit);
        }
      }

      return {
        min: Math.max(0, boardMin),
        max: Math.max(0, boardMax)
      };
    } catch (boardError) {
      console.error('Error checking board constraint for dividend:', boardError);
      // If board check fails, return hard limits
    }

    // If no board constraint or check failed, return hard limits
    return {
      min: Math.max(0, hardMinDividend),
      max: Math.max(0, hardMaxDividend)
    };
  } catch (error) {
    console.error('Error calculating dividend rate limits:', error);
    return { min: 0, max: 0 };
  }
}

/**
 * Get detailed constraint information for share issuance (for UI display)
 * Returns BaseConstraintInfo + additional fields (maxShares, hardLimit, boardLimit)
 */
export async function getIssuanceConstraintInfo(options?: {
  sharePrice?: number;
  shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
  boardSatisfaction?: number;
}): Promise<BaseConstraintInfo & { maxShares: number; hardLimit: number; boardLimit: number | null }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      return {
        maxShares: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'No company selected',
        isBlocked: false,
        isLimited: false
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return {
        maxShares: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'Company not found',
        isBlocked: false,
        isLimited: false
      };
    }

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return {
        maxShares: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'Share data not found',
        isBlocked: false,
        isLimited: false
      };
    }

    const currentTotalShares = sharesData.totalShares;
    const yearlyOps = await getYearlyShareOperations(companyId);
    const sharesIssuedThisYear = yearlyOps.sharesIssuedThisYear;

    // Hard limits
    const maxByOperation = Math.floor(currentTotalShares * 0.5);
    const maxSharesPerYear = Math.floor(currentTotalShares * 1.0);
    const remainingYearlyLimit = Math.max(0, maxSharesPerYear - sharesIssuedThisYear);
    const hardLimit = Math.min(maxByOperation, remainingYearlyLimit);

    let limitingFactor = '';
    if (hardLimit === maxByOperation) {
      limitingFactor = 'Per-operation limit (50% of total shares)';
    } else {
      limitingFactor = `Yearly limit (100% per year, ${sharesIssuedThisYear.toLocaleString()} already issued)`;
    }

    // Board limit and blocked status
    let boardLimit: number | null = null;
    let boardSatisfaction: number | undefined = undefined;
    let boardReason = '';
    let isBlocked = false;
    let isLimited = false;
    let blockReason = '';

    try {
      // Use provided sharePrice or get from database (don't update market value)
      let sharePrice = options?.sharePrice;
      if (sharePrice === undefined) {
        const { getMarketValue } = await import('../../index');
        const marketData = await getMarketValue();
        sharePrice = marketData.sharePrice;
      }

      const financialContext = {
        outstandingShares: sharesData.outstandingShares,
        totalShares: sharesData.totalShares,
        sharePrice: sharePrice,
        sharesIssuedThisYear: sharesIssuedThisYear
      };

      // Check if action is allowed (to determine blocked status)
      const boardCheck = await boardEnforcer.isActionAllowed(
        'share_issuance',
        1,
        financialContext,
        {
          shareholderBreakdown: options?.shareholderBreakdown,
          satisfaction: options?.boardSatisfaction
        }
      );
      
      if (!boardCheck.allowed) {
        // Operation is completely blocked by board
        isBlocked = true;
        // Get threshold from board constants
        const { BOARD_CONSTRAINTS } = await import('../../../constants/boardConstants');
        const thresholdPercent = (BOARD_CONSTRAINTS.share_issuance.maxThreshold * 100).toFixed(0);
        blockReason = boardCheck.message 
          ? boardCheck.message.replace('Board approval required', `Board approval (of at least ${thresholdPercent}% satisfaction) required`)
          : `Board approval (of at least ${thresholdPercent}% satisfaction) required for share issuance. Board satisfaction is too low to approve new share issuance.`;
        boardSatisfaction = boardCheck.satisfaction;
      } else {
        // Check if it's limited (between startThreshold and maxThreshold)
        const boardLimitResult = await boardEnforcer.getActionLimit(
          'share_issuance',
          currentTotalShares,
          financialContext,
          {
            shareholderBreakdown: options?.shareholderBreakdown,
            satisfaction: options?.boardSatisfaction
          }
        );
        
        if (boardLimitResult) {
          boardSatisfaction = boardLimitResult.satisfaction;
          
          // Check if satisfaction is below startThreshold (limited but not blocked)
          // share_issuance: startThreshold: 0.6, maxThreshold: 0.3
          if (boardSatisfaction !== undefined && boardSatisfaction <= 0.6 && boardSatisfaction > 0.3) {
            isLimited = true;
          }
          
          if (boardLimitResult.limit !== null) {
            const boardYearlyLimit = boardLimitResult.limit;
            const remainingBoardLimit = Math.max(0, boardYearlyLimit - sharesIssuedThisYear);
            boardLimit = remainingBoardLimit;
            
            if (boardSatisfaction !== undefined) {
              boardReason = `Board satisfaction: ${(boardSatisfaction * 100).toFixed(1)}%`;
              if (sharePrice < 0.50) {
                boardReason += ` (Share price penalty: <€0.50)`;
              }
            }
          }
        }
      }
    } catch (boardError) {
      console.error('Error checking board constraint for issuance:', boardError);
    }

    // Determine which constraint is limiting
    // If blocked, maxShares should be 0
    const maxShares = isBlocked ? 0 : (boardLimit !== null ? Math.min(hardLimit, boardLimit) : hardLimit);
    let limitingConstraint: 'hard' | 'board' | 'none' = 'none';
    let constraintReason = '';

    if (isBlocked) {
      limitingConstraint = 'board';
      constraintReason = blockReason;
    } else if (maxShares === 0) {
      limitingConstraint = 'hard';
      constraintReason = limitingFactor;
    } else if (boardLimit !== null && boardLimit < hardLimit) {
      limitingConstraint = 'board';
      constraintReason = boardReason || 'Board approval required';
    } else {
      limitingConstraint = 'hard';
      constraintReason = limitingFactor;
    }

    return {
      maxShares,
      limitingConstraint,
      hardLimit,
      boardLimit,
      constraintReason,
      isBlocked,
      isLimited,
      blockReason: isBlocked ? blockReason : undefined,
      boardLimitDetails: boardLimit !== null || isBlocked ? {
        satisfaction: boardSatisfaction,
        reason: boardReason || blockReason
      } : undefined
    };
  } catch (error) {
    console.error('Error calculating issuance constraint info:', error);
    return {
      maxShares: 0,
      limitingConstraint: 'none',
      hardLimit: 0,
      boardLimit: null,
      constraintReason: 'Error calculating limits',
      isBlocked: false,
      isLimited: false
    };
  }
}

/**
 * Get detailed constraint information for share buyback (for UI display)
 * Returns BaseConstraintInfo + additional fields (maxShares, hardLimit, boardLimit)
 */
export async function getBuybackConstraintInfo(options?: {
  sharePrice?: number;
  shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
  boardSatisfaction?: number;
}): Promise<BaseConstraintInfo & { maxShares: number; hardLimit: number; boardLimit: number | null }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      return {
        maxShares: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'No company selected',
        isBlocked: false,
        isLimited: false
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return {
        maxShares: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'Company not found',
        isBlocked: false,
        isLimited: false
      };
    }

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return {
        maxShares: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'Share data not found',
        isBlocked: false,
        isLimited: false
      };
    }

    const outstandingShares = sharesData.outstandingShares;
    const currentMoney = company.money || 0;

    // Use provided sharePrice or get from database (don't update market value)
    let sharePrice = options?.sharePrice;
    if (sharePrice === undefined) {
      const { getMarketValue } = await import('../../index');
      const marketData = await getMarketValue();
      sharePrice = marketData.sharePrice;
    }

    if (sharePrice <= 0) {
      return {
        maxShares: 0,
        limitingConstraint: 'hard',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'Invalid share price',
        isBlocked: false,
        isLimited: false
      };
    }

    // Hard limits
    const maxByCash = Math.floor(currentMoney / sharePrice);
    const yearlyOps = await getYearlyShareOperations(companyId);
    const sharesBoughtBackThisYear = yearlyOps.sharesBoughtBackThisYear;
    const maxSharesPerYear = Math.floor(outstandingShares * 0.25);
    const remainingYearlyLimit = Math.max(0, maxSharesPerYear - sharesBoughtBackThisYear);

    const financialData = await calculateFinancialData('year');
    const totalDebt = await calculateTotalOutstandingLoans();
    const debtRatio = financialData.totalAssets > 0 ? totalDebt / financialData.totalAssets : 0;
    const maxByDebtRatio = debtRatio > 0.3 ? 0 : outstandingShares;

    const hardLimit = Math.min(
      outstandingShares,
      maxByCash,
      remainingYearlyLimit,
      maxByDebtRatio
    );

    let limitingFactor = '';
    if (hardLimit === 0 && debtRatio > 0.3) {
      limitingFactor = 'Debt ratio exceeds 30%';
    } else if (hardLimit === maxByCash) {
      limitingFactor = `Cash balance (${formatNumber(currentMoney, { currency: true })})`;
    } else if (hardLimit === remainingYearlyLimit) {
      limitingFactor = `Yearly limit (25% per year, ${sharesBoughtBackThisYear.toLocaleString()} already bought back)`;
    } else if (hardLimit === outstandingShares) {
      limitingFactor = 'Outstanding shares available';
    }

    // Board limit and blocked status
    let boardLimit: number | null = null;
    let boardSatisfaction: number | undefined = undefined;
    let boardReason = '';
    let isBlocked = false;
    let isLimited = false;
    let blockReason = '';

    try {
      const financialContext = {
        cashMoney: currentMoney,
        totalAssets: financialData.totalAssets,
        debtRatio: debtRatio,
        outstandingShares: outstandingShares,
        totalShares: sharesData.totalShares,
        sharePrice: sharePrice,
        sharesBoughtBackThisYear: sharesBoughtBackThisYear
      };

      // Check if action is allowed (to determine blocked status)
      const boardCheck = await boardEnforcer.isActionAllowed(
        'share_buyback',
        1,
        financialContext,
        {
          shareholderBreakdown: options?.shareholderBreakdown,
          satisfaction: options?.boardSatisfaction
        }
      );
      
      if (!boardCheck.allowed) {
        // Operation is completely blocked by board
        isBlocked = true;
        // Get threshold from board constants
        const { BOARD_CONSTRAINTS } = await import('../../../constants/boardConstants');
        const thresholdPercent = (BOARD_CONSTRAINTS.share_buyback.maxThreshold * 100).toFixed(0);
        blockReason = boardCheck.message 
          ? boardCheck.message.replace('Board approval required', `Board approval (of at least ${thresholdPercent}% satisfaction) required`)
          : `Board approval (of at least ${thresholdPercent}% satisfaction) required for share buyback. Board satisfaction is too low to approve share repurchases.`;
        boardSatisfaction = boardCheck.satisfaction;
      } else {
        // Check if it's limited (between startThreshold and maxThreshold)
        const boardLimitResult = await boardEnforcer.getActionLimit(
          'share_buyback',
          outstandingShares,
          financialContext,
          {
            shareholderBreakdown: options?.shareholderBreakdown,
            satisfaction: options?.boardSatisfaction
          }
        );
        
        if (boardLimitResult) {
          boardSatisfaction = boardLimitResult.satisfaction;
          
          // Check if satisfaction is below startThreshold (limited but not blocked)
          // share_buyback: startThreshold: 0.5, maxThreshold: 0.2
          if (boardSatisfaction !== undefined && boardSatisfaction <= 0.5 && boardSatisfaction > 0.2) {
            isLimited = true;
          }
          
          if (boardLimitResult.limit !== null) {
            const boardYearlyLimit = boardLimitResult.limit;
            const remainingBoardLimit = Math.max(0, boardYearlyLimit - sharesBoughtBackThisYear);
            boardLimit = remainingBoardLimit;
            
            if (boardSatisfaction !== undefined) {
              boardReason = `Board satisfaction: ${(boardSatisfaction * 100).toFixed(1)}%`;
              if (debtRatio > 0.20 && debtRatio <= 0.30) {
                boardReason += ` (Debt ratio concern: ${(debtRatio * 100).toFixed(1)}%)`;
              }
              const estimatedCost = remainingBoardLimit * sharePrice;
              if (estimatedCost > currentMoney * 0.5) {
                boardReason += ` (Cash availability concern)`;
              }
            }
          }
        }
      }
    } catch (boardError) {
      console.error('Error checking board constraint for buyback:', boardError);
    }

    // Determine which constraint is limiting
    // If blocked, maxShares should be 0
    const maxShares = isBlocked ? 0 : (boardLimit !== null ? Math.min(hardLimit, boardLimit) : hardLimit);
    let limitingConstraint: 'hard' | 'board' | 'none' = 'none';
    let constraintReason = '';

    if (isBlocked) {
      limitingConstraint = 'board';
      constraintReason = blockReason;
    } else if (maxShares === 0) {
      limitingConstraint = 'hard';
      constraintReason = limitingFactor;
    } else if (boardLimit !== null && boardLimit < hardLimit) {
      limitingConstraint = 'board';
      constraintReason = boardReason || 'Board approval required';
    } else {
      limitingConstraint = 'hard';
      constraintReason = limitingFactor;
    }

    return {
      maxShares,
      limitingConstraint,
      hardLimit,
      boardLimit,
      constraintReason,
      isBlocked,
      isLimited,
      blockReason: isBlocked ? blockReason : undefined,
      boardLimitDetails: boardLimit !== null || isBlocked ? {
        satisfaction: boardSatisfaction,
        reason: boardReason || blockReason
      } : undefined
    };
  } catch (error) {
    console.error('Error calculating buyback constraint info:', error);
    return {
      maxShares: 0,
      limitingConstraint: 'none',
      hardLimit: 0,
      boardLimit: null,
      constraintReason: 'Error calculating limits',
      isBlocked: false,
      isLimited: false
    };
  }
}

/**
 * Get detailed constraint information for dividend changes (for UI display)
 * Returns BaseConstraintInfo + additional fields (minRate, maxRate, hardMinRate, hardMaxRate, boardMinRate, boardMaxRate)
 */
export async function getDividendConstraintInfo(options?: {
  shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
  boardSatisfaction?: number;
}): Promise<BaseConstraintInfo & { minRate: number; maxRate: number; hardMinRate: number; hardMaxRate: number; boardMinRate: number | null; boardMaxRate: number | null }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      return {
        minRate: 0,
        maxRate: 0,
        limitingConstraint: 'none',
        hardMinRate: 0,
        hardMaxRate: 0,
        boardMinRate: null,
        boardMaxRate: null,
        constraintReason: 'No company selected',
        isBlocked: false,
        isLimited: false
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return {
        minRate: 0,
        maxRate: 0,
        limitingConstraint: 'none',
        hardMinRate: 0,
        hardMaxRate: 0,
        boardMinRate: null,
        boardMaxRate: null,
        constraintReason: 'Company not found',
        isBlocked: false,
        isLimited: false
      };
    }

    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return {
        minRate: 0,
        maxRate: 0,
        limitingConstraint: 'none',
        hardMinRate: 0,
        hardMaxRate: 0,
        boardMinRate: null,
        boardMaxRate: null,
        constraintReason: 'Share data not found',
        isBlocked: false,
        isLimited: false
      };
    }

    const currentMoney = company.money || 0;
    const oldRate = sharesData.dividendRate;
    const totalShares = sharesData.totalShares;

    // Hard limits
    const maxByCash = totalShares > 0 ? currentMoney / (4 * totalShares) : 0;
    const smallChangeThreshold = 0.005;
    let minByChangeLimit = 0;

    if (oldRate > 0) {
      const minChange = oldRate * 0.1;
      minByChangeLimit = Math.max(0, oldRate - Math.max(minChange, smallChangeThreshold));
    }

    const hardMaxRate = oldRate > maxByCash ? oldRate : maxByCash;
    const hardMinRate = minByChangeLimit;

    let limitingFactor = '';
    if (hardMaxRate === maxByCash && oldRate <= maxByCash) {
      limitingFactor = `Cash reserves (must have 1 year = 4 seasons)`;
    } else if (hardMinRate > 0 && oldRate > 0) {
      limitingFactor = `10% decrease limit per season`;
    }

    // Board limit and blocked status
    let boardMinRate: number | null = null;
    let boardMaxRate: number | null = null;
    let boardSatisfaction: number | undefined = undefined;
    let boardReason = '';
    let isBlocked = false;
    let isLimited = false;
    let blockReason = '';

    try {
      const financialData = await calculateFinancialData('year');
      const shareMetrics = await getShareMetrics();
      const profitMargin = shareMetrics.profitMargin || 0;
      
      const financialContext = {
        cashMoney: currentMoney,
        totalAssets: financialData.totalAssets,
        profitMargin: profitMargin,
        totalShares: totalShares,
        oldRate: oldRate
      };

      // Check if action is allowed (to determine blocked status)
      // Test with a rate change to see if it's blocked
      const testRate = oldRate > 0 ? oldRate * 1.1 : maxByCash * 0.9;
      const boardCheck = await boardEnforcer.isActionAllowed(
        'dividend_change',
        testRate,
        financialContext,
        {
          shareholderBreakdown: options?.shareholderBreakdown,
          satisfaction: options?.boardSatisfaction
        }
      );
      
      if (!boardCheck.allowed) {
        // Operation is completely blocked by board
        isBlocked = true;
        // Get threshold from board constants
        const { BOARD_CONSTRAINTS } = await import('../../../constants/boardConstants');
        const thresholdPercent = (BOARD_CONSTRAINTS.dividend_change.maxThreshold * 100).toFixed(0);
        blockReason = boardCheck.message 
          ? boardCheck.message.replace('Board approval required', `Board approval (of at least ${thresholdPercent}% satisfaction) required`)
          : `Board approval (of at least ${thresholdPercent}% satisfaction) required for dividend changes. Board satisfaction is too low to approve dividend modifications.`;
        boardSatisfaction = boardCheck.satisfaction;
      } else {
        // Check if it's limited (between startThreshold and maxThreshold)
        const boardLimitResult = await boardEnforcer.getActionLimit(
          'dividend_change',
          testRate,
          financialContext,
          {
            shareholderBreakdown: options?.shareholderBreakdown,
            satisfaction: options?.boardSatisfaction
          }
        );
        
        if (boardLimitResult) {
          boardSatisfaction = boardLimitResult.satisfaction;
          
          // Check if satisfaction is below startThreshold (limited but not blocked)
          // dividend_change: startThreshold: 0.5, maxThreshold: 0.3
          if (boardSatisfaction !== undefined && boardSatisfaction <= 0.5 && boardSatisfaction > 0.3) {
            isLimited = true;
          }
        }

        // Check increase limit
        const testIncreaseRate = oldRate > 0 
          ? Math.max(oldRate * 1.2, maxByCash * 0.9)
          : maxByCash * 0.9;
        
        if (testIncreaseRate > oldRate) {
          const boardIncreaseResult = await boardEnforcer.getActionLimit(
            'dividend_change',
            testIncreaseRate,
            financialContext,
            {
              shareholderBreakdown: options?.shareholderBreakdown,
              satisfaction: options?.boardSatisfaction
            }
          );
          if (boardIncreaseResult && boardIncreaseResult.limit !== null) {
            boardMaxRate = Math.min(hardMaxRate, boardIncreaseResult.limit);
          }
        }
        
        // Check decrease limit
        if (oldRate > 0) {
          const testDecreaseRate = oldRate * 0.5;
          const boardDecreaseResult = await boardEnforcer.getActionLimit(
            'dividend_change',
            testDecreaseRate,
            financialContext,
            {
              shareholderBreakdown: options?.shareholderBreakdown,
              satisfaction: options?.boardSatisfaction
            }
          );
          if (boardDecreaseResult && boardDecreaseResult.limit !== null) {
            boardMinRate = Math.max(hardMinRate, boardDecreaseResult.limit);
          }
        }

        if (boardSatisfaction !== undefined) {
          boardReason = `Board satisfaction: ${(boardSatisfaction * 100).toFixed(1)}%`;
        }
      }
    } catch (boardError) {
      console.error('Error checking board constraint for dividend:', boardError);
    }

    // Determine which constraint is limiting
    let minRate = hardMinRate;
    let maxRate = hardMaxRate;
    let limitingConstraint: 'hard' | 'board' | 'none' = 'none';
    let constraintReason = '';

    if (isBlocked) {
      limitingConstraint = 'board';
      constraintReason = blockReason;
      // When blocked, rates should be clamped to current rate (no changes allowed)
      minRate = oldRate;
      maxRate = oldRate;
    } else {
      // Apply board limits if they exist and are more restrictive
      if (boardMaxRate !== null && boardMaxRate < hardMaxRate) {
        maxRate = boardMaxRate;
        limitingConstraint = 'board';
        constraintReason = boardReason || 'Board approval required';
      } else if (boardMinRate !== null && boardMinRate > hardMinRate) {
        minRate = boardMinRate;
        limitingConstraint = 'board';
        constraintReason = boardReason || 'Board approval required';
      } else {
        limitingConstraint = 'hard';
        constraintReason = limitingFactor || 'Regulatory limits';
      }
    }

    return {
      minRate,
      maxRate,
      limitingConstraint,
      hardMinRate,
      hardMaxRate,
      boardMinRate,
      boardMaxRate,
      constraintReason,
      isBlocked,
      isLimited,
      blockReason: isBlocked ? blockReason : undefined,
      boardLimitDetails: (boardMinRate !== null || boardMaxRate !== null || isBlocked) ? {
        satisfaction: boardSatisfaction,
        reason: boardReason || blockReason
      } : undefined
    };
  } catch (error) {
    console.error('Error calculating dividend constraint info:', error);
    return {
      minRate: 0,
      maxRate: 0,
      limitingConstraint: 'none',
      hardMinRate: 0,
      hardMaxRate: 0,
      boardMinRate: null,
      boardMaxRate: null,
      constraintReason: 'Error calculating limits',
      isBlocked: false,
      isLimited: false
    };
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

    // Prepare financial context for board constraint evaluation
    // Track yearly issuance for per-year board limit (like buyback)
    const yearlyOps = await getYearlyShareOperations(companyId);
    
    const financialContext = {
      outstandingShares: sharesData.outstandingShares,
      totalShares: sharesData.totalShares,
      sharePrice: sharePrice,
      sharesIssuedThisYear: yearlyOps.sharesIssuedThisYear // For yearly limit tracking
    };

    // Check board constraint (handles yearly limit internally)
    const boardCheck = await boardEnforcer.isActionAllowed('share_issuance', shares, financialContext);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for share issuance' };
    }
    
    // Check if shares exceed board limit (yearly limit is checked in isActionAllowed)
    if (boardCheck.limit !== undefined && boardCheck.limit !== null) {
      // For yearly limits, the check is already done in isActionAllowed
      // This is just for consistency with the return structure
    }

    const capitalRaised = shares * sharePrice;

    const currentTotalShares = sharesData.totalShares;
    const currentPlayerShares = sharesData.playerShares;
    const newTotalShares = currentTotalShares + shares;
    const newOutstandingShares = sharesData.outstandingShares + shares;
    const newOutsideShares = sharesData.outsideShares + shares; // New shares go to outside investors
    const newPlayerShares = currentPlayerShares;
    const newPlayerOwnershipPct = (newPlayerShares / newTotalShares) * 100;

    const updateResult = await updateCompanyShares(companyId, {
      total_shares: newTotalShares,
      outstanding_shares: newOutstandingShares,
      player_shares: newPlayerShares,
      outside_shares: newOutsideShares
      // familyShares remains unchanged
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

    // Increment yearly share operations tracking
    await incrementYearlyShareOperations(companyId, 'issuance', shares);

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

    // Prepare financial context for board constraint evaluation
    // Track yearly buyback for per-year board limit
    const yearlyOps = await getYearlyShareOperations(companyId);
    
    const financialData = await calculateFinancialData('year');
    const totalDebt = await calculateTotalOutstandingLoans();
    const debtRatio = financialData.totalAssets > 0 ? totalDebt / financialData.totalAssets : 0;
    
    const financialContext = {
      cashMoney: currentMoney,
      totalAssets: financialData.totalAssets,
      debtRatio: debtRatio,
      outstandingShares: currentOutstandingShares,
      totalShares: sharesData.totalShares,
      sharePrice: sharePrice,
      sharesBoughtBackThisYear: yearlyOps.sharesBoughtBackThisYear // For yearly limit tracking
    };

    const boardCheck = await boardEnforcer.isActionAllowed('share_buyback', shares, financialContext);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for share buyback' };
    }
    
    // Yearly limit is checked in isActionAllowed, so no need for separate check here

    const currentTotalShares = sharesData.totalShares;
    const currentPlayerShares = sharesData.playerShares;
    const newTotalShares = currentTotalShares - shares;
    const newOutstandingShares = currentOutstandingShares - shares;
    const newOutsideShares = sharesData.outsideShares - shares; // Buyback reduces outside shares
    const newPlayerShares = currentPlayerShares;
    const newPlayerOwnershipPct = newTotalShares > 0 ? (newPlayerShares / newTotalShares) * 100 : 100;

    const updateResult = await updateCompanyShares(companyId, {
      total_shares: newTotalShares,
      outstanding_shares: newOutstandingShares,
      player_shares: newPlayerShares,
      outside_shares: newOutsideShares
      // familyShares remains unchanged
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

    // Increment yearly share operations tracking
    await incrementYearlyShareOperations(companyId, 'buyback', shares);

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

    // Prepare financial context for board constraint evaluation
    const financialData = await calculateFinancialData('year');
    const shareMetrics = await getShareMetrics();
    const profitMargin = shareMetrics.profitMargin || 0;
    
    const financialContext = {
      cashMoney: currentMoney,
      totalAssets: financialData.totalAssets,
      profitMargin: profitMargin,
      totalShares: sharesData.totalShares,
      oldRate: oldRate
    };

    const boardCheck = await boardEnforcer.isActionAllowed('dividend_change', rate, financialContext);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for dividend changes' };
    }
    
    // Check if rate exceeds board limit (if scaling constraint applies)
    // For dividend changes, limit is the maximum allowed rate
    if (boardCheck.limit !== undefined && boardCheck.limit !== null) {
      if (rate > oldRate && rate > boardCheck.limit) {
        return { 
          success: false, 
          error: `Dividend increase exceeds board-approved limit of ${formatNumber(boardCheck.limit, { currency: true, decimals: 4 })} per share. Maximum allowed: ${formatNumber(boardCheck.limit, { currency: true, decimals: 4 })} per share` 
        };
      }
      if (rate < oldRate && rate < boardCheck.limit) {
        return { 
          success: false, 
          error: `Dividend decrease exceeds board-approved limit. Minimum allowed: ${formatNumber(boardCheck.limit, { currency: true, decimals: 4 })} per share` 
        };
      }
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

