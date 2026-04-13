/**
 * Descriptor / flavor normalization from `docs/TasteSystem_WineFolly_Research.md`.
 */
import { clamp01 } from '@/lib/utils/utils';

export const MIN_TASTE_FLOOR = 0.005;

/**
 * `profile = MIN + (1-MIN) * sigmoid((raw - 0.5) * 4)` with raw clamped to [0, 1] first.
 */
export function normalizeTasteScalar(raw: number): number {
  const x = clamp01(raw);
  const sig = 1 / (1 + Math.exp(-(x - 0.5) * 4));
  return clamp01(MIN_TASTE_FLOOR + (1 - MIN_TASTE_FLOOR) * sig);
}
