import { normalizeXP } from '@/lib/utils/calculator';

/** Applies learned XP to a primary skill without exceeding 1.0. */
export function calculateEffectiveSkill(baseSkill: number, rawXP: number): number {
  const safeBase = Math.max(0, Math.min(1, baseSkill));
  return safeBase + (normalizeXP(rawXP) * (1 - safeBase));
}
