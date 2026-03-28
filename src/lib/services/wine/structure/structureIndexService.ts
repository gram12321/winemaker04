import { WineBatch } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

/**
 * Transitional alias layer: "Structure" maps to existing balance data.
 * This keeps naming aligned with the Taste-system redesign without
 * requiring a full storage migration in the same change.
 */
export function getStructureIndex(batch: WineBatch): number {
  return clamp01(batch.balance);
}

