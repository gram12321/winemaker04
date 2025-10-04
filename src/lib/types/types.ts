
// ===== CORE TYPES =====

// WorkCategory enum - defines all activity types in the game
export enum WorkCategory {
  PLANTING = 'PLANTING',
  HARVESTING = 'HARVESTING',
  CRUSHING = 'CRUSHING',
  FERMENTATION = 'FERMENTATION',
  CLEARING = 'CLEARING',
  UPROOTING = 'UPROOTING',
  BUILDING = 'BUILDING',
  UPGRADING = 'UPGRADING',
  MAINTENANCE = 'MAINTENANCE',
  STAFF_SEARCH = 'STAFF_SEARCH',
  ADMINISTRATION = 'ADMINISTRATION'
}

// Time System
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

// Game Date structure
export interface GameDate {
  week: number;
  season: Season;
  year: number;
}

// ===== VINEYARD TYPES =====

// Grape varieties - single source of truth
export const GRAPE_VARIETIES = [
  'Barbera',
  'Chardonnay',
  'Pinot Noir',
  'Primitivo',
  'Sauvignon Blanc'
] as const;
export type GrapeVariety = typeof GRAPE_VARIETIES[number];

// Vineyard status types
export type VineyardStatus = 'Barren' | 'Planted' | 'Growing' | 'Harvested' | 'Dormant';

// New vineyard-related types for v3 expansion
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

// Vineyard interface - expanded with v3 parameters
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
  density: number; // Vine density (vines per hectare)
  vineyardHealth: number; // Vineyard health (0-1 scale, affects yield quality)
  landValue: number;
  vineyardTotalValue: number; // Calculated as landValue * hectares
  status: string;
  ripeness: number; // Grape ripeness (0-1 scale, affects harvest readiness)
  vineyardPrestige: number;
  vineYield: number; // Persistent vine yield factor (0-1+ scale, can exceed 1.0)
  // completedClearingTasks: string[]; // Commented out as per request
  // annualYieldFactor: number; // Random value simulating vintage yield Commented out as per request
  // annualQualityFactor: number; // Random value simulating vintage quality Commented out as per request
  // farmingMethod: FarmingMethod; // Commented out as per request
  // organicYears: number; // Commented out as per request
  // remainingYield: number | null; // Used in old iterations, for tracking yield doing harvest. Commented out as per request
  // upgrades?: string[]; // Commented out as per request
  // generateFarmlandPreview not implemented yet (Creates a specific Farmland instance based on country/region for starting conditions)
  
  // Prestige events for this vineyard
  prestigeEvents?: PrestigeEvent[];
}

// Derived, ephemeral prestige factor outputs for UI/tooltips and event creation
export interface VineyardPrestigeFactors {
  // Context values for tooltips/UI
  maxLandValue: number; // € per ha max (excl. premium regions)
  landValuePerHectare: number; // € per ha

  // Base 0..1 stages (derived)
  ageBase01: number; // vineyardAgePrestigeModifier(age)
  landBase01: number; // log(totalValue/maxLandValue + 1)
  ageWithSuitability01: number; // clamp01(ageBase01 * suitability)
  landWithSuitability01: number; // clamp01(landBase01 * suitability)

  // Scaled (event amounts; >= 0)
  ageScaled: number; // calculateAsymmetricalMultiplier(ageWithSuitability01) - 1
  landScaled: number; // calculateAsymmetricalMultiplier(landWithSuitability01) - 1
}

// ===== WINE TYPES =====

// Wine characteristics interface
export interface WineCharacteristics {
  acidity: number;      // 0-1 scale
  aroma: number;        // 0-1 scale
  body: number;         // 0-1 scale
  spice: number;        // 0-1 scale
  sweetness: number;    // 0-1 scale
  tannins: number;      // 0-1 scale
}

// Balance calculation result interface
export interface BalanceResult {
  score: number;        // 0-1 balance score
  qualifies: boolean;   // Whether wine qualifies for any archetype (placeholder)
  dynamicRanges: Record<keyof WineCharacteristics, [number, number]>; // Adjusted ranges (placeholder)
}

// Wine batch state - unified system replacing separate stage/process
export type WineBatchState = 
  | 'grapes'           // Ready for crushing
  | 'must_ready'       // Ready for fermentation  
  | 'must_fermenting'  // Currently fermenting
  | 'bottled';         // Completed

// Wine batch interface for winery operations
export interface WineBatch {
  id: string;
  vineyardId: string;
  vineyardName: string;
  grape: GrapeVariety;
  quantity: number; // in kg or bottles
  state: WineBatchState;
  fermentationProgress?: number; // 0-100% for fermentation tracking
  
  // Wine quality properties (0-1 scale)
  quality: number; // Overall wine quality (0-1)
  balance: number; // Wine balance/body (0-1)
  characteristics: WineCharacteristics; // Individual wine characteristics
  finalPrice: number; // Calculated base price per bottle in euros
  askingPrice?: number; // User-set asking price per bottle in euros (defaults to finalPrice)
  
  // Breakdown data for UI tooltips (tracks all characteristic modifications)
  breakdown?: {
    effects: Array<{
      characteristic: keyof WineCharacteristics;
      modifier: number;
      description: string; // Shows effect name (e.g., "Ripeness", "Altitude") not source
    }>;
  };
  
  // Fermentation options (stored when fermentation starts)
  fermentationOptions?: {
    method: 'Basic' | 'Temperature Controlled' | 'Extended Maceration';
    temperature: 'Ambient' | 'Cool' | 'Warm';
  };
  
  // Grape metadata (0-1 scale unless specified)
  grapeColor: 'red' | 'white';
  naturalYield: number; // 0-1 scale, affects harvest yield
  fragile: number; // 0-1 scale, affects work requirements (0=robust, 1=fragile)
  proneToOxidation: number; // 0-1 scale, affects wine stability
  
  harvestDate: GameDate;
  createdAt: GameDate;
  completedAt?: GameDate; // When bottling is completed
}

// Wine production log entry - recorded when wine is bottled
export interface WineLogEntry {
  id: string;
  vineyardId: string;
  vineyardName: string;
  grape: GrapeVariety;
  vintage: number; // Year the grapes were harvested
  quantity: number; // Bottles produced
  quality: number; // Overall wine quality (0-1)
  balance: number; // Wine balance/body (0-1)
  characteristics: WineCharacteristics; // Individual wine characteristics
  finalPrice: number; // Price per bottle when bottled
  harvestDate: GameDate;
  bottledDate: GameDate;
  created_at: string; // Database timestamp
}

// ===== SALES TYPES =====

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

// ===== PRESTIGE TYPES =====

// Prestige system interfaces
export interface PrestigeEvent {
  id: string;
  type: 'vineyard' | 'company_value' | 'sale' | 'contract' | 'penalty' | 'vineyard_sale' | 'vineyard_base' | 'vineyard_achievement' | 'vineyard_age' | 'vineyard_land';
  amount: number;
  timestamp: number;
  decayRate: number; // 0 for base, 0.95 for sales, etc.
  description: string;
  sourceId?: string; // vineyard ID, etc.
  created_at?: string;
  updated_at?: string;
  
  // UI-required fields (calculated by service layer)
  originalAmount?: number; // Original amount when created
  currentAmount?: number;  // Current amount after decay
  category?: 'company' | 'vineyard'; // Computed category for UI grouping
  
  // Structured metadata for UI display (optional, computed at event creation)
  metadata?: {
    vineyardName?: string;
    vineyardId?: string;
    // For vineyard_age events
    vineAge?: number;
    ageBase01?: number;
    ageWithSuitability01?: number;
    // For vineyard_land events  
    totalValue?: number;
    landValuePerHectare?: number;
    hectares?: number;
    maxLandValue?: number;
    landBase01?: number;
    landWithSuitability01?: number;
    // For sales
    customerName?: string;
    wineName?: string;
    saleValue?: number;
  };
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

// ===== FINANCE TYPES =====

// Financial transaction interface
export interface Transaction {
  id: string;
  date: GameDate;
  amount: number; // Positive for income, negative for expense
  description: string;
  category: string;
  recurring: boolean;
  money: number; // Money amount after transaction
}

// ===== ACTIVITY TYPES =====

export interface Activity {
  id: string;
  category: WorkCategory;
  title: string;
  totalWork: number;
  completedWork: number;
  targetId?: string; // vineyard ID, building ID, etc.
  params: Record<string, any>; // grape variety, density, etc.
  status: 'active' | 'cancelled';
  gameWeek: number;
  gameSeason: string;
  gameYear: number;
  isCancellable: boolean;
  createdAt: Date;
}

export interface ActivityCreationOptions {
  category: WorkCategory;
  title: string;
  totalWork: number;
  targetId?: string;
  params?: Record<string, any>;
  isCancellable?: boolean;
}

export interface ActivityProgress {
  activityId: string;
  progress: number; // 0-100
  isComplete: boolean;
  timeRemaining?: string; // estimated time remaining
}

// ===== GAME STATE =====

export interface GameState {
  week: number;
  season: Season;
  currentYear: number;
  companyName: string;
  foundedYear: number; // Year the company was founded
  money: number;
  prestige: number; // Company prestige for order generation scaling
  activities?: Activity[]; // Active activities
}
