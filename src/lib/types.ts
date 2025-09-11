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
  
  // Pricing factors (using placeholders for now)
  landValue?: number; // Land value factor (0-1 scale) - will be calculated from region/soil/etc
  fieldPrestige?: number; // Field prestige factor (0-1 scale) - will be calculated from vine age/health/etc
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
  
  // Wine quality properties (0-1 scale)
  quality: number; // Overall wine quality (0-1)
  balance: number; // Wine balance/body (0-1)
  finalPrice: number; // Calculated base price per bottle in euros
  askingPrice?: number; // User-set asking price per bottle in euros (defaults to finalPrice)
  
  harvestDate: GameDate;
  createdAt: GameDate;
  completedAt?: GameDate; // When bottling is completed
}

// Wine order types for sales system
export type OrderType = 'Local Restaurant' | 'Wine Shop' | 'Private Collector' | 'Export Order';

// Wine order interface for sales operations
export interface WineOrder {
  id: string;
  orderedAt: GameDate;
  orderType: OrderType;
  wineBatchId: string;
  wineName: string; // Formatted wine name
  requestedQuantity: number; // bottles requested
  offeredPrice: number; // price per bottle
  totalValue: number; // requestedQuantity × offeredPrice
  fulfillableQuantity?: number; // bottles that can actually be fulfilled (calculated at fulfillment time)
  fulfillableValue?: number; // fulfillableQuantity × offeredPrice
  askingPriceAtOrderTime?: number; // asking price at the time the order was placed
  status: 'pending' | 'fulfilled' | 'rejected' | 'partially_fulfilled';
}

// Game State (time/financial/company data, vineyards/inventory now in separate DB tables)
export interface GameState {
  // Time Management
  week: number;
  season: Season;
  currentYear: number;
  
  // Company Identity
  companyName: string;
  foundedYear: number; // Year the company was founded
  
  // Financial & Reputation
  money: number;
  prestige: number; // Company prestige for order generation scaling
}
