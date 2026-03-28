// React hooks for wine structure index calculations
import { useMemo } from 'react';
import { WineBatch, WineCharacteristics, StructureIndexResult } from '../lib/types/types';
import { calculateStructureIndex, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES } from '../lib/wineStructure';
import { getWineStructureCategory } from '../lib/utils/utils';

/**
 * Hook to calculate structure index for a wine batch
 */
export function useWineBatchStructureIndex(wineBatch: WineBatch | null): StructureIndexResult | null {
  return useMemo(() => {
    if (!wineBatch) return null;
    return calculateStructureIndex(wineBatch.characteristics, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES);
  }, [wineBatch]);
}

/**
 * Hook to calculate structure index for wine characteristics
 */
export function useWineStructureIndex(characteristics: WineCharacteristics | null): StructureIndexResult | null {
  return useMemo(() => {
    if (!characteristics) return null;
    return calculateStructureIndex(characteristics, BASE_BALANCED_RANGES, RANGE_ADJUSTMENTS, RULES);
  }, [characteristics]);
}

/**
 * Hook to get formatted structure index as percentage
 */
export function useFormattedStructureIndex(structureResult: StructureIndexResult | null): string {
  return useMemo(() => {
    if (!structureResult) return '0%';
    return `${Math.round(structureResult.score * 100)}%`;
  }, [structureResult]);
}

/**
 * Hook to get structure tier label (uses getWineStructureCategory)
 */
export function useStructureIndexQuality(structureResult: StructureIndexResult | null): string {
  return useMemo(() => {
    if (!structureResult) return 'Unknown';
    return getWineStructureCategory(structureResult.score);
  }, [structureResult]);
}
