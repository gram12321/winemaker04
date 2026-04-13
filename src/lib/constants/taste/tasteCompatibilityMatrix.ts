/**
 * Pairwise flavor-family synergy (+) / clash (-) weights for harmony in
 * `docs/TasteSystem_WineFolly_Research.md` (flavor domain).
 * Sparse: missing pairs default to 0 (neutral).
 */
import { FLAVOR_FAMILY_IDS, type FlavorFamilyId } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

function pairKey(a: FlavorFamilyId, b: FlavorFamilyId): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function coeff(a: FlavorFamilyId, b: FlavorFamilyId, w: number): Record<string, number> {
  return { [pairKey(a, b)]: w };
}

/** Symmetric coefficients C[a,b] in roughly [-0.55, 0.55]. */
const FLAVOR_PAIR_COEFFS: Record<string, number> = {
  ...coeff('tropicalFruit', 'generalAging', -0.42),
  ...coeff('tropicalFruit', 'oakAging', -0.22),
  ...coeff('citrus', 'flower', 0.28),
  ...coeff('citrus', 'treeFruit', 0.22),
  ...coeff('blackFruit', 'oakAging', 0.35),
  ...coeff('blackFruit', 'spiceFlavor', 0.24),
  ...coeff('redFruit', 'spiceFlavor', 0.2),
  ...coeff('driedFruit', 'oakAging', 0.26),
  ...coeff('driedFruit', 'generalAging', 0.18),
  ...coeff('microbial', 'citrus', 0.16),
  ...coeff('microbial', 'treeFruit', 0.12),
  ...coeff('earth', 'spiceFlavor', 0.2),
  ...coeff('earth', 'oakAging', 0.15),
  ...coeff('vegetable', 'citrus', 0.1),
  ...coeff('vegetable', 'flower', -0.15),
  ...coeff('faults', 'flower', -0.38),
  ...coeff('faults', 'citrus', -0.22),
  ...coeff('faults', 'treeFruit', -0.2),
  ...coeff('redFruit', 'blackFruit', 0.18),
  ...coeff('flower', 'treeFruit', 0.2),
  ...coeff('spiceFlavor', 'oakAging', 0.14)
};

/**
 * Doc: harmonyRaw = sum C[a][b] fa fb / sum fa fb over a<b; harmony = clamp01(0.5 + 0.5 * harmonyRaw).
 */
export function computeFlavorHarmonyFromMatrix(profile: Record<FlavorFamilyId, number>): number {
  let numerator = 0;
  let denominator = 0;
  const ids = FLAVOR_FAMILY_IDS;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const fa = profile[ids[i]];
      const fb = profile[ids[j]];
      const prod = fa * fb;
      denominator += prod;
      const c = FLAVOR_PAIR_COEFFS[pairKey(ids[i], ids[j])] ?? 0;
      numerator += c * prod;
    }
  }
  if (denominator < 1e-9) return 0.5;
  const harmonyRaw = numerator / denominator;
  const clampedRaw = Math.max(-1, Math.min(1, harmonyRaw));
  return clamp01(0.5 + 0.5 * clampedRaw);
}
