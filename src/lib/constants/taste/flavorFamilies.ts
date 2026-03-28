import { FlavorFamilyId, TasteDescriptorId } from '@/lib/types/taste';

export const FAMILY_TO_DESCRIPTORS: Record<FlavorFamilyId, TasteDescriptorId[]> = {
  flower: ['floral'],
  citrus: ['citrus'],
  treeFruit: ['orchardFruit', 'stoneMelonFruit'],
  tropicalFruit: ['tropicalFruit'],
  redFruit: ['redFruit'],
  blackFruit: ['blackFruit'],
  driedFruit: ['driedFruit'],
  spiceFlavor: ['pepperSpice', 'sweetSpice'],
  vegetable: ['herbal', 'vegetalPyrazine'],
  earth: ['organicEarth', 'mineralEarth'],
  microbial: ['yeastBread', 'mlfButterCream', 'leesDoughy'],
  oakAging: ['oakVanilla', 'oakCoconutToast'],
  generalAging: ['tobaccoCedar', 'coffeeCocoa', 'leather', 'nuttyOxidative'],
  faults: ['volatileAcidity', 'reductiveSulfur', 'oxidizedCooked']
};

export const PRIMARY_DESCRIPTOR_IDS: TasteDescriptorId[] = [
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
  'mineralEarth'
];

export const SECONDARY_DESCRIPTOR_IDS: TasteDescriptorId[] = [
  'yeastBread',
  'mlfButterCream',
  'leesDoughy'
];

export const TERTIARY_DESCRIPTOR_IDS: TasteDescriptorId[] = [
  'oakVanilla',
  'oakCoconutToast',
  'tobaccoCedar',
  'coffeeCocoa',
  'leather',
  'nuttyOxidative'
];

export const FAULT_DESCRIPTOR_IDS: TasteDescriptorId[] = [
  'volatileAcidity',
  'reductiveSulfur',
  'oxidizedCooked'
];

