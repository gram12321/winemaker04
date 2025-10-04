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

// ===== SALES & CUSTOMER CONSTANTS =====

// Base pricing and sales constants
export const SALES_CONSTANTS = {
  // Base rate per bottle for wine pricing calculations
  BASE_RATE_PER_BOTTLE: 25, // €25 base rate
  
  // Maximum price to prevent database overflow (numeric(10,2) field limit)
  MAX_PRICE: 99999999.99, // €99,999,999.99 maximum price per bottle
  
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
// Note: Wine characteristics constants have been moved to src/lib/constants/grapeConstants.ts

// ===== FUTURE CONSTANTS =====
// This file can be extended with other game constants as needed:
// - Vineyard constants (land values, prestige factors)
// - Winery constants (fermentation rates, aging effects)
// - Financial constants (loan rates, taxes)
// - Time constants (season lengths, aging periods)