/**
 * Common constraint information interface
 * Base interface for all constraint types
 */
export interface BaseConstraintInfo {
  limitingConstraint: 'hard' | 'board' | 'none';
  constraintReason: string;
  isBlocked: boolean; // True if operation is completely blocked (cannot proceed at all)
  isLimited: boolean; // True if operation is limited but still allowed
  blockReason?: string; // Reason for blocking (if isBlocked is true)
  boardLimitDetails?: {
    satisfaction?: number;
    reason?: string;
  };
}

/**
 * Constraint display type
 * Determines how the constraint should be displayed in the UI
 */
export type ConstraintDisplayType = 
  | 'single_max' // Single maximum value (shares, currency)
  | 'range' // Min/max range (dividend rates)
  | 'currency' // Currency amount with current balance context
  | 'shares'; // Share count

/**
 * Common constraint display props
 * Used by the shared ConstraintDisplay component
 */
export interface ConstraintDisplayProps {
  constraintInfo: BaseConstraintInfo | null;
  displayType: ConstraintDisplayType;
  
  // For single_max display
  maxValue?: number;
  hardLimit?: number;
  boardLimit?: number | null;
  valueLabel?: string; // e.g., "shares", "€"
  formatOptions?: {
    currency?: boolean;
    decimals?: number;
    forceDecimals?: boolean;
  };
  
  // For range display
  minValue?: number;
  maxValueRange?: number;
  hardMinValue?: number;
  hardMaxValue?: number;
  boardMinValue?: number | null;
  boardMaxValue?: number | null;
  rangeLabel?: string; // e.g., "/share"
  
  // For currency display
  currentBalance?: number;
  
  // For shares display
  sharePrice?: number; // Optional: to show value equivalent
  
  // Custom formatting function
  formatValue?: (value: number) => string;
}

