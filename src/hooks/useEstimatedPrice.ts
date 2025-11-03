import { useMemo } from 'react';
import { WineBatch } from '@/lib/types/types';
import { calculateEstimatedPrice } from '@/lib/services';

export function useEstimatedPrice(wineBatch: WineBatch | null): number {
  return useMemo(() => {
    if (!wineBatch) return 0;
    // Use service calculation; prestige/vineyard multipliers can be added later if needed
    return calculateEstimatedPrice(wineBatch as any, undefined as any);
  }, [wineBatch]);
}


