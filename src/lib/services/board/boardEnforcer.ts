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
   * @returns Enforcement result with allowed status and details
   */
  async isActionAllowed(
    constraintType: BoardConstraintType,
    value?: any
  ): Promise<BoardEnforcementResult> {
    try {
      const breakdown = await getShareholderBreakdown();
      if (breakdown.playerPct >= 100) {
        return { allowed: true };
      }

      const satisfaction = await calculateBoardSatisfaction();
      const nonPlayerOwnershipPct = breakdown.nonPlayerOwnershipPct / 100;
      const effectiveSatisfaction = satisfaction * nonPlayerOwnershipPct;

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
        const limit = constraint.scalingFormula(effectiveSatisfaction, value);
        
        if (effectiveSatisfaction > constraint.startThreshold) {
          return {
            allowed: true,
            satisfaction: effectiveSatisfaction,
            limit
          };
        }

        const allowed = value <= limit;
        
        return {
          allowed,
          satisfaction: effectiveSatisfaction,
          limit,
          message: allowed ? undefined : constraint.message
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
   * @returns Maximum allowed value, or null if no scaling constraint
   */
  async getActionLimit(
    constraintType: BoardConstraintType,
    contextValue: any
  ): Promise<{ limit: number | null; satisfaction: number } | null> {
    try {
      const breakdown = await getShareholderBreakdown();
      if (breakdown.playerPct >= 100) {
        return { limit: null, satisfaction: 1.0 }; // No limit for full ownership
      }

      const constraint = BOARD_CONSTRAINTS[constraintType];
      if (!constraint || !constraint.scalingFormula) {
        return null;
      }

      const satisfaction = await calculateBoardSatisfaction();
      const nonPlayerOwnershipPct = breakdown.nonPlayerOwnershipPct / 100;
      const effectiveSatisfaction = satisfaction * nonPlayerOwnershipPct;

      if (effectiveSatisfaction > constraint.startThreshold) {
        return { limit: null, satisfaction: effectiveSatisfaction };
      }

      const limit = constraint.scalingFormula(effectiveSatisfaction, contextValue);

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
}

// Export singleton instance
export const boardEnforcer = new BoardEnforcerService();

// Export class for testing
export { BoardEnforcerService };
