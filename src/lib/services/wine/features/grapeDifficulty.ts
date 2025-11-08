import { GRAPE_CONST, BASE_BALANCED_RANGES, REGION_GRAPE_SUITABILITY } from '@/lib/constants';
import { GrapeVariety, WineCharacteristics } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils';

type DifficultyComponentKey =
  | 'handling'
  | 'yield'
  | 'balance'
  | 'aging'
  | 'regionalSuitability';

export type DifficultyTier = 'low' | 'medium' | 'high';

export interface GrapeDifficultyComponents {
  handling: number;
  yield: number;
  balance: number;
  aging: number;
  regionalSuitability: number;
}

export interface GrapeDifficultyBreakdown {
  grape: GrapeVariety;
  score: number;
  components: GrapeDifficultyComponents;
  tier: DifficultyTier;
}

const COMPONENT_WEIGHTS: Record<DifficultyComponentKey, number> = {
  handling: 0.35,
  yield: 0.2,
  balance: 0.2,
  aging: 0.1,
  regionalSuitability: 0.15,
};

const AGE_SPANS = Object.values(GRAPE_CONST).map(grape => {
  const { earlyPeak, latePeak } = grape.agingProfile;
  return Math.max(0, latePeak - earlyPeak);
});

const AGING_SPAN_REFERENCE = AGE_SPANS.length > 0 ? Math.max(...AGE_SPANS) : 10;

const AGE_WORTHINESS_MAP = {
  low: 0.2,
  medium: 0.5,
  high: 0.8,
} as const;

const DIFFICULTY_TIERS: Array<{ max: number; tier: DifficultyTier }> = [
  { max: 0.4, tier: 'low' },
  { max: 0.7, tier: 'medium' },
  { max: 1, tier: 'high' },
];

function calculateHandlingComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  return clamp01((data.fragile + data.proneToOxidation) / 2);
}

function calculateYieldComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  return clamp01(1 - data.naturalYield);
}

function calculateBalanceComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  const characteristicKeys = Object.keys(BASE_BALANCED_RANGES) as Array<keyof WineCharacteristics>;

  const totalDeviation = characteristicKeys.reduce((sum, key) => {
    const [min, max] = BASE_BALANCED_RANGES[key];
    const midpoint = (min + max) / 2;
    const halfRange = (max - min) / 2 || 0.0001;
    const deviation = Math.abs(data.baseCharacteristics[key] - midpoint) / halfRange;
    return sum + clamp01(deviation);
  }, 0);

  return clamp01(totalDeviation / characteristicKeys.length);
}

function calculateAgingComponent(grape: GrapeVariety): number {
  const data = GRAPE_CONST[grape];
  const { earlyPeak, latePeak, ageWorthiness } = data.agingProfile;

  const span = clamp01((latePeak - earlyPeak) / AGING_SPAN_REFERENCE);
  const worthiness = AGE_WORTHINESS_MAP[ageWorthiness];

  return clamp01((span + worthiness) / 2);
}

function calculateRegionalSuitabilityComponent(grape: GrapeVariety): number {
  let total = 0;
  let count = 0;

  Object.values(REGION_GRAPE_SUITABILITY).forEach(country => {
    Object.values(country).forEach(region => {
      const value = region[grape as keyof typeof region];
      if (typeof value === 'number') {
        total += value;
        count += 1;
      }
    });
  });

  if (count === 0) {
    return 0.5; // Neutral difficulty when no data exists
  }

  const averageSuitability = clamp01(total / count);
  return clamp01(1 - averageSuitability);
}

function deriveTier(score: number): DifficultyTier {
  const tierEntry = DIFFICULTY_TIERS.find(entry => score <= entry.max);
  return tierEntry ? tierEntry.tier : 'high';
}

function calculateComponents(grape: GrapeVariety): GrapeDifficultyComponents {
  return {
    handling: calculateHandlingComponent(grape),
    yield: calculateYieldComponent(grape),
    balance: calculateBalanceComponent(grape),
    aging: calculateAgingComponent(grape),
    regionalSuitability: calculateRegionalSuitabilityComponent(grape),
  };
}

export function calculateGrapeDifficulty(grape: GrapeVariety): GrapeDifficultyBreakdown {
  const components = calculateComponents(grape);

  const score = (Object.keys(COMPONENT_WEIGHTS) as DifficultyComponentKey[]).reduce((sum, key) => {
    return sum + COMPONENT_WEIGHTS[key] * components[key];
  }, 0);

  const normalizedScore = clamp01(score);

  return {
    grape,
    score: normalizedScore,
    components,
    tier: deriveTier(normalizedScore),
  };
}

export function calculateAllGrapeDifficulties(): Record<GrapeVariety, GrapeDifficultyBreakdown> {
  return Object.keys(GRAPE_CONST).reduce((acc, grapeName) => {
    const grape = grapeName as GrapeVariety;
    acc[grape] = calculateGrapeDifficulty(grape);
    return acc;
  }, {} as Record<GrapeVariety, GrapeDifficultyBreakdown>);
}

