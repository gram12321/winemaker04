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

// Customer types for sales system (matching importer types)
export type CustomerType = 'Restaurant' | 'Wine Shop' | 'Private Collector' | 'Chain Store';

// Customer countries and regional data
export type CustomerCountry = 'France' | 'Germany' | 'Italy' | 'Spain' | 'United States';

// Customer characteristics for sophisticated order generation
export interface Customer {
  id: string;
  name: string;
  country: CustomerCountry;
  customerType: CustomerType;
  
  // Regional characteristics (0-1 scale)
  purchasingPower: number; // Affects price tolerance and order amounts
  wineTradition: number; // Affects wine quality preferences and price premiums
  marketShare: number; // Affects order size multipliers (0-1 scale)
  
  // Behavioral multipliers (calculated from characteristics)
  priceMultiplier: number; // How much they're willing to pay relative to base price
  
  // Relationship tracking (for future contract system)
  relationship?: number; // 0-100 scale for relationship strength
  activeCustomer?: boolean; // True if customer has placed orders (actively interacting with company)
}


// Wine order interface for sales operations
export interface WineOrder {
  id: string;
  orderedAt: GameDate;
  customerType: CustomerType;
  wineBatchId: string;
  wineName: string; // Formatted wine name
  requestedQuantity: number; // bottles requested
  offeredPrice: number; // price per bottle
  totalValue: number; // requestedQuantity × offeredPrice
  fulfillableQuantity?: number; // bottles that can actually be fulfilled (calculated at fulfillment time)
  fulfillableValue?: number; // fulfillableQuantity × offeredPrice
  askingPriceAtOrderTime?: number; // asking price at the time the order was placed
  status: 'pending' | 'fulfilled' | 'rejected' | 'partially_fulfilled';
  
  // Customer information
  customerId: string; // Reference to the Customer who placed this order
  customerName: string; // For display purposes
  customerCountry: CustomerCountry; // For display and regional analysis
  customerRelationship?: number; // Customer relationship strength (0-100)
  
  // Calculation data for tooltips and analysis
  calculationData?: {
    // Price multiplier calculation
    estimatedBaseMultiplier: number;
    purchasingPowerMultiplier: number;
    wineTraditionMultiplier: number;
    marketShareMultiplier: number;
    finalPriceMultiplier: number;
    
    // Quantity calculation
    baseQuantity: number;
    priceSensitivity: number;
    quantityMarketShareMultiplier: number;
    finalQuantity: number;
    
    // Rejection analysis
    baseRejectionProbability: number;
    multipleOrderModifier: number;
    finalRejectionProbability: number;
    randomValue: number;
    wasRejected: boolean;
  };
}

// Prestige system interfaces
export interface PrestigeEvent {
  id: string;
  type: 'vineyard' | 'company_value' | 'sale' | 'contract' | 'penalty';
  amount: number;
  timestamp: number;
  decayRate: number; // 0 for base, 0.95 for sales, etc.
  description: string;
  sourceId?: string; // vineyard ID, etc.
  created_at?: string;
  updated_at?: string;
}

export interface RelationshipBoost {
  id: string;
  customerId: string;
  amount: number;
  timestamp: number;
  decayRate: number;
  description: string;
  created_at?: string;
  updated_at?: string;
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
