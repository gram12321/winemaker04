import { BASE_BALANCED_RANGES } from '@/lib/constants/grapeConstants';
import type { Vineyard, WineAnchorValues, WineBatch } from '@/lib/types/types';
import { calculateStructureIndex, RANGE_ADJUSTMENTS, RULES } from '@/lib/wineStructure';
import { getAnchorAdjustedStructureRanges } from '@/lib/services/wine/anchors/wineAnchorCharacteristicBridge';
import { NEUTRAL_WINE_ANCHORS, resolveWineAnchors } from '@/lib/services/wine/anchors/wineAnchorService';
import { calculateTasteQualityIndex } from '@/lib/services/wine/taste/tasteQualityIndexService';
import { calculateEstimatedPriceBreakdown } from '@/lib/services/wine/winescore/wineScoreCalculation';
import type { AnchorEffectEntry } from './wineAnchorEffectUtils';
import { buildAnchorEffectsFromNeutral } from './wineAnchorEffectUtils';

interface DownstreamSnapshot {
  structureIndex: number;
  tasteQualityIndex: number;
  wineScore: number;
  estimatedPrice: number;
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

function buildDownstreamSnapshot(
  batch: WineBatch,
  anchors: WineAnchorValues,
  vineyard?: Vineyard,
  companyPrestige?: number,
  vineyardPrestige?: number
): DownstreamSnapshot {
  const adjustedRanges = getAnchorAdjustedStructureRanges(BASE_BALANCED_RANGES, anchors);
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
    estimatedPrice: breakdown.finalPrice
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
      }
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
