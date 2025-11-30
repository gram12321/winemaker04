import { clamp01 } from './utils';

/**
 * Shared utility for calculating consistency scores from historical data
 * Used for both share price valuation and board satisfaction
 */

/**
 * Calculate consistency score from historical volatility
 * Returns 0-1 scale where 1 = most consistent (low volatility)
 * 
 * @param historicalValues - Array of historical values to analyze
 * @param currentValue - Current value to include in analysis
 * @param minSamples - Minimum number of samples required (default: 4)
 * @param defaultScore - Default score when insufficient data (default: 0.7)
 * @param maxStdDev - Maximum standard deviation for normalization (default: 0.3)
 * @returns Consistency score (0-1) where 1 is most consistent
 */
export function calculateConsistencyScore(
  historicalValues: number[],
  currentValue: number,
  minSamples: number = 4,
  defaultScore: number = 0.7,
  maxStdDev: number = 0.3
): number {
  if (historicalValues.length < minSamples) {
    return defaultScore;
  }

  // Include current value in analysis
  const allValues = [...historicalValues, currentValue];
  
  // Calculate standard deviation
  const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
  const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
  const stdDev = Math.sqrt(variance);

  // Normalize volatility: stdDev of 0 = perfect consistency (1.0), 
  // stdDev of maxStdDev = very inconsistent (0.0)
  const consistencyScore = clamp01(1 - (stdDev / maxStdDev));
  
  return consistencyScore;
}

/**
 * Calculate volatility from historical values
 * Returns 0-1 scale where 0 = most consistent (low volatility), 1 = most volatile
 * 
 * @param historicalValues - Array of historical values to analyze
 * @param currentValue - Current value to include in analysis
 * @param minSamples - Minimum number of samples required (default: 4)
 * @param defaultVolatility - Default volatility when insufficient data (default: 0.3)
 * @param maxStdDev - Maximum standard deviation for normalization (default: 0.3)
 * @returns Volatility score (0-1) where 0 is most consistent
 */
export function calculateVolatility(
  historicalValues: number[],
  currentValue: number,
  minSamples: number = 4,
  defaultVolatility: number = 0.3,
  maxStdDev: number = 0.3
): number {
  if (historicalValues.length < minSamples) {
    return defaultVolatility;
  }

  const allValues = [...historicalValues, currentValue];
  const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
  const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-1: 0 = no volatility, 1 = max volatility
  return clamp01(stdDev / maxStdDev);
}

