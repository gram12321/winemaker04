import { FlavorFamilyId } from './taste';

export const CHEMICAL_ANCHOR_IDS = [
  'residualSugar',
  'alcoholABV',
  'pH',
  'totalAcidity',
  'phenolicLoad',
  'anthocyaninLoad',
  'aromaticPotential',
  'glycerolMouthfeel',
  'volatileAcidityPotential',
  'oxidationSensitivity'
] as const;

export const TERROIR_ANCHOR_IDS = [
  'grapeVarietyProfile',
  'grapeColor',
  'vineAge',
  'altitude',
  'aspect',
  'soilProfile',
  'windExposure',
  'seasonHeatLoad',
  'diurnalShift',
  'vineyardHealth'
] as const;

export const PROCESS_ANCHOR_IDS = [
  'harvestTiming',
  'fermentationMethod',
  'fermentationTemperatureCurve',
  'macerationIntensity',
  'oakProgram',
  'leesContact',
  'bottleAgingState',
  'featureHistory'
] as const;

export type ChemicalAnchorId = typeof CHEMICAL_ANCHOR_IDS[number];
export type TerroirAnchorId = typeof TERROIR_ANCHOR_IDS[number];
export type ProcessAnchorId = typeof PROCESS_ANCHOR_IDS[number];
export type WineAnchorId = ChemicalAnchorId | TerroirAnchorId | ProcessAnchorId;

export type WineAnchorSet = Record<WineAnchorId, number>;

export interface SourceImpactPath {
  target: FlavorFamilyId | string;
  source: string;
  path: 'direct' | 'anchor' | 'stacked';
}
