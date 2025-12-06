/**
 * Board Constants
 * Defines board satisfaction weighting factors and constraint configurations
 */

/**
 * Types of constraints that the board can enforce
 */
export type BoardConstraintType =
  | 'share_issuance'
  | 'share_buyback'
  | 'dividend_change'
  | 'vineyard_purchase'
  | 'staff_hiring'
  // | 'major_expenditure'; // Future: large purchases (commented out until framework supports other major expenditures)

/**
 * Financial context for scaling formulas
 * Provides additional financial parameters that can modify constraint limits
 */
export interface ScalingFormulaFinancialContext {
  cashMoney?: number; // Available cash
  totalAssets?: number; // Total company assets
  fixedAssets?: number; // Fixed assets (vineyards, buildings)
  currentAssets?: number; // Current assets (wine, grapes, inventory)
  debtRatio?: number; // Total debt / total assets (0-1)
  profitMargin?: number; // Profit margin (0-1)
  expensesPerSeason?: number; // Expenses per season (for liquidity calculations)
  outstandingShares?: number; // For share operations
  totalShares?: number; // For share operations
  sharePrice?: number; // Current share price
  oldRate?: number; // For dividend changes (current dividend rate)
  sharesIssuedThisYear?: number; // For share issuance yearly limit tracking
  sharesBoughtBackThisYear?: number; // For share buyback yearly limit tracking
  [key: string]: any; // Allow additional context-specific parameters
}

/**
 * Scaling formula function type
 * @param satisfaction - Effective satisfaction score (0-1) - PRIMARY parameter
 * @param value - Context value (e.g., total balance, number of shares, dividend rate)
 * @param financialContext - Optional financial context - SECONDARY parameters (cash, debt ratio, etc.)
 * @returns Maximum allowed value
 * 
 * DESIGN PRINCIPLE: Satisfaction is PRIMARY driver, financial parameters are SECONDARY modifiers
 * Formula pattern: limit = baseLimit * satisfactionMultiplier * financialMultiplier
 */
export type ScalingFormula = (
  satisfaction: number,
  value: any,
  financialContext?: ScalingFormulaFinancialContext
) => number;

/**
 * Board constraint configuration
 */
export interface BoardConstraint {
  type: BoardConstraintType;
  startThreshold: number; // Satisfaction level where constraints start (e.g., 0.8)
  maxThreshold: number; // Satisfaction level where action is forbidden (e.g., 0.2)
  scalingFormula?: ScalingFormula; // Dynamic limit calculation (for scaling constraints)
  message: string; // Error message when blocked
}

/**
 * Board Satisfaction Component Weights
 * Formula: Satisfaction = (performance × 0.40) + (stability × 0.25) + (consistency × 0.20)
 * Effective Satisfaction (for constraints) = Satisfaction × NonPlayerOwnership%
 */
export const BOARD_SATISFACTION_WEIGHTS = {
  performanceScore: 0.40,
  stabilityScore: 0.25,
  consistencyScore: 0.20
} as const;

/**
 * Default satisfaction values
 */
export const BOARD_SATISFACTION_DEFAULTS = {
  newCompany: 0.8 // Default for new companies (generous starting value)
} as const;

/**
 * Board constraint configurations
 */
export const BOARD_CONSTRAINTS: Record<BoardConstraintType, BoardConstraint> = {
  vineyard_purchase: {
    type: 'vineyard_purchase',
    startThreshold: 0.8,
    maxThreshold: 0.2,
    scalingFormula: (
      satisfaction: number,
      totalBalance: number,
      financialContext?: ScalingFormulaFinancialContext
    ): number => {
      // PRIMARY: Satisfaction-based limit
      // Limit = (1 - BoardSatisfaction) % of balance
      // As satisfaction decreases, allowed percentage decreases
      const allowedPercent = 1 - satisfaction;
      const baseLimit = totalBalance * allowedPercent;
      
      // SECONDARY: Financial modifiers
      // Board is concerned about liquidity: too much value in fixed assets leaves no room for operations
      // Want to maintain sufficient non-fixed assets (cash + current assets) relative to expenses
      const fixedAssets = financialContext?.fixedAssets || 0;
      const currentAssets = financialContext?.currentAssets || 0;
      const totalAssets = financialContext?.totalAssets || totalBalance;
      const expensesPerSeason = financialContext?.expensesPerSeason || 0;
      const profitMargin = financialContext?.profitMargin || 0;
      
      let financialMultiplier = 1.0;
      
      // Liquidity concern: if fixed asset ratio is very high, board restricts new fixed asset purchases
      // Target: keep at least 2-3 seasons of expenses in non-fixed assets (cash + current assets)
      if (totalAssets > 0 && expensesPerSeason > 0) {
        const fixedAssetRatio = fixedAssets / totalAssets;
        const nonFixedAssets = currentAssets + (financialContext?.cashMoney || 0);
        const requiredLiquidity = expensesPerSeason * 2.5; // 2.5 seasons of expenses
        
        // If fixed asset ratio > 70% AND liquidity is below requirement, restrict purchases
        if (fixedAssetRatio > 0.70 && nonFixedAssets < requiredLiquidity) {
          const liquidityShortfall = (requiredLiquidity - nonFixedAssets) / requiredLiquidity; // 0 to 1
          const ratioPenalty = (fixedAssetRatio - 0.70) / 0.30; // 0 to 1 (70% to 100% fixed assets)
          const combinedPenalty = Math.min(1.0, liquidityShortfall * 0.7 + ratioPenalty * 0.3);
          financialMultiplier = 1.0 - (combinedPenalty * 0.6); // Reduce by up to 60%
        }
      }
      
      // Profit margin concern: if profit margin is negative or very low, board is more cautious
      // Low profits mean less ability to service debt or cover expenses
      if (profitMargin < 0) {
        // Negative profit: reduce limit significantly
        financialMultiplier *= 0.4;
      } else if (profitMargin < 0.05) {
        // Low profit margin (< 5%): reduce limit moderately
        const marginPenalty = (0.05 - profitMargin) / 0.05; // 0 to 1
        financialMultiplier *= (1.0 - marginPenalty * 0.3); // Reduce by up to 30%
      }
      
      return baseLimit * financialMultiplier;
    },
    message: 'Board approval required for vineyard purchases. Your purchase exceeds the approved budget limit.'
  },
  
  share_issuance: {
    type: 'share_issuance',
    startThreshold: 0.6,
    maxThreshold: 0.3,
    scalingFormula: (
      satisfaction: number,
      _requestedShares: number, // Requested shares (not used in calculation, but provided for context)
      financialContext?: ScalingFormulaFinancialContext
    ): number => {
      // PRIMARY: Satisfaction-based limit (per-year, like buyback)
      // Higher satisfaction = more shares allowed per year
      // Formula: maxShares = totalShares * (0.2 + satisfaction * 0.3)
      // Range: 20% (low satisfaction) to 50% (high satisfaction) of total shares per year
      // NOTE: This is a per-year limit. Hard financial constraints also enforce:
      //   - 50% per operation (regulatory)
      //   - 100% per year (regulatory)
      const totalShares = financialContext?.totalShares || 0;
      if (totalShares === 0) return 0;
      
      const satisfactionMultiplier = 0.2 + (satisfaction * 0.3); // 0.2 to 0.5
      const baseLimit = Math.floor(totalShares * satisfactionMultiplier);
      
      // SECONDARY: Financial modifiers
      // If share price is very low, board is more cautious about dilution
      const sharePrice = financialContext?.sharePrice || 0;
      let financialMultiplier = 1.0;
      
      if (sharePrice < 0.50) {
        // Share price below €0.50: reduce limit by up to 30%
        const pricePenalty = (0.50 - sharePrice) / 0.50; // 0 to 1
        financialMultiplier = 1.0 - (pricePenalty * 0.3); // 1.0 to 0.7
      }
      
      const boardLimit = Math.floor(baseLimit * financialMultiplier);
      
      // CRITICAL: Never exceed hard financial constraint (100% of total shares per year)
      // The per-operation limit (50%) is enforced separately in checkIssuanceFinancialConstraints
      const hardLimit = Math.floor(totalShares * 1.0); // 100% per year
      return Math.min(boardLimit, hardLimit);
    },
    message: 'Board approval required for share issuance. Board satisfaction is too low to approve new share issuance.'
  },
  
  share_buyback: {
    type: 'share_buyback',
    startThreshold: 0.5,
    maxThreshold: 0.2,
    scalingFormula: (
      satisfaction: number,
      _requestedShares: number, // Requested shares (not used directly, but cost calculated from it)
      financialContext?: ScalingFormulaFinancialContext
    ): number => {
      // PRIMARY: Satisfaction-based limit
      // Higher satisfaction = more shares allowed for buyback
      // Formula: maxShares = outstandingShares * (0.10 + satisfaction * 0.15)
      // Range: 10% (low satisfaction) to 25% (high satisfaction) of outstanding shares per year
      // NOTE: Hard financial constraint limits to 25% per year, so board constraint must not exceed this
      const outstandingShares = financialContext?.outstandingShares || 0;
      if (outstandingShares === 0) return 0;
      
      const satisfactionMultiplier = 0.10 + (satisfaction * 0.15); // 0.10 to 0.25
      const baseLimit = Math.floor(outstandingShares * satisfactionMultiplier);
      
      // SECONDARY: Financial modifiers
      // Board is more cautious if debt is high or cash is low
      // NOTE: Hard constraint blocks at debt ratio > 30%, so board only reduces at 20%+
      const debtRatio = financialContext?.debtRatio || 0;
      const cashMoney = financialContext?.cashMoney || 0;
      const sharePrice = financialContext?.sharePrice || 0;
      
      let financialMultiplier = 1.0;
      
      // Debt ratio penalty: if debt > 20%, reduce limit (hard constraint blocks at 30%)
      if (debtRatio > 0.20) {
        const debtPenalty = Math.min((debtRatio - 0.20) / 0.10, 1.0); // 0 to 1 (debt 20% to 30%)
        financialMultiplier *= (1.0 - debtPenalty * 0.5); // Reduce by up to 50%
      }
      
      // Cash availability penalty: if buyback would use > 50% of cash, reduce limit
      // Estimate cost using baseLimit to check cash availability
      if (cashMoney > 0 && sharePrice > 0) {
        const estimatedCost = baseLimit * sharePrice;
        const cashUsageRatio = estimatedCost / cashMoney;
        if (cashUsageRatio > 0.5) {
          const cashPenalty = Math.min((cashUsageRatio - 0.5) / 0.5, 1.0); // 0 to 1 (50% to 100% usage)
          financialMultiplier *= (1.0 - cashPenalty * 0.4); // Reduce by up to 40%
        }
      }
      
      const boardLimit = Math.floor(baseLimit * financialMultiplier);
      
      // CRITICAL: Never exceed hard financial constraint (25% of outstanding shares per year)
      const hardLimit = Math.floor(outstandingShares * 0.25);
      return Math.min(boardLimit, hardLimit);
    },
    message: 'Board approval required for share buyback. Board satisfaction is too low to approve share repurchases.'
  },
  
  dividend_change: {
    type: 'dividend_change',
    startThreshold: 0.5,
    maxThreshold: 0.3,
    scalingFormula: (
      satisfaction: number,
      newRate: number,
      financialContext?: ScalingFormulaFinancialContext
    ): number => {
      // PRIMARY: Satisfaction-based limit
      // Higher satisfaction = larger dividend changes allowed
      // Formula: maxChangePercent = 0.03 + satisfaction * 0.07
      // Range: 3% (low satisfaction) to 10% (high satisfaction) change per season
      // NOTE: Hard financial constraint limits decreases to 10%, so board constraint must not exceed this for decreases
      const oldRate = financialContext?.oldRate || 0;
      if (oldRate === 0) {
        // No current dividend: return maximum allowed rate based on cash reserves
        // Hard constraint requires 1 year reserves (4 seasons), board uses same requirement
        const cashMoney = financialContext?.cashMoney || 0;
        const totalShares = financialContext?.totalShares || 1;
        const maxByCash = totalShares > 0 ? cashMoney / (4 * totalShares) : 0; // 1 year reserves
        return maxByCash;
      }
      
      const satisfactionMultiplier = 0.03 + (satisfaction * 0.07); // 0.03 to 0.10
      const maxChangePercent = satisfactionMultiplier;
      const baseMaxRate = oldRate * (1 + maxChangePercent); // Maximum allowed increase
      const baseMinRate = oldRate * (1 - maxChangePercent); // Minimum allowed decrease
      
      // SECONDARY: Financial modifiers
      // Board is more cautious if cash reserves are low or profit margins are negative
      const cashMoney = financialContext?.cashMoney || 0;
      const totalShares = financialContext?.totalShares || 0;
      const profitMargin = financialContext?.profitMargin || 0;
      
      let increaseMultiplier = 1.0; // For increases
      let decreaseMultiplier = 1.0; // For decreases (usually less restricted)
      
      // Cash reserves check: need at least 1 year of payments (4 seasons)
      // Hard constraint already enforces this, but board can be more restrictive
      const paymentPerSeason = newRate * totalShares;
      const requiredCash = paymentPerSeason * 4;
      if (cashMoney < requiredCash && newRate > oldRate) {
        // Increasing dividend without sufficient cash reserves: reduce allowed increase
        const cashShortfall = (requiredCash - cashMoney) / requiredCash; // 0 to 1
        increaseMultiplier = Math.max(0.1, 1.0 - cashShortfall * 0.9); // Reduce by up to 90%
      }
      
      // Profit margin check: if negative or very low, be more restrictive on increases
      if (profitMargin < 0) {
        // Negative profit: very restrictive on increases
        increaseMultiplier *= 0.3;
      } else if (profitMargin < 0.05) {
        // Low profit margin (< 5%): reduce increases
        const marginPenalty = (0.05 - profitMargin) / 0.05; // 0 to 1
        increaseMultiplier *= (1.0 - marginPenalty * 0.5); // Reduce by up to 50%
      }
      
      // Apply financial multipliers to limits
      let maxRate = baseMaxRate * increaseMultiplier;
      let minRate = Math.max(0, baseMinRate * decreaseMultiplier);
      
      // CRITICAL: For decreases, never exceed hard financial constraint (10% decrease max)
      // Hard constraint allows max 10% decrease, so board constraint must not exceed this
      const hardMinRate = oldRate * 0.9; // 10% decrease max
      minRate = Math.max(minRate, hardMinRate);
      
      // Return maximum allowed rate (for increases) or minimum allowed rate (for decreases)
      // The calling code will check if newRate is within bounds
      if (newRate > oldRate) {
        return maxRate; // Maximum allowed rate for increases
      } else {
        return minRate; // Minimum allowed rate for decreases (capped at 10% decrease)
      }
    },
    message: 'Board approval required for dividend changes. Board satisfaction is too low to approve dividend modifications.'
  },
  
  staff_hiring: {
    type: 'staff_hiring',
    startThreshold: 0.7,
    maxThreshold: 0.4,
    message: 'Board approval required for staff hiring. Board satisfaction is too low to approve new staff hires.'
  }
  
  // TODO: Re-enable when framework supports other major expenditures beyond vineyard purchases
  // major_expenditure: {
  //   type: 'major_expenditure',
  //   startThreshold: 0.6,
  //   maxThreshold: 0.3,
  //   scalingFormula: (satisfaction: number, totalBalance: number): number => {
  //     // Major expenditures (large purchases) follow same pattern as vineyard purchases
  //     const allowedPercent = 1 - satisfaction;
  //     return totalBalance * allowedPercent;
  //   },
  //   message: 'Board approval required for major expenditures. This purchase exceeds the approved budget limit.'
  // }
} as const;
