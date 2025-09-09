// Global game constants
// This file centralizes all game constants to avoid duplication and improve maintainability

// ===== SALES CONSTANTS =====

// Base pricing constants
export const SALES_CONSTANTS = {
  // Base rate per bottle for wine pricing calculations
  BASE_RATE_PER_BOTTLE: 25, // €25 base rate
  
  // Minimum price per bottle (floor price)
  MIN_PRICE_PER_BOTTLE: 0.01, // €0.01 minimum
  
  // Order type configurations (using 6-bottle cases)
  ORDER_TYPES: {
    'Local Restaurant': {
      priceMultiplier: 0.8, // Restaurants pay slightly less
      quantityRange: [6, 24], // 1-4 cases (6 bottles each)
      chance: 0.4
    },
    'Wine Shop': {
      priceMultiplier: 0.9, // Standard retail price
      quantityRange: [12, 36], // 2-6 cases (6 bottles each)
      chance: 0.3
    },
    'Private Collector': {
      priceMultiplier: 1.2, // Collectors pay premium
      quantityRange: [3, 12], // Half case to 2 cases (6 bottles each)
      chance: 0.2
    },
    'Export Order': {
      priceMultiplier: 1.1, // Export premium
      quantityRange: [30, 90], // 5-15 cases (6 bottles each)
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

// ===== FUTURE CONSTANTS =====
// This file can be extended with other game constants as needed:
// - Vineyard constants (land values, prestige factors)
// - Winery constants (fermentation rates, aging effects)
// - Financial constants (loan rates, taxes)
// - Time constants (season lengths, aging periods)
