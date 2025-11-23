import { EconomyPhase } from '../../types/types';
import { calculateTotalAssets } from './financeService';
import { calculateTotalOutstandingLoans } from './loanService';
import { companyService } from '../user/companyService';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { getGameState } from '../core/gameState';
import { ECONOMY_MARKET_CAP_MULTIPLIERS } from '../../constants/economyConstants';

/**
 * Calculate market capitalization for a company
 * Formula: market_cap = (total_assets - total_liabilities) * economy_multiplier
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Market capitalization in euros
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

    // Get total assets
    const totalAssets = await calculateTotalAssets();
    
    // Get total liabilities (outstanding loans)
    const totalLiabilities = await calculateTotalOutstandingLoans();
    
    // Calculate net worth (assets - liabilities)
    const netWorth = totalAssets - totalLiabilities;
    
    // Get current economy phase
    const gameState = getGameState();
    const economyPhase: EconomyPhase = (gameState.economyPhase as EconomyPhase) || 'Stable';
    
    // Apply economy multiplier
    const economyMultiplier = ECONOMY_MARKET_CAP_MULTIPLIERS[economyPhase];
    const marketCap = netWorth * economyMultiplier;
    
    // Ensure market cap is never negative
    return Math.max(0, marketCap);
  } catch (error) {
    console.error('Error calculating market cap:', error);
    return 0;
  }
}

/**
 * Calculate share price for a company
 * Formula: share_price = market_cap / total_shares
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Share price in euros per share
 */
export async function calculateSharePrice(companyId?: string): Promise<number> {
  try {
    if (!companyId) {
      companyId = getCurrentCompanyId();
    }
    
    if (!companyId) {
      console.error('No company ID available for share price calculation');
      return 0;
    }

    // Get company data
    const company = await companyService.getCompany(companyId);
    if (!company) {
      console.error('Company not found for share price calculation');
      return 0;
    }

    // Get total shares (default to 1,000,000 if not set)
    const totalShares = company.totalShares || 1000000;
    
    if (totalShares === 0) {
      return 0;
    }

    // Calculate market cap
    const marketCap = await calculateMarketCap(companyId);
    
    // Calculate share price
    const sharePrice = marketCap / totalShares;
    
    return Math.max(0, sharePrice);
  } catch (error) {
    console.error('Error calculating share price:', error);
    return 0;
  }
}

/**
 * Update company's market value (market cap and share price)
 * This function calculates and persists the current market value to the database
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Success status and updated values
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

    // Calculate market cap and share price
    const marketCap = await calculateMarketCap(companyId);
    const sharePrice = await calculateSharePrice(companyId);
    
    // Update company in database
    const updateResult = await companyService.updateCompany(companyId, {
      marketCap,
      sharePrice
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
 * Returns cached values from company record if available, otherwise calculates fresh
 * 
 * @param companyId - Company ID (optional, uses current company if not provided)
 * @returns Market cap and share price
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

    // Get company data (may have cached values)
    const company = await companyService.getCompany(companyId);
    if (!company) {
      return { marketCap: 0, sharePrice: 0 };
    }

    // If we have cached values, return them (they should be updated regularly)
    // Otherwise calculate fresh
    if (company.marketCap !== undefined && company.sharePrice !== undefined) {
      return {
        marketCap: company.marketCap,
        sharePrice: company.sharePrice
      };
    }

    // Calculate fresh values
    const marketCap = await calculateMarketCap(companyId);
    const sharePrice = await calculateSharePrice(companyId);
    
    return { marketCap, sharePrice };
  } catch (error) {
    console.error('Error getting market value:', error);
    return { marketCap: 0, sharePrice: 0 };
  }
}

