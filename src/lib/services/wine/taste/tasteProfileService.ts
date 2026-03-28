import { FAMILY_TO_DESCRIPTORS, FAULT_DESCRIPTOR_IDS } from '@/lib/constants/taste/flavorFamilies';
import { createEmptyTasteVector, DEFAULT_DESCRIPTOR_BASELINE, GRAPE_DESCRIPTOR_BASELINES, MIN_TASTE_FLOOR, TASTE_SIGMOID_STEEPNESS } from '@/lib/constants/taste/tasteDescriptors';
import { buildWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { WineAnchorId, WineAnchorSet } from '@/lib/types/anchors';
import { FlavorFamilyId, FlavorFamilyVector, FLAVOR_FAMILY_IDS, TASTE_DESCRIPTOR_IDS, TasteDescriptorId, TasteEvaluation, TasteVector } from '@/lib/types/taste';
import { Vineyard, WineBatch } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

export type TasteOriginStage = 'baseline' | 'anchor' | 'process' | 'feature' | 'interaction';

export interface DescriptorOriginTerm {
  stage: TasteOriginStage;
  source: string;
  deltaRaw: number;
  occurrences?: number;
}

export interface DescriptorFlavorOrigin {
  descriptorId: TasteDescriptorId;
  rawValue: number;
  normalizedValue: number;
  terms: DescriptorOriginTerm[];
}

export interface FamilyOriginTerm {
  stage: TasteOriginStage;
  source: string;
  impactRaw: number;
}

export interface FlavorFamilyOrigin {
  familyId: FlavorFamilyId;
  value: number;
  topSources: FamilyOriginTerm[];
}

export interface TasteProfileOrigins {
  stageTotals: Array<{
    stage: TasteOriginStage;
    signedDeltaRaw: number;
    absoluteDeltaRaw: number;
  }>;
  descriptorOrigins: Record<TasteDescriptorId, DescriptorFlavorOrigin>;
  familyOrigins: FlavorFamilyOrigin[];
}

export interface TasteProfileWithOrigins extends Pick<TasteEvaluation, 'descriptors' | 'families'> {
  origins: TasteProfileOrigins;
}

type DescriptorContributionMap = Record<TasteDescriptorId, DescriptorOriginTerm[]>;
type AnchorBlendTerm = { anchorId: WineAnchorId; weight: number; inverse?: boolean };
type AnchorBlendComponent = { anchorId: WineAnchorId; contribution: number };

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
const EPSILON = 0.0000001;
const clampRange = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const DESCRIPTOR_TO_FAMILY: Record<TasteDescriptorId, FlavorFamilyId> = Object.entries(FAMILY_TO_DESCRIPTORS)
  .reduce((acc, [familyId, descriptorIds]) => {
    descriptorIds.forEach((descriptorId) => {
      acc[descriptorId] = familyId as FlavorFamilyId;
    });
    return acc;
  }, {} as Record<TasteDescriptorId, FlavorFamilyId>);

const FAMILY_ANCHOR_MODULATION: Record<FlavorFamilyId, AnchorBlendTerm[]> = {
  flower: [
    { anchorId: 'altitude', weight: 0.35 },
    { anchorId: 'diurnalShift', weight: 0.25 },
    { anchorId: 'aromaticPotential', weight: 0.25 },
    { anchorId: 'windExposure', weight: 0.1 },
    { anchorId: 'seasonHeatLoad', weight: 0.15, inverse: true }
  ],
  citrus: [
    { anchorId: 'totalAcidity', weight: 0.4 },
    { anchorId: 'diurnalShift', weight: 0.3 },
    { anchorId: 'pH', weight: 0.15, inverse: true },
    { anchorId: 'seasonHeatLoad', weight: 0.2, inverse: true },
    { anchorId: 'residualSugar', weight: 0.1, inverse: true }
  ],
  treeFruit: [
    { anchorId: 'harvestTiming', weight: 0.35 },
    { anchorId: 'seasonHeatLoad', weight: 0.25 },
    { anchorId: 'aromaticPotential', weight: 0.2 },
    { anchorId: 'aspect', weight: 0.1 },
    { anchorId: 'residualSugar', weight: 0.2 }
  ],
  tropicalFruit: [
    { anchorId: 'residualSugar', weight: 0.45 },
    { anchorId: 'seasonHeatLoad', weight: 0.25 },
    { anchorId: 'harvestTiming', weight: 0.2 },
    { anchorId: 'aspect', weight: 0.1 },
    { anchorId: 'fermentationTemperatureCurve', weight: 0.1 }
  ],
  redFruit: [
    { anchorId: 'phenolicLoad', weight: 0.3, inverse: true },
    { anchorId: 'grapeColor', weight: 0.2 },
    { anchorId: 'harvestTiming', weight: 0.3 },
    { anchorId: 'seasonHeatLoad', weight: 0.2 },
    { anchorId: 'totalAcidity', weight: 0.2 }
  ],
  blackFruit: [
    { anchorId: 'phenolicLoad', weight: 0.35 },
    { anchorId: 'anthocyaninLoad', weight: 0.25 },
    { anchorId: 'grapeColor', weight: 0.2 },
    { anchorId: 'macerationIntensity', weight: 0.2 },
    { anchorId: 'seasonHeatLoad', weight: 0.2 }
  ],
  driedFruit: [
    { anchorId: 'seasonHeatLoad', weight: 0.35 },
    { anchorId: 'bottleAgingState', weight: 0.25 },
    { anchorId: 'harvestTiming', weight: 0.2 },
    { anchorId: 'residualSugar', weight: 0.2 }
  ],
  spiceFlavor: [
    { anchorId: 'macerationIntensity', weight: 0.35 },
    { anchorId: 'grapeVarietyProfile', weight: 0.25 },
    { anchorId: 'aspect', weight: 0.15 },
    { anchorId: 'fermentationMethod', weight: 0.2 },
    { anchorId: 'oakProgram', weight: 0.2 }
  ],
  vegetable: [
    { anchorId: 'harvestTiming', weight: 0.35, inverse: true },
    { anchorId: 'vineyardHealth', weight: 0.25, inverse: true },
    { anchorId: 'diurnalShift', weight: 0.2 },
    { anchorId: 'featureHistory', weight: 0.2 }
  ],
  earth: [
    { anchorId: 'vineAge', weight: 0.35 },
    { anchorId: 'soilProfile', weight: 0.35 },
    { anchorId: 'grapeVarietyProfile', weight: 0.15 },
    { anchorId: 'bottleAgingState', weight: 0.15 }
  ],
  microbial: [
    { anchorId: 'leesContact', weight: 0.35 },
    { anchorId: 'fermentationMethod', weight: 0.25 },
    { anchorId: 'fermentationTemperatureCurve', weight: 0.2 },
    { anchorId: 'featureHistory', weight: 0.2 }
  ],
  oakAging: [
    { anchorId: 'oakProgram', weight: 0.5 },
    { anchorId: 'bottleAgingState', weight: 0.3 },
    { anchorId: 'glycerolMouthfeel', weight: 0.15 },
    { anchorId: 'alcoholABV', weight: 0.2 }
  ],
  generalAging: [
    { anchorId: 'bottleAgingState', weight: 0.4 },
    { anchorId: 'oakProgram', weight: 0.25 },
    { anchorId: 'glycerolMouthfeel', weight: 0.15 },
    { anchorId: 'alcoholABV', weight: 0.2 },
    { anchorId: 'oxidationSensitivity', weight: 0.15 }
  ],
  faults: [
    { anchorId: 'volatileAcidityPotential', weight: 0.35 },
    { anchorId: 'oxidationSensitivity', weight: 0.3 },
    { anchorId: 'pH', weight: 0.15 },
    { anchorId: 'featureHistory', weight: 0.2 },
    { anchorId: 'vineyardHealth', weight: 0.15, inverse: true }
  ]
};

const createContributionMap = (): DescriptorContributionMap => (
  TASTE_DESCRIPTOR_IDS.reduce((acc, descriptorId) => {
    acc[descriptorId] = [];
    return acc;
  }, {} as DescriptorContributionMap)
);

const trackDelta = (
  raw: TasteVector,
  descriptorId: TasteDescriptorId,
  delta: number,
  stage: TasteOriginStage,
  source: string,
  contributions?: DescriptorContributionMap
): void => {
  if (Math.abs(delta) <= EPSILON) return;
  raw[descriptorId] += delta;
  if (contributions) {
    contributions[descriptorId].push({ stage, source, deltaRaw: delta });
  }
};

const getAnchorBlendComponents = (
  descriptorId: TasteDescriptorId,
  anchors: WineAnchorSet
): AnchorBlendComponent[] => {
  const familyId = DESCRIPTOR_TO_FAMILY[descriptorId];
  const blendTerms = FAMILY_ANCHOR_MODULATION[familyId];

  if (!blendTerms?.length) return [];

  return blendTerms.map((term) => {
    const anchorValue = anchors[term.anchorId] ?? 0.5;
    const centered = (anchorValue - 0.5) * 2;
    return {
      anchorId: term.anchorId,
      contribution: centered * term.weight * (term.inverse ? -1 : 1)
    };
  }).filter((component) => Math.abs(component.contribution) > EPSILON);
};

const getAnchorModulationMultiplier = (
  baseDelta: number,
  blend: number
): number => {
  if (baseDelta >= 0) {
    return clampRange(1 + (blend * 0.75), 0.35, 1.9);
  }

  return clampRange(1 - (blend * 0.45), 0.55, 1.55);
};

const trackModulatedDelta = (
  raw: TasteVector,
  descriptorId: TasteDescriptorId,
  baseDelta: number,
  stage: Exclude<TasteOriginStage, 'anchor'>,
  source: string,
  anchors: WineAnchorSet,
  contributions?: DescriptorContributionMap
): void => {
  if (Math.abs(baseDelta) <= EPSILON) return;

  const blendComponents = getAnchorBlendComponents(descriptorId, anchors);
  const rawBlend = blendComponents.reduce((sum, component) => sum + component.contribution, 0);
  const blend = clampRange(rawBlend, -1, 1);
  const multiplier = getAnchorModulationMultiplier(baseDelta, blend);
  const modulatedDelta = baseDelta * multiplier;

  trackDelta(raw, descriptorId, modulatedDelta, stage, source, contributions);

  const anchorDelta = modulatedDelta - baseDelta;
  if (contributions && Math.abs(anchorDelta) > EPSILON && blendComponents.length > 0) {
    const sensitivity = baseDelta >= 0 ? 0.75 : -0.45;
    const unclampedAnchorDelta = baseDelta * sensitivity * blend;
    const scale = Math.abs(unclampedAnchorDelta) > EPSILON ? (anchorDelta / unclampedAnchorDelta) : 0;

    blendComponents.forEach((component) => {
      const componentDelta = baseDelta * sensitivity * component.contribution * scale;
      if (Math.abs(componentDelta) <= EPSILON) return;

      contributions[descriptorId].push({
        stage: 'anchor',
        source: `anchor.${component.anchorId}`,
        deltaRaw: componentDelta
      });
    });
  }
};

const getFeatureSeverity = (batch: WineBatch, featureId: string): number => {
  const feature = (batch.features || []).find((candidate) => candidate.id === featureId && candidate.isPresent);
  return feature ? clamp01(feature.severity || 0) : 0;
};

const applyGrapeBaselines = (
  raw: TasteVector,
  batch: WineBatch,
  anchors: WineAnchorSet,
  contributions?: DescriptorContributionMap
): void => {
  const baseline = GRAPE_DESCRIPTOR_BASELINES[batch.grape] || {};
  TASTE_DESCRIPTOR_IDS.forEach((descriptorId) => {
    const descriptorBase = baseline[descriptorId];
    if (descriptorBase !== undefined) {
      const baseDelta = descriptorBase - raw[descriptorId];
      trackModulatedDelta(raw, descriptorId, baseDelta, 'baseline', `grapeBaseline.${batch.grape}`, anchors, contributions);
    }
  });
};

const applyProcessDeltas = (
  raw: TasteVector,
  batch: WineBatch,
  anchors: WineAnchorSet,
  contributions?: DescriptorContributionMap
): void => {
  const method = batch.fermentationOptions?.method;
  const temperature = batch.fermentationOptions?.temperature;
  const agingYears = (batch.agingProgress || 0) / 52;

  if (method === 'Temperature Controlled') {
    trackModulatedDelta(raw, 'citrus', 0.06, 'process', 'process.fermentationMethod.TemperatureControlled', anchors, contributions);
    trackModulatedDelta(raw, 'floral', 0.05, 'process', 'process.fermentationMethod.TemperatureControlled', anchors, contributions);
    trackModulatedDelta(raw, 'yeastBread', 0.02, 'process', 'process.fermentationMethod.TemperatureControlled', anchors, contributions);
  } else if (method === 'Extended Maceration') {
    trackModulatedDelta(raw, 'blackFruit', 0.08, 'process', 'process.fermentationMethod.ExtendedMaceration', anchors, contributions);
    trackModulatedDelta(raw, 'pepperSpice', 0.06, 'process', 'process.fermentationMethod.ExtendedMaceration', anchors, contributions);
    trackModulatedDelta(raw, 'organicEarth', 0.06, 'process', 'process.fermentationMethod.ExtendedMaceration', anchors, contributions);
  } else {
    trackModulatedDelta(raw, 'yeastBread', 0.03, 'process', 'process.fermentationMethod.Other', anchors, contributions);
  }

  if (temperature === 'Cool') {
    trackModulatedDelta(raw, 'citrus', 0.05, 'process', 'process.temperature.Cool', anchors, contributions);
    trackModulatedDelta(raw, 'floral', 0.03, 'process', 'process.temperature.Cool', anchors, contributions);
  } else if (temperature === 'Warm') {
    trackModulatedDelta(raw, 'tropicalFruit', 0.06, 'process', 'process.temperature.Warm', anchors, contributions);
    trackModulatedDelta(raw, 'driedFruit', 0.04, 'process', 'process.temperature.Warm', anchors, contributions);
  }

  // Generic tertiary aging arc, independent of bottle_aging feature id.
  if (agingYears > 0) {
    const agingFactor = clamp01(agingYears / 12);
    trackModulatedDelta(raw, 'tobaccoCedar', agingFactor * 0.12, 'process', 'process.agingProgress', anchors, contributions);
    trackModulatedDelta(raw, 'coffeeCocoa', agingFactor * 0.08, 'process', 'process.agingProgress', anchors, contributions);
    trackModulatedDelta(raw, 'leather', agingFactor * 0.08, 'process', 'process.agingProgress', anchors, contributions);
    trackModulatedDelta(raw, 'nuttyOxidative', agingFactor * 0.06, 'process', 'process.agingProgress', anchors, contributions);
    trackModulatedDelta(raw, 'redFruit', -agingFactor * 0.06, 'process', 'process.agingProgress', anchors, contributions);
    trackModulatedDelta(raw, 'blackFruit', -agingFactor * 0.04, 'process', 'process.agingProgress', anchors, contributions);
  }
};

const applyFeatureDeltas = (
  raw: TasteVector,
  batch: WineBatch,
  anchors: WineAnchorSet,
  contributions?: DescriptorContributionMap
): void => {
  const oxidation = getFeatureSeverity(batch, 'oxidation');
  const greenFlavor = getFeatureSeverity(batch, 'green_flavor');
  const terroir = getFeatureSeverity(batch, 'terroir');
  const bottleAging = getFeatureSeverity(batch, 'bottle_aging');
  const stuckFermentation = getFeatureSeverity(batch, 'stuck_fermentation');

  if (oxidation > 0) {
    trackModulatedDelta(raw, 'oxidizedCooked', oxidation * 0.70, 'feature', 'feature.oxidation', anchors, contributions);
    trackModulatedDelta(raw, 'nuttyOxidative', oxidation * 0.40, 'feature', 'feature.oxidation', anchors, contributions);
    trackModulatedDelta(raw, 'volatileAcidity', oxidation * 0.25, 'feature', 'feature.oxidation', anchors, contributions);
    trackModulatedDelta(raw, 'citrus', -oxidation * 0.20, 'feature', 'feature.oxidation', anchors, contributions);
    trackModulatedDelta(raw, 'redFruit', -oxidation * 0.18, 'feature', 'feature.oxidation', anchors, contributions);
    trackModulatedDelta(raw, 'blackFruit', -oxidation * 0.18, 'feature', 'feature.oxidation', anchors, contributions);
  }

  if (greenFlavor > 0) {
    trackModulatedDelta(raw, 'vegetalPyrazine', greenFlavor * 0.72, 'feature', 'feature.greenFlavor', anchors, contributions);
    trackModulatedDelta(raw, 'herbal', greenFlavor * 0.32, 'feature', 'feature.greenFlavor', anchors, contributions);
    trackModulatedDelta(raw, 'redFruit', -greenFlavor * 0.18, 'feature', 'feature.greenFlavor', anchors, contributions);
    trackModulatedDelta(raw, 'tropicalFruit', -greenFlavor * 0.15, 'feature', 'feature.greenFlavor', anchors, contributions);
  }

  if (terroir > 0) {
    trackModulatedDelta(raw, 'mineralEarth', terroir * 0.24, 'feature', 'feature.terroirExpression', anchors, contributions);
    trackModulatedDelta(raw, 'floral', terroir * 0.14, 'feature', 'feature.terroirExpression', anchors, contributions);
    trackModulatedDelta(raw, 'sweetSpice', terroir * 0.11, 'feature', 'feature.terroirExpression', anchors, contributions);
    trackModulatedDelta(raw, 'organicEarth', terroir * 0.12, 'feature', 'feature.terroirExpression', anchors, contributions);
  }

  if (bottleAging > 0) {
    trackModulatedDelta(raw, 'tobaccoCedar', bottleAging * 0.22, 'feature', 'feature.bottleAging', anchors, contributions);
    trackModulatedDelta(raw, 'coffeeCocoa', bottleAging * 0.14, 'feature', 'feature.bottleAging', anchors, contributions);
    trackModulatedDelta(raw, 'leather', bottleAging * 0.16, 'feature', 'feature.bottleAging', anchors, contributions);
    trackModulatedDelta(raw, 'nuttyOxidative', bottleAging * 0.12, 'feature', 'feature.bottleAging', anchors, contributions);
    trackModulatedDelta(raw, 'redFruit', -bottleAging * 0.10, 'feature', 'feature.bottleAging', anchors, contributions);
    trackModulatedDelta(raw, 'blackFruit', -bottleAging * 0.08, 'feature', 'feature.bottleAging', anchors, contributions);
  }

  if (stuckFermentation > 0) {
    trackModulatedDelta(raw, 'yeastBread', stuckFermentation * 0.18, 'feature', 'feature.stuckFermentation', anchors, contributions);
    trackModulatedDelta(raw, 'mlfButterCream', stuckFermentation * 0.10, 'feature', 'feature.stuckFermentation', anchors, contributions);
    trackModulatedDelta(raw, 'citrus', -stuckFermentation * 0.08, 'feature', 'feature.stuckFermentation', anchors, contributions);
    trackModulatedDelta(raw, 'floral', -stuckFermentation * 0.08, 'feature', 'feature.stuckFermentation', anchors, contributions);
  }
};

const applyInteractionDeltas = (raw: TasteVector, contributions?: DescriptorContributionMap): void => {
  // Clash example from design notes: tropical + leather
  const tropicalLeatherClash = Math.min(raw.tropicalFruit, raw.leather);
  if (tropicalLeatherClash > 0.35) {
    const clashPenalty = (tropicalLeatherClash - 0.35) * 0.12;
    trackDelta(raw, 'tropicalFruit', -clashPenalty, 'interaction', 'interaction.tropicalFruit.leather.clash', contributions);
    trackDelta(raw, 'leather', -clashPenalty, 'interaction', 'interaction.tropicalFruit.leather.clash', contributions);
  }

  // Positive aromatic synergy: citrus + floral
  const citrusFloralSynergy = Math.min(raw.citrus, raw.floral);
  if (citrusFloralSynergy > 0.25) {
    const synergyBonus = (citrusFloralSynergy - 0.25) * 0.10;
    trackDelta(raw, 'citrus', synergyBonus, 'interaction', 'interaction.citrus.floral.synergy', contributions);
    trackDelta(raw, 'floral', synergyBonus, 'interaction', 'interaction.citrus.floral.synergy', contributions);
  }
};

const normalizeDescriptors = (raw: TasteVector): TasteVector => {
  const normalized = createEmptyTasteVector(0);
  TASTE_DESCRIPTOR_IDS.forEach((descriptorId: TasteDescriptorId) => {
    const rawValue = raw[descriptorId] ?? DEFAULT_DESCRIPTOR_BASELINE;
    const transformed = MIN_TASTE_FLOOR + ((1 - MIN_TASTE_FLOOR) * sigmoid((rawValue - 0.5) * TASTE_SIGMOID_STEEPNESS));
    normalized[descriptorId] = clamp01(transformed);
  });
  return normalized;
};

export function aggregateFlavorFamilies(descriptors: TasteVector): FlavorFamilyVector {
  const families = FLAVOR_FAMILY_IDS.reduce((acc, familyId) => {
    const descriptorIds = FAMILY_TO_DESCRIPTORS[familyId];
    const avg = descriptorIds.reduce((sum, descriptorId) => sum + descriptors[descriptorId], 0) / Math.max(1, descriptorIds.length);
    acc[familyId] = clamp01(avg);
    return acc;
  }, {} as FlavorFamilyVector);

  // Fault family should directly reflect fault descriptors.
  families.faults = clamp01(
    FAULT_DESCRIPTOR_IDS.reduce((sum, descriptorId) => sum + descriptors[descriptorId], 0) / FAULT_DESCRIPTOR_IDS.length
  );

  return families;
}

export function buildTasteProfile(batch: WineBatch, vineyard?: Vineyard): Pick<TasteEvaluation, 'descriptors' | 'families'> {
  const raw = createEmptyTasteVector(DEFAULT_DESCRIPTOR_BASELINE);
  const anchors = buildWineAnchors(batch, vineyard);

  applyGrapeBaselines(raw, batch, anchors);
  applyProcessDeltas(raw, batch, anchors);
  applyFeatureDeltas(raw, batch, anchors);
  applyInteractionDeltas(raw);

  const descriptors = normalizeDescriptors(raw);
  const families = aggregateFlavorFamilies(descriptors);

  return { descriptors, families };
}

const buildOrigins = (
  contributions: DescriptorContributionMap,
  rawAfterDeltas: TasteVector,
  descriptors: TasteVector,
  families: FlavorFamilyVector
): TasteProfileOrigins => {
  const stages: TasteOriginStage[] = ['baseline', 'anchor', 'process', 'feature', 'interaction'];
  const stageTotals = stages.map((stage) => {
    let signedDeltaRaw = 0;
    let absoluteDeltaRaw = 0;

    TASTE_DESCRIPTOR_IDS.forEach((descriptorId) => {
      contributions[descriptorId]
        .filter((term) => term.stage === stage)
        .forEach((term) => {
          signedDeltaRaw += term.deltaRaw;
          absoluteDeltaRaw += Math.abs(term.deltaRaw);
        });
    });

    return { stage, signedDeltaRaw, absoluteDeltaRaw };
  });

  const descriptorOrigins = TASTE_DESCRIPTOR_IDS.reduce((acc, descriptorId) => {
    const mergedBySource = new Map<string, DescriptorOriginTerm>();
    contributions[descriptorId].forEach((term) => {
      const key = `${term.stage}|${term.source}`;
      const current = mergedBySource.get(key);
      if (current) {
        current.deltaRaw += term.deltaRaw;
        current.occurrences = (current.occurrences || 1) + 1;
      } else {
        mergedBySource.set(key, { ...term, occurrences: 1 });
      }
    });

    const terms = [...mergedBySource.values()].sort((a, b) => Math.abs(b.deltaRaw) - Math.abs(a.deltaRaw));
    acc[descriptorId] = {
      descriptorId,
      rawValue: rawAfterDeltas[descriptorId],
      normalizedValue: descriptors[descriptorId],
      terms
    };
    return acc;
  }, {} as Record<TasteDescriptorId, DescriptorFlavorOrigin>);

  const familyOrigins = FLAVOR_FAMILY_IDS.map((familyId) => {
    const descriptorIds = FAMILY_TO_DESCRIPTORS[familyId];
    const sourceImpact = new Map<string, FamilyOriginTerm>();

    descriptorIds.forEach((descriptorId) => {
      contributions[descriptorId].forEach((term) => {
        const key = `${term.stage}|${term.source}`;
        const current = sourceImpact.get(key);
        const impactRaw = term.deltaRaw / descriptorIds.length;
        if (current) {
          current.impactRaw += impactRaw;
        } else {
          sourceImpact.set(key, {
            stage: term.stage,
            source: term.source,
            impactRaw
          });
        }
      });
    });

    return {
      familyId,
      value: families[familyId],
      topSources: [...sourceImpact.values()]
        .sort((a, b) => Math.abs(b.impactRaw) - Math.abs(a.impactRaw))
    };
  });

  return {
    stageTotals,
    descriptorOrigins,
    familyOrigins
  };
};

export function buildTasteProfileWithOrigins(batch: WineBatch, vineyard?: Vineyard): TasteProfileWithOrigins {
  const raw = createEmptyTasteVector(DEFAULT_DESCRIPTOR_BASELINE);
  const anchors = buildWineAnchors(batch, vineyard);
  const contributions = createContributionMap();

  applyGrapeBaselines(raw, batch, anchors, contributions);
  applyProcessDeltas(raw, batch, anchors, contributions);
  applyFeatureDeltas(raw, batch, anchors, contributions);
  applyInteractionDeltas(raw, contributions);

  const rawAfterDeltas = { ...raw };
  const descriptors = normalizeDescriptors(raw);
  const families = aggregateFlavorFamilies(descriptors);
  const origins = buildOrigins(contributions, rawAfterDeltas, descriptors, families);

  return {
    descriptors,
    families,
    origins
  };
}
