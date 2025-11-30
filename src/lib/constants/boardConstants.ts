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
  | 'major_expenditure'; // Future: large purchases

/**
 * Scaling formula function type
 * @param satisfaction - Board satisfaction score (0-1)
 * @param value - Context value (e.g., total balance for purchase limits)
 * @returns Maximum allowed value
 */
export type ScalingFormula = (satisfaction: number, value: any) => number;

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
 * Effective Satisfaction (for constraints) = Satisfaction × OutsideShare%
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
    scalingFormula: (satisfaction: number, totalBalance: number): number => {
      // Limit = (1 - BoardSatisfaction) % of balance
      // As satisfaction decreases, allowed percentage decreases
      const allowedPercent = 1 - satisfaction;
      return totalBalance * allowedPercent;
    },
    message: 'Board approval required for vineyard purchases. Your purchase exceeds the approved budget limit.'
  },
  
  share_issuance: {
    type: 'share_issuance',
    startThreshold: 0.6,
    maxThreshold: 0.3,
    message: 'Board approval required for share issuance. Board satisfaction is too low to approve new share issuance.'
  },
  
  share_buyback: {
    type: 'share_buyback',
    startThreshold: 0.5,
    maxThreshold: 0.2,
    message: 'Board approval required for share buyback. Board satisfaction is too low to approve share repurchases.'
  },
  
  dividend_change: {
    type: 'dividend_change',
    startThreshold: 0.5,
    maxThreshold: 0.3,
    message: 'Board approval required for dividend changes. Board satisfaction is too low to approve dividend modifications.'
  },
  
  staff_hiring: {
    type: 'staff_hiring',
    startThreshold: 0.7,
    maxThreshold: 0.4,
    message: 'Board approval required for staff hiring. Board satisfaction is too low to approve new staff hires.'
  },
  
  major_expenditure: {
    type: 'major_expenditure',
    startThreshold: 0.6,
    maxThreshold: 0.3,
    scalingFormula: (satisfaction: number, totalBalance: number): number => {
      // Major expenditures (large purchases) follow same pattern as vineyard purchases
      const allowedPercent = 1 - satisfaction;
      return totalBalance * allowedPercent;
    },
    message: 'Board approval required for major expenditures. This purchase exceeds the approved budget limit.'
  }
} as const;
