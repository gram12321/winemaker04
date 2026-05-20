import { GRAPE_CONST } from '@/lib/constants/grapeConstants';
import {
  FLAVOR_FAMILY_IDS,
  type FlavorFamilyId,
  type GrapeVariety,
  type WineBatch,
  type WineFlavorFamilyProfile
} from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';
import { computeWineTasteProfile } from './wineTasteProfileService';

type GrapeColor = 'red' | 'white';

export interface TasteQualityContext {
  grape: GrapeVariety;
  grapeColor: GrapeColor;
}

interface TasteTargetSeed {
  ideal: number;
  width: number;
  weight: number;
}

interface TasteTargetState extends TasteTargetSeed {
  reasons: string[];
}

export interface TasteQualityFamilyBreakdown {
  current: number;
  ideal: number;
  acceptedRange: [number, number];
  score: number;
  weight: number;
  reasons: string[];
}

export interface TasteQualityIndexResult {
  tasteQualityIndex: number;
  families: Record<FlavorFamilyId, TasteQualityFamilyBreakdown>;
}

interface TasteDependencyRule {
  source: FlavorFamilyId;
  threshold: number;
  target: FlavorFamilyId;
  idealDelta: number;
  widthDelta?: number;
  context?: GrapeColor;
  reason: string;
}

// TODO: Descriptor-level scoring belongs in a later typicity layer. The core
// taste quality score intentionally uses only the 14 family values for now.
const RED_BASE_TARGETS: Record<FlavorFamilyId, TasteTargetSeed> = {
  flower: { ideal: 0.22, width: 0.18, weight: 0.65 },
  citrus: { ideal: 0.18, width: 0.16, weight: 0.8 },
  treeFruit: { ideal: 0.24, width: 0.18, weight: 0.85 },
  tropicalFruit: { ideal: 0.08, width: 0.1, weight: 1.1 },
  redFruit: { ideal: 0.48, width: 0.22, weight: 1.25 },
  blackFruit: { ideal: 0.38, width: 0.22, weight: 1.15 },
  driedFruit: { ideal: 0.24, width: 0.18, weight: 0.9 },
  spiceFlavor: { ideal: 0.28, width: 0.18, weight: 0.95 },
  vegetable: { ideal: 0.14, width: 0.12, weight: 0.9 },
  earth: { ideal: 0.26, width: 0.18, weight: 0.9 },
  microbial: { ideal: 0.16, width: 0.14, weight: 0.65 },
  oakAging: { ideal: 0.2, width: 0.18, weight: 0.75 },
  generalAging: { ideal: 0.18, width: 0.16, weight: 0.75 },
  faults: { ideal: 0.02, width: 0.055, weight: 2.3 }
};

const WHITE_BASE_TARGETS: Record<FlavorFamilyId, TasteTargetSeed> = {
  flower: { ideal: 0.32, width: 0.2, weight: 0.9 },
  citrus: { ideal: 0.42, width: 0.22, weight: 1.15 },
  treeFruit: { ideal: 0.46, width: 0.22, weight: 1.15 },
  tropicalFruit: { ideal: 0.24, width: 0.18, weight: 0.85 },
  redFruit: { ideal: 0.05, width: 0.08, weight: 0.8 },
  blackFruit: { ideal: 0.035, width: 0.07, weight: 0.95 },
  driedFruit: { ideal: 0.14, width: 0.14, weight: 0.75 },
  spiceFlavor: { ideal: 0.14, width: 0.13, weight: 0.75 },
  vegetable: { ideal: 0.16, width: 0.14, weight: 0.75 },
  earth: { ideal: 0.2, width: 0.16, weight: 0.75 },
  microbial: { ideal: 0.18, width: 0.16, weight: 0.7 },
  oakAging: { ideal: 0.12, width: 0.14, weight: 0.75 },
  generalAging: { ideal: 0.1, width: 0.12, weight: 0.75 },
  faults: { ideal: 0.02, width: 0.05, weight: 2.3 }
};

const GRAPE_TARGET_NUDGES: Record<GrapeVariety, Partial<Record<FlavorFamilyId, number>>> = {
  Barbera: {
    redFruit: 0.06,
    blackFruit: 0.04,
    citrus: 0.04,
    driedFruit: -0.02
  },
  Chardonnay: {
    treeFruit: 0.06,
    tropicalFruit: 0.04,
    microbial: 0.07,
    oakAging: 0.08,
    citrus: -0.03
  },
  'Pinot Noir': {
    redFruit: 0.1,
    blackFruit: -0.07,
    flower: 0.05,
    earth: 0.06,
    oakAging: -0.04,
    driedFruit: -0.03
  },
  Primitivo: {
    blackFruit: 0.12,
    driedFruit: 0.1,
    redFruit: 0.04,
    spiceFlavor: 0.05,
    tropicalFruit: -0.03
  },
  'Sauvignon Blanc': {
    citrus: 0.12,
    flower: 0.06,
    vegetable: 0.07,
    oakAging: -0.06,
    microbial: -0.03
  },
  Sangiovese: {
    redFruit: 0.08,
    driedFruit: 0.03,
    spiceFlavor: 0.04,
    earth: 0.06,
    citrus: 0.02
  },
  Tempranillo: {
    blackFruit: 0.06,
    redFruit: 0.04,
    driedFruit: 0.06,
    spiceFlavor: 0.06,
    oakAging: 0.08,
    earth: 0.04
  }
};

const DEPENDENCY_RULES: TasteDependencyRule[] = [
  {
    source: 'redFruit',
    threshold: 0.5,
    target: 'blackFruit',
    idealDelta: 0.16,
    widthDelta: 0.02,
    context: 'red',
    reason: 'High red fruit wants darker fruit support.'
  },
  {
    source: 'redFruit',
    threshold: 0.5,
    target: 'driedFruit',
    idealDelta: 0.1,
    widthDelta: 0.01,
    context: 'red',
    reason: 'High red fruit tolerates some concentration.'
  },
  {
    source: 'redFruit',
    threshold: 0.5,
    target: 'spiceFlavor',
    idealDelta: 0.08,
    context: 'red',
    reason: 'High red fruit benefits from spice support.'
  },
  {
    source: 'redFruit',
    threshold: 0.5,
    target: 'tropicalFruit',
    idealDelta: -0.1,
    widthDelta: -0.04,
    context: 'red',
    reason: 'Tropical fruit clashes with a red-fruit red profile.'
  },
  {
    source: 'blackFruit',
    threshold: 0.45,
    target: 'oakAging',
    idealDelta: 0.08,
    context: 'red',
    reason: 'Dark fruit can carry oak and toast.'
  },
  {
    source: 'blackFruit',
    threshold: 0.45,
    target: 'spiceFlavor',
    idealDelta: 0.08,
    context: 'red',
    reason: 'Dark fruit wants spice depth.'
  },
  {
    source: 'blackFruit',
    threshold: 0.45,
    target: 'earth',
    idealDelta: 0.06,
    context: 'red',
    reason: 'Dark fruit can carry earth and mineral depth.'
  },
  {
    source: 'citrus',
    threshold: 0.45,
    target: 'flower',
    idealDelta: 0.08,
    context: 'white',
    reason: 'Bright citrus benefits from floral lift.'
  },
  {
    source: 'citrus',
    threshold: 0.45,
    target: 'treeFruit',
    idealDelta: 0.08,
    context: 'white',
    reason: 'Bright citrus wants orchard fruit support.'
  },
  {
    source: 'tropicalFruit',
    threshold: 0.45,
    target: 'oakAging',
    idealDelta: -0.06,
    widthDelta: -0.02,
    reason: 'Very ripe tropical fruit can overwhelm oak balance.'
  },
  {
    source: 'generalAging',
    threshold: 0.45,
    target: 'tropicalFruit',
    idealDelta: -0.08,
    widthDelta: -0.03,
    reason: 'Mature profiles tolerate less fresh tropical fruit.'
  },
  {
    source: 'oakAging',
    threshold: 0.45,
    target: 'driedFruit',
    idealDelta: 0.06,
    context: 'red',
    reason: 'Oak-forward reds want some concentration.'
  },
  {
    source: 'faults',
    threshold: 0.12,
    target: 'flower',
    idealDelta: -0.08,
    widthDelta: -0.03,
    reason: 'Fault pressure suppresses delicate aromatic targets.'
  }
];

function baseTargetsFor(color: GrapeColor): Record<FlavorFamilyId, TasteTargetState> {
  const seeds = color === 'red' ? RED_BASE_TARGETS : WHITE_BASE_TARGETS;
  const targets = {} as Record<FlavorFamilyId, TasteTargetState>;
  for (const id of FLAVOR_FAMILY_IDS) {
    targets[id] = {
      ...seeds[id],
      reasons: [`${color} wine base target`]
    };
  }
  return targets;
}

function nudgeTarget(
  target: TasteTargetState,
  idealDelta: number,
  widthDelta: number,
  reason: string
): TasteTargetState {
  return {
    ...target,
    ideal: clamp01(target.ideal + idealDelta),
    width: Math.max(0.035, Math.min(0.35, target.width + widthDelta)),
    reasons: [...target.reasons, reason]
  };
}

function applyGrapeNudges(
  targets: Record<FlavorFamilyId, TasteTargetState>,
  grape: GrapeVariety
): void {
  const nudges = GRAPE_TARGET_NUDGES[grape];
  for (const id of FLAVOR_FAMILY_IDS) {
    const delta = nudges[id];
    if (delta === undefined || delta === 0) continue;
    targets[id] = nudgeTarget(
      targets[id],
      delta,
      0,
      `${grape} typicity target`
    );
  }
}

function applyDependencyRules(
  targets: Record<FlavorFamilyId, TasteTargetState>,
  profile: WineFlavorFamilyProfile,
  context: TasteQualityContext
): void {
  for (const rule of DEPENDENCY_RULES) {
    if (rule.context && rule.context !== context.grapeColor) continue;
    const sourceValue = profile[rule.source];
    if (sourceValue <= rule.threshold) continue;

    const strength = clamp01((sourceValue - rule.threshold) / (1 - rule.threshold));
    targets[rule.target] = nudgeTarget(
      targets[rule.target],
      rule.idealDelta * strength,
      (rule.widthDelta ?? 0) * strength,
      rule.reason
    );
  }
}

function rangeForTarget(target: TasteTargetState): [number, number] {
  return [
    clamp01(target.ideal - target.width),
    clamp01(target.ideal + target.width)
  ];
}

function scoreWithinRange(current: number, ideal: number, acceptedRange: [number, number]): number {
  const [min, max] = acceptedRange;
  if (current >= min && current <= max) {
    const halfWidth = Math.max(0.001, (max - min) / 2);
    const midpointDistance = Math.abs(current - ideal) / halfWidth;
    return clamp01(1 - midpointDistance * 0.08);
  }

  const distanceOutside = current < min ? min - current : current - max;
  const tolerance = Math.max(0.08, (max - min) * 0.75);
  return Math.pow(clamp01(1 - distanceOutside / tolerance), 1.35);
}

export function buildTasteFamilyTargets(
  profile: WineFlavorFamilyProfile,
  context: TasteQualityContext
): Record<FlavorFamilyId, TasteTargetState> {
  const targets = baseTargetsFor(context.grapeColor);
  applyGrapeNudges(targets, context.grape);
  applyDependencyRules(targets, profile, context);
  return targets;
}

export function calculateTasteQualityIndexFromProfile(
  profile: WineFlavorFamilyProfile,
  context: TasteQualityContext
): TasteQualityIndexResult {
  const targets = buildTasteFamilyTargets(profile, context);
  const families = {} as Record<FlavorFamilyId, TasteQualityFamilyBreakdown>;
  let weightedScore = 0;
  let totalWeight = 0;

  for (const id of FLAVOR_FAMILY_IDS) {
    const target = targets[id];
    const acceptedRange = rangeForTarget(target);
    const current = clamp01(profile[id]);
    const score = scoreWithinRange(current, target.ideal, acceptedRange);
    families[id] = {
      current,
      ideal: target.ideal,
      acceptedRange,
      score,
      weight: target.weight,
      reasons: target.reasons
    };
    weightedScore += score * target.weight;
    totalWeight += target.weight;
  }

  return {
    tasteQualityIndex: totalWeight > 0 ? clamp01(weightedScore / totalWeight) : 0,
    families
  };
}

export function calculateTasteQualityIndex(batch: WineBatch): TasteQualityIndexResult {
  const grapeData = GRAPE_CONST[batch.grape];
  const grapeColor = grapeData?.grapeColor ?? batch.grapeColor;
  const profile = computeWineTasteProfile(batch).flavorFamilies;
  return calculateTasteQualityIndexFromProfile(profile, {
    grape: batch.grape,
    grapeColor
  });
}
