import { GrapeVariety } from './types';

export const FLAVOR_FAMILY_IDS = [
  'flower',
  'citrus',
  'treeFruit',
  'tropicalFruit',
  'redFruit',
  'blackFruit',
  'driedFruit',
  'spiceFlavor',
  'vegetable',
  'earth',
  'microbial',
  'oakAging',
  'generalAging',
  'faults'
] as const;

export type FlavorFamilyId = typeof FLAVOR_FAMILY_IDS[number];

export const TASTE_DESCRIPTOR_IDS = [
  'citrus',
  'orchardFruit',
  'stoneMelonFruit',
  'tropicalFruit',
  'redFruit',
  'blackFruit',
  'driedFruit',
  'floral',
  'herbal',
  'vegetalPyrazine',
  'pepperSpice',
  'sweetSpice',
  'organicEarth',
  'mineralEarth',
  'yeastBread',
  'mlfButterCream',
  'leesDoughy',
  'oakVanilla',
  'oakCoconutToast',
  'tobaccoCedar',
  'coffeeCocoa',
  'leather',
  'nuttyOxidative',
  'volatileAcidity',
  'reductiveSulfur',
  'oxidizedCooked'
] as const;

export type TasteDescriptorId = typeof TASTE_DESCRIPTOR_IDS[number];

export type TasteVector = Record<TasteDescriptorId, number>;
export type FlavorFamilyVector = Record<FlavorFamilyId, number>;

export interface TasteMetrics {
  intensity: number;
  complexity: number;
  harmony: number;
  typicity: number;
  layerBalance: number;
}

export interface TasteEvaluation {
  descriptors: TasteVector;
  families: FlavorFamilyVector;
  metrics: TasteMetrics;
  tasteIndex: number;
}

export interface TasteTypicityProfile {
  grape: GrapeVariety;
  targetFamilies: Partial<FlavorFamilyVector>;
}

