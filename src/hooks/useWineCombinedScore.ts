import { useMemo } from 'react';
import { WineBatch } from '@/lib/types/types';
import { calculateWineScore } from '@/lib/services/wine/winescore/wineScoreCalculation';
import { getGrapeQualityCategory, getGrapeQualityDescription, getColorClass, getBadgeColorClasses, formatPercent } from '@/lib/utils/utils';

/**
 * Hook to calculate and format wine score
 * @param wineBatch - The wine batch to calculate wine score for
 * @returns Wine score result with formatted display values
 */
export function useWineCombinedScore(wineBatch: WineBatch | null): {
  score: number;
  formattedScore: string;
  category: string;
  colorClass: string;
  badgeClasses: { text: string; bg: string };
  description: string;
} | null {
  return useMemo(() => {
    if (!wineBatch) return null;

    const score = calculateWineScore(wineBatch);
    const formattedScore = formatPercent(score, 1, true);
    const category = getGrapeQualityCategory(score);
    const colorClass = getColorClass(score);
    const badgeClasses = getBadgeColorClasses(score);
    const description = getGrapeQualityDescription(score);

    return {
      score,
      formattedScore,
      category,
      colorClass,
      badgeClasses,
      description
    };
  }, [wineBatch]);
}

/**
 * Hook to get wine score for multiple wine batches
 * @param wineBatches - Array of wine batches
 * @returns Array of wine score results
 */
export function useWineBatchesCombinedScore(wineBatches: WineBatch[]): Array<{
  batchId: string;
  score: number;
  formattedScore: string;
  category: string;
  colorClass: string;
  badgeClasses: { text: string; bg: string };
  description: string;
}> {
  return useMemo(() => {
    return wineBatches.map(batch => {
      const result = useWineCombinedScore(batch);
      return {
        batchId: batch.id,
        score: result?.score || 0,
        formattedScore: result?.formattedScore || '0.0%',
        category: result?.category || 'Unknown',
        colorClass: result?.colorClass || 'text-gray-600',
        badgeClasses: result?.badgeClasses || { text: 'text-gray-600', bg: 'bg-gray-100' },
        description: result?.description || 'Unable to calculate score'
      };
    });
  }, [wineBatches]);
}
