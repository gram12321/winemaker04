export type OvergrowthMap = { vegetation: number; debris: number; uproot: number; replant: number };

export function calculateOvergrowthModifier(years: number, baseIncrease = 0.10, decayRate = 0.5, cap = 2.0): number {
  if (!years || years <= 0) return 0;
  const maxModifier = baseIncrease / decayRate;
  const curve = maxModifier * (1 - Math.pow(1 - decayRate, years));
  return Math.min(curve, cap);
}

export function combineOvergrowthYears(
  overgrowth: Partial<OvergrowthMap> | undefined,
  fields?: Array<keyof OvergrowthMap>,
  weights?: Partial<Record<keyof OvergrowthMap, number>>,
): number {
  const values: OvergrowthMap = {
    vegetation: Math.max(0, overgrowth?.vegetation ?? 0),
    debris: Math.max(0, overgrowth?.debris ?? 0),
    uproot: Math.max(0, overgrowth?.uproot ?? 0),
    replant: Math.max(0, overgrowth?.replant ?? 0),
  };
  const selected = fields?.length ? fields : ['vegetation', 'debris', 'uproot', 'replant'] as Array<keyof OvergrowthMap>;
  const defaults: Record<keyof OvergrowthMap, number> = { vegetation: 1, debris: 0.5, uproot: 1, replant: 1 };
  let total = 0;
  let totalWeight = 0;
  for (const field of selected) {
    const weight = weights?.[field] ?? defaults[field];
    total += values[field] * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? total / totalWeight : 0;
}
