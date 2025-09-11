// Global game constants
// This file centralizes all game constants to avoid duplication and improve maintainability

// ===== SALES CONSTANTS =====

// Base pricing constants
export const SALES_CONSTANTS = {
  // Base rate per bottle for wine pricing calculations
  BASE_RATE_PER_BOTTLE: 25, // €25 base rate
  
  // Order type configurations (using 6-bottle cases)
  ORDER_TYPES: {
    'Local Restaurant': {
      priceMultiplierRange: [0.4, 0.9], // Restaurants: 50% discount to 90% discount (wide range, most near 0.65x)
      quantityRange: [12, 80], // 2-13 cases (6 bottles each) - increased for better scaling
      chance: 0.4
    },
    'Wine Shop': {
      priceMultiplierRange: [0.6, 1.0], // Wine shops: 40% discount to 0% premium (wide range, most near 0.8x)
      quantityRange: [18, 120], // 3-20 cases (6 bottles each) - increased for better scaling
      chance: 0.3
    },
    'Private Collector': {
      priceMultiplierRange: [1.1, 1.6], // Collectors: 10% premium to 60% premium (wide range, most near 1.2x)
      quantityRange: [3, 36], // 0.5-6 cases (6 bottles each) - increased for better scaling
      chance: 0.2
    },
    'Export Order': {
      priceMultiplierRange: [1.0, 1.5], // Export: 0% premium to 50% premium (wide range, most near 1.1x)
      quantityRange: [60, 300], // 10-50 cases (6 bottles each) - increased for better scaling
      chance: 0.1
    }
  },
  
  // Order generation probability
  ORDER_GENERATION_CHANCE: 0.15, // 15% chance per check
} as const;

// ===== WINE QUALITY CONSTANTS =====

// Quality constants for wine generation
export const WINE_QUALITY_CONSTANTS = {
  // Base placeholder values (will be replaced with proper calculations later)
  BASE_QUALITY: 0.5, // Placeholder quality value (middle of 0-1 range)
  BASE_BALANCE: 0.5, // Placeholder balance value (middle of 0-1 range)
  
  // Random variation applied to base values (full 0-1 range)
  QUALITY_VARIATION: 2.0, // ±100% variation (0.0 to 1.0)
} as const;

// ===== PRICING PLACEHOLDER CONSTANTS =====

// Placeholder values for pricing calculations (will be replaced with real calculations later)
export const PRICING_PLACEHOLDER_CONSTANTS = {
  // Land value placeholder (0-1 scale)
  LAND_VALUE_PLACEHOLDER: 0.5,
  
  // Prestige placeholder (0-1 scale)
  PRESTIGE_PLACEHOLDER: 0.5,
} as const;

// ===== GAME INITIALIZATION CONSTANTS =====

// Starting values for new games
export const GAME_INITIALIZATION = {
  // Starting financial capital
  STARTING_MONEY: 10000000, // €10M starting capital
  
  // Starting time
  STARTING_WEEK: 1,
  STARTING_SEASON: 'Spring' as const,
  STARTING_YEAR: 2024,
  
  // Starting company
  DEFAULT_COMPANY_NAME: 'My Winery',
  
  // Starting prestige
  STARTING_PRESTIGE: 1,
} as const;

// ===== PRESTIGE-BASED ORDER GENERATION =====

// Constants for scaling order generation based on company prestige
export const PRESTIGE_ORDER_GENERATION = {
  // Base order generation chances
  MIN_BASE_CHANCE: 0.05,    // 5% minimum chance at 0 prestige
  MID_PRESTIGE_CHANCE: 0.15, // 15% chance at threshold prestige
  MAX_BASE_CHANCE: 0.35,    // 35% maximum chance at high prestige
  
  // Prestige scaling thresholds
  PRESTIGE_THRESHOLD: 100,   // Prestige value where mid-chance is reached
  HIGH_PRESTIGE_THRESHOLD: 500, // Prestige value where diminishing returns start
  
  // Diminishing returns for high prestige
  DIMINISHING_FACTOR: 200,   // Factor for arctan scaling beyond threshold
  
  // Pending order penalties (to avoid order spam)
  PENDING_ORDER_PENALTY: 0.8, // Penalty multiplier per pending order (diminishing returns)
} as const;

// ===== FUTURE CONSTANTS =====
// This file can be extended with other game constants as needed:
// - Vineyard constants (land values, prestige factors)
// - Winery constants (fermentation rates, aging effects)
// - Financial constants (loan rates, taxes)
// - Time constants (season lengths, aging periods)
