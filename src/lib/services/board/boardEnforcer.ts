import { getCurrentCompanyId } from '@/lib/utils/companyUtils';
import { getShareholderBreakdown } from '@/lib/services';
import { calculateBoardSatisfaction, getBoardSatisfactionBreakdown } from './boardSatisfactionService';
import { BOARD_CONSTRAINTS, type BoardConstraintType } from '@/lib/constants';

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
 * Board Enforcer Service
 * Singleton service for checking board constraints
 * Pattern mirrors researchEnforcer.ts
 */
class BoardEnforcerService {
  /**
   * Check if an action is allowed given current board satisfaction
   * @param constraintType - Type of constraint to check
   * @param value - Optional value for scaling constraints (e.g., purchase amount, number of shares)
   * @param companyId - Optional company ID (defaults to current company)
   * @returns Enforcement result with allowed status and details
   */
  async isActionAllowed(
    constraintType: BoardConstraintType,
    value?: any,
    companyId?: string
  ): Promise<BoardEnforcementResult> {
    try {
      const targetCompanyId = companyId || getCurrentCompanyId();
      if (!targetCompanyId) {
        return { allowed: false, message: 'No company ID available' };
      }

      // 1. Check player ownership - if 100%, always allow
      const breakdown = await getShareholderBreakdown(targetCompanyId);
      if (breakdown.playerPct >= 100) {
        return { allowed: true };
      }

      // 2. Calculate BoardSatisfaction (uses current company)
      // Note: boardEnforcer supports checking different companies, but underlying service uses current company
      // For now, if companyId is provided, we still use current company (may need refactoring later)
      const satisfaction = await calculateBoardSatisfaction();

      // 3. Get constraint config
      const constraint = BOARD_CONSTRAINTS[constraintType];
      if (!constraint) {
        console.warn(`No constraint configuration found for type: ${constraintType}`);
        return { allowed: true }; // Default to allowed if constraint not defined
      }

      // 4. Check max threshold (action is forbidden)
      if (satisfaction <= constraint.maxThreshold) {
        return {
          allowed: false,
          satisfaction,
          message: constraint.message
        };
      }

      // 5. For scaling constraints, calculate limit and check
      if (constraint.scalingFormula && value !== undefined) {
        const limit = constraint.scalingFormula(satisfaction, value);
        
        // If satisfaction is above start threshold, no limit (full freedom)
        if (satisfaction > constraint.startThreshold) {
          return {
            allowed: true,
            satisfaction,
            limit
          };
        }

        // Between max and start threshold: apply scaling
        const allowed = value <= limit;
        
        return {
          allowed,
          satisfaction,
          limit,
          message: allowed ? undefined : constraint.message
        };
      }

      // 6. For threshold-only constraints
      const allowed = satisfaction > constraint.startThreshold;
      
      return {
        allowed,
        satisfaction,
        message: allowed ? undefined : constraint.message
      };
    } catch (error) {
      console.error('Error checking board constraint:', error);
      // On error, default to allowed to avoid blocking players
      return { allowed: true };
    }
  }

  /**
   * Get the maximum allowed value for a scaling constraint
   * @param constraintType - Type of constraint
   * @param contextValue - Context value (e.g., total balance for purchase limits)
   * @param companyId - Optional company ID (defaults to current company)
   * @returns Maximum allowed value, or null if no scaling constraint
   */
  async getActionLimit(
    constraintType: BoardConstraintType,
    contextValue: any,
    companyId?: string
  ): Promise<{ limit: number | null; satisfaction: number } | null> {
    try {
      const targetCompanyId = companyId || getCurrentCompanyId();
      if (!targetCompanyId) {
        return null;
      }

      // Check if 100% player owned
      const breakdown = await getShareholderBreakdown(targetCompanyId);
      if (breakdown.playerPct >= 100) {
        return { limit: null, satisfaction: 1.0 }; // No limit for full ownership
      }

      const constraint = BOARD_CONSTRAINTS[constraintType];
      if (!constraint || !constraint.scalingFormula) {
        return null; // Not a scaling constraint
      }

      const satisfaction = await calculateBoardSatisfaction();

      // If satisfaction is above start threshold, no limit
      if (satisfaction > constraint.startThreshold) {
        return { limit: null, satisfaction };
      }

      // Calculate limit
      const limit = constraint.scalingFormula(satisfaction, contextValue);

      return { limit, satisfaction };
    } catch (error) {
      console.error('Error getting action limit:', error);
      return null;
    }
  }

  /**
   * Get current board satisfaction score
   * @param companyId - Optional company ID (defaults to current company)
   * @returns Satisfaction score (0-1)
   */
  async getBoardSatisfaction(_companyId?: string): Promise<number> {
    try {
      // Note: Currently always uses current company; companyId parameter kept for API compatibility
      return await calculateBoardSatisfaction();
    } catch (error) {
      console.error('Error getting board satisfaction:', error);
      return 1.0; // Default to full satisfaction on error
    }
  }

  /**
   * Get detailed board satisfaction breakdown
   * @param _companyId - Optional company ID (currently ignored, uses current company)
   * @returns Detailed breakdown with all components
   */
  async getSatisfactionBreakdown(_companyId?: string) {
    // Note: Currently always uses current company; companyId parameter kept for API compatibility
    return await getBoardSatisfactionBreakdown();
  }
}

// Export singleton instance
export const boardEnforcer = new BoardEnforcerService();

// Export class for testing
export { BoardEnforcerService };
