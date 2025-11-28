import { EconomyPhase } from '../../types/types';
import { companyService } from '../user/companyService';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { getGameState } from '../core/gameState';
import { getShareMetrics } from './shareManagementService';
import {
  ECONOMY_EXPECTATION_MULTIPLIERS,
  PRESTIGE_SCALING
} from '../../constants/shareValuationConstants';
import { NormalizeScrewed1000To01WithTail } from '../../utils/calculator';

/**
 * Share Valuation Service
 * 
 * Share price and market value calculations.
 * 
 * Public API:
 * - calculateSharePrice() - Initial share price calculation (book value per share)
 * - calculateMarketCap() - Market capitalization calculation
 * - updateMarketValue() - Persist market values to database
 * - getMarketValue() - Retrieve cached or calculate fresh market values
 * - calculateExpectedValues() - Calculate expected values for incremental system
 */

/**
 * Expected values for comparison
 */
export interface ExpectedValues {
  revenueGrowth: number;
  profitMargin: number;
  earningsPerShare: number;
  revenuePerShare: number;  // Expected revenue per share (annual, scaled to 48 weeks for comparison)
}

/**
 * Calculate expected values based on economy phase, prestige, and growth trends
 * Exported for use in growth trend tracking
 */
export async function calculateExpectedValues(
  bookValuePerShare: number,
  companyId: string
): Promise<ExpectedValues> {
  const gameState = getGameState();
  const economyPhase: EconomyPhase = (gameState.economyPhase as EconomyPhase) || 'Stable';
  const prestige = gameState.prestige || 0;
  
  // Get growth trend multiplier from company (defaults to 1.0 if not set)
  const company = await companyService.getCompany(companyId);
  const growthTrendMultiplier = company?.growthTrendMultiplier ?? 1.0;
  
  // Base expectations - use company-stored values if available, otherwise use fallback defaults
  const baseRevenueGrowth = company?.baseRevenueGrowth ?? 0.10; // 10% default
  const baseProfitMargin = company?.baseProfitMargin ?? 0.15; // 15% default
  const expectedReturnOnBookValue = company?.baseExpectedReturnOnBookValue ?? 0.10;
  
  // Economy phase adjustment
  const economyMultiplier = ECONOMY_EXPECTATION_MULTIPLIERS[economyPhase];
  
  // Prestige adjustment (logarithmic scaling)
  const normalizedPrestige = NormalizeScrewed1000To01WithTail(prestige);
  // Map 0-1 normalized prestige to 1.0-2.0 multiplier range
  const prestigeMultiplier = PRESTIGE_SCALING.base + (normalizedPrestige * (PRESTIGE_SCALING.maxMultiplier - PRESTIGE_SCALING.base));
  
  // Calculate adjusted expected values
  const expectedRevenueGrowth = baseRevenueGrowth * economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
  const expectedProfitMargin = baseProfitMargin * economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
  const expectedEarningsPerShare = bookValuePerShare * expectedReturnOnBookValue * economyMultiplier * prestigeMultiplier * growthTrendMultiplier;
  
  // Expected Revenue Per Share: Based on expected profit margin and EPS
  // If expected profit margin is X% and expected EPS is Y, then expected revenue per share = Y / X
  // This gives us the revenue needed to achieve the expected EPS at the expected profit margin
  const expectedRevenuePerShare = expectedProfitMargin > 0 
    ? expectedEarningsPerShare / expectedProfitMargin 
    : bookValuePerShare * 0.5; // Fallback: assume 50% of book value as revenue if profit margin is 0
  
  return {
    revenueGrowth: expectedRevenueGrowth,
    profitMargin: expectedProfitMargin,
    earningsPerShare: expectedEarningsPerShare,
    revenuePerShare: expectedRevenuePerShare
  };
}


/**
 * Calculate initial share price - simply uses book value per share
 * For incremental system, use getMarketValue() to get current price
 */
export async function calculateSharePrice(companyId?: string): Promise<number> {
  if (!companyId) {
    companyId = getCurrentCompanyId();
  }
  
  if (!companyId) {
    return 0;
  }
  
  const shareMetrics = await getShareMetrics(companyId);
  return shareMetrics.bookValuePerShare;
}

/**
 * Get current share price (from database, or calculate if not set)
 * For incremental system, this returns the actual stored price
 */
export async function getCurrentSharePrice(companyId?: string): Promise<number> {
  if (!companyId) {
    companyId = getCurrentCompanyId();
  }
  
  if (!companyId) {
    return 0;
  }
  
  const company = await companyService.getCompany(companyId);
  if (company?.sharePrice && company.sharePrice > 0) {
    return company.sharePrice;
  }
  
  // If not set, initialize deterministically
  return await calculateSharePrice(companyId);
}

/**
 * Calculate market capitalization for a company
 * Formula: market_cap = share_price * total_shares
 * Uses current share price from database (incremental system)
 */
export async function calculateMarketCap(companyId?: string): Promise<number> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      console.error('No company ID available for market cap calculation');
      return 0;
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      console.error('Company not found for market cap calculation');
      return 0;
    }

    const totalShares = company.totalShares || 1000000;
    
    if (totalShares === 0) {
      return 0;
    }

    // Use current share price from database (incremental system)
    const sharePrice = await getCurrentSharePrice(companyId);
    const marketCap = sharePrice * totalShares;
    
    return Math.max(0, marketCap);
  } catch (error) {
    console.error('Error calculating market cap:', error);
    return 0;
  }
}

/**
 * Update company's market value (market cap only - share price is managed incrementally)
 * Share price is now managed by incremental system, so we only update market cap
 */
export async function updateMarketValue(companyId?: string): Promise<{
  success: boolean;
  marketCap?: number;
  sharePrice?: number;
  error?: string;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { success: false, error: 'No company ID available' };
    }

    const marketCap = await calculateMarketCap(companyId);
    const sharePrice = await getCurrentSharePrice(companyId);
    
    // Only update market cap (share price is managed incrementally)
    const updateResult = await companyService.updateCompany(companyId, {
      marketCap
    });
    
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update market value' };
    }
    
    return {
      success: true,
      marketCap,
      sharePrice
    };
  } catch (error) {
    console.error('Error updating market value:', error);
    return { success: false, error: 'Failed to update market value' };
  }
}

/**
 * Get current market value for display
 * Returns current share price from database (incremental system) and calculated market cap
 */
export async function getMarketValue(companyId?: string): Promise<{
  marketCap: number;
  sharePrice: number;
}> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      return { marketCap: 0, sharePrice: 0 };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { marketCap: 0, sharePrice: 0 };
    }

    // Use current share price from database (incremental system)
    // If not initialized, initialize it first
    let sharePrice = company.sharePrice;
    if (!sharePrice || sharePrice <= 0) {
      // Initialize share price deterministically
      const { initializeSharePriceDeterministically } = await import('./sharePriceIncrementService');
      const initResult = await initializeSharePriceDeterministically(companyId);
      sharePrice = initResult.sharePrice || 0;
    }

    // Calculate market cap from current share price
    const totalShares = company.totalShares || 1000000;
    const marketCap = sharePrice * totalShares;
    
    return { marketCap, sharePrice };
  } catch (error) {
    console.error('Error getting market value:', error);
    return { marketCap: 0, sharePrice: 0 };
  }
}

