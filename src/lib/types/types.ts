import { WineFeature } from './wineFeatures';

// ===== CORE TYPES =====

// WorkCategory enum - defines all activity types in the game
export enum WorkCategory {
  PLANTING = 'PLANTING',
  HARVESTING = 'HARVESTING',
  CRUSHING = 'CRUSHING',
  FERMENTATION = 'FERMENTATION',
  CLEARING = 'CLEARING',
  BUILDING = 'BUILDING',
  UPGRADING = 'UPGRADING',
  ADMINISTRATION_AND_RESEARCH = 'ADMINISTRATION_AND_RESEARCH',
  STAFF_SEARCH = 'STAFF_SEARCH',
  STAFF_HIRING = 'STAFF_HIRING',
  LAND_SEARCH = 'LAND_SEARCH',
  LENDER_SEARCH = 'LENDER_SEARCH',
  TAKE_LOAN = 'TAKE_LOAN',
  FINANCE_AND_STAFF = 'FINANCE_AND_STAFF'
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

// Vineyard status types
export type VineyardStatus = 'Barren' | 'Planting' | 'Planted' | 'Growing' | 'Harvested' | 'Dormant';

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
  isRipenessDeclining?: boolean; // Indicates ripeness is currently trending downward (e.g., winter decay)
  vineyardPrestige: number;
  vineYield: number; // Persistent vine yield factor (0-1+ scale, can exceed 1.0)
  overgrowth?: {
    vegetation: number; // Years since last clear-vegetation
    debris: number;     // Years since last remove-debris  
    uproot: number;      // Years since last uproot-vines
    replant: number;     // Years since last replant-vines
  };
  plantingHealthBonus?: number; // Gradual health improvement from planting/replanting (0-0.2, increases over 5 years)
  healthTrend?: {
    seasonalDecay: number; // Health lost this season
    plantingImprovement: number; // Health gained from planting/replanting this season
    netChange: number; // Total health change this season
  };
  pendingFeatures?: WineFeature[]; // Features that develop before harvest (e.g., Noble Rot)
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
  adjustedRanges: Record<keyof WineCharacteristics, [number, number]>; // Adjusted ranges from balance calculation
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
  batchNumber?: number; // Sequential identifier for duplicate vintage/vineyard batches
  batchGroupSize?: number; // Total batches sharing the same vintage/vineyard combination
  state: WineBatchState;
  fermentationProgress?: number; // 0-100% for fermentation tracking

  // Wine quality properties (0-1 scale)
  // Quality lifecycle: born (harvest) → current (evolving) → bottled (snapshot)
  bornGrapeQuality: number; // Original vineyard quality at harvest (immutable)
  bornBalance: number; // Original balance at harvest (immutable)
  grapeQuality: number; // Current grape quality (modified by features throughout lifecycle)
  balance: number; // Current wine balance (modified by features throughout lifecycle)
  characteristics: WineCharacteristics; // Individual wine characteristics
  estimatedPrice: number; // Estimated price per bottle in euros (calculated)
  askingPrice?: number; // User-set asking price per bottle in euros (defaults to estimatedPrice)

  // Bottling snapshots (frozen values at bottling time for WineLog)
  bottledGrapeQuality?: number; // Grape quality at bottling (snapshot for historical records)
  bottledBalance?: number; // Balance at bottling (snapshot for historical records)
  bottledWineScore?: number; // Wine score at bottling (snapshot for historical records)

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
  grapeQuality: number; // Overall grape quality (0-1)
  balance: number; // Wine balance/body (0-1)
  wineScore: number; // Overall wine score (grape quality + balance) / 2
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

export interface DifficultyPreference {
  target: number;    // Target difficulty score (0-1) this customer type is most comfortable with.
  tolerance: number; // How wide the comfort band is around the target (0-1). Smaller values mean sharper preferences.
  weight: number;    // How strongly the customer type cares about difficulty (0-1). 0 ignores difficulty, 1 makes it dominant.
  bias: number;      // Bias toward easier (0) or harder (1) grapes, 0.5 represents neutral.
}

// Customer characteristics for sophisticated order generation
export interface Customer {
  id: string;
  name: string;
  country: CustomerCountry;
  customerType: CustomerType;

  // Regional characteristics (0-1 scale)
  purchasingPower: number; // Affects price tolerance and order amounts
  wineTradition: number; // Affects wine grape quality preferences and price premiums
  marketShare: number; // Affects order size multipliers (0-1 scale)

  // Behavioral multipliers (calculated from characteristics)
  priceMultiplier: number; // How much they're willing to pay relative to base price

  // Relationship tracking (for future contract system)
  relationship?: number; // 0-100 scale for relationship strength
  activeCustomer?: boolean; // True if customer has placed orders (actively interacting with company)
  difficultyPreference?: DifficultyPreference; // Difficulty affinity used when valuing wines
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
  status: 'pending' | 'fulfilled' | 'rejected' | 'partially_fulfilled' | 'expired';

  // Order expiration
  expiresAt: number; // Absolute week number for efficient comparison (used in expireOldOrders)
  expiresWeek: number; // Week component for display
  expiresSeason: Season; // Season component for display
  expiresYear: number; // Year component for display

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
    relationshipBonusMultiplier: number;
    relationshipAdjustedMultiplier: number;

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
    difficulty?: {
      grapeDifficulty: number;
      affinity: number;
      priceFactor: number;
      quantityFactor: number;
      rejectionFactor: number;
    };
  };
}

// ===== CONTRACT TYPES =====

// Requirement types for contracts
export type ContractRequirementType = 'quality' | 'minimumVintage' | 'specificVintage' | 'balance' | 'landValue' | 'grape' | 'grapeColor' | 'altitude' | 'aspect' | 'characteristicMin' | 'characteristicMax' | 'characteristicBalance';

// Individual contract requirement
export interface ContractRequirement {
  type: ContractRequirementType;
  value: number; // For quality/balance/altitude: 0-1 threshold, for landValue: absolute €/ha, for minimumVintage: minimum age in years, for specificVintage: target year, for characteristics: 0-1 threshold or maxTotalDistance
  params?: {
    minAge?: number; // For minimumVintage requirements
    maxAge?: number; // For minimumVintage requirements (optional)
    targetYear?: number; // For specificVintage requirements
    targetGrape?: GrapeVariety; // For grape requirements
    targetGrapeColor?: 'red' | 'white'; // For grapeColor requirements
    targetCharacteristic?: keyof WineCharacteristics; // For characteristic requirements (acidity, aroma, body, spice, sweetness, tannins)
  };
}

// Contract status types
export type ContractStatus = 'pending' | 'fulfilled' | 'rejected' | 'expired';

// Multi-year contract terms
export interface ContractTerms {
  durationYears: number; // Total contract duration (1-5 years)
  deliveriesPerYear: number; // How many deliveries per year (1-4, once per season)
  totalDeliveries: number; // Total number of expected deliveries
  deliveriesCompleted: number; // How many deliveries have been fulfilled
  nextDeliveryDate?: GameDate; // When the next delivery is expected
}

// Wine contract interface
export interface WineContract {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerCountry: CustomerCountry;
  customerType: CustomerType;

  // Contract requirements
  requirements: ContractRequirement[];
  requestedQuantity: number; // bottles per delivery
  offeredPrice: number; // price per bottle
  totalValue: number; // requestedQuantity × offeredPrice (per delivery)

  // Contract status
  status: ContractStatus;

  // Date tracking (decomposed GameDate for database compatibility)
  createdWeek: number;
  createdSeason: Season;
  createdYear: number;

  expiresWeek: number;
  expiresSeason: Season;
  expiresYear: number;

  fulfilledWeek?: number;
  fulfilledSeason?: Season;
  fulfilledYear?: number;

  rejectedWeek?: number;
  rejectedSeason?: Season;
  rejectedYear?: number;

  // Multi-year terms (optional, if undefined it's a single delivery)
  terms?: ContractTerms;

  // Fulfillment tracking
  fulfilledWineBatchIds?: string[]; // Track which wine batches were used

  // Relationship context
  relationshipAtCreation: number; // Customer relationship when contract was offered

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

// ===== PRESTIGE TYPES =====

// Discriminated union payloads for prestige events
export type PrestigeEventType =
  | 'company_finance'
  | 'company_story'
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

export interface PrestigePayloadCompanyFinance extends PrestigePayloadBase {
  // For company value events
  companyNetWorth?: number;
  maxLandValue?: number;
  prestigeBase01?: number;

  // For loan default events
  reason?: string;
  lenderName?: string;
  lenderType?: string;
  loanAmount?: number;
  missedPaymentAmount?: number;
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

export interface PrestigePayloadCompanyStory extends PrestigePayloadBase {
  title?: string;
  description?: string;
  summary?: string;
  origin?: string;
  family?: string;
}

export type PrestigeEventPayload =
  | { type: 'company_finance'; payload: PrestigePayloadCompanyFinance }
  | { type: 'company_story'; payload: PrestigePayloadCompanyStory }
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
  created_at?: string; // Optional timestamp for sorting
}

// ===== ECONOMY TYPES =====
export type EconomyPhase = 'Crash' | 'Recession' | 'Stable' | 'Expansion' | 'Boom';

export type LenderType = 'Bank' | 'Investment Fund' | 'Private Lender' | 'QuickLoan';

export interface Lender {
  id: string;
  name: string;
  type: LenderType;

  // Financial characteristics (0-1 scale)
  riskTolerance: number; // Higher = lends to lower credit ratings
  flexibility: number; // Higher = better terms, longer durations
  marketPresence: number; // Affects availability/visibility

  // Calculated multipliers
  baseInterestRate: number; // Base rate (e.g., 0.05 = 5%)

  // Loan parameters
  minLoanAmount: number;
  maxLoanAmount: number;
  minDurationSeasons: number;
  maxDurationSeasons: number;

  // Origination fee configuration
  originationFee: {
    basePercent: number; // Base fee as percentage of loan amount (e.g., 0.015 = 1.5%)
    minFee: number; // Minimum fee amount
    maxFee: number; // Maximum fee amount
    creditRatingModifier: number; // How much credit rating affects fees (0.7 = 30% discount for excellent credit)
    durationModifier: number; // How much duration affects fees (1.2 = 20% premium for long-term)
  };

  // Relationship tracking
  blacklisted?: boolean; // If player defaulted on this lender
}

export type LoanCategory = 'standard' | 'emergency' | 'restructured';

export interface Loan {
  id: string;
  lenderId: string;
  lenderName: string;
  lenderType: LenderType;

  principalAmount: number;
  baseInterestRate: number; // Original base rate
  economyPhaseAtCreation: EconomyPhase; // For display/reference
  effectiveInterestRate: number; // Actual rate after all modifiers

  originationFee: number; // One-time fee paid when loan is taken

  remainingBalance: number;
  seasonalPayment: number;
  seasonsRemaining: number;
  totalSeasons: number;

  startDate: GameDate;
  nextPaymentDue: GameDate;

  missedPayments: number;
  status: 'active' | 'paid_off' | 'defaulted';
  isForced?: boolean;
  loanCategory?: LoanCategory;
}

// Lender Search Options (for activity system)
export interface LenderSearchOptions {
  numberOfOffers: number; // How many loan offers to generate (default 3)
  lenderTypes: LenderType[]; // Which types to search (default all)
  loanAmountRange: [number, number]; // Min and max loan amounts to filter offers
  durationRange: [number, number]; // Min and max durations to filter offers (in seasons)
  searchCost: number; // Computed cost
  searchWork: number; // Computed work units
}

// Loan Offer (result of lender search)
export interface LoanOffer {
  id: string; // Unique ID for this offer
  lender: Lender; // The lender making the offer
  principalAmount: number; // Fixed offer amount
  durationSeasons: number; // Fixed offer duration
  effectiveInterestRate: number; // Calculated rate
  seasonalPayment: number; // Calculated payment
  originationFee: number; // Calculated fee
  totalInterest: number; // Total interest over life of loan
  totalExpenses: number; // originationFee + totalInterest
  isAvailable: boolean; // Whether lender is willing to offer (credit check)
  unavailableReason?: string; // Why not available (if applicable)
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
  // Optional details appended to the generic start notification
  activityDetails?: string;
  // Skip the default activity creation notification (useful for combined notifications)
  skipNotification?: boolean;
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
export type SkillKey = 'field' | 'winery' | 'financeAndStaff' | 'sales' | 'administrationAndResearch';

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
  ADMINISTRATION = 'financeAndStaff',
  SALES_ORDERS = 'sales',
  ADMINISTRATION_AND_RESEARCH = 'administrationAndResearch',

  // Sub-category notifications (distinct colors)
  // Under Finance & Staff
  TIME_CALENDAR = 'time',          // Cyan - scheduling and calendar
  STAFF_MANAGEMENT = 'staff',      // Teal - HR and people management

  // Under Administration & Research
  ACTIVITIES_TASKS = 'tasks'       // Indigo - task and activity management
}

// Staff skills interface - all skills are 0-1 scale
export interface StaffSkills {
  field: number;        // Vineyard work
  winery: number;       // Wine production
  financeAndStaff: number; // Administrative tasks
  sales: number;        // Sales and marketing
  administrationAndResearch: number;  // Building and equipment maintenance
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

// ===== LAND SEARCH TYPES =====

/**
 * Pending land search results
 * Temporary storage for properties generated from completed search activity
 */
export interface PendingLandSearchResults {
  activityId: string;
  options: any[]; // VineyardPurchaseOption[]
  searchOptions: {
    numberOfOptions: number;
    regions: string[];
    altitudeRange?: [number, number];
    aspectPreferences?: string[];
    hectareRange: [number, number];
    soilTypes?: string[];
    minGrapeSuitability?: number;
  };
  timestamp: number;
}

/**
 * Pending lender search results
 * Temporary storage for loan offers generated from completed search activity
 */
export interface PendingLenderSearchResults {
  activityId: string;
  offers: LoanOffer[];
  searchOptions: LenderSearchOptions;
  timestamp: number;
}

// ===== ACHIEVEMENT SYSTEM =====

/**
 * Achievement categories for organization and filtering
 */
export type AchievementCategory = 'financial' | 'production' | 'time' | 'prestige' | 'sales' | 'vineyard' | 'special';

/**
 * Achievement level for tiered achievements
 */
export type AchievementLevel = 1 | 2 | 3 | 4 | 5;

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
  | 'vineyard_time_same_grape'      // Check if vineyard has same grape for X years
  | 'vineyard_wine_variety_count'   // Check if vineyard produced X different grape varieties
  | 'vineyard_bottles_produced'     // Check if vineyard produced X bottles
  | 'vineyard_sales_count'          // Check if vineyard made X sales
  | 'vineyard_prestige_threshold'   // Check if vineyard has X prestige
  | 'single_contract_bottles'       // Check if single contract sold X bottles
  | 'single_contract_value'         // Check if single contract value >= threshold
  | 'cellar_value'                  // Check if cellar wine value >= threshold
  | 'total_assets'                  // Check if total company assets >= threshold
  | 'vineyard_value'                // Check if highest single vineyard value >= threshold
  | 'total_vineyard_value'          // Check if combined vineyard value >= threshold
  | 'achievement_completion'        // Check if X% of achievements completed
  | 'different_grapes'              // Check if produced X different grape varieties
  | 'wine_grape_quality_threshold'        // Check if wine grape quality >= threshold
  | 'wine_balance_threshold'        // Check if wine balance >= threshold
  | 'wine_score_threshold'          // Check if wine score >= threshold
  | 'wine_price_threshold'          // Check if wine estimated price >= threshold
  | 'sales_price_percentage'        // Check if sales price is X% over/under estimated
  | 'prestige_by_year'              // Check if prestige >= threshold by specific year
  | 'revenue_by_year'               // Check if revenue >= threshold in single year
  | 'assets_by_year'                // Check if assets >= threshold by specific year
  | 'hectares_by_year'              // Check if hectares >= threshold by specific year
  | 'total_hectares'                // Check if total hectares >= threshold
  | 'average_hectare_value'         // Check if average hectare value >= threshold
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
  achievementLevel?: AchievementLevel;  // Tiered system (1-5)
  condition: AchievementCondition;
  prerequisites?: string[];             // Array of achievement IDs that must be completed first
  prestige?: AchievementPrestigeConfig;
  hidden?: boolean;                     // Hidden until unlocked
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

// ===== LOAN WARNING TYPES =====

/**
 * Pending loan warning modal
 * Queued when a loan payment fails, displayed on next render
 */
export interface PendingLoanWarningDecision {
  type: 'forcedLoanRestructure';
  offerId: string;
}

export interface ForcedLoanRestructureStep {
  order: number;
  type: 'cellar' | 'vineyard';
  description: string;
  valueRecovered: number;
  saleProceeds: number;
}

export interface ForcedLoanRestructureOffer {
  id: string;
  createdAt: string;
  forcedLoanIds: string[];
  totalForcedBalance: number;
  maxSeizureValue: number;
  steps: ForcedLoanRestructureStep[];
  estimatedCellarLots: Array<{
    label: string;
    proceeds: number;
    valueRecovered: number;
  }>;
  estimatedVineyards: Array<{
    id: string;
    name: string;
    valueRecovered: number;
    saleProceeds: number;
  }>;
  consolidatedPrincipalEstimate: number;
  lender?: {
    id: string | null;
    name: string;
    type: LenderType;
    effectiveRate: number;
    durationSeasons: number;
    originationFeeEstimate: number;
    isEmergencyOverride: boolean;
  } | null;
  prestigePenalty: number;
  summaryLines: string[];
}

export interface PendingLoanWarning {
  loanId: string;
  lenderName: string;
  missedPayments: number;
  severity: 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  details: string;
  decision?: PendingLoanWarningDecision;
  penalties: {
    lateFee?: number;
    interestRateIncrease?: number;
    balancePenalty?: number;
    creditRatingLoss?: number;
    prestigeLoss?: number;
    bookkeepingWork?: number;
    vineyardsSeized?: number;
    vineyardNames?: string[];
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
  creditRating: number; // NEW: 0-100 scale, affects loan availability
  economyPhase: EconomyPhase; // NEW: Current economy phase
  activities?: Activity[]; // Active activities
  staff?: Staff[]; // Active staff members
  teams?: StaffTeam[]; // Staff teams
  pendingStaffCandidates?: PendingStaffCandidates;
  pendingLandSearchResults?: PendingLandSearchResults;
  pendingLenderSearchResults?: PendingLenderSearchResults;
  loanPenaltyWork?: number; // NEW: Accumulated loan penalty work for bookkeeping
  pendingForcedLoanRestructure?: ForcedLoanRestructureOffer | null;
}
