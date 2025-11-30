
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
import { boardEnforcer } from '@/lib/services';

export async function issueStock(
  shares: number,
  price?: number
): Promise<ShareOperationResult & { capitalRaised?: number }> {
  try {
    const companyId = getCurrentCompanyId();
    
    if (shares <= 0) {
      return { success: false, error: 'Number of shares must be greater than 0' };
    }

    // Check board constraint
    const boardCheck = await boardEnforcer.isActionAllowed('share_issuance', shares);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for share issuance' };
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

    // Get current share price if not provided
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

    // Calculate capital raised
    const capitalRaised = shares * sharePrice;

    // Update share structure
    const currentTotalShares = sharesData.totalShares;
    const currentPlayerShares = sharesData.playerShares;
    const newTotalShares = currentTotalShares + shares;
    const newOutstandingShares = sharesData.outstandingShares + shares;
    const newPlayerShares = currentPlayerShares; // Player shares stay the same (dilution)
    const newPlayerOwnershipPct = (newPlayerShares / newTotalShares) * 100;

    // Update company shares in database
    const updateResult = await updateCompanyShares(companyId, {
      total_shares: newTotalShares,
      outstanding_shares: newOutstandingShares,
      player_shares: newPlayerShares
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update share structure' };
    }

    // Add capital raised to company money
    await addTransaction(
      capitalRaised,
      `Stock Issuance: ${shares.toLocaleString()} shares @ ${sharePrice.toFixed(2)}€ per share`,
      TRANSACTION_CATEGORIES.INITIAL_INVESTMENT,
      false,
      companyId
    );

    // Apply immediate price adjustment for dilution effect
    const { applyImmediateShareStructureAdjustment } = await import('./sharePriceService');
    await applyImmediateShareStructureAdjustment(
      companyId,
      currentTotalShares,
      newTotalShares,
      'issuance'
    );

    // Update market cap (share price already adjusted above)
    await updateMarketValue();

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

    // Check board constraint
    const boardCheck = await boardEnforcer.isActionAllowed('share_buyback', shares);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for share buyback' };
    }

    // Get current share price if not provided
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

    // Calculate total cost
    const cost = shares * sharePrice;

    // Check if company has enough cash
    const currentMoney = company.money || 0;
    if (cost > currentMoney) {
      return { success: false, error: 'Insufficient funds to buy back shares' };
    }

    // Update share structure
    const currentTotalShares = sharesData.totalShares;
    const currentPlayerShares = sharesData.playerShares;
    const newTotalShares = currentTotalShares - shares;
    const newOutstandingShares = currentOutstandingShares - shares;
    const newPlayerShares = currentPlayerShares; // Player shares stay the same (concentration)
    const newPlayerOwnershipPct = newTotalShares > 0 ? (newPlayerShares / newTotalShares) * 100 : 100;

    // Update company shares in database
    const updateResult = await updateCompanyShares(companyId, {
      total_shares: newTotalShares,
      outstanding_shares: newOutstandingShares,
      player_shares: newPlayerShares
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
    const { applyImmediateShareStructureAdjustment } = await import('./sharePriceService');
    await applyImmediateShareStructureAdjustment(
      companyId,
      currentTotalShares,
      newTotalShares,
      'buyback'
    );

    // Update market cap (share price already adjusted above)
    await updateMarketValue();

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

export async function calculateDividendPayment(): Promise<number> {
  try {
    const companyId = getCurrentCompanyId();
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return 0;
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return 0;
    }

    const dividendRate = sharesData.dividendRate;
    const totalShares = sharesData.totalShares;

    // Calculate total dividend payment (fixed per share) for all shares
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

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return false;
    }

    const dividendRate = sharesData.dividendRate;
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
    const lastPaidWeek = sharesData.lastDividendPaid?.week;
    const lastPaidSeason = sharesData.lastDividendPaid?.season;
    const lastPaidYear = sharesData.lastDividendPaid?.year;

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

export async function updateDividendRate(
  rate: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const companyId = getCurrentCompanyId();

    if (rate < 0) {
      return { success: false, error: 'Dividend rate cannot be negative' };
    }

    // Check board constraint
    const boardCheck = await boardEnforcer.isActionAllowed('dividend_change', rate);
    if (!boardCheck.allowed) {
      return { success: false, error: boardCheck.message || 'Board approval required for dividend changes' };
    }

    // Get current company
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Get share data
    const sharesData = await getCompanyShares(companyId);
    if (!sharesData) {
      return { success: false, error: 'Share data not found' };
    }

    // Get old rate for comparison
    const oldRate = sharesData.dividendRate;
    const rateChange = rate - oldRate;

    // Update company shares in database
    const updateResult = await updateCompanyShares(companyId, {
      dividend_rate: rate
    });

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update dividend rate' };
    }

    // Create prestige event for dividend change (asymmetric impact)
    if (rateChange !== 0) {
      try {
        const gameState = getGameState();
        
        // Calculate prestige impact (asymmetric: cuts more negative than increases positive)
        const rateChangePercent = oldRate > 0 ? (rateChange / oldRate) : (rate > 0 ? 1 : 0);
        const basePrestigeImpact = Math.abs(rateChangePercent) * 0.5;
        
        const prestigeAmount = rateChange < 0 
          ? -basePrestigeImpact * DIVIDEND_CHANGE_PRESTIGE_CONFIG.cutMultiplier
          : basePrestigeImpact * DIVIDEND_CHANGE_PRESTIGE_CONFIG.increaseMultiplier;
        
        // Only create event if impact is meaningful
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

    // Trigger game update
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

    // Check if dividends are due (week 1 of season, not already paid)
    const gameState = getGameState();
    const currentWeek = gameState.week || 1;
    const currentSeason = gameState.season || 'Spring';
    const currentYear = gameState.currentYear || 2024;

    // Dividends are only due on week 1 of each season
    if (currentWeek !== 1) {
      return { success: false, error: 'Dividends are only due on week 1 of each season' };
    }

    // Check if dividends have already been paid for this season
    const lastPaidWeek = sharesData.lastDividendPaid?.week;
    const lastPaidSeason = sharesData.lastDividendPaid?.season;
    const lastPaidYear = sharesData.lastDividendPaid?.year;

    if (lastPaidWeek === 1 && lastPaidSeason === currentSeason && lastPaidYear === currentYear) {
      return { success: false, error: 'Dividends already paid for this season' };
    }

    // Calculate payments
    const playerShares = sharesData.playerShares;
    const outstandingShares = sharesData.outstandingShares;
    const totalShares = sharesData.totalShares;

    const playerPayment = dividendRate * playerShares;
    const outstandingPayment = dividendRate * outstandingShares;
    const totalPayment = playerPayment + outstandingPayment;

    // Check if company has enough cash
    const currentMoney = company.money || 0;
    if (totalPayment > currentMoney) {
      return { success: false, error: 'Insufficient funds to pay dividends' };
    }

    // Get current game date
    const gameDate: GameDate = {
      week: currentWeek,
      season: (currentSeason || 'Spring') as any,
      year: currentYear
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
    if (company.userId && playerPayment > 0) {
      const balanceResult = await updatePlayerBalance(playerPayment, company.userId);
      if (!balanceResult.success) {
        console.warn('Failed to add player dividend to user balance:', balanceResult.error);
      }
    }

    // Update last dividend paid date
    await updateCompanyShares(companyId, {
      last_dividend_paid_week: gameDate.week,
      last_dividend_paid_season: gameDate.season,
      last_dividend_paid_year: gameDate.year
    });

    // Recalculate market value after dividend payment
    await updateMarketValue();

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

