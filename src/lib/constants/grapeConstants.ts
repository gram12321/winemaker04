// Grape constants - fragility, natural yield, color, oxidation, base characteristics, and descriptions
import { GrapeVariety, WineCharacteristics } from '@/lib/types/types';

// Base balanced ranges for wine characteristics (ported from v3 ranges)
export const BASE_BALANCED_RANGES = {
  acidity: [0.4, 0.6],
  aroma: [0.3, 0.7],
  body: [0.4, 0.8],
  spice: [0.35, 0.65],
  sweetness: [0.4, 0.6],
  tannins: [0.35, 0.65]
} as const;


// Unified grape data interface
export interface GrapeData {
  name: GrapeVariety;
  naturalYield: number; // 0-1 scale, affects harvest yield (not yet wired)
  fragile: number; // 0-1 scale, affects work requirements (0=robust, 1=fragile)
  proneToOxidation: number; // 0-1 scale, affects wine stability (not yet wired)
  grapeColor: 'red' | 'white';
  baseCharacteristics: WineCharacteristics; // Base wine characteristics for this grape
  description: string; // Short UI description
  agingProfile: {
    earlyPeak: number;  // Years - end of fast growth phase
    latePeak: number;   // Years - end of moderate growth phase (plateau after this)
    ageWorthiness: 'low' | 'medium' | 'high';  // For UI display
  };
}

// Grape constants for all varieties
export const GRAPE_CONST: Record<GrapeVariety, GrapeData> = {
  'Barbera': {
    name: 'Barbera',
    naturalYield: 0.7,
    fragile: 0.4,
    proneToOxidation: 0.4,
    grapeColor: 'red',
    baseCharacteristics: {
      acidity: 0.7, aroma: 0.5, body: 0.6, spice: 0.5, sweetness: 0.5, tannins: 0.6
    },
    description: 'A versatile grape known for high acidity and moderate tannins, producing medium-bodied wines.',
    agingProfile: {
      earlyPeak: 3,
      latePeak: 7,
      ageWorthiness: 'medium'
    }
  },
  'Chardonnay': {
    name: 'Chardonnay',
    naturalYield: 0.8,
    fragile: 0.6,
    proneToOxidation: 0.7,
    grapeColor: 'white',
    baseCharacteristics: {
      acidity: 0.4, aroma: 0.65, body: 0.75, spice: 0.5, sweetness: 0.5, tannins: 0.35
    },
    description: 'A noble grape variety producing aromatic, medium-bodied wines with moderate acidity.',
    agingProfile: {
      earlyPeak: 2,
      latePeak: 5,
      ageWorthiness: 'medium'
    }
  },
  'Pinot Noir': {
    name: 'Pinot Noir',
    naturalYield: 0.6,
    fragile: 0.7,
    proneToOxidation: 0.8,
    grapeColor: 'red',
    baseCharacteristics: {
      acidity: 0.65, aroma: 0.6, body: 0.35, spice: 0.5, sweetness: 0.5, tannins: 0.4
    },
    description: 'A delicate grape creating light-bodied, aromatic wines with high acidity and soft tannins.',
    agingProfile: {
      earlyPeak: 3,
      latePeak: 7,
      ageWorthiness: 'high'
    }
  },
  'Primitivo': {
    name: 'Primitivo',
    naturalYield: 0.9,
    fragile: 0.3,
    proneToOxidation: 0.3,
    grapeColor: 'red',
    baseCharacteristics: {
      acidity: 0.5, aroma: 0.7, body: 0.7, spice: 0.5, sweetness: 0.7, tannins: 0.7
    },
    description: 'A robust grape yielding full-bodied, aromatic wines with natural sweetness and high tannins.',
    agingProfile: {
      earlyPeak: 4,
      latePeak: 10,
      ageWorthiness: 'high'
    }
  },
  'Sauvignon Blanc': {
    name: 'Sauvignon Blanc',
    naturalYield: 0.75,
    fragile: 0.5,
    proneToOxidation: 0.9,
    grapeColor: 'white',
    baseCharacteristics: {
      acidity: 0.8, aroma: 0.75, body: 0.3, spice: 0.6, sweetness: 0.4, tannins: 0.3
    },
    description: 'A crisp grape variety producing aromatic, light-bodied wines with high acidity.',
    agingProfile: {
      earlyPeak: 1,
      latePeak: 3,
      ageWorthiness: 'low'
    }
  }
} as const;


