import type { WineFeature } from '../wineFeatures';
import type { GameDate } from '../shared/coreTypes';
import type { GrapeVariety } from './vineyardTypes';

export interface WineCharacteristics {
  acidity: number;
  aroma: number;
  body: number;
  spice: number;
  sweetness: number;
  tannins: number;
}

export interface BalanceResult {
  score: number;
  qualifies: boolean;
  adjustedRanges: Record<keyof WineCharacteristics, [number, number]>;
}

export type WineBatchState = 'grapes' | 'must_ready' | 'must_fermenting' | 'bottled';

export interface WineBatch {
  id: string;
  vineyardId: string;
  vineyardName: string;
  grape: GrapeVariety;
  quantity: number;
  batchNumber?: number;
  batchGroupSize?: number;
  state: WineBatchState;
  fermentationProgress?: number;
  bornGrapeQuality: number;
  bornBalance: number;
  grapeQuality: number;
  balance: number;
  characteristics: WineCharacteristics;
  estimatedPrice: number;
  askingPrice?: number;
  bottledGrapeQuality?: number;
  bottledBalance?: number;
  bottledWineScore?: number;
  breakdown?: {
    effects: Array<{
      characteristic: keyof WineCharacteristics;
      modifier: number;
      description: string;
    }>;
  };
  fermentationOptions?: {
    method: 'Basic' | 'Temperature Controlled' | 'Extended Maceration';
    temperature: 'Ambient' | 'Cool' | 'Warm';
  };
  grapeColor: 'red' | 'white';
  naturalYield: number;
  fragile: number;
  proneToOxidation: number;
  features: WineFeature[];
  harvestStartDate: GameDate;
  harvestEndDate: GameDate;
  bottledDate?: GameDate;
  agingProgress?: number;
}

export interface WineLogEntry {
  id: string;
  vineyardId: string;
  vineyardName: string;
  grape: GrapeVariety;
  vintage: number;
  quantity: number;
  grapeQuality: number;
  balance: number;
  wineScore: number;
  characteristics: WineCharacteristics;
  estimatedPrice: number;
  harvestDate: GameDate;
  bottledDate: GameDate;
}
