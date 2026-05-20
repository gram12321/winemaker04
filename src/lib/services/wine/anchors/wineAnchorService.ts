import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { ASPECT_SUN_EXPOSURE_OFFSETS } from '@/lib/constants/vineyardConstants';
import { calculateGrapeSuitabilityMetrics } from '@/lib/services/vineyard/vineyardValueCalc';
import { GrapeVariety, Vineyard, Aspect, WineAnchorValues } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

export function weightedMean(pairs: ReadonlyArray<{ value: number; weight: number }>): number {
  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  if (totalWeight <= 0) return 0;
  return pairs.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
}

function aspectSunNorm(aspect: Aspect): number {
  const raw = ASPECT_SUN_EXPOSURE_OFFSETS[aspect as keyof typeof ASPECT_SUN_EXPOSURE_OFFSETS] ?? 0;
  return clamp01((raw + 0.2) / 0.32);
}

function altitudeNorm(altitude: number, minAlt: number, maxAlt: number): number {
  if (maxAlt <= minAlt) return 0.5;
  return clamp01((altitude - minAlt) / (maxAlt - minAlt));
}

function soilKeywordMinerality(soil: string[] | undefined): number {
  if (!soil?.length) return 0.5;
  const lower = soil.map((s) => s.toLowerCase());
  const n = lower.filter(
    (s) =>
      s.includes('chalk') ||
      s.includes('limestone') ||
      s.includes('slate') ||
      s.includes('gravel') ||
      s.includes('volcanic')
  ).length;
  return clamp01(n / lower.length);
}

export function normalizeVineWoodMaturity(vineAge: number | null): number {
  if (vineAge == null || !Number.isFinite(vineAge)) return 0.5;
  const age = Math.max(0, Math.min(80, vineAge));
  if (age <= 4) return clamp01(0.12 + age * 0.06);
  if (age <= 28) return clamp01(0.36 + ((age - 4) / 24) * 0.5);
  return clamp01(0.86 - Math.min(age - 28, 40) * 0.008);
}

export function normalizeRowCompetition(density: number): number {
  const d = Number.isFinite(density) && density > 0 ? density : 5000;
  const clamped = Math.max(2500, Math.min(12000, d));
  return clamp01((clamped - 2500) / 9500);
}

function siteWildnessFromOvergrowth(vineyard: Vineyard): number {
  const o = vineyard.overgrowth;
  if (!o) return 0.06;
  const veg = clamp01(Math.min(o.vegetation ?? 0, 10) / 10);
  const deb = clamp01(Math.min(o.debris ?? 0, 10) / 10);
  const uproot = clamp01(Math.min(o.uproot ?? 0, 10) / 40);
  return clamp01(0.06 + 0.42 * veg + 0.38 * deb + 0.14 * uproot);
}

export const WINE_ANCHOR_KEYS = [
  'sugarPotential',
  'acidPotential',
  'phenolicPotential',
  'aromaticPotential',
  'bodyPotential',
  'extractionState',
  'fermentationState',
  'leesState',
  'oxidationPressure',
  'maturationState',
  'terroirExpression',
  'processFootprint'
] as const satisfies readonly (keyof WineAnchorValues)[];

const ANCHOR_KEYS = WINE_ANCHOR_KEYS;
const MID = 0.5;

export const NEUTRAL_WINE_ANCHORS: WineAnchorValues = {
  sugarPotential: MID,
  acidPotential: MID,
  phenolicPotential: MID,
  aromaticPotential: MID,
  bodyPotential: MID,
  extractionState: MID,
  fermentationState: MID,
  leesState: MID,
  oxidationPressure: MID,
  maturationState: MID,
  terroirExpression: MID,
  processFootprint: MID
};

export function resolveWineAnchors(anchors: WineAnchorValues | undefined | null): WineAnchorValues {
  return anchors ?? NEUTRAL_WINE_ANCHORS;
}

export function computeHarvestWineAnchors(
  vineyard: Vineyard,
  grape: GrapeVariety,
  opts: { minAltitude: number; maxAltitude: number; ripeness: number; landValueModifier: number }
): WineAnchorValues {
  const grapeData = GRAPE_CONST[grape];
  const base = grapeData.baseCharacteristics;
  const ripeness = clamp01(opts.ripeness);
  const land = clamp01(opts.landValueModifier);
  const health = clamp01(vineyard.vineyardHealth ?? 0.5);
  const altitude = altitudeNorm(vineyard.altitude, opts.minAltitude, opts.maxAltitude);
  const aspectSun = aspectSunNorm(vineyard.aspect);
  const soilMinerality = soilKeywordMinerality(vineyard.soil);
  const vineAgeMaturity = normalizeVineWoodMaturity(vineyard.vineAge);
  const rowCompetition = normalizeRowCompetition(vineyard.density);
  const siteWildness = siteWildnessFromOvergrowth(vineyard);

  const suitability = calculateGrapeSuitabilityMetrics(
    grape,
    vineyard.region,
    vineyard.country,
    vineyard.altitude,
    vineyard.aspect,
    vineyard.soil
  );

  const siteSignal = clamp01(
    weightedMean([
      { value: suitability.overall, weight: 0.35 },
      { value: suitability.region, weight: 0.2 },
      { value: suitability.soil, weight: 0.15 },
      { value: suitability.sunExposure, weight: 0.12 },
      { value: land, weight: 0.1 },
      { value: health, weight: 0.08 }
    ])
  );

  const sugarPotential = clamp01(
    weightedMean([
      { value: base.sweetness, weight: 0.35 },
      { value: ripeness, weight: 0.35 },
      { value: aspectSun, weight: 0.15 },
      { value: 1 - altitude, weight: 0.15 }
    ])
  );

  const acidPotential = clamp01(
    weightedMean([
      { value: base.acidity, weight: 0.45 },
      { value: 1 - ripeness, weight: 0.25 },
      { value: altitude, weight: 0.15 },
      { value: suitability.sunExposure, weight: 0.15 }
    ])
  );

  const isRed = grapeData.grapeColor === 'red';
  const phenolicPotential = clamp01(
    weightedMean([
      { value: base.tannins * (isRed ? 1 : 0.4), weight: 0.45 },
      { value: ripeness, weight: 0.2 },
      { value: rowCompetition, weight: 0.15 },
      { value: isRed ? 1 : 0.2, weight: 0.1 },
      { value: health, weight: 0.1 }
    ])
  );

  const aromaticPotential = clamp01(
    weightedMean([
      { value: base.aroma, weight: 0.45 },
      { value: siteSignal, weight: 0.2 },
      { value: soilMinerality, weight: 0.12 },
      { value: siteWildness, weight: 0.08 },
      { value: ripeness, weight: 0.15 }
    ])
  );

  const bodyPotential = clamp01(
    weightedMean([
      { value: base.body, weight: 0.4 },
      { value: sugarPotential, weight: 0.25 },
      { value: phenolicPotential, weight: 0.15 },
      { value: ripeness, weight: 0.2 }
    ])
  );

  const oxidationPressure = clamp01(
    weightedMean([
      { value: clamp01(grapeData.proneToOxidation), weight: 0.4 },
      { value: 1 - acidPotential, weight: 0.3 },
      { value: 1 - health, weight: 0.2 },
      { value: ripeness, weight: 0.1 }
    ])
  );

  const maturationState = clamp01(
    weightedMean([
      { value: base.spice, weight: 0.45 },
      { value: vineAgeMaturity, weight: 0.25 },
      { value: siteSignal, weight: 0.2 },
      { value: ripeness, weight: 0.1 }
    ])
  );

  const terroirExpression = clamp01(
    weightedMean([
      { value: siteSignal, weight: 0.35 },
      { value: soilMinerality, weight: 0.15 },
      { value: altitude, weight: 0.12 },
      { value: vineAgeMaturity, weight: 0.1 },
      { value: rowCompetition, weight: 0.08 },
      { value: 1 - siteWildness, weight: 0.08 },
      { value: health, weight: 0.12 }
    ])
  );

  const pending = vineyard.pendingFeatures || [];
  const pendingDensity =
    pending.length > 0 ? pending.filter((f) => f.isPresent && f.severity > 0).length / pending.length : 0;

  return {
    sugarPotential,
    acidPotential,
    phenolicPotential,
    aromaticPotential,
    bodyPotential,
    extractionState: 0.35,
    fermentationState: 0.35,
    leesState: 0.28,
    oxidationPressure,
    maturationState,
    terroirExpression,
    processFootprint: clamp01(pendingDensity)
  };
}

export function combineWineAnchorSets(
  a: WineAnchorValues,
  b: WineAnchorValues,
  weightA: number,
  weightB: number
): WineAnchorValues {
  const total = weightA + weightB;
  if (total <= 0) return a;
  const wa = weightA / total;
  const wb = weightB / total;
  const out = {} as WineAnchorValues;
  for (const k of ANCHOR_KEYS) {
    out[k] = clamp01(a[k] * wa + b[k] * wb);
  }
  return out;
}

export function parseWineAnchorsFromDb(raw: unknown): WineAnchorValues {
  const out = { ...NEUTRAL_WINE_ANCHORS };
  if (!raw || typeof raw !== 'object') {
    return out;
  }

  const o = raw as Record<string, unknown>;
  const partial =
    o.values && typeof o.values === 'object' && o.values !== null
      ? (o.values as Partial<Record<string, number>>)
      : (o as Partial<Record<string, number>>);

  for (const k of ANCHOR_KEYS) {
    const v = partial[k];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      out[k] = clamp01(v);
    }
  }

  return out;
}
