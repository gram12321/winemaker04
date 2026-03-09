import type { WineFeature } from '../wineFeatures';

export const GRAPE_VARIETIES = [
  'Barbera',
  'Chardonnay',
  'Pinot Noir',
  'Primitivo',
  'Sauvignon Blanc',
  'Tempranillo',
  'Sangiovese'
] as const;

export type GrapeVariety = typeof GRAPE_VARIETIES[number];

export type VineyardStatus = 'Barren' | 'Planting' | 'Planted' | 'Growing' | 'Harvested' | 'Dormant';

export const ASPECTS = [
  'North',
  'Northeast',
  'East',
  'Southeast',
  'South',
  'Southwest',
  'West',
  'Northwest'
] as const;

export type Aspect = typeof ASPECTS[number];

export interface Vineyard {
  id: string;
  name: string;
  country: string;
  region: string;
  hectares: number;
  grape: GrapeVariety | null;
  vineAge: number | null;
  soil: string[];
  altitude: number;
  aspect: Aspect;
  density: number;
  vineyardHealth: number;
  landValue: number;
  vineyardTotalValue: number;
  status: string;
  ripeness: number;
  isRipenessDeclining?: boolean;
  vineyardPrestige: number;
  vineYield: number;
  overgrowth?: {
    vegetation: number;
    debris: number;
    uproot: number;
    replant: number;
  };
  plantingHealthBonus?: number;
  healthTrend?: {
    seasonalDecay: number;
    plantingImprovement: number;
    netChange: number;
  };
  pendingFeatures?: WineFeature[];
}
