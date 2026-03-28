import { FLAVOR_FAMILY_IDS, FlavorFamilyId } from '@/lib/types/taste';

type CompatibilityMatrix = Record<FlavorFamilyId, Record<FlavorFamilyId, number>>;

function createEmptyMatrix(): CompatibilityMatrix {
  return FLAVOR_FAMILY_IDS.reduce((outer, a) => {
    outer[a] = FLAVOR_FAMILY_IDS.reduce((inner, b) => {
      inner[b] = a === b ? 0.2 : 0;
      return inner;
    }, {} as Record<FlavorFamilyId, number>);
    return outer;
  }, {} as CompatibilityMatrix);
}

const matrix = createEmptyMatrix();

const setPair = (a: FlavorFamilyId, b: FlavorFamilyId, value: number) => {
  matrix[a][b] = value;
  matrix[b][a] = value;
};

setPair('citrus', 'flower', 0.35);
setPair('citrus', 'treeFruit', 0.22);
setPair('redFruit', 'spiceFlavor', 0.20);
setPair('blackFruit', 'spiceFlavor', 0.30);
setPair('blackFruit', 'oakAging', 0.32);
setPair('blackFruit', 'generalAging', 0.30);
setPair('driedFruit', 'generalAging', 0.28);
setPair('earth', 'generalAging', 0.22);
setPair('microbial', 'oakAging', 0.10);

setPair('tropicalFruit', 'generalAging', -0.35);
setPair('tropicalFruit', 'earth', -0.22);
setPair('citrus', 'faults', -0.25);
setPair('flower', 'faults', -0.20);
setPair('redFruit', 'faults', -0.24);
setPair('blackFruit', 'faults', -0.28);
setPair('faults', 'oakAging', -0.26);
setPair('faults', 'generalAging', -0.30);

export const TASTE_COMPATIBILITY_MATRIX = matrix;

export function getFamilyCompatibility(a: FlavorFamilyId, b: FlavorFamilyId): number {
  return TASTE_COMPATIBILITY_MATRIX[a][b] ?? 0;
}

