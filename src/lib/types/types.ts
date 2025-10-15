import { WineFeature } from './wineFeatures';

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
  yearsSinceLastClearing?: number; // Years since last clearing activity (affects overgrowth modifier)
  plantingHealthBonus?: number; // Gradual health improvement from planting/replanting (0-0.2, increases over 5 years)
  healthTrend?: {
    seasonalDecay: number; // Health lost this season
    plantingImprovement: number; // Health gained from planting/replanting this season
    netChange: number; // Total health change this season
  };
  // annualYieldFactor: number; // Random value simulating vintage yield Commented out as per request
  // annualQualityFactor: number; // Random value simulating vintage quality Commented out as per request
  // farmingMethod: FarmingMethod; // Commented out as per request
  // organicYears: number; // Commented out as per request
  // upgrades?: string[]; // Commented out as per request
  // generateFarmlandPreview not implemented yet (Creates a specific Farmland instance based on country/region for starting conditions)
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
  estimatedPrice: number; // Estimated price per bottle in euros (calculated)
  askingPrice?: number; // User-set asking price per bottle in euros (defaults to estimatedPrice)
  
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
  
  // Wine Features Framework (faults and positive features)
  features: WineFeature[];
  
  harvestStartDate: GameDate; // first week/season/year grapes were harvested for this batch
  harvestEndDate: GameDate; // last week/season/year grapes were harvested for this batch
  bottledDate?: GameDate; // When bottling is completed
  
  // Aging tracking (weeks since bottling)
  agingProgress?: number; // Weeks aged in bottle (0 if not bottled)
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
  estimatedPrice: number; // Estimated price per bottle when bottled
  harvestDate: GameDate;
  bottledDate: GameDate;
  // created_at removed; use bottledDate for ordering
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
    featurePriceMultiplier?: number; // Feature impact on price (oxidation, etc.)
    
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

// Discriminated union payloads for prestige events
export type PrestigeEventType =
  | 'company_value'
  | 'sale'
  | 'contract'
  | 'penalty'
  | 'cellar_collection'
  | 'achievement'
  | 'vineyard_sale'
  | 'vineyard_base'
  | 'vineyard_achievement'
  | 'vineyard_age'
  | 'vineyard_land'
  | 'wine_feature';

export interface PrestigePayloadBase { }

export interface PrestigePayloadCompanyValue extends PrestigePayloadBase {
  companyMoney: number;
  maxLandValue: number;
  prestigeBase01: number;
}

export interface PrestigePayloadVineyardCommon extends PrestigePayloadBase {
  vineyardId: string;
  vineyardName: string;
}

export interface PrestigePayloadVineyardAge extends PrestigePayloadVineyardCommon {
  vineAge: number;
  ageBase01: number;
  ageWithSuitability01: number;
}

export interface PrestigePayloadVineyardLand extends PrestigePayloadVineyardCommon {
  totalValue: number;
  landValuePerHectare: number;
  hectares: number;
  maxLandValue: number;
  landBase01: number;
  landWithSuitability01: number;
}

export interface PrestigePayloadVineyardSale extends PrestigePayloadVineyardCommon {
  customerName: string;
  wineName: string;
  saleValue: number;
  vineyardPrestigeFactor: number;
}

export interface PrestigePayloadVineyardAchievement extends PrestigePayloadVineyardCommon {
  event: 'planting' | 'aging' | 'improvement' | 'harvest';
}

export type PrestigeEventPayload =
  | { type: 'company_value'; payload: PrestigePayloadCompanyValue }
  | { type: 'sale'; payload: { customerName: string; wineName: string; saleValue: number } }
  | { type: 'contract'; payload: Record<string, unknown> }
  | { type: 'penalty'; payload: Record<string, unknown> }
  | { type: 'vineyard_sale'; payload: PrestigePayloadVineyardSale }
  | { type: 'vineyard_base'; payload: PrestigePayloadVineyardCommon }
  | { type: 'vineyard_achievement'; payload: PrestigePayloadVineyardAchievement }
  | { type: 'vineyard_age'; payload: PrestigePayloadVineyardAge }
  | { type: 'vineyard_land'; payload: PrestigePayloadVineyardLand };

// Prestige system interfaces
export interface PrestigeEvent {
  id: string;
  type: PrestigeEventType;
  amount: number; // current or base amount depending on context
  timestamp: number;
  decayRate: number; // 0 for base, 0.95 for sales, etc.
  description?: string; // optional; UI should derive from metadata
  sourceId?: string; // vineyard ID, etc.
  created_at?: string;
  updated_at?: string;
  
  // UI-required fields (calculated by service layer)
  originalAmount?: number; // Original amount when created
  currentAmount?: number;  // Current amount after decay
  
  // Structured metadata for UI display (computed at event creation)
  metadata?: PrestigeEventPayload extends { type: infer T; payload: infer P }
    ? T extends PrestigeEventType
      ? P
      : never
    : never;
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

// ===== STAFF TYPES =====

// Nationality options for staff members
export type Nationality = 'Italy' | 'Germany' | 'France' | 'Spain' | 'United States';

// Skill key type - the 5 core skills in the game
export type SkillKey = 'field' | 'winery' | 'administration' | 'sales' | 'maintenance';

// ===== NOTIFICATION TYPES =====

/**
 * Notification categories - unified system for all notification types
 * 
 * Maps to COLOR_MAPPING keys:
 * - 6 main categories: system, field, winery, administration, sales, maintenance
 * - 4 sub-categories: time, staff, finance, tasks
 */
export enum NotificationCategory {
  // System notifications
  SYSTEM = 'system',
  
  // Activity-related notifications (map to core skills)
  VINEYARD_OPERATIONS = 'field',
  WINEMAKING_PROCESS = 'winery',
  ADMINISTRATION = 'administration',
  SALES_ORDERS = 'sales',
  MAINTENANCE = 'maintenance',
  
  // Sub-category notifications (distinct colors, hierarchically under administration)
  TIME_CALENDAR = 'time',          // Cyan - scheduling and calendar
  STAFF_MANAGEMENT = 'staff',      // Teal - HR and people management
  FINANCE = 'finance',             // Yellow/Gold - money and budgets
  ACTIVITIES_TASKS = 'tasks'       // Indigo - task and activity management
}

// Staff skills interface - all skills are 0-1 scale
export interface StaffSkills {
  field: number;        // Vineyard work
  winery: number;       // Wine production
  administration: number; // Administrative tasks
  sales: number;        // Sales and marketing
  maintenance: number;  // Building and equipment maintenance
}

// Staff member interface
export interface Staff {
  id: string;
  name: string;
  nationality: Nationality;
  skillLevel: number;  // 0-1 scale, overall skill level
  specializations: string[]; // Array of specialization keys (e.g., 'field', 'winery')
  wage: number;        // Monthly wage in euros
  teamIds: string[];   // Multiple team assignments (replaces single teamId)
  skills: StaffSkills;
  workforce: number;   // Base work capacity (default 50)
  hireDate: GameDate;
}

// ===== TEAM MANAGEMENT TYPES =====

// Staff team interface - for organizing staff into teams
export interface StaffTeam {
  id: string;
  name: string;
  description: string;
  memberIds: string[]; // Array of staff member IDs
  icon?: string; // Optional icon for the team
  defaultTaskTypes: string[]; // Task types that this team handles
}

// ===== STAFF SEARCH TYPES =====

/**
 * Pending staff search results
 * Temporary storage for candidates generated from completed search activity
 */
export interface PendingStaffCandidates {
  activityId: string;
  candidates: Staff[];
  searchOptions: {
    numberOfCandidates: number;
    skillLevel: number;
    specializations: string[];
  };
  timestamp: number;
}

// ===== ACHIEVEMENT SYSTEM =====

/**
 * Achievement categories for organization and filtering
 */
export type AchievementCategory = 'financial' | 'production' | 'time' | 'prestige' | 'special';

/**
 * Achievement rarity levels
 */
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * Achievement condition types
 */
export type AchievementConditionType = 
  | 'money_threshold'       // Check if company money >= threshold
  | 'prestige_threshold'    // Check if company prestige >= threshold
  | 'time_threshold'        // Check if company age >= threshold (in years)
  | 'sales_count'           // Check if total sales count >= threshold
  | 'sales_value'           // Check if total sales value >= threshold
  | 'production_count'      // Check if total wines produced >= threshold
  | 'bottles_produced'      // Check if total bottles produced >= threshold
  | 'vineyard_count'        // Check if vineyard count >= threshold
  | 'custom';               // Custom condition with checker function

/**
 * Achievement condition configuration
 */
export interface AchievementCondition {
  type: AchievementConditionType;
  threshold?: number;        // For numeric thresholds
  customChecker?: string;    // For custom conditions (function name)
}

/**
 * Achievement prestige configuration
 */
export interface AchievementPrestigeConfig {
  company?: {
    baseAmount: number;
    decayRate: number;        // 0 for permanent, >0 for decaying
  };
  vineyard?: {
    baseAmount: number;
    decayRate: number;
    vineyardId?: string;      // Optional specific vineyard
  };
}

/**
 * Achievement definition (constant configuration)
 */
export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  condition: AchievementCondition;
  prestige?: AchievementPrestigeConfig;
  hidden?: boolean;          // Hidden until unlocked
}

/**
 * Achievement unlock record (database record)
 */
export interface AchievementUnlock {
  id: string;
  achievementId: string;
  companyId: string;
  unlockedAt: GameDate;
  unlockedAtTimestamp: number;
  progress?: number;         // Current progress towards achievement
  metadata?: {
    value?: number;          // Value at unlock (e.g., money amount, prestige amount)
    [key: string]: any;
  };
}

/**
 * Achievement with unlock status (UI display)
 */
export interface AchievementWithStatus extends AchievementConfig {
  isUnlocked: boolean;
  unlockedAt?: GameDate;
  progress?: {
    current: number;
    target: number;
    unit: string;
  };
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
  staff?: Staff[]; // Active staff members
  teams?: StaffTeam[]; // Staff teams
  pendingStaffCandidates?: PendingStaffCandidates;
}
