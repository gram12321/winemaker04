import { GrapeVariety } from '@/lib/types/types';
import { TASTE_DESCRIPTOR_IDS, TasteDescriptorId, TasteVector } from '@/lib/types/taste';

export const MIN_TASTE_FLOOR = 0.005;
export const TASTE_SIGMOID_STEEPNESS = 4;

const descriptorBase = (overrides: Partial<Record<TasteDescriptorId, number>>): Partial<TasteVector> => overrides;

export const GRAPE_DESCRIPTOR_BASELINES: Record<GrapeVariety, Partial<TasteVector>> = {
  Barbera: descriptorBase({
    redFruit: 0.72,
    blackFruit: 0.28,
    floral: 0.34,
    pepperSpice: 0.24,
    mineralEarth: 0.20,
    citrus: 0.30
  }),
  Chardonnay: descriptorBase({
    citrus: 0.55,
    orchardFruit: 0.62,
    stoneMelonFruit: 0.44,
    floral: 0.20,
    oakVanilla: 0.20,
    mlfButterCream: 0.18
  }),
  'Pinot Noir': descriptorBase({
    redFruit: 0.78,
    blackFruit: 0.22,
    floral: 0.40,
    organicEarth: 0.32,
    tobaccoCedar: 0.15
  }),
  Primitivo: descriptorBase({
    blackFruit: 0.80,
    driedFruit: 0.44,
    sweetSpice: 0.38,
    oakCoconutToast: 0.20,
    organicEarth: 0.18
  }),
  'Sauvignon Blanc': descriptorBase({
    citrus: 0.74,
    orchardFruit: 0.48,
    tropicalFruit: 0.40,
    herbal: 0.52,
    vegetalPyrazine: 0.36,
    floral: 0.18
  }),
  Tempranillo: descriptorBase({
    redFruit: 0.48,
    blackFruit: 0.58,
    driedFruit: 0.35,
    sweetSpice: 0.46,
    tobaccoCedar: 0.24,
    organicEarth: 0.34
  }),
  Sangiovese: descriptorBase({
    redFruit: 0.68,
    blackFruit: 0.30,
    driedFruit: 0.22,
    floral: 0.26,
    organicEarth: 0.30,
    pepperSpice: 0.32
  })
};

export const DEFAULT_DESCRIPTOR_BASELINE = 0.2;

export function createEmptyTasteVector(baseValue: number = DEFAULT_DESCRIPTOR_BASELINE): TasteVector {
  return TASTE_DESCRIPTOR_IDS.reduce((acc, descriptorId) => {
    acc[descriptorId] = baseValue;
    return acc;
  }, {} as TasteVector);
}
