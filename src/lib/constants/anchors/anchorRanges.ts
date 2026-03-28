import { WineAnchorId } from '@/lib/types/anchors';

export const ANCHOR_DEFAULT_VALUES: Record<WineAnchorId, number> = {
  residualSugar: 0.35,
  alcoholABV: 0.5,
  pH: 0.5,
  totalAcidity: 0.5,
  phenolicLoad: 0.5,
  anthocyaninLoad: 0.5,
  aromaticPotential: 0.5,
  glycerolMouthfeel: 0.5,
  volatileAcidityPotential: 0.1,
  oxidationSensitivity: 0.5,

  grapeVarietyProfile: 0.5,
  grapeColor: 0.5,
  vineAge: 0.5,
  altitude: 0.5,
  aspect: 0.5,
  soilProfile: 0.5,
  windExposure: 0.5,
  seasonHeatLoad: 0.5,
  diurnalShift: 0.5,
  vineyardHealth: 0.5,

  harvestTiming: 0.5,
  fermentationMethod: 0.5,
  fermentationTemperatureCurve: 0.5,
  macerationIntensity: 0.5,
  oakProgram: 0.5,
  leesContact: 0.5,
  bottleAgingState: 0,
  featureHistory: 0
};

