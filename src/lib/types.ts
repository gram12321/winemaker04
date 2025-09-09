// Game Types and Interfaces

// Time System
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

// Game Date structure
export interface GameDate {
  week: number;
  season: Season;
  year: number;
}

export function formatGameDate(date: GameDate): string {
  return `Week ${date.week}, ${date.season} ${date.year}`;
}

// Grape varieties (simplified to match what's actually used)
export type GrapeVariety = 'Chardonnay' | 'Pinot Noir' | 'Cabernet Sauvignon' | 'Merlot';

// Vineyard status types
export type VineyardStatus = 'Barren' | 'Planted' | 'Growing' | 'Harvested' | 'Dormant';

// Vineyard interface
export interface Vineyard {
  id: string;
  name: string;
  country: string;
  region: string;
  acres: number;
  grape: GrapeVariety | null;
  isPlanted: boolean; // Boolean for planted/barren state
  status: VineyardStatus;
  createdAt: GameDate;
}


// Wine batch stages and processes
export type WineBatchStage = 'grapes' | 'must' | 'wine' | 'bottled';
export type WineBatchProcess = 'none' | 'fermentation' | 'aging' | 'bottled';

// Wine batch interface for winery operations
export interface WineBatch {
  id: string;
  vineyardId: string;
  vineyardName: string;
  grape: GrapeVariety;
  quantity: number; // in kg or bottles
  stage: WineBatchStage;
  process: WineBatchProcess;
  fermentationProgress?: number; // 0-100% for fermentation tracking
  harvestDate: GameDate;
  createdAt: GameDate;
  completedAt?: GameDate; // When bottling is completed
}

// Game State (only time/financial data, vineyards/inventory now in separate DB tables)
export interface GameState {
  // Time Management
  week: number;
  season: Season;
  currentYear: number;
  
  // Financial
  money: number;
  prestige: number;
}
