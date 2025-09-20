// ===== GAME CORE CONSTANTS =====

// Starting values for new games
export const GAME_INITIALIZATION = {
  // Starting financial capital (amount added as transaction)
  STARTING_MONEY: 10000000, // €10M starting capital transaction
  
  // Starting time
  STARTING_WEEK: 1,
  STARTING_SEASON: 'Spring' as const,
  STARTING_YEAR: 2024,
  
  // Starting prestige
  STARTING_PRESTIGE: 1,
} as const;

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

// ===== WINE PRODUCTION CONSTANTS =====

// Vineyard prestige calculation constants
export const VINEYARD_PRESTIGE_CONSTANTS = {
  // Land value normalization constant for prestige calculation
  // Set to 200000 to match the max price of non-top3 regions like "Bordeaux, France"
  LAND_VALUE_NORMALIZATION: 200000,
} as const;

// Quality constants for wine generation
export const WINE_QUALITY_CONSTANTS = {
  // Base placeholder values (will be replaced with proper calculations later)
  BASE_QUALITY: 0.5, // Placeholder quality value (middle of 0-1 range)
  BASE_BALANCE: 0.5, // Placeholder balance value (middle of 0-1 range)
  
  // Random variation applied to base values (full 0-1 range)
  QUALITY_VARIATION: 2.0, // ±100% variation (0.0 to 1.0)
} as const;

// Placeholder values for pricing calculations (will be replaced with real calculations later)
export const PRICING_PLACEHOLDER_CONSTANTS = {
  // Land value placeholder (0-1 scale)
  LAND_VALUE_PLACEHOLDER: 0.5,
  
  // Prestige placeholder (0-1 scale)
  PRESTIGE_PLACEHOLDER: 0.5,
} as const;

// ===== SALES & CUSTOMER CONSTANTS =====

// Base pricing and sales constants
export const SALES_CONSTANTS = {
  // Base rate per bottle for wine pricing calculations
  BASE_RATE_PER_BOTTLE: 25, // €25 base rate
  
  // Customer type configurations (using 6-bottle cases)
  CUSTOMER_TYPES: {
    'Restaurant': {
      priceMultiplierRange: [0.4, 0.9], // Restaurants: 50% discount to 90% discount (wide range, most near 0.65x)
      quantityRange: [12, 80], // 2-13 cases (6 bottles each) - increased for better scaling
      baseQuantityMultiplier: 2.2, // Restaurants buy smaller amounts
      multipleOrderPenalty: 0.5 // Restaurants usually focus on specific wines
    },
    'Wine Shop': {
      priceMultiplierRange: [0.6, 1.0], // Wine shops: 40% discount to 0% premium (wide range, most near 0.8x)
      quantityRange: [18, 120], // 3-20 cases (6 bottles each) - increased for better scaling
      baseQuantityMultiplier: 5.5, // Wine shops buy moderate amounts
      multipleOrderPenalty: 0.6 // Wine shops need variety
    },
    'Private Collector': {
      priceMultiplierRange: [1.1, 1.6], // Collectors: 10% premium to 60% premium (wide range, most near 1.2x)
      quantityRange: [3, 36], // 0.5-6 cases (6 bottles each) - increased for better scaling
      baseQuantityMultiplier: 0.5, // Private collectors buy smallest amounts
      multipleOrderPenalty: 0.8 // Collectors often buy diverse wines
    },
    'Chain Store': {
      priceMultiplierRange: [1.0, 1.5], // Chain stores: 0% premium to 50% premium (wide range, most near 1.1x)
      quantityRange: [60, 300], // 10-50 cases (6 bottles each) - increased for better scaling
      baseQuantityMultiplier: 10.0, // Chain stores buy in bulk
      multipleOrderPenalty: 0.9 // Chain stores often buy multiple varietals
    }
  },
  
  // Order generation probability
  ORDER_GENERATION_CHANCE: 0.15, // 15% chance per check
} as const;

// Regional characteristics by country (from legacy importer system)
// Values centered around 100% (1.0) - can go above and below
export const CUSTOMER_REGIONAL_DATA = {
  'France': { 
    purchasingPower: 0.85, // 85% = 15% below average
    wineTradition: 1.10,   // 110% = 10% above average
    customerTypeWeights: {
      'Restaurant': 0.35,
      'Wine Shop': 0.05,
      'Private Collector': 0.55,
      'Chain Store': 0.05
    }
  },
  'Germany': { 
    purchasingPower: 0.80, // 80% = 20% below average
    wineTradition: 0.75,  // 75% = 25% below average
    customerTypeWeights: {
      'Restaurant': 0.16,
      'Wine Shop': 0.10,
      'Private Collector': 0.70,
      'Chain Store': 0.04
    }
  },
  'Italy': { 
    purchasingPower: 0.75, // 75% = 25% below average
    wineTradition: 1.05,  // 105% = 5% above average
    customerTypeWeights: {
      'Restaurant': 0.26,
      'Wine Shop': 0.10,
      'Private Collector': 0.60,
      'Chain Store': 0.04
      }
  },
  'Spain': { 
    purchasingPower: 0.70, // 70% = 30% below average
    wineTradition: 0.85,  // 85% = 15% below average
    customerTypeWeights: {
      'Restaurant': 0.15,
      'Wine Shop': 0.12,
      'Private Collector': 0.70,
      'Chain Store': 0.03
    }
  },
  'United States': { 
    purchasingPower: 1.20, // 120% = 20% above average
    wineTradition: 0.60,  // 60% = 40% below average
    customerTypeWeights: {
      'Restaurant': 0.08,
      'Wine Shop': 0.10,
      'Private Collector': 0.80,
      'Chain Store': 0.02
    }
  }
} as const;

// Note: Customer name data has been moved to src/lib/constants/names.ts
// This provides a centralized location for all name generation (vineyards and customers)

// ===== WINE CHARACTERISTICS CONSTANTS =====

// Base balanced ranges for wine characteristics (Phase 1: Static values)
export const BASE_BALANCED_RANGES = {
  acidity: [0.4, 0.6],
  aroma: [0.4, 0.6], 
  body: [0.4, 0.6],
  spice: [0.4, 0.6],
  sweetness: [0.4, 0.6],
  tannins: [0.4, 0.6]
} as const;

// Base characteristics for grape varieties (Phase 1: Static values)
// Values represent absolute position on a 0-1 scale (0.5 is midpoint)
export const BASE_GRAPE_CHARACTERISTICS = {
  'Barbera': { acidity: 0.7, aroma: 0.5, body: 0.6, spice: 0.5, sweetness: 0.5, tannins: 0.6 },
  'Chardonnay': { acidity: 0.4, aroma: 0.65, body: 0.75, spice: 0.5, sweetness: 0.5, tannins: 0.35 },
  'Pinot Noir': { acidity: 0.65, aroma: 0.6, body: 0.35, spice: 0.5, sweetness: 0.5, tannins: 0.4 },
  'Primitivo': { acidity: 0.5, aroma: 0.7, body: 0.7, spice: 0.5, sweetness: 0.7, tannins: 0.7 },
  'Sauvignon Blanc': { acidity: 0.8, aroma: 0.75, body: 0.3, spice: 0.6, sweetness: 0.4, tannins: 0.3 }
} as const;

// Grape variety information for UI display
export const GRAPE_VARIETY_INFO = [
  {
    name: 'Barbera' as const,
    description: 'A versatile grape known for high acidity and moderate tannins, producing medium-bodied wines.'
  },
  {
    name: 'Chardonnay' as const,
    description: 'A noble grape variety producing aromatic, medium-bodied wines with moderate acidity.'
  },
  {
    name: 'Pinot Noir' as const,
    description: 'A delicate grape creating light-bodied, aromatic wines with high acidity and soft tannins.'
  },
  {
    name: 'Primitivo' as const,
    description: 'A robust grape yielding full-bodied, aromatic wines with natural sweetness and high tannins.'
  },
  {
    name: 'Sauvignon Blanc' as const,
    description: 'A crisp grape variety producing aromatic, light-bodied wines with high acidity.'
  }
] as const;

// ===== FUTURE CONSTANTS =====
// This file can be extended with other game constants as needed:
// - Vineyard constants (land values, prestige factors)
// - Winery constants (fermentation rates, aging effects)
// - Financial constants (loan rates, taxes)
// - Time constants (season lengths, aging periods)