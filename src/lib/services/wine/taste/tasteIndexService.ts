import { FAMILY_TO_DESCRIPTORS, PRIMARY_DESCRIPTOR_IDS, SECONDARY_DESCRIPTOR_IDS, TERTIARY_DESCRIPTOR_IDS } from '@/lib/constants/taste/flavorFamilies';
import { getFamilyCompatibility } from '@/lib/constants/taste/tasteCompatibilityMatrix';
import { buildTasteProfile, buildTasteProfileWithOrigins, TasteProfileOrigins } from '@/lib/services/wine/taste/tasteProfileService';
import { FlavorFamilyId, FlavorFamilyVector, TasteEvaluation, TasteMetrics, TasteVector, TASTE_DESCRIPTOR_IDS } from '@/lib/types/taste';
import { GrapeVariety, Vineyard, WineBatch } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

const GRAPE_TYPICITY_TARGETS: Record<GrapeVariety, Partial<FlavorFamilyVector>> = {
  Barbera: { redFruit: 0.8, flower: 0.4, spiceFlavor: 0.35, earth: 0.35, faults: 0 },
  Chardonnay: { citrus: 0.65, treeFruit: 0.75, oakAging: 0.35, microbial: 0.25, faults: 0 },
  'Pinot Noir': { redFruit: 0.9, flower: 0.45, earth: 0.45, spiceFlavor: 0.3, faults: 0 },
  Primitivo: { blackFruit: 0.85, driedFruit: 0.55, spiceFlavor: 0.45, generalAging: 0.3, faults: 0 },
  'Sauvignon Blanc': { citrus: 0.85, treeFruit: 0.55, vegetable: 0.55, flower: 0.2, faults: 0 },
  Tempranillo: { redFruit: 0.55, blackFruit: 0.6, spiceFlavor: 0.55, earth: 0.45, generalAging: 0.35, faults: 0 },
  Sangiovese: { redFruit: 0.8, spiceFlavor: 0.45, earth: 0.45, flower: 0.25, faults: 0 }
};

type IndexMetricKey = 'harmony' | 'complexity' | 'intensity' | 'typicity';

export const TASTE_INDEX_WEIGHTS: Record<IndexMetricKey, number> = {
  harmony: 0.45,
  complexity: 0.25,
  intensity: 0.2,
  typicity: 0.1
};

export interface TasteMetricComponent {
  label: string;
  value: number;
  weight: number;
  weightedValue: number;
  note?: string;
}

export interface TasteMetricExplainability {
  score: number;
  formula: string;
  description: string;
  components: TasteMetricComponent[];
}

export interface TasteFamilyInteraction {
  familyA: FlavorFamilyId;
  familyB: FlavorFamilyId;
  compatibility: number;
  pairWeight: number;
  contribution: number;
  normalizedContribution: number;
  kind: 'synergy' | 'clash' | 'neutral';
}

export interface TasteInteractionSummary {
  harmonyRaw: number;
  pairMass: number;
  topSynergies: TasteFamilyInteraction[];
  topClashes: TasteFamilyInteraction[];
}

export interface TasteIndexTerm {
  metric: IndexMetricKey;
  weight: number;
  metricValue: number;
  contribution: number;
}

export interface TasteEvaluationDetails {
  evaluation: TasteEvaluation;
  profileOrigins: TasteProfileOrigins;
  metricExplainability: Record<keyof TasteMetrics, TasteMetricExplainability>;
  indexTerms: TasteIndexTerm[];
  indexFormula: string;
  interactionSummary: TasteInteractionSummary;
}

const mean = (values: number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const normalizedEntropy = (values: number[]): number => {
  const sum = values.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (sum <= 0) return 0;
  const probabilities = values.map((value) => Math.max(0, value) / sum).filter((value) => value > 0);
  if (probabilities.length <= 1) return 0;
  const entropy = -probabilities.reduce((acc, p) => acc + (p * Math.log(p)), 0);
  const maxEntropy = Math.log(probabilities.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
};

function calculateFamilyInteractionSummary(families: FlavorFamilyVector): {
  harmony: number;
  harmonyRaw: number;
  pairMass: number;
  interactions: TasteFamilyInteraction[];
} {
  const familyIds = Object.keys(FAMILY_TO_DESCRIPTORS) as FlavorFamilyId[];
  let numerator = 0;
  let denominator = 0;
  const rawInteractions: Array<Omit<TasteFamilyInteraction, 'normalizedContribution'>> = [];

  for (let i = 0; i < familyIds.length; i += 1) {
    for (let j = i + 1; j < familyIds.length; j += 1) {
      const a = familyIds[i];
      const b = familyIds[j];
      const pairWeight = families[a] * families[b];
      if (pairWeight <= 0.000001) continue;

      const compatibility = getFamilyCompatibility(a, b);
      const contribution = compatibility * pairWeight;

      numerator += contribution;
      denominator += pairWeight;
      rawInteractions.push({
        familyA: a,
        familyB: b,
        compatibility,
        pairWeight,
        contribution,
        kind: compatibility > 0 ? 'synergy' : (compatibility < 0 ? 'clash' : 'neutral')
      });
    }
  }

  if (denominator <= 0.000001) {
    return {
      harmony: 0.5,
      harmonyRaw: 0,
      pairMass: 0,
      interactions: []
    };
  }

  const harmonyRaw = numerator / denominator;
  const harmony = clamp01(0.5 + (0.5 * harmonyRaw));
  const interactions = rawInteractions.map((interaction) => ({
    ...interaction,
    normalizedContribution: interaction.contribution / denominator
  }));

  return {
    harmony,
    harmonyRaw,
    pairMass: denominator,
    interactions
  };
}

function calculateComplexity(descriptors: TasteVector, families: FlavorFamilyVector): {
  score: number;
  descriptorEntropy: number;
  familyEntropy: number;
  activeDescriptorRatio: number;
} {
  const descriptorValues = TASTE_DESCRIPTOR_IDS.map((descriptorId) => descriptors[descriptorId]);
  const familyValues = (Object.keys(FAMILY_TO_DESCRIPTORS) as FlavorFamilyId[]).map((familyId) => families[familyId]);

  const descriptorEntropy = normalizedEntropy(descriptorValues);
  const familyEntropy = normalizedEntropy(familyValues);
  const activeDescriptorRatio = descriptorValues.filter((value) => value >= 0.25).length / descriptorValues.length;
  const score = clamp01((descriptorEntropy * 0.5) + (familyEntropy * 0.3) + (activeDescriptorRatio * 0.2));

  return {
    score,
    descriptorEntropy,
    familyEntropy,
    activeDescriptorRatio
  };
}

function calculateIntensity(descriptors: TasteVector, families: FlavorFamilyVector): {
  score: number;
  topFamiliesMean: number;
  topDescriptorsMean: number;
} {
  const topFamilies = (Object.keys(FAMILY_TO_DESCRIPTORS) as FlavorFamilyId[])
    .map((familyId) => families[familyId])
    .sort((a, b) => b - a)
    .slice(0, 5);
  const topDescriptorValues = TASTE_DESCRIPTOR_IDS
    .map((descriptorId) => descriptors[descriptorId])
    .sort((a, b) => b - a)
    .slice(0, 8);

  const topFamiliesMean = mean(topFamilies);
  const topDescriptorsMean = mean(topDescriptorValues);
  const score = clamp01((topFamiliesMean * 0.65) + (topDescriptorsMean * 0.35));

  return {
    score,
    topFamiliesMean,
    topDescriptorsMean
  };
}

function calculateTypicity(grape: GrapeVariety, families: FlavorFamilyVector): {
  score: number;
  targetDistance: number;
  checkedFamilies: number;
} {
  const target = GRAPE_TYPICITY_TARGETS[grape];
  const entries = Object.entries(target) as Array<[FlavorFamilyId, number]>;
  if (entries.length === 0) {
    return {
      score: 0.5,
      targetDistance: 0.5,
      checkedFamilies: 0
    };
  }

  const distance = entries.reduce((sum, [familyId, targetValue]) => {
    const delta = Math.abs((families[familyId] ?? 0) - targetValue);
    return sum + delta;
  }, 0) / entries.length;

  return {
    score: clamp01(1 - distance),
    targetDistance: distance,
    checkedFamilies: entries.length
  };
}

function calculateLayerBalance(descriptors: TasteVector): {
  score: number;
  primary: number;
  secondary: number;
  tertiary: number;
  spread: number;
} {
  const primary = mean(PRIMARY_DESCRIPTOR_IDS.map((descriptorId) => descriptors[descriptorId]));
  const secondary = mean(SECONDARY_DESCRIPTOR_IDS.map((descriptorId) => descriptors[descriptorId]));
  const tertiary = mean(TERTIARY_DESCRIPTOR_IDS.map((descriptorId) => descriptors[descriptorId]));
  const layerMean = (primary + secondary + tertiary) / 3;
  const spread = Math.abs(primary - layerMean) + Math.abs(secondary - layerMean) + Math.abs(tertiary - layerMean);
  const score = clamp01(1 - (spread / 1.5));

  return {
    score,
    primary,
    secondary,
    tertiary,
    spread
  };
}

function buildMetricExplainability(
  score: number,
  formula: string,
  description: string,
  components: TasteMetricComponent[]
): TasteMetricExplainability {
  return {
    score,
    formula,
    description,
    components
  };
}

export function calculateTasteMetrics(batch: WineBatch, descriptors: TasteVector, families: FlavorFamilyVector): TasteMetrics {
  const harmonyResult = calculateFamilyInteractionSummary(families);
  const complexityResult = calculateComplexity(descriptors, families);
  const intensityResult = calculateIntensity(descriptors, families);
  const typicityResult = calculateTypicity(batch.grape, families);
  const layerBalanceResult = calculateLayerBalance(descriptors);

  return {
    harmony: harmonyResult.harmony,
    complexity: complexityResult.score,
    intensity: intensityResult.score,
    typicity: typicityResult.score,
    layerBalance: layerBalanceResult.score
  };
}

export function calculateTasteIndexFromMetrics(metrics: TasteMetrics): number {
  return clamp01(
    (TASTE_INDEX_WEIGHTS.harmony * metrics.harmony)
    + (TASTE_INDEX_WEIGHTS.complexity * metrics.complexity)
    + (TASTE_INDEX_WEIGHTS.intensity * metrics.intensity)
    + (TASTE_INDEX_WEIGHTS.typicity * metrics.typicity)
  );
}

export function calculateTasteEvaluation(batch: WineBatch, vineyard?: Vineyard): TasteEvaluation {
  const { descriptors, families } = buildTasteProfile(batch, vineyard);
  const metrics = calculateTasteMetrics(batch, descriptors, families);
  const tasteIndex = calculateTasteIndexFromMetrics(metrics);

  return {
    descriptors,
    families,
    metrics,
    tasteIndex
  };
}

export function calculateTasteEvaluationDetails(batch: WineBatch, vineyard?: Vineyard): TasteEvaluationDetails {
  const { descriptors, families, origins } = buildTasteProfileWithOrigins(batch, vineyard);

  const harmonyResult = calculateFamilyInteractionSummary(families);
  const complexityResult = calculateComplexity(descriptors, families);
  const intensityResult = calculateIntensity(descriptors, families);
  const typicityResult = calculateTypicity(batch.grape, families);
  const layerBalanceResult = calculateLayerBalance(descriptors);

  const metrics: TasteMetrics = {
    harmony: harmonyResult.harmony,
    complexity: complexityResult.score,
    intensity: intensityResult.score,
    typicity: typicityResult.score,
    layerBalance: layerBalanceResult.score
  };

  const tasteIndex = calculateTasteIndexFromMetrics(metrics);
  const evaluation: TasteEvaluation = {
    descriptors,
    families,
    metrics,
    tasteIndex
  };

  const metricExplainability: Record<keyof TasteMetrics, TasteMetricExplainability> = {
    harmony: buildMetricExplainability(
      metrics.harmony,
      'harmonyRaw = sum(C[a,b]*f[a]*f[b]) / sum(f[a]*f[b]); harmony = clamp01(0.5 + 0.5*harmonyRaw)',
      'Measures whether flavor-family combinations reinforce or fight each other.',
      [
        {
          label: 'harmonyRaw',
          value: harmonyResult.harmonyRaw,
          weight: 1,
          weightedValue: harmonyResult.harmonyRaw,
          note: 'Pre-clamp synergy-vs-clash score. Above 0 means synergy-dominated; below 0 means clash-dominated.'
        }
      ]
    ),
    complexity: buildMetricExplainability(
      metrics.complexity,
      'complexity = 0.50*descriptorEntropy + 0.30*familyEntropy + 0.20*activeDescriptorRatio',
      'Higher when expression is broad and distributed instead of concentrated in a few notes.',
      [
        {
          label: 'Descriptor entropy',
          value: complexityResult.descriptorEntropy,
          weight: 0.5,
          weightedValue: complexityResult.descriptorEntropy * 0.5,
          note: 'How evenly intensity is spread across all descriptors. Higher means broader, less concentrated flavor expression.'
        },
        {
          label: 'Family entropy',
          value: complexityResult.familyEntropy,
          weight: 0.3,
          weightedValue: complexityResult.familyEntropy * 0.3,
          note: 'How evenly intensity is spread across flavor families. Higher means more balanced family-level diversity.'
        },
        {
          label: 'Active descriptor ratio',
          value: complexityResult.activeDescriptorRatio,
          weight: 0.2,
          weightedValue: complexityResult.activeDescriptorRatio * 0.2,
          note: 'Share of descriptors above activity threshold (>= 25%). Higher means more descriptors are materially present.'
        }
      ]
    ),
    intensity: buildMetricExplainability(
      metrics.intensity,
      'intensity = 0.65*mean(top5Families) + 0.35*mean(top8Descriptors)',
      'Represents concentration and amplitude of the most expressive flavor notes.',
      [
        {
          label: 'Top family mean',
          value: intensityResult.topFamiliesMean,
          weight: 0.65,
          weightedValue: intensityResult.topFamiliesMean * 0.65
        },
        {
          label: 'Top descriptor mean',
          value: intensityResult.topDescriptorsMean,
          weight: 0.35,
          weightedValue: intensityResult.topDescriptorsMean * 0.35
        }
      ]
    ),
    typicity: buildMetricExplainability(
      metrics.typicity,
      'typicity = 1 - avgDistanceToGrapeTargets',
      'Shows how closely this profile matches expected family signatures for the grape.',
      [
        {
          label: 'Distance to grape targets',
          value: typicityResult.targetDistance,
          weight: -1,
          weightedValue: -typicityResult.targetDistance,
          note: `${typicityResult.checkedFamilies} family targets checked`
        }
      ]
    ),
    layerBalance: buildMetricExplainability(
      metrics.layerBalance,
      'layerBalance = 1 - spread(primary, secondary, tertiary)',
      'Checks whether primary, secondary, and tertiary layers are reasonably integrated.',
      [
        {
          label: 'Primary layer mean',
          value: layerBalanceResult.primary,
          weight: 1,
          weightedValue: layerBalanceResult.primary
        },
        {
          label: 'Secondary layer mean',
          value: layerBalanceResult.secondary,
          weight: 1,
          weightedValue: layerBalanceResult.secondary
        },
        {
          label: 'Tertiary layer mean',
          value: layerBalanceResult.tertiary,
          weight: 1,
          weightedValue: layerBalanceResult.tertiary
        },
        {
          label: 'Layer spread penalty',
          value: layerBalanceResult.spread,
          weight: -1,
          weightedValue: -layerBalanceResult.spread
        }
      ]
    )
  };

  const indexTerms: TasteIndexTerm[] = (Object.keys(TASTE_INDEX_WEIGHTS) as IndexMetricKey[]).map((metricKey) => ({
    metric: metricKey,
    weight: TASTE_INDEX_WEIGHTS[metricKey],
    metricValue: metrics[metricKey],
    contribution: TASTE_INDEX_WEIGHTS[metricKey] * metrics[metricKey]
  }));

  const indexFormula = `tasteIndex = 0.45*harmony + 0.25*complexity + 0.20*intensity + 0.10*typicity`;

  const positiveInteractions = harmonyResult.interactions
    .filter((interaction) => interaction.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 6);

  const negativeInteractions = harmonyResult.interactions
    .filter((interaction) => interaction.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 6);

  return {
    evaluation,
    profileOrigins: origins,
    metricExplainability,
    indexTerms,
    indexFormula,
    interactionSummary: {
      harmonyRaw: harmonyResult.harmonyRaw,
      pairMass: harmonyResult.pairMass,
      topSynergies: positiveInteractions,
      topClashes: negativeInteractions
    }
  };
}

export function calculateTasteIndexForBatch(batch: WineBatch, vineyard?: Vineyard): number {
  return calculateTasteEvaluation(batch, vineyard).tasteIndex;
}
