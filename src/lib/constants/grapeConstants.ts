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

export interface GrapeAltitudeSuitability {
  preferred: readonly [number, number];
  tolerance: readonly [number, number];
}

export interface GrapeSunPreference {
  optimalHeatMin: number;
  optimalHeatMax: number;
  tolerance: number;
}

export const GRAPE_ALTITUDE_SUITABILITY = {
  Barbera: {
    preferred: [200, 520],
    tolerance: [120, 650]
  },
  Chardonnay: {
    preferred: [180, 620],
    tolerance: [0, 850]
  },
  'Pinot Noir': {
    preferred: [260, 600],
    tolerance: [130, 760]
  },
  Primitivo: {
    preferred: [80, 280],
    tolerance: [0, 450]
  },
  'Sauvignon Blanc': {
    preferred: [200, 580],
    tolerance: [60, 850]
  },
  Tempranillo: {
    preferred: [350, 760],
    tolerance: [200, 900]
  }
} as const satisfies Record<GrapeVariety, GrapeAltitudeSuitability>;

export const GRAPE_SUN_PREFERENCES = {
  Barbera: {
    optimalHeatMin: 0.40,
    optimalHeatMax: 0.65,
    tolerance: 0.18
  },
  Chardonnay: {
    optimalHeatMin: 0.45,
    optimalHeatMax: 0.70,
    tolerance: 0.22
  },
  'Pinot Noir': {
    optimalHeatMin: 0.30,
    optimalHeatMax: 0.55,
    tolerance: 0.18
  },
  Primitivo: {
    optimalHeatMin: 0.55,
    optimalHeatMax: 0.85,
    tolerance: 0.15
  },
  'Sauvignon Blanc': {
    optimalHeatMin: 0.35,
    optimalHeatMax: 0.60,
    tolerance: 0.20
  },
  Tempranillo: {
    optimalHeatMin: 0.45,
    optimalHeatMax: 0.75,
    tolerance: 0.18
  }
} as const satisfies Record<GrapeVariety, GrapeSunPreference>;

// ===== GRAPE SUITABILITY =====

// Grape variety suitability by region (0-1 scale, where 1.0 is optimal)
export const REGION_GRAPE_SUITABILITY = {
  Italy: {
    Piedmont: { Barbera: 1.0, Chardonnay: 0.8, 'Pinot Noir': 0.6, Primitivo: 0.5, 'Sauvignon Blanc': 0.6, Tempranillo: 0.4 },
    Tuscany: { Barbera: 0.9, Chardonnay: 0.7, 'Pinot Noir': 0.5, Primitivo: 0.7, 'Sauvignon Blanc': 0.7, Tempranillo: 0.5 },
    Veneto: { Barbera: 0.85, Chardonnay: 0.75, 'Pinot Noir': 0.7, Primitivo: 0.6, 'Sauvignon Blanc': 0.8, Tempranillo: 0.35 },
    Sicily: { Barbera: 0.8, Chardonnay: 0.6, 'Pinot Noir': 0.3, Primitivo: 0.8, 'Sauvignon Blanc': 0.5, Tempranillo: 0.3 },
    Puglia: { Barbera: 0.9, Chardonnay: 0.65, 'Pinot Noir': 0.4, Primitivo: 1.0, 'Sauvignon Blanc': 0.4, Tempranillo: 0.6 }
  },
  France: {
    Bordeaux: { Barbera: 0.7, Chardonnay: 0.8, 'Pinot Noir': 0.6, Primitivo: 0.6, 'Sauvignon Blanc': 0.9, Tempranillo: 0.5 },
    Bourgogne: { Barbera: 0.4, Chardonnay: 0.9, 'Pinot Noir': 0.9, Primitivo: 0.3, 'Sauvignon Blanc': 0.7, Tempranillo: 0.3 },
    Champagne: { Barbera: 0.2, Chardonnay: 0.9, 'Pinot Noir': 0.8, Primitivo: 0.2, 'Sauvignon Blanc': 0.6, Tempranillo: 0.1 },
    'Rhone Valley': { Barbera: 0.85, Chardonnay: 0.75, 'Pinot Noir': 0.5, Primitivo: 0.7, 'Sauvignon Blanc': 0.7, Tempranillo: 0.5 },
    Jura: { Barbera: 0.3, Chardonnay: 0.9, 'Pinot Noir': 0.8, Primitivo: 0.2, 'Sauvignon Blanc': 0.6, Tempranillo: 0.2 }
  },
  Spain: {
    Rioja: { Barbera: 0.85, Chardonnay: 0.7, 'Pinot Noir': 0.4, Primitivo: 0.5, 'Sauvignon Blanc': 0.6, Tempranillo: 0.95 },
    'Ribera del Duero': { Barbera: 0.8, Chardonnay: 0.6, 'Pinot Noir': 0.35, Primitivo: 0.4, 'Sauvignon Blanc': 0.5, Tempranillo: 1.0 },
    Jumilla: { Barbera: 0.9, Chardonnay: 0.5, 'Pinot Noir': 0.3, Primitivo: 0.85, 'Sauvignon Blanc': 0.4, Tempranillo: 0.7 },
    'La Mancha': { Barbera: 0.85, Chardonnay: 0.55, 'Pinot Noir': 0.25, Primitivo: 0.8, 'Sauvignon Blanc': 0.5, Tempranillo: 0.9 },
    Jerez: { Barbera: 0.8, Chardonnay: 0.5, 'Pinot Noir': 0.2, Primitivo: 0.7, 'Sauvignon Blanc': 0.4, Tempranillo: 0.4 }
  },
  'United States': {
    'Napa Valley': { Barbera: 0.9, Chardonnay: 1.0, 'Pinot Noir': 0.7, Primitivo: 0.85, 'Sauvignon Blanc': 0.8, Tempranillo: 0.6 },
    'Sonoma County': { Barbera: 0.85, Chardonnay: 0.95, 'Pinot Noir': 0.75, Primitivo: 0.8, 'Sauvignon Blanc': 0.7, Tempranillo: 0.5 },
    'Willamette Valley': { Barbera: 0.4, Chardonnay: 0.85, 'Pinot Noir': 1.0, Primitivo: 0.3, 'Sauvignon Blanc': 0.6, Tempranillo: 0.3 },
    'Finger Lakes': { Barbera: 0.3, Chardonnay: 0.7, 'Pinot Noir': 0.75, Primitivo: 0.2, 'Sauvignon Blanc': 0.5, Tempranillo: 0.25 },
    'Central Coast': { Barbera: 0.85, Chardonnay: 0.8, 'Pinot Noir': 0.6, Primitivo: 0.75, 'Sauvignon Blanc': 0.7, Tempranillo: 0.55 }
  },
  Germany: {
    Mosel: { Barbera: 0.15, Chardonnay: 0.8, 'Pinot Noir': 1.0, Primitivo: 0.1, 'Sauvignon Blanc': 0.8, Tempranillo: 0.15 },
    Rheingau: { Barbera: 0.2, Chardonnay: 0.85, 'Pinot Noir': 0.9, Primitivo: 0.15, 'Sauvignon Blanc': 0.85, Tempranillo: 0.2 },
    Rheinhessen: { Barbera: 0.25, Chardonnay: 0.8, 'Pinot Noir': 0.85, Primitivo: 0.2, 'Sauvignon Blanc': 0.8, Tempranillo: 0.25 },
    Pfalz: { Barbera: 0.3, Chardonnay: 0.75, 'Pinot Noir': 0.8, Primitivo: 0.25, 'Sauvignon Blanc': 0.75, Tempranillo: 0.3 },
    Ahr: { Barbera: 0.1, Chardonnay: 0.7, 'Pinot Noir': 0.95, Primitivo: 0.1, 'Sauvignon Blanc': 0.6, Tempranillo: 0.1 }
  }
} as const satisfies Record<string, Record<string, Record<GrapeVariety, number>>>;


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
  },
  'Tempranillo': {
    name: 'Tempranillo',
    naturalYield: 0.65,
    fragile: 0.45,
    proneToOxidation: 0.5,
    grapeColor: 'red',
    baseCharacteristics: {
      acidity: 0.55, aroma: 0.6, body: 0.65, spice: 0.55, sweetness: 0.45, tannins: 0.65
    },
    description: 'A versatile Iberian grape thriving at altitude, producing structured wines with balanced fruit and tannins.',
    agingProfile: {
      earlyPeak: 3,
      latePeak: 8,
      ageWorthiness: 'high'
    }
  }
} as const;


