import type {
  FlavorFamilyId,
  WineTasteComputedMetrics,
  WineTasteDescriptorId
} from '@/lib/types/types';

export const FLAVOR_FAMILY_LABELS: Record<FlavorFamilyId, string> = {
  flower: 'Floral',
  citrus: 'Citrus',
  treeFruit: 'Tree & stone fruit',
  tropicalFruit: 'Tropical fruit',
  redFruit: 'Red fruit',
  blackFruit: 'Black fruit',
  driedFruit: 'Dried / cooked fruit',
  spiceFlavor: 'Spice',
  vegetable: 'Herbal / vegetable',
  earth: 'Earth & mineral',
  microbial: 'Yeast & lees',
  oakAging: 'Oak & toast',
  generalAging: 'Bottle evolution',
  faults: 'Fault & edge'
};

export const TASTE_DESCRIPTOR_LABELS: Record<WineTasteDescriptorId, string> = {
  citrusZest: 'Citrus zest',
  orchardFruit: 'Orchard apple & pear',
  stoneMelon: 'Stone fruit & melon',
  tropicalNotes: 'Tropical ripe',
  redBerry: 'Red berry',
  darkFruit: 'Dark fruit',
  driedConcentrated: 'Dried & concentrated',
  floralLift: 'Floral lift',
  herbalGreen: 'Herbal & green',
  pepperBakingSpice: 'Pepper & baking spice',
  earthMineral: 'Earth & mineral',
  yeastLees: 'Yeast & autolysis',
  oakToastVanilla: 'Oak toast & vanilla',
  bottleEvolved: 'Bottle-aged notes',
  faultEdge: 'Volatile / fault edge',
  whiteFloral: 'White flowers',
  greenApple: 'Green apple',
  yellowApple: 'Yellow apple',
  pearNotes: 'Pear',
  whitePeach: 'White peach',
  grapefruit: 'Grapefruit',
  orangeZest: 'Orange zest',
  tropicalIsland: 'Tropical island fruit',
  honeyed: 'Honeyed / waxy',
  leatheryTobacco: 'Leather & tobacco',
  graphiteMineral: 'Graphite & mineral'
};

/** Short labels for the 14-axis taste wheel SVG. */
export const FLAVOR_FAMILY_WHEEL_LABELS: Record<FlavorFamilyId, string> = {
  flower: 'Floral',
  citrus: 'Citrus',
  treeFruit: 'Tree',
  tropicalFruit: 'Tropical',
  redFruit: 'Red fr.',
  blackFruit: 'Black fr.',
  driedFruit: 'Dried',
  spiceFlavor: 'Spice',
  vegetable: 'Herbal',
  earth: 'Earth',
  microbial: 'Microbial',
  oakAging: 'Oak',
  generalAging: 'Bottle',
  faults: 'Faults'
};

export const METRIC_LABELS: Record<keyof WineTasteComputedMetrics, string> = {
  intensity: 'Flavor intensity',
  complexity: 'Complexity',
  harmony: 'Flavor harmony',
  typicity: 'Typicity vs site',
  layerBalance: 'Primary / sec. / tert. balance',
  flavorQualityIndex: 'Flavor quality (model)'
};
