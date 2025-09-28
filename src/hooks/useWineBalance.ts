// React hook for wine balance calculations
import { useMemo } from 'react';
import { WineBatch, WineCharacteristics, BalanceResult } from '../lib/types/types';
import { calculateWineBalance, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES } from '../lib/balance';

/**
 * Hook to calculate balance for a wine batch
 * @param wineBatch - Wine batch to calculate balance for
 * @returns BalanceResult with score and metadata
 */
export function useWineBatchBalance(wineBatch: WineBatch | null): BalanceResult | null {
  return useMemo(() => {
    if (!wineBatch) return null;
    return calculateWineBalance(wineBatch.characteristics, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES);
  }, [wineBatch]);
}

/**
 * Hook to calculate balance for wine characteristics
 * @param characteristics - Wine characteristics to calculate balance for  
 * @returns BalanceResult with score and metadata
 */
export function useWineBalance(characteristics: WineCharacteristics | null): BalanceResult | null {
  return useMemo(() => {
    if (!characteristics) return null;
    return calculateWineBalance(characteristics, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES);
  }, [characteristics]);
}

/**
 * Hook to get formatted balance score as percentage
 * @param balanceResult - Balance result from useWineBalance
 * @returns Formatted percentage string
 */
export function useFormattedBalance(balanceResult: BalanceResult | null): string {
  return useMemo(() => {
    if (!balanceResult) return '0%';
    return `${Math.round(balanceResult.score * 100)}%`;
  }, [balanceResult]);
}

/**
 * Hook to get balance quality description
 * @param balanceResult - Balance result from useWineBalance
 * @returns Quality description string
 */
export function useBalanceQuality(balanceResult: BalanceResult | null): string {
  return useMemo(() => {
    if (!balanceResult) return 'Unknown';
    
    const score = balanceResult.score;
    if (score >= 0.9) return 'Exceptional';
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.7) return 'Very Good';
    if (score >= 0.6) return 'Good';
    if (score >= 0.5) return 'Average';
    if (score >= 0.4) return 'Below Average';
    return 'Poor';
  }, [balanceResult]);
}
