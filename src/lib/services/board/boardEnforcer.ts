import { getShareholderBreakdown, calculateFinancialData, getShareMetrics } from '@/lib/services';
import { calculateBoardSatisfaction, getBoardSatisfactionBreakdown } from './boardSatisfactionService';
import { BOARD_CONSTRAINTS, OWNERSHIP_WEIGHT_FACTOR, type BoardConstraintType, type ScalingFormulaFinancialContext } from '@/lib/constants';
import type { BaseConstraintInfo } from '@/lib/types/constraintTypes';
import { companyService } from '../user/companyService';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Board enforcement result
 */
export interface BoardEnforcementResult {
  allowed: boolean;
  satisfaction?: number;
  limit?: number; // For scaling constraints
  message?: string;
}

/**
 * Financial context for board constraint evaluation
 * Use ScalingFormulaFinancialContext from @/lib/constants
 */
type BoardConstraintFinancialContext = ScalingFormulaFinancialContext;

/**
 * Board Enforcer Service
 * Singleton service for checking board constraints
 * Pattern mirrors researchEnforcer.ts
 * 
 * DESIGN PRINCIPLE:
 * - PRIMARY PARAMETER: Effective Satisfaction (satisfaction × (1 - non-player ownership % × OWNERSHIP_WEIGHT_FACTOR))
 *   This is the main driver for ALL board constraints. High satisfaction = lenient, low = strict.
 *   Higher non-player ownership = lower effective satisfaction = stricter constraints.
 *   OWNERSHIP_WEIGHT_FACTOR (default 0.5) reduces the harshness when player has minority ownership.
 * 
 * - SECONDARY PARAMETERS: Financial Context (cash, debt ratio, profit margins, etc.)
 *   Each constraint may use additional financial parameters as modifiers.
 *   Financial parameters can make constraints stricter even with high satisfaction.
 *   Example: High satisfaction + high debt = moderate limits (debt concern overrides satisfaction)
 *   Example: Low satisfaction + good finances = strict limits (satisfaction is primary)
 * 
 * Formula Pattern:
 *   limit = baseLimit * satisfactionMultiplier * financialMultiplier
 *   Satisfaction is PRIMARY (main driver), financial parameters are SECONDARY (modifiers)
 */
class BoardEnforcerService {
  /**
   * Check if an action is allowed given current board satisfaction
   * @param constraintType - Type of constraint to check
   * @param value - Optional value for scaling constraints (e.g., purchase amount, number of shares)
   * @param financialContext - Optional financial context (cash, debt ratio, etc.) for constraint evaluation
   * @returns Enforcement result with allowed status and details
   */
  async isActionAllowed(
    constraintType: BoardConstraintType,
    value?: any,
    financialContext?: BoardConstraintFinancialContext,
    preCalculatedValues?: {
      shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
      satisfaction?: number;
    }
  ): Promise<BoardEnforcementResult> {
    try {
      const breakdown = preCalculatedValues?.shareholderBreakdown ?? await getShareholderBreakdown();
      if (breakdown.playerPct >= 100) {
        return { allowed: true };
      }

      const satisfaction = preCalculatedValues?.satisfaction ?? await calculateBoardSatisfaction();
      const nonPlayerOwnershipPct = breakdown.nonPlayerOwnershipPct / 100;
      // Higher non-player ownership = lower effective satisfaction = stricter constraints
      // OWNERSHIP_WEIGHT_FACTOR reduces the impact to make it less harsh for minority ownership
      const effectiveSatisfaction = satisfaction * (1 - nonPlayerOwnershipPct * OWNERSHIP_WEIGHT_FACTOR);

      const constraint = BOARD_CONSTRAINTS[constraintType];
      if (!constraint) {
        console.warn(`No constraint configuration found for type: ${constraintType}`);
        return { allowed: true };
      }

      if (effectiveSatisfaction <= constraint.maxThreshold) {
        return {
          allowed: false,
          satisfaction: effectiveSatisfaction,
          message: constraint.message
        };
      }

      if (constraint.scalingFormula && value !== undefined) {
        // Pass both value and financial context to scaling formula
        const limit = constraint.scalingFormula(effectiveSatisfaction, value, financialContext);
        
        if (effectiveSatisfaction > constraint.startThreshold) {
          return {
            allowed: true,
            satisfaction: effectiveSatisfaction,
            limit
          };
        }

        // For yearly limits (share_issuance, share_buyback), check against yearly total
        let allowed: boolean;
        let customMessage: string | undefined = undefined;
        
        if (constraintType === 'share_issuance' && financialContext?.sharesIssuedThisYear !== undefined) {
          // Yearly limit: check if requested + already issued this year <= yearly limit
          const totalThisYear = (financialContext.sharesIssuedThisYear || 0) + value;
          allowed = totalThisYear <= limit;
          if (!allowed && limit !== null) {
            const remaining = Math.max(0, limit - (financialContext.sharesIssuedThisYear || 0));
            customMessage = `Share issuance exceeds board-approved yearly limit of ${limit.toLocaleString()} shares. Already issued ${(financialContext.sharesIssuedThisYear || 0).toLocaleString()} shares this year. Maximum allowed this year: ${limit.toLocaleString()} shares. Remaining: ${remaining.toLocaleString()} shares`;
          }
        } else if (constraintType === 'share_buyback' && financialContext?.sharesBoughtBackThisYear !== undefined) {
          // Yearly limit: check if requested + already bought back this year <= yearly limit
          const totalThisYear = (financialContext.sharesBoughtBackThisYear || 0) + value;
          allowed = totalThisYear <= limit;
          if (!allowed && limit !== null) {
            const remaining = Math.max(0, limit - (financialContext.sharesBoughtBackThisYear || 0));
            customMessage = `Share buyback exceeds board-approved yearly limit of ${limit.toLocaleString()} shares. Already bought back ${(financialContext.sharesBoughtBackThisYear || 0).toLocaleString()} shares this year. Maximum allowed this year: ${limit.toLocaleString()} shares. Remaining: ${remaining.toLocaleString()} shares`;
          }
        } else {
          // Per-operation limit: check if requested <= limit
          allowed = value <= limit;
        }
        
        return {
          allowed,
          satisfaction: effectiveSatisfaction,
          limit,
          message: allowed ? undefined : (customMessage || constraint.message)
        };
      }

      const allowed = effectiveSatisfaction > constraint.startThreshold;
      
      return {
        allowed,
        satisfaction: effectiveSatisfaction,
        message: allowed ? undefined : constraint.message
      };
    } catch (error) {
      console.error('Error checking board constraint:', error);
      return { allowed: true };
    }
  }

  /**
   * Get the maximum allowed value for a scaling constraint
   * @param constraintType - Type of constraint
   * @param contextValue - Context value (e.g., total balance for purchase limits)
   * @param financialContext - Optional financial context (cash, debt ratio, etc.) for constraint evaluation
   * @returns Maximum allowed value, or null if no scaling constraint
   */
  async getActionLimit(
    constraintType: BoardConstraintType,
    contextValue: any,
    financialContext?: BoardConstraintFinancialContext,
    preCalculatedValues?: {
      shareholderBreakdown?: Awaited<ReturnType<typeof getShareholderBreakdown>>;
      satisfaction?: number;
    }
  ): Promise<{ limit: number | null; satisfaction: number } | null> {
    try {
      const breakdown = preCalculatedValues?.shareholderBreakdown ?? await getShareholderBreakdown();
      if (breakdown.playerPct >= 100) {
        return { limit: null, satisfaction: 1.0 }; // No limit for full ownership
      }

      const constraint = BOARD_CONSTRAINTS[constraintType];
      if (!constraint || !constraint.scalingFormula) {
        return null;
      }

      const satisfaction = preCalculatedValues?.satisfaction ?? await calculateBoardSatisfaction();
      const nonPlayerOwnershipPct = breakdown.nonPlayerOwnershipPct / 100;
      // Higher non-player ownership = lower effective satisfaction = stricter constraints
      // OWNERSHIP_WEIGHT_FACTOR reduces the impact to make it less harsh for minority ownership
      const effectiveSatisfaction = satisfaction * (1 - nonPlayerOwnershipPct * OWNERSHIP_WEIGHT_FACTOR);

      if (effectiveSatisfaction > constraint.startThreshold) {
        return { limit: null, satisfaction: effectiveSatisfaction };
      }

      const limit = constraint.scalingFormula(effectiveSatisfaction, contextValue, financialContext);

      return { limit, satisfaction: effectiveSatisfaction };
    } catch (error) {
      console.error('Error getting action limit:', error);
      return null;
    }
  }

  /**
   * Get current board satisfaction score
   * @returns Satisfaction score (0-1)
   */
  async getBoardSatisfaction(): Promise<number> {
    try {
      return await calculateBoardSatisfaction();
    } catch (error) {
      console.error('Error getting board satisfaction:', error);
      return 1.0; // Default to full satisfaction on error
    }
  }

  /**
   * Get detailed board satisfaction breakdown
   * @returns Detailed breakdown with all components
   */
  async getSatisfactionBreakdown() {
    return await getBoardSatisfactionBreakdown();
  }

  /**
   * Generate BaseConstraintInfo for a constraint type
   * Generic helper that handles board constraint checking and generates the common constraint info
   * @param constraintType - Type of constraint to check
   * @param hardLimit - Hard limit value (regulatory/financial limit)
   * @param contextValue - Context value for scaling formula (e.g., total balance, total shares)
   * @param financialContext - Financial context for constraint evaluation
   * @param hardLimitReason - Reason for hard limit (e.g., "Insufficient cash balance")
   * @returns BaseConstraintInfo with board constraint details
   */
  async generateConstraintInfo(
    constraintType: BoardConstraintType,
    hardLimit: number,
    contextValue: any,
    financialContext?: BoardConstraintFinancialContext,
    hardLimitReason?: string
  ): Promise<BaseConstraintInfo & { boardLimit: number | null; hardLimit: number }> {
    const constraint = BOARD_CONSTRAINTS[constraintType];
    if (!constraint) {
      return {
        limitingConstraint: 'none',
        constraintReason: 'No constraint configuration',
        isBlocked: false,
        isLimited: false,
        boardLimit: null,
        hardLimit
      };
    }

    // Check if action is allowed (to determine blocked status)
    const boardCheck = await this.isActionAllowed(constraintType, 1, financialContext);
    
    let boardLimit: number | null = null;
    let boardSatisfaction: number | undefined = undefined;
    let boardReason = '';
    let isBlocked = false;
    let isLimited = false;
    let blockReason = '';

    if (!boardCheck.allowed) {
      // Operation is completely blocked by board
      isBlocked = true;
      const thresholdPercent = (constraint.maxThreshold * 100).toFixed(0);
      blockReason = boardCheck.message 
        ? boardCheck.message.replace('Board approval required', `Board approval (of at least ${thresholdPercent}% satisfaction) required`)
        : `Board approval (of at least ${thresholdPercent}% satisfaction) required. Board satisfaction is too low.`;
      boardSatisfaction = boardCheck.satisfaction;
    } else {
      // Check if it's limited (between startThreshold and maxThreshold)
      const boardLimitResult = await this.getActionLimit(constraintType, contextValue, financialContext);
      
      if (boardLimitResult) {
        boardSatisfaction = boardLimitResult.satisfaction;
        
        // Check if satisfaction is below startThreshold (limited but not blocked)
        if (boardSatisfaction !== undefined && boardSatisfaction <= constraint.startThreshold && boardSatisfaction > constraint.maxThreshold) {
          isLimited = true;
        }
        
        if (boardLimitResult.limit !== null) {
          boardLimit = boardLimitResult.limit;
          
          if (boardSatisfaction !== undefined) {
            boardReason = `Board satisfaction: ${(boardSatisfaction * 100).toFixed(1)}%`;
          }
        }
      }
    }

    // Determine which constraint is limiting
    let limitingConstraint: 'hard' | 'board' | 'none' = 'none';
    let constraintReason = '';

    if (isBlocked) {
      limitingConstraint = 'board';
      constraintReason = blockReason;
    } else if (hardLimit === 0) {
      limitingConstraint = 'hard';
      constraintReason = hardLimitReason || 'Hard limit reached';
    } else if (boardLimit !== null && boardLimit < hardLimit) {
      limitingConstraint = 'board';
      constraintReason = boardReason || 'Board approval required';
    } else {
      limitingConstraint = 'hard';
      constraintReason = hardLimitReason || 'Regulatory limits';
    }

    return {
      limitingConstraint,
      constraintReason,
      isBlocked,
      isLimited,
      blockReason: isBlocked ? blockReason : undefined,
      boardLimit,
      hardLimit,
      boardLimitDetails: boardLimit !== null || isBlocked ? {
        satisfaction: boardSatisfaction,
        reason: boardReason || blockReason
      } : undefined
    };
  }
}

// Export singleton instance
export const boardEnforcer = new BoardEnforcerService();

// Export class for testing
export { BoardEnforcerService };

/**
 * Get constraint info for vineyard purchases
 * Moved from shareOperationsService.ts - belongs here as it's board constraint logic
 */
export async function getVineyardPurchaseConstraintInfo(): Promise<BaseConstraintInfo & { maxAmount: number; hardLimit: number; boardLimit: number | null; currentBalance: number }> {
  try {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      return {
        maxAmount: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'No company selected',
        isBlocked: false,
        isLimited: false,
        currentBalance: 0
      };
    }

    const company = await companyService.getCompany(companyId);
    if (!company) {
      return {
        maxAmount: 0,
        limitingConstraint: 'none',
        hardLimit: 0,
        boardLimit: null,
        constraintReason: 'Company not found',
        isBlocked: false,
        isLimited: false,
        currentBalance: 0
      };
    }

    const currentMoney = company.money || 0;
    const hardLimit = currentMoney; // Hard limit is simply available cash

    // Prepare financial context
    const financialData = await calculateFinancialData('season');
    const shareMetrics = await getShareMetrics();
    
    const financialContext = {
      cashMoney: currentMoney,
      totalAssets: financialData.totalAssets,
      fixedAssets: financialData.fixedAssets,
      currentAssets: financialData.currentAssets,
      expensesPerSeason: financialData.expenses,
      profitMargin: shareMetrics.profitMargin || 0
    };

    // Generate constraint info using generic helper
    const constraintInfo = await boardEnforcer.generateConstraintInfo(
      'vineyard_purchase',
      hardLimit,
      currentMoney,
      financialContext,
      'Available cash balance'
    );

    // Add vineyard-specific details to board reason
    if (constraintInfo.boardLimitDetails && constraintInfo.boardLimitDetails.satisfaction !== undefined) {
      const fixedAssetRatio = financialData.totalAssets > 0 ? financialData.fixedAssets / financialData.totalAssets : 0;
      const nonFixedAssets = financialData.currentAssets + currentMoney;
      const requiredLiquidity = financialData.expenses * 2.5;
      
      let reason = constraintInfo.boardLimitDetails.reason || '';
      if (fixedAssetRatio > 0.70 && nonFixedAssets < requiredLiquidity) {
        reason += ` (Liquidity concern: Fixed assets ${(fixedAssetRatio * 100).toFixed(0)}%)`;
      }
      if (shareMetrics.profitMargin < 0) {
        reason += ` (Negative profit margin)`;
      } else if (shareMetrics.profitMargin < 0.05) {
        reason += ` (Low profit margin: ${(shareMetrics.profitMargin * 100).toFixed(1)}%)`;
      }
      
      constraintInfo.boardLimitDetails.reason = reason;
    }

    // Determine max amount (if blocked, maxAmount should be 0)
    const maxAmount = constraintInfo.isBlocked ? 0 : (constraintInfo.boardLimit !== null ? Math.min(hardLimit, constraintInfo.boardLimit) : hardLimit);

    return {
      ...constraintInfo,
      maxAmount,
      currentBalance: currentMoney
    };
  } catch (error) {
    console.error('Error calculating vineyard purchase constraint info:', error);
    return {
      maxAmount: 0,
      limitingConstraint: 'none',
      hardLimit: 0,
      boardLimit: null,
      constraintReason: 'Error calculating limits',
      isBlocked: false,
      isLimited: false,
      currentBalance: 0
    };
  }
}
