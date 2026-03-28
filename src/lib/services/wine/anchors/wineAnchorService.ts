import { ANCHOR_DEFAULT_VALUES } from '@/lib/constants/anchors/anchorRanges';
import { WineAnchorId, WineAnchorSet } from '@/lib/types/anchors';
import { GrapeVariety, Vineyard, WineBatch } from '@/lib/types/types';
import { clamp01 } from '@/lib/utils/utils';

type WeightTerm = { value: number; weight: number };

const weightedMean = (terms: WeightTerm[]): number => {
  const weightSum = terms.reduce((sum, term) => sum + term.weight, 0);
  if (weightSum <= 0) return 0.5;
  const weightedSum = terms.reduce((sum, term) => sum + (term.value * term.weight), 0);
  return clamp01(weightedSum / weightSum);
};

const aspectHeatIndex = (aspect?: string): number => {
  if (!aspect) return 0.5;
  if (aspect === 'South' || aspect === 'Southeast' || aspect === 'Southwest') return 0.75;
  if (aspect === 'East' || aspect === 'West') return 0.6;
  return 0.4;
};

const soilMineralityIndex = (soil?: string[]): number => {
  if (!soil?.length) return 0.5;
  const lower = soil.map((entry) => entry.toLowerCase());
  const mineralCount = lower.filter((entry) => (
    entry.includes('chalk')
    || entry.includes('limestone')
    || entry.includes('slate')
    || entry.includes('gravel')
    || entry.includes('volcanic')
  )).length;
  return clamp01(mineralCount / lower.length);
};

const grapeAnchorProfile: Record<GrapeVariety, {
  sweetness: number;
  aromatic: number;
  phenolic: number;
  spice: number;
}> = {
  Barbera: { sweetness: 0.35, aromatic: 0.5, phenolic: 0.55, spice: 0.45 },
  Chardonnay: { sweetness: 0.55, aromatic: 0.65, phenolic: 0.3, spice: 0.35 },
  'Pinot Noir': { sweetness: 0.45, aromatic: 0.7, phenolic: 0.45, spice: 0.4 },
  Primitivo: { sweetness: 0.7, aromatic: 0.55, phenolic: 0.75, spice: 0.6 },
  'Sauvignon Blanc': { sweetness: 0.3, aromatic: 0.75, phenolic: 0.25, spice: 0.25 },
  Tempranillo: { sweetness: 0.45, aromatic: 0.5, phenolic: 0.72, spice: 0.65 },
  Sangiovese: { sweetness: 0.35, aromatic: 0.55, phenolic: 0.62, spice: 0.55 }
};

const fermentationMethodAnchor = (method?: 'Basic' | 'Temperature Controlled' | 'Extended Maceration'): number => {
  if (!method) return 0.5;
  if (method === 'Temperature Controlled') return 0.62;
  if (method === 'Extended Maceration') return 0.78;
  return 0.45;
};

const fermentationTemperatureAnchor = (temperature?: 'Ambient' | 'Cool' | 'Warm'): number => {
  if (!temperature) return 0.5;
  if (temperature === 'Cool') return 0.35;
  if (temperature === 'Warm') return 0.75;
  return 0.5;
};

const getFeatureSeverity = (batch: WineBatch, featureId: string): number => {
  const feature = (batch.features || []).find((candidate) => candidate.id === featureId && candidate.isPresent);
  return clamp01(feature?.severity || 0);
};

export function buildWineAnchors(batch: WineBatch, vineyard?: Vineyard): WineAnchorSet {
  const grapeProfile = grapeAnchorProfile[batch.grape];
  const altitudeNorm = vineyard ? clamp01(vineyard.altitude / 1500) : clamp01((batch.landValueModifier * 0.8) + 0.1);
  const vineAgeNorm = vineyard?.vineAge !== null && vineyard?.vineAge !== undefined ? clamp01(vineyard.vineAge / 40) : 0.5;
  const healthNorm = clamp01(vineyard?.vineyardHealth ?? 0.5);
  const ripenessNorm = clamp01(vineyard?.ripeness ?? 0.5);
  const aspectNorm = aspectHeatIndex(vineyard?.aspect);
  const soilMinerality = soilMineralityIndex(vineyard?.soil);
  const landNorm = clamp01(batch.landValueModifier);
  const bottleAgeNorm = clamp01((batch.agingProgress || 0) / (52 * 10));

  const oxidationSeverity = getFeatureSeverity(batch, 'oxidation');
  const bottleAgingSeverity = getFeatureSeverity(batch, 'bottle_aging');
  const featureDensity = batch.features.length > 0
    ? batch.features.filter((feature) => feature.isPresent && feature.severity > 0).length / batch.features.length
    : 0;

  const baseFermentationMethod = fermentationMethodAnchor(batch.fermentationOptions?.method);
  const baseFermentationTemperature = fermentationTemperatureAnchor(batch.fermentationOptions?.temperature);

  const values: Partial<WineAnchorSet> = {
    residualSugar: weightedMean([
      { value: batch.characteristics.sweetness, weight: 0.45 },
      { value: ripenessNorm, weight: 0.2 },
      { value: grapeProfile.sweetness, weight: 0.2 },
      { value: aspectNorm, weight: 0.1 },
      { value: 1 - altitudeNorm, weight: 0.05 }
    ]),
    alcoholABV: weightedMean([
      { value: batch.characteristics.body, weight: 0.35 },
      { value: batch.characteristics.spice, weight: 0.15 },
      { value: ripenessNorm, weight: 0.2 },
      { value: aspectNorm, weight: 0.15 },
      { value: grapeProfile.sweetness, weight: 0.15 }
    ]),
    pH: weightedMean([
      { value: 1 - batch.characteristics.acidity, weight: 0.55 },
      { value: ripenessNorm, weight: 0.2 },
      { value: 1 - altitudeNorm, weight: 0.15 },
      { value: aspectNorm, weight: 0.1 }
    ]),
    totalAcidity: weightedMean([
      { value: batch.characteristics.acidity, weight: 0.55 },
      { value: altitudeNorm, weight: 0.2 },
      { value: 1 - ripenessNorm, weight: 0.15 },
      { value: 1 - aspectNorm, weight: 0.1 }
    ]),
    phenolicLoad: weightedMean([
      { value: batch.characteristics.tannins, weight: 0.45 },
      { value: batch.characteristics.spice, weight: 0.15 },
      { value: grapeProfile.phenolic, weight: 0.2 },
      { value: baseFermentationMethod, weight: 0.1 },
      { value: clamp01(batch.fermentationOptions?.method === 'Extended Maceration' ? 1 : 0.35), weight: 0.1 }
    ]),
    anthocyaninLoad: weightedMean([
      { value: batch.grapeColor === 'red' ? 1 : 0.05, weight: 0.45 },
      { value: batch.characteristics.tannins, weight: 0.2 },
      { value: grapeProfile.phenolic, weight: 0.2 },
      { value: ripenessNorm, weight: 0.15 }
    ]),
    aromaticPotential: weightedMean([
      { value: batch.characteristics.aroma, weight: 0.45 },
      { value: grapeProfile.aromatic, weight: 0.25 },
      { value: altitudeNorm, weight: 0.15 },
      { value: 1 - baseFermentationTemperature, weight: 0.15 }
    ]),
    glycerolMouthfeel: weightedMean([
      { value: batch.characteristics.body, weight: 0.45 },
      { value: batch.characteristics.sweetness, weight: 0.25 },
      { value: clamp01(baseFermentationMethod), weight: 0.15 },
      { value: clamp01(baseFermentationTemperature), weight: 0.15 }
    ]),
    volatileAcidityPotential: weightedMean([
      { value: oxidationSeverity, weight: 0.4 },
      { value: clamp01(batch.proneToOxidation), weight: 0.3 },
      { value: bottleAgeNorm, weight: 0.15 },
      { value: featureDensity, weight: 0.15 }
    ]),
    oxidationSensitivity: weightedMean([
      { value: clamp01(batch.proneToOxidation), weight: 0.55 },
      { value: 1 - batch.characteristics.acidity, weight: 0.2 },
      { value: bottleAgeNorm, weight: 0.1 },
      { value: 1 - healthNorm, weight: 0.15 }
    ]),

    grapeVarietyProfile: weightedMean([
      { value: 0.5, weight: 0.2 },
      { value: grapeProfile.spice, weight: 0.25 },
      { value: grapeProfile.aromatic, weight: 0.25 },
      { value: grapeProfile.phenolic, weight: 0.3 }
    ]),
    grapeColor: weightedMean([
      { value: batch.grapeColor === 'red' ? 1 : 0, weight: 0.85 },
      { value: grapeProfile.phenolic, weight: 0.15 }
    ]),
    vineAge: weightedMean([
      { value: vineAgeNorm, weight: 0.6 },
      { value: healthNorm, weight: 0.2 },
      { value: landNorm, weight: 0.2 }
    ]),
    altitude: weightedMean([
      { value: altitudeNorm, weight: 0.7 },
      { value: landNorm, weight: 0.2 },
      { value: 1 - aspectNorm, weight: 0.1 }
    ]),
    aspect: weightedMean([
      { value: aspectNorm, weight: 0.65 },
      { value: ripenessNorm, weight: 0.2 },
      { value: 1 - altitudeNorm, weight: 0.15 }
    ]),
    soilProfile: weightedMean([
      { value: soilMinerality, weight: 0.5 },
      { value: landNorm, weight: 0.25 },
      { value: healthNorm, weight: 0.25 }
    ]),
    windExposure: weightedMean([
      { value: 1 - aspectNorm, weight: 0.3 },
      { value: altitudeNorm, weight: 0.3 },
      { value: 1 - soilMinerality, weight: 0.1 },
      { value: 1 - healthNorm, weight: 0.3 }
    ]),
    seasonHeatLoad: weightedMean([
      { value: ripenessNorm, weight: 0.35 },
      { value: aspectNorm, weight: 0.25 },
      { value: 1 - altitudeNorm, weight: 0.2 },
      { value: batch.characteristics.sweetness, weight: 0.2 }
    ]),
    diurnalShift: weightedMean([
      { value: altitudeNorm, weight: 0.35 },
      { value: batch.characteristics.acidity, weight: 0.25 },
      { value: 1 - aspectNorm, weight: 0.2 },
      { value: batch.characteristics.aroma, weight: 0.2 }
    ]),
    vineyardHealth: weightedMean([
      { value: healthNorm, weight: 0.6 },
      { value: 1 - featureDensity, weight: 0.2 },
      { value: vineAgeNorm, weight: 0.2 }
    ]),

    harvestTiming: weightedMean([
      { value: ripenessNorm, weight: 0.45 },
      { value: batch.characteristics.sweetness, weight: 0.2 },
      { value: 1 - batch.characteristics.acidity, weight: 0.2 },
      { value: aspectNorm, weight: 0.15 }
    ]),
    fermentationMethod: weightedMean([
      { value: baseFermentationMethod, weight: 0.7 },
      { value: clamp01(batch.fermentationOptions?.method === 'Extended Maceration' ? 0.85 : 0.45), weight: 0.3 }
    ]),
    fermentationTemperatureCurve: weightedMean([
      { value: baseFermentationTemperature, weight: 0.75 },
      { value: clamp01(batch.fermentationOptions?.temperature === 'Cool' ? 0.35 : batch.fermentationOptions?.temperature === 'Warm' ? 0.75 : 0.5), weight: 0.25 }
    ]),
    macerationIntensity: weightedMean([
      { value: clamp01(batch.fermentationOptions?.method === 'Extended Maceration' ? 0.9 : 0.4), weight: 0.6 },
      { value: grapeProfile.phenolic, weight: 0.2 },
      { value: batch.characteristics.tannins, weight: 0.2 }
    ]),
    oakProgram: weightedMean([
      { value: bottleAgingSeverity, weight: 0.45 },
      { value: bottleAgeNorm, weight: 0.35 },
      { value: batch.characteristics.spice, weight: 0.2 }
    ]),
    leesContact: weightedMean([
      { value: clamp01(batch.fermentationOptions?.method === 'Temperature Controlled' ? 0.3 : 0.55), weight: 0.45 },
      { value: clamp01(batch.fermentationOptions?.temperature === 'Cool' ? 0.35 : 0.6), weight: 0.25 },
      { value: batch.characteristics.body, weight: 0.15 },
      { value: bottleAgeNorm, weight: 0.15 }
    ]),
    bottleAgingState: weightedMean([
      { value: bottleAgeNorm, weight: 0.7 },
      { value: bottleAgingSeverity, weight: 0.2 },
      { value: oxidationSeverity, weight: 0.1 }
    ]),
    featureHistory: weightedMean([
      { value: featureDensity, weight: 0.65 },
      { value: bottleAgeNorm, weight: 0.2 },
      { value: oxidationSeverity, weight: 0.15 }
    ])
  };

  const result = {} as WineAnchorSet;
  (Object.keys(ANCHOR_DEFAULT_VALUES) as WineAnchorId[]).forEach((anchorId) => {
    result[anchorId] = clamp01(values[anchorId] ?? ANCHOR_DEFAULT_VALUES[anchorId]);
  });

  return result;
}
