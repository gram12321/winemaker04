import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import {
  FLAVOR_FAMILY_IDS,
  type FlavorFamilyId,
  type Vineyard,
  type WineAnchorValues,
  type WineBatch,
  type WineCharacteristics
} from '@/lib/types/types';
import {
  calculateCharacteristicBreakdown,
  calculateStructureIndex,
  RANGE_ADJUSTMENTS,
  RULES
} from '@/lib/wineStructure';
import { getAnchorAdjustedStructureRanges } from '@/lib/services/wine/anchors/wineAnchorCharacteristicBridge';
import { NEUTRAL_WINE_ANCHORS, resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { calculateTasteQualityIndex } from '@/lib/services/wine/taste/tasteQualityIndexService';
import { computeWineTasteProfile } from '@/lib/services/wine/taste/wineTasteProfileService';
import {
  calculateEstimatedPriceBreakdown,
  type EstimatedPriceBreakdown
} from '@/lib/services/wine/winescore/wineScoreCalculation';
import type { AnchorEffectEntry } from './wineAnchorEffectUtils';
import { buildAnchorEffectsFromNeutral } from './wineAnchorEffectUtils';

type CharacteristicDeltaMap = Record<keyof WineCharacteristics, number>;
type FlavorFamilyDeltaMap = Record<FlavorFamilyId, number>;
type PriceInputKey =
  | 'basePrice'
  | 'wineScoreMultiplier'
  | 'landValuePriceMultiplier'
  | 'featurePriceMultiplier'
  | 'prePrestigePrice'
  | 'companyPrestigeMultiplier'
  | 'vineyardPrestigeMultiplier'
  | 'finalPrice';
type PriceInputDeltaMap = Record<PriceInputKey, number>;

interface PriceInputSnapshot {
  basePrice: number;
  wineScoreMultiplier: number;
  landValuePriceMultiplier: number;
  featurePriceMultiplier: number;
  prePrestigePrice: number;
  companyPrestigeMultiplier: number;
  vineyardPrestigeMultiplier: number;
  finalPrice: number;
}

interface DownstreamSnapshot {
  structureIndex: number;
  tasteQualityIndex: number;
  wineScore: number;
  estimatedPrice: number;
  structureCharacteristicContributions: CharacteristicDeltaMap;
  tasteFamilyValues: FlavorFamilyDeltaMap;
  priceInputs: PriceInputSnapshot;
}

interface DownstreamDeltas {
  structureIndex: number;
  tasteQualityIndex: number;
  wineScore: number;
  estimatedPrice: number;
}

export interface AnchorIsolatedImpact {
  anchor: keyof WineAnchorValues;
  currentValue: number;
  neutralValue: number;
  current: DownstreamSnapshot;
  neutralBaseline: DownstreamSnapshot;
  delta: DownstreamDeltas;
  structureCharacteristicDelta: CharacteristicDeltaMap;
  tasteFamilyDelta: FlavorFamilyDeltaMap;
  priceInputDelta: PriceInputDeltaMap;
}

export interface WineAnchorImpactDebugAnalysis {
  currentAnchors: WineAnchorValues;
  neutralAnchors: WineAnchorValues;
  current: DownstreamSnapshot;
  neutralBaseline: DownstreamSnapshot;
  delta: DownstreamDeltas;
  anchorDeltaFromNeutral: Record<keyof WineAnchorValues, number>;
  isolatedAnchorImpacts: AnchorIsolatedImpact[];
  anchorEffects: AnchorEffectEntry[];
  hasRecordedAnchorHistory: boolean;
}

const ANCHOR_KEYS = Object.keys(NEUTRAL_WINE_ANCHORS) as Array<keyof WineAnchorValues>;
const CHARACTERISTIC_KEYS: Array<keyof WineCharacteristics> = [
  'acidity',
  'aroma',
  'body',
  'spice',
  'sweetness',
  'tannins'
];
const PRICE_INPUT_KEYS: PriceInputKey[] = [
  'basePrice',
  'wineScoreMultiplier',
  'landValuePriceMultiplier',
  'featurePriceMultiplier',
  'prePrestigePrice',
  'companyPrestigeMultiplier',
  'vineyardPrestigeMultiplier',
  'finalPrice'
];

function pickPriceInputs(breakdown: EstimatedPriceBreakdown): PriceInputSnapshot {
  return {
    basePrice: breakdown.basePrice,
    wineScoreMultiplier: breakdown.wineScoreMultiplier,
    landValuePriceMultiplier: breakdown.landValuePriceMultiplier,
    featurePriceMultiplier: breakdown.featurePriceMultiplier,
    prePrestigePrice: breakdown.prePrestigePrice,
    companyPrestigeMultiplier: breakdown.companyPrestigeMultiplier,
    vineyardPrestigeMultiplier: breakdown.vineyardPrestigeMultiplier,
    finalPrice: breakdown.finalPrice
  };
}

function buildDownstreamSnapshot(
  batch: WineBatch,
  anchors: WineAnchorValues,
  vineyard?: Vineyard,
  companyPrestige?: number,
  vineyardPrestige?: number
): DownstreamSnapshot {
  const adjustedRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, anchors);
  const structureBreakdown = calculateCharacteristicBreakdown(
    batch.characteristics,
    adjustedRanges,
    RANGE_ADJUSTMENTS,
    RULES
  );
  const structureIndex = calculateStructureIndex(
    batch.characteristics,
    adjustedRanges,
    RANGE_ADJUSTMENTS,
    RULES
  ).score;

  const batchWithAnchors: WineBatch = {
    ...batch,
    wineAnchors: anchors,
    structureIndex
  };

  const contributionScale = CHARACTERISTIC_KEYS.length > 0 ? -2 / CHARACTERISTIC_KEYS.length : 0;
  const structureCharacteristicContributions = {} as CharacteristicDeltaMap;
  for (const key of CHARACTERISTIC_KEYS) {
    structureCharacteristicContributions[key] =
      contributionScale * structureBreakdown[key].finalTotalDistance;
  }

  const tasteFamilyValues = computeWineTasteProfile(batchWithAnchors).flavorFamilies;
  const tasteQualityIndex = calculateTasteQualityIndex(batchWithAnchors).tasteQualityIndex;
  const breakdown = calculateEstimatedPriceBreakdown(
    batchWithAnchors,
    vineyard,
    companyPrestige,
    vineyardPrestige
  );

  return {
    structureIndex,
    tasteQualityIndex,
    wineScore: breakdown.wineScore,
    estimatedPrice: breakdown.finalPrice,
    structureCharacteristicContributions,
    tasteFamilyValues,
    priceInputs: pickPriceInputs(breakdown)
  };
}

export function analyzeWineAnchorDownstreamImpact(
  batch: WineBatch,
  vineyard?: Vineyard,
  companyPrestige?: number,
  vineyardPrestige?: number
): WineAnchorImpactDebugAnalysis {
  const currentAnchors = resolveWineAnchors(batch.wineAnchors);
  const neutralAnchors = resolveWineAnchors(NEUTRAL_WINE_ANCHORS);

  const current = buildDownstreamSnapshot(
    batch,
    currentAnchors,
    vineyard,
    companyPrestige,
    vineyardPrestige
  );
  const neutralBaseline = buildDownstreamSnapshot(
    batch,
    neutralAnchors,
    vineyard,
    companyPrestige,
    vineyardPrestige
  );

  const anchorDeltaFromNeutral = {} as Record<keyof WineAnchorValues, number>;
  for (const key of ANCHOR_KEYS) {
    anchorDeltaFromNeutral[key] = currentAnchors[key] - neutralAnchors[key];
  }

  const isolatedAnchorImpacts: AnchorIsolatedImpact[] = ANCHOR_KEYS.map((key) => {
    const isolatedAnchors = {
      ...neutralAnchors,
      [key]: currentAnchors[key]
    };
    const isolatedCurrent = buildDownstreamSnapshot(
      batch,
      isolatedAnchors,
      vineyard,
      companyPrestige,
      vineyardPrestige
    );
    return {
      anchor: key,
      currentValue: currentAnchors[key],
      neutralValue: neutralAnchors[key],
      current: isolatedCurrent,
      neutralBaseline,
      delta: {
        structureIndex: isolatedCurrent.structureIndex - neutralBaseline.structureIndex,
        tasteQualityIndex: isolatedCurrent.tasteQualityIndex - neutralBaseline.tasteQualityIndex,
        wineScore: isolatedCurrent.wineScore - neutralBaseline.wineScore,
        estimatedPrice: isolatedCurrent.estimatedPrice - neutralBaseline.estimatedPrice
      },
      structureCharacteristicDelta: CHARACTERISTIC_KEYS.reduce((acc, characteristic) => {
        acc[characteristic] =
          isolatedCurrent.structureCharacteristicContributions[characteristic] -
          neutralBaseline.structureCharacteristicContributions[characteristic];
        return acc;
      }, {} as CharacteristicDeltaMap),
      tasteFamilyDelta: FLAVOR_FAMILY_IDS.reduce((acc, family) => {
        acc[family] = isolatedCurrent.tasteFamilyValues[family] - neutralBaseline.tasteFamilyValues[family];
        return acc;
      }, {} as FlavorFamilyDeltaMap),
      priceInputDelta: PRICE_INPUT_KEYS.reduce((acc, keyName) => {
        acc[keyName] = isolatedCurrent.priceInputs[keyName] - neutralBaseline.priceInputs[keyName];
        return acc;
      }, {} as PriceInputDeltaMap)
    };
  });

  const recordedAnchorEffects = batch.breakdown?.anchorEffects || [];
  const hasRecordedAnchorHistory = recordedAnchorEffects.length > 0;
  const anchorEffects = hasRecordedAnchorHistory
    ? recordedAnchorEffects
    : buildAnchorEffectsFromNeutral(currentAnchors, 'Legacy snapshot (history unavailable)');

  return {
    currentAnchors,
    neutralAnchors,
    current,
    neutralBaseline,
    delta: {
      structureIndex: current.structureIndex - neutralBaseline.structureIndex,
      tasteQualityIndex: current.tasteQualityIndex - neutralBaseline.tasteQualityIndex,
      wineScore: current.wineScore - neutralBaseline.wineScore,
      estimatedPrice: current.estimatedPrice - neutralBaseline.estimatedPrice
    },
    anchorDeltaFromNeutral,
    isolatedAnchorImpacts,
    anchorEffects,
    hasRecordedAnchorHistory
  };
}
