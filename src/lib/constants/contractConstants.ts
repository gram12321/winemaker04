import { CustomerType, ContractRequirementType } from '../types/types';

// ===== CONTRACT GENERATION CONFIG =====

export interface ContractGenerationConfig {
  maxPendingContracts: number;
  baseGenerationChance: number; // Base chance per tick
}

export const CONTRACT_CONFIG: ContractGenerationConfig = {
  maxPendingContracts: 5,
  baseGenerationChance: 0.005 // 0.5% base chance per eligible customer per tick
  // With 50 eligible customers: ~23% chance per tick, ~95% chance per season (12 ticks)
  // With 10 eligible customers: ~5% chance per tick, ~46% chance per season
  // With 1 eligible customer: 0.5% chance per tick, ~6% chance per season
};

// ===== CUSTOMER CONTRACT REQUIREMENTS =====

export interface CustomerContractRequirements {
  minRelationship: number; // Minimum relationship (0-100) to be eligible
  minPrestige: number; // Minimum prestige to be eligible
  relationshipWeight: number; // How much relationship affects contract chance (0-1)
  prestigeWeight: number; // How much prestige affects contract chance (0-1)
}

export const CUSTOMER_CONTRACT_REQUIREMENTS: Record<CustomerType, CustomerContractRequirements> = {
  'Restaurant': {
    minRelationship: 5, // Restaurants need moderate relationship
    minPrestige: 1.5, // Need some prestige for restaurants
    relationshipWeight: 0.7, // Relationship very important
    prestigeWeight: 0.8 // Prestige very important for restaurants
  },
  'Wine Shop': {
    minRelationship: 0.1, // Wine shops easiest to work with
    minPrestige: 0.1, // Very low prestige threshold - accessible from start
    relationshipWeight: 0.6,
    prestigeWeight: 0.4 // Lower prestige importance for early game
  },
  'Private Collector': {
    minRelationship: 10, // Collectors need strong relationship
    minPrestige: 5, // Need good prestige for collectors
    relationshipWeight: 0.8, // Relationship critical
    prestigeWeight: 0.9 // Prestige critical
  },
  'Chain Store': {
    minRelationship: 12, // Chains need good relationship
    minPrestige: 0.3, // Don't care much about prestige
    relationshipWeight: 0.9, // Almost entirely relationship-based
    prestigeWeight: 0.2 // Low prestige importance
  }
};

// ===== REQUIREMENT TYPE PREFERENCES =====

/**
 * Requirement type with weight (higher weight = more likely to be selected)
 */
export interface WeightedRequirementType {
  type: ContractRequirementType;
  weight: number; // 1 = normal, 0.5 = half as likely, 2 = twice as likely
}

/**
 * Available requirement types by customer preference with weights
 * Each customer type has different priorities for what they care about in contracts
 * Characteristics are weighted lower (0.3) to make them less common than general requirements
 */
export const CUSTOMER_REQUIREMENT_PREFERENCES: Record<CustomerType, WeightedRequirementType[]> = {
  'Restaurant': [
    { type: 'quality', weight: 1 },
    { type: 'balance', weight: 1 },
    { type: 'minimumVintage', weight: 1 },
    { type: 'grapeColor', weight: 1 },
    { type: 'characteristicMin', weight: 0.3 },
    { type: 'characteristicMax', weight: 0.3 },
    { type: 'characteristicBalance', weight: 0.3 }
  ],
  'Wine Shop': [
    { type: 'quality', weight: 1 },
    { type: 'minimumVintage', weight: 1 },
    { type: 'specificVintage', weight: 1 },
    { type: 'grape', weight: 1 },
    { type: 'grapeColor', weight: 1 },
    { type: 'altitude', weight: 1 },
    { type: 'aspect', weight: 1 },
    { type: 'characteristicMin', weight: 0.3 },
    { type: 'characteristicMax', weight: 0.3 },
    { type: 'characteristicBalance', weight: 0.3 }
  ],
  'Private Collector': [
    { type: 'quality', weight: 1 },
    { type: 'minimumVintage', weight: 1 },
    { type: 'specificVintage', weight: 1 },
    { type: 'balance', weight: 1 },
    { type: 'landValue', weight: 1 },
    { type: 'grape', weight: 1 },
    { type: 'altitude', weight: 1 },
    { type: 'aspect', weight: 1 },
    { type: 'characteristicMin', weight: 0.3 },
    { type: 'characteristicMax', weight: 0.3 },
    { type: 'characteristicBalance', weight: 0.3 }
  ],
  'Chain Store': [
    { type: 'quality', weight: 1 },
    { type: 'grape', weight: 1 },
    { type: 'grapeColor', weight: 1 },
    { type: 'minimumVintage', weight: 1 }
  ]
};

// ===== REQUIREMENT BASE QUANTITIES =====

/**
 * Base quantities for contract sizes by customer type
 * These are scaled by sqrt(marketShare) and have high randomness (±75%)
 */
export const CONTRACT_BASE_QUANTITIES: Record<CustomerType, number> = {
  'Chain Store': 800,
  'Restaurant': 400,
  'Wine Shop': 300,
  'Private Collector': 200
};

/**
 * Minimum quantities by customer type
 */
export const CONTRACT_MIN_QUANTITIES: Record<CustomerType, number> = {
  'Chain Store': 60,
  'Restaurant': 40,
  'Wine Shop': 30,
  'Private Collector': 20
};

// ===== CUSTOMER TYPE MAX AGES =====

/**
 * Maximum acceptable wine age by customer type
 * Used for vintage requirements
 */
export const CUSTOMER_MAX_WINE_AGE: Record<CustomerType, number> = {
  'Private Collector': 20,
  'Restaurant': 12,
  'Wine Shop': 10,
  'Chain Store': 7
};

// ===== AVAILABLE GRAPES =====

/**
 * All available grape varieties for grape-specific requirements
 */
export const AVAILABLE_GRAPES = [
  'Chardonnay',
  'Pinot Noir', 
  'Sauvignon Blanc',
  'Sangiovese',
  'Tempranillo',
  'Barbera',
  'Primitivo'
] as const;

/**
 * Available grape colors for color-specific requirements
 */
export const AVAILABLE_GRAPE_COLORS: ('red' | 'white')[] = ['red', 'white'];

/**
 * Available wine characteristics for characteristic requirements
 */
export const AVAILABLE_CHARACTERISTICS: (keyof import('../types/types').WineCharacteristics)[] = [
  'acidity',
  'aroma',
  'body',
  'spice',
  'sweetness',
  'tannins'
];

// ===== PRICING CONFIGURATION =====

/**
 * Base price range for contracts
 */
export const CONTRACT_PRICING = {
  baseMin: 1, // Minimum base price (€)
  baseMax: 1000, // Maximum base price (€)
  difficultyMultiplierMax: 2.5, // Maximum multiplier from difficulty (1.0-2.5x)
  requirementCountBonus: 0.15, // Bonus per additional requirement (+15%)
  multiYearPremiumPerYear: 0.2 // Premium per year beyond first (+20%/year)
};

// ===== REQUIREMENT DIFFICULTY THRESHOLDS =====

/**
 * Difficulty tier thresholds for requirements
 */
export const DIFFICULTY_THRESHOLDS = {
  quality: {
    easy: { max: 0.5, scoreRange: [0, 0.2] },
    medium: { max: 0.7, scoreRange: [0.2, 0.4] },
    hard: { max: 0.85, scoreRange: [0.4, 0.7] },
    expert: { max: 1.0, scoreRange: [0.7, 1.0] }
  },
  vintage: {
    easy: { maxYears: 3, scoreRange: [0, 0.2] },
    medium: { maxYears: 7, scoreRange: [0.2, 0.4] },
    hard: { maxYears: 12, scoreRange: [0.4, 0.9] },
    expert: { maxYears: 20, scoreRange: [0.9, 1.0] }
  },
  balance: {
    easy: { max: 0.6, scoreRange: [0, 0.2] },
    medium: { max: 0.75, scoreRange: [0.2, 0.4] },
    hard: { max: 0.85, scoreRange: [0.4, 0.7] },
    expert: { max: 1.0, scoreRange: [0.7, 1.0] }
  },
  landValue: {
    easy: { max: 0.4, scoreRange: [0, 0.2] },
    medium: { max: 0.6, scoreRange: [0.2, 0.4] },
    hard: { max: 0.8, scoreRange: [0.4, 0.7] },
    expert: { max: 1.0, scoreRange: [0.7, 1.0] }
  }
};

// ===== MULTI-YEAR CONTRACT CONFIGURATION =====

/**
 * Multi-year contract parameters
 */
export const MULTI_YEAR_CONFIG = {
  minRelationshipForMultiYear: 10, // Need 10+ relationship
  chanceForMultiYear: 0.1, // 10% chance if eligible
  minYears: 2,
  maxYears: 4,
  minDeliveriesPerYear: 1,
  maxDeliveriesPerYear: 2
};

// ===== REQUIREMENT COMPLEXITY THRESHOLDS =====

/**
 * Thresholds for determining requirement count and difficulty
 * Based on combined relationship/prestige score (0-1)
 */
export const COMPLEXITY_THRESHOLDS = {
  low: {
    maxScore: 0.3,
    requirements: { min: 1, max: 2 },
    targetDifficulty: 0.15 // Easy
  },
  medium: {
    maxScore: 0.6,
    requirements: { min: 2, max: 3 },
    targetDifficulty: 0.35 // Medium
  },
  high: {
    maxScore: 0.8,
    requirements: { min: 3, max: 4 },
    targetDifficulty: 0.60 // Hard
  },
  expert: {
    maxScore: 1.0,
    requirements: { min: 4, max: 5 },
    targetDifficulty: 0.85 // Expert
  }
};
