// Game Types and Interfaces

// Time System
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];
export const WEEKS_PER_SEASON = 12;
export const STARTING_WEEK = 1;
export const STARTING_SEASON: Season = 'Spring';
export const STARTING_YEAR = 2025;

// Game Date structure
export interface GameDate {
  week: number;
  season: Season;
  year: number;
}

export function formatGameDate(date: GameDate): string {
  return `Week ${date.week}, ${date.season} ${date.year}`;
}

// Grape varieties
export type GrapeVariety = 'Barbera' | 'Chardonnay' | 'Pinot Noir' | 'Primitivo' | 'Sauvignon Blanc' | 'Cabernet Sauvignon' | 'Merlot';

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

// Inventory item interface
export interface InventoryItem {
  id: string;
  grape: GrapeVariety;
  quantity: number; // in kg
  vineyardName: string;
}

// Game State
export interface GameState {
  // Time Management
  week: number;
  season: Season;
  currentYear: number;
  
  // Financial
  money: number;
  prestige: number;
  
  // Core systems
  vineyards: Vineyard[];
  inventory: InventoryItem[];
}

// Initial game state
export const initialGameState: GameState = {
  // Time
  week: STARTING_WEEK,
  season: STARTING_SEASON,
  currentYear: STARTING_YEAR,
  
  // Financial
  money: 10000000, // €10M starting capital like in old version
  prestige: 1,
  
  // Systems
  vineyards: [],
  inventory: []
};
