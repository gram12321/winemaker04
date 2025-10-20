export type OvergrowthMap = { vegetation: number; debris: number; uproot: number; replant: number };

// Generic diminishing-returns overgrowth modifier (shared by clearing and planting)
// years: non-negative number of years since relevant maintenance
// baseIncrease: base per-year increase (e.g., 0.10)
// decayRate: diminishing factor (e.g., 0.5)
// cap: maximum allowed modifier (e.g., 2.0)
export function calculateOvergrowthModifier(
  years: number,
  baseIncrease: number = 0.10,
  decayRate: number = 0.5,
  cap: number = 2.0
): number {
  if (!years || years <= 0) return 0;
  const maxModifier = baseIncrease / decayRate;
  const curve = maxModifier * (1 - Math.pow(1 - decayRate, years));
  return Math.min(curve, cap);
}

// Weighted average of selected overgrowth fields with default weights
// If fields not provided, use all fields. Defaults: vegetation=1, debris=0.5, uproot=1, replant=1
export function combineOvergrowthYears(
  overgrowth: Partial<OvergrowthMap> | undefined,
  fields?: Array<keyof OvergrowthMap>,
  weights?: Partial<Record<keyof OvergrowthMap, number>>
): number {
  const og: OvergrowthMap = {
    vegetation: Math.max(0, overgrowth?.vegetation ?? 0),
    debris: Math.max(0, overgrowth?.debris ?? 0),
    uproot: Math.max(0, overgrowth?.uproot ?? 0),
    replant: Math.max(0, overgrowth?.replant ?? 0),
  };

  const selected: Array<keyof OvergrowthMap> = fields && fields.length ? fields : ['vegetation', 'debris', 'uproot', 'replant'];
  const defaultWeights: Record<keyof OvergrowthMap, number> = { vegetation: 1, debris: 0.5, uproot: 1, replant: 1 };
  let total = 0;
  let totalWeight = 0;
  for (const f of selected) {
    const w = (weights && weights[f] !== undefined ? weights[f]! : defaultWeights[f]);
    total += og[f] * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? total / totalWeight : 0;
}
