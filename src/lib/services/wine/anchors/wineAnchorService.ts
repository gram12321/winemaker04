/**
 * Wine anchors (0–1) on `WineBatch.wineAnchors` — **upstream** definition of the wine.
 *
 * Flow: **anchors → characteristics / structure / flavor** (taste layer is derived for the player, not an input here).
 * Harvest anchors use only **grape constants**, **vineyard**, **ripeness**, **land value** — never harvested `WineCharacteristics`
 * (avoids circular dependency with `modifyHarvestCharacteristics`).
 *
 * - **Harvest**: `computeHarvestWineAnchors`
 * - **Crush / ferment**: `wineAnchorProcess.ts`
 * - **Life / faults**: `applyFeatureLayerAnchors` (uses prior anchors + grape priors + features, not tasted characteristics)
 */
import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import { ASPECT_SUN_EXPOSURE_OFFSETS } from '@/lib/constants/vineyardConstants';
import { calculateGrapeSuitabilityMetrics } from '@/lib/services/vineyard/vineyardValueCalc';
import { GrapeVariety, Vineyard, Aspect, WineAnchorValues } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

// =============================================================================
// Shared math
// =============================================================================

export function weightedMean(pairs: ReadonlyArray<{ value: number; weight: number }>): number {
  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  if (totalWeight <= 0) return 0;
  return pairs.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
}

// =============================================================================
// Grape variety priors (identity + juice hints)
// =============================================================================

const GRAPE_VARIETY_PRIORS: Record<
  GrapeVariety,
  { sweetness: number; aromatic: number; phenolic: number; spice: number }
> = {
  Barbera: { sweetness: 0.35, aromatic: 0.5, phenolic: 0.55, spice: 0.45 },
  Chardonnay: { sweetness: 0.55, aromatic: 0.65, phenolic: 0.3, spice: 0.35 },
  'Pinot Noir': { sweetness: 0.45, aromatic: 0.7, phenolic: 0.45, spice: 0.4 },
  Primitivo: { sweetness: 0.7, aromatic: 0.55, phenolic: 0.75, spice: 0.6 },
  'Sauvignon Blanc': { sweetness: 0.3, aromatic: 0.75, phenolic: 0.25, spice: 0.25 },
  Tempranillo: { sweetness: 0.45, aromatic: 0.5, phenolic: 0.72, spice: 0.65 },
  Sangiovese: { sweetness: 0.35, aromatic: 0.55, phenolic: 0.62, spice: 0.55 }
};

// =============================================================================
// Site helpers (used only inside harvest computation)
// =============================================================================

function aspectSunNorm(aspect: Aspect): number {
  const raw = ASPECT_SUN_EXPOSURE_OFFSETS[aspect as keyof typeof ASPECT_SUN_EXPOSURE_OFFSETS] ?? 0;
  return clamp01((raw + 0.2) / 0.32);
}

/** Warm vs cool slope buckets (S-facing vs E/W vs N). */
function aspectWarmthFromAspect(aspect: Aspect): number {
  if (aspect === 'South' || aspect === 'Southeast' || aspect === 'Southwest') return 0.75;
  if (aspect === 'East' || aspect === 'West') return 0.6;
  return 0.4;
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

/** Peak maturity ~8–28 years; very young / very old taper. Exported for reuse outside anchors. */
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

// =============================================================================
// Keys & defaults (DB parse / previews)
// =============================================================================

export const WINE_ANCHOR_KEYS = [
  'residualSugar',
  'alcoholPotential',
  'juiceAcidity',
  'phenolicExtract',
  'aromaticIntensity',
  'textureRichness',
  'leesContact',
  'crushingExtraction',
  'fermentationProfile',
  'skinContactEvolution',
  'regionalTypicity',
  'soilAffinity',
  'solarClimateFit',
  'vineAgeCharacter',
  'rowCompetition',
  'siteWildness',
  'siteAltitude',
  'aspectWarmth',
  'microclimateBlend',
  'vineyardHealth',
  'harvestTiming',
  'varietyCharacter',
  'colorIntensity',
  'oxidativeCharacter',
  'cellarEvolution',
  'featureFootprint'
] as const satisfies readonly (keyof WineAnchorValues)[];

const ANCHOR_KEYS = WINE_ANCHOR_KEYS;

const MID = 0.5;

/**
 * Every anchor at 0.5 — the implicit state when nothing has nudged a key yet.
 * Prefer `resolveWineAnchors(batch.wineAnchors)` when reading; persist real values once harvest/process runs.
 */
export const NEUTRAL_WINE_ANCHORS: WineAnchorValues = {
  residualSugar: MID,
  alcoholPotential: MID,
  juiceAcidity: MID,
  phenolicExtract: MID,
  aromaticIntensity: MID,
  textureRichness: MID,
  leesContact: MID,
  crushingExtraction: MID,
  fermentationProfile: MID,
  skinContactEvolution: MID,
  regionalTypicity: MID,
  soilAffinity: MID,
  solarClimateFit: MID,
  vineAgeCharacter: MID,
  rowCompetition: MID,
  siteWildness: MID,
  siteAltitude: MID,
  aspectWarmth: MID,
  microclimateBlend: MID,
  vineyardHealth: MID,
  harvestTiming: MID,
  varietyCharacter: MID,
  colorIntensity: MID,
  oxidativeCharacter: MID,
  cellarEvolution: MID,
  featureFootprint: MID
};

/** Missing/null `wineAnchors` means “never set” → treat as neutral 0.5 on all keys. */
export function resolveWineAnchors(anchors: WineAnchorValues | undefined | null): WineAnchorValues {
  return anchors ?? NEUTRAL_WINE_ANCHORS;
}

// =============================================================================
// Harvest: compute full anchor set
// =============================================================================

export function computeHarvestWineAnchors(
  vineyard: Vineyard,
  grape: GrapeVariety,
  opts: { minAltitude: number; maxAltitude: number; ripeness: number; landValueModifier: number }
): WineAnchorValues {
  const grapeData = GRAPE_CONST[grape];
  const grapeProfile = grapeData.baseCharacteristics;
  const priors = GRAPE_VARIETY_PRIORS[grape];
  const ripenessNorm = clamp01(opts.ripeness);
  /** Variety sugar signal from genetics + vintage ripeness only (not harvested taste stats). */
  const varietySugarSignal = clamp01(grapeProfile.sweetness * 0.52 + ripenessNorm * 0.48);
  const aspectN = aspectSunNorm(vineyard.aspect);
  const aspectWarmth = aspectWarmthFromAspect(vineyard.aspect);
  const altN = altitudeNorm(vineyard.altitude, opts.minAltitude, opts.maxAltitude);
  const isRed = grapeData.grapeColor === 'red';
  const landNorm = clamp01(opts.landValueModifier);
  const healthNorm = clamp01(vineyard.vineyardHealth ?? 0.5);
  const vineAgeLinear = clamp01((vineyard.vineAge ?? 25) / 40);
  const soilMinRaw = soilKeywordMinerality(vineyard.soil);
  const pending = vineyard.pendingFeatures || [];
  const pendingFeatureDensity =
    pending.length > 0 ? pending.filter((f) => f.isPresent && f.severity > 0).length / pending.length : 0;

  const metrics = calculateGrapeSuitabilityMetrics(
    grape,
    vineyard.region,
    vineyard.country,
    vineyard.altitude,
    vineyard.aspect,
    vineyard.soil
  );

  const regionalTypicity = metrics.region;
  const solarClimateFit = metrics.sunExposure;
  const soilAffinity = clamp01(0.62 * metrics.soil + 0.38 * soilMinRaw);

  const rowCompetition = normalizeRowCompetition(vineyard.density);
  const siteWildness = siteWildnessFromOvergrowth(vineyard);

  const siteAltitude = clamp01(
    weightedMean([
      { value: altN, weight: 0.7 },
      { value: landNorm, weight: 0.2 },
      { value: 1 - aspectWarmth, weight: 0.1 }
    ])
  );

  const windFeel = clamp01(
    weightedMean([
      { value: 1 - aspectWarmth, weight: 0.3 },
      { value: altN, weight: 0.3 },
      { value: 1 - soilMinRaw, weight: 0.1 },
      { value: 1 - healthNorm, weight: 0.3 }
    ])
  );
  const heatFeel = clamp01(
    weightedMean([
      { value: ripenessNorm, weight: 0.35 },
      { value: aspectWarmth, weight: 0.25 },
      { value: 1 - altN, weight: 0.2 },
      { value: varietySugarSignal, weight: 0.2 }
    ])
  );
  const diurnalFeel = clamp01(
    weightedMean([
      { value: altN, weight: 0.35 },
      { value: grapeProfile.acidity, weight: 0.25 },
      { value: 1 - aspectWarmth, weight: 0.2 },
      { value: grapeProfile.aroma, weight: 0.2 }
    ])
  );
  const microclimateBlend = clamp01(
    weightedMean([
      { value: windFeel, weight: 0.33 },
      { value: heatFeel, weight: 0.34 },
      { value: diurnalFeel, weight: 0.33 }
    ])
  );

  const vineyardHealth = clamp01(
    weightedMean([
      { value: healthNorm, weight: 0.6 },
      { value: 1 - pendingFeatureDensity, weight: 0.2 },
      { value: vineAgeLinear, weight: 0.2 }
    ])
  );

  const harvestTiming = clamp01(
    weightedMean([
      { value: ripenessNorm, weight: 0.45 },
      { value: varietySugarSignal, weight: 0.2 },
      { value: 1 - grapeProfile.acidity, weight: 0.2 },
      { value: aspectWarmth, weight: 0.15 }
    ])
  );

  const vineAgeCharacter = clamp01(
    weightedMean([
      { value: normalizeVineWoodMaturity(vineyard.vineAge), weight: 0.5 },
      { value: vineAgeLinear, weight: 0.2 },
      { value: healthNorm, weight: 0.15 },
      { value: landNorm, weight: 0.15 }
    ])
  );

  // --- Juice & chemistry (variety genetics + site + ripeness only) ---
  const residualSugar = clamp01(
    weightedMean([
      { value: varietySugarSignal, weight: 0.42 },
      { value: ripenessNorm, weight: 0.2 },
      { value: grapeProfile.sweetness, weight: 0.15 },
      { value: aspectN, weight: 0.08 },
      { value: 1 - altN, weight: 0.05 },
      { value: solarClimateFit, weight: 0.08 },
      { value: regionalTypicity, weight: 0.02 }
    ])
  );

  const alcoholPotential = clamp01(
    weightedMean([
      { value: ripenessNorm, weight: 0.3 },
      { value: varietySugarSignal, weight: 0.22 },
      { value: aspectN, weight: 0.16 },
      { value: grapeProfile.body, weight: 0.17 },
      { value: solarClimateFit, weight: 0.1 },
      { value: regionalTypicity, weight: 0.05 }
    ])
  );

  const juiceAcidity = clamp01(
    weightedMean([
      { value: grapeProfile.acidity, weight: 0.65 },
      { value: altN, weight: 0.15 },
      { value: 1 - ripenessNorm, weight: 0.1 },
      { value: aspectN, weight: 0.1 }
    ])
  );

  const phenolicStress = clamp01(0.82 + 0.22 * rowCompetition);
  const tanninFromVariety = clamp01(grapeProfile.tannins * (0.62 + 0.38 * ripenessNorm));
  const phenolicBase = clamp01(tanninFromVariety * (isRed ? 1 : 0.38));
  const colorLayer = isRed
    ? clamp01(tanninFromVariety * (0.55 + 0.45 * ripenessNorm) * phenolicStress)
    : 0.02;
  const phenolicExtract = clamp01(
    weightedMean([
      { value: clamp01(phenolicBase * (0.75 + 0.25 * ripenessNorm) * phenolicStress), weight: 0.72 },
      { value: colorLayer, weight: 0.28 }
    ])
  );

  const aromaticIntensity = clamp01(
    weightedMean([
      { value: grapeProfile.aroma, weight: 0.55 },
      { value: ripenessNorm, weight: 0.2 },
      { value: soilAffinity, weight: 0.1 },
      { value: siteWildness, weight: 0.08 },
      { value: regionalTypicity, weight: 0.07 }
    ])
  );

  const textureRichness = clamp01(
    weightedMean([
      { value: grapeProfile.body, weight: 0.44 },
      { value: ripenessNorm, weight: 0.26 },
      { value: residualSugar, weight: 0.18 },
      { value: soilAffinity, weight: 0.12 }
    ])
  );

  const varietyCharacter = clamp01(
    weightedMean([
      { value: 0.5, weight: 0.2 },
      { value: priors.spice, weight: 0.25 },
      { value: priors.aromatic, weight: 0.25 },
      { value: priors.phenolic, weight: 0.3 }
    ])
  );

  const colorIntensity = clamp01(
    weightedMean([
      { value: isRed ? 1 : 0, weight: 0.85 },
      { value: priors.phenolic, weight: 0.15 }
    ])
  );

  const skinContactEvolution = clamp01(
    weightedMean([
      { value: 0.4, weight: 0.6 },
      { value: priors.phenolic, weight: 0.2 },
      { value: grapeProfile.tannins, weight: 0.2 }
    ])
  );

  const oxidativeCharacter = clamp01(
    weightedMean([
      { value: clamp01(grapeData.proneToOxidation), weight: 0.35 },
      { value: pendingFeatureDensity, weight: 0.2 },
      { value: 1 - juiceAcidity, weight: 0.25 },
      { value: 1 - healthNorm, weight: 0.2 }
    ])
  );

  const cellarEvolution = clamp01(grapeProfile.spice * 0.22);

  return {
    residualSugar,
    alcoholPotential,
    juiceAcidity,
    phenolicExtract,
    aromaticIntensity,
    textureRichness,
    leesContact: 0.28,
    crushingExtraction: 0.35,
    fermentationProfile: 0.35,
    skinContactEvolution,
    regionalTypicity,
    soilAffinity,
    solarClimateFit,
    vineAgeCharacter,
    rowCompetition,
    siteWildness,
    siteAltitude,
    aspectWarmth: clamp01(
      weightedMean([
        { value: aspectWarmth, weight: 0.65 },
        { value: ripenessNorm, weight: 0.2 },
        { value: 1 - altN, weight: 0.15 }
      ])
    ),
    microclimateBlend,
    vineyardHealth,
    harvestTiming,
    varietyCharacter,
    colorIntensity,
    oxidativeCharacter,
    cellarEvolution,
    featureFootprint: clamp01(pendingFeatureDensity)
  };
}

// =============================================================================
// Merge & DB
// =============================================================================

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
  const base = { ...NEUTRAL_WINE_ANCHORS };
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const o = raw as Record<string, unknown>;
  const partial =
    o.values && typeof o.values === 'object' && o.values !== null
      ? (o.values as Partial<Record<keyof WineAnchorValues, number>>)
      : (o as Partial<Record<keyof WineAnchorValues, number>>);

  const out = { ...base };
  for (const k of ANCHOR_KEYS) {
    const v = partial[k];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      out[k] = clamp01(v);
    }
  }
  return out;
}
