// Global game constants
// This file centralizes all game constants to avoid duplication and improve maintainability

// ===== SALES CONSTANTS =====

// Base pricing constants
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
  // Starting financial capital (amount added as transaction)
  STARTING_MONEY: 10000000, // €10M starting capital transaction
  
  // Starting time
  STARTING_WEEK: 1,
  STARTING_SEASON: 'Spring' as const,
  STARTING_YEAR: 2024,
  
  // Starting company
  DEFAULT_COMPANY_NAME: 'My Winery',
  DEFAULT_COMPANY_ID: '00000000-0000-0000-0000-000000000000', // Default fallback company ID
  
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

// ===== CUSTOMER REGIONAL CHARACTERISTICS =====

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

// Customer name data for realistic name generation
export const CUSTOMER_NAMES = {
  'France': {
    firstNames: {
      male: ["Thomas", "Hugo", "Arthur", "Lucas", "Jules", "Gabriel", "Théo", "Léon", "Valentin", "Pierre", "Quentin", "Clément", "Maxime", "Alexandre", "Antoine"],
      female: ["Camille", "Léa", "Manon", "Inès", "Chloé", "Emma", "Jade", "Louise", "Alice", "Clara", "Julie", "Margaux", "Anaïs", "Mathilde", "Pauline"]
    },
    lastNames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefèvre", "Michel", "Garcia"],
    businessSuffixes: {
      'Restaurant': ["Restaurant", "Bistro", "Brasserie"],
      'Wine Shop': ["Wine Merchants", "Wine & Spirits", "Wine Cellar"],
      'Private Collector': ["Wines", "Wine Trading", "Fine Wines"],
      'Chain Store': ["International", "Group", "Distribution"]
    }
  },
  'Germany': {
    firstNames: {
      male: ["Maximilian", "Elias", "Paul", "Leon", "Jonas", "Tim", "Lukas", "Erik", "Julian", "Alexander", "Jan", "Fabian", "Florian", "Benjamin", "Niklas"],
      female: ["Anna", "Lena", "Marie", "Laura", "Katharina", "Johanna", "Lisa", "Sophie", "Julia", "Alina", "Lea", "Clara", "Amelie", "Mia", "Emma"]
    },
    lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein"],
    businessSuffixes: {
      'Restaurant': ["Restaurant", "Gasthaus", "Weinhaus"],
      'Wine Shop': ["Wine Merchants", "Wine Gallery", "Vintage Wines"],
      'Private Collector': ["Wines", "Wine Import", "Wine Selection"],
      'Chain Store': ["Corporation", "Holdings", "International"]
    }
  },
  'Italy': {
    firstNames: {
      male: ["Alessandro", "Andrea", "Marco", "Francesco", "Giuseppe", "Antonio", "Luca", "Giovanni", "Roberto", "Stefano", "Paolo", "Carlo", "Claudio", "Davide", "Massimo"],
      female: ["Giulia", "Francesca", "Chiara", "Sara", "Alessia", "Anna", "Federica", "Valentina", "Paola", "Elisabetta", "Silvia", "Martina", "Cristina", "Elena", "Roberta"]
    },
    lastNames: ["Rossi", "Bianchi", "Romano", "Colombo", "Ricci", "Conti", "Greco", "Gallo", "Ferrara", "Rizzo", "Caruso", "Moretti", "Lombardi", "Esposito", "Marchetti"],
    businessSuffixes: {
      'Restaurant': ["Ristorante", "Trattoria", "Osteria"],
      'Wine Shop': ["Wine Merchants", "Wine Cellar", "Vintage Wines"],
      'Private Collector': ["Wines", "Wine Trading", "Fine Wines"],
      'Chain Store': ["International", "Corporation", "Group"]
    }
  },
  'Spain': {
    firstNames: {
      male: ["José", "Antonio", "Juan", "Francisco", "Javier", "Carlos", "Daniel", "Miguel", "Jesús", "Alejandro", "Manuel", "Rafael", "Luis", "Fernando", "Sergio"],
      female: ["María", "Carmen", "Ana", "Laura", "Marta", "Sara", "Paula", "Isabel", "Cristina", "Patricia", "Sandra", "Raquel", "Pilar", "Rosa", "Elena"]
    },
    lastNames: ["García", "Martínez", "Rodríguez", "Fernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Castro", "Ramos", "Delgado", "Morales", "Ortiz"],
    businessSuffixes: {
      'Restaurant': ["Restaurant", "Bistro", "Bodega"],
      'Wine Shop': ["Wine Merchants", "Wine & Spirits", "Wine Cellar"],
      'Private Collector': ["Wines", "Wine Trading", "Fine Wines"],
      'Chain Store': ["International", "Group", "Distribution"]
    }
  },
  'United States': {
    firstNames: {
      male: ["James", "Robert", "John", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Christopher", "Charles", "Daniel", "Matthew", "Anthony", "Mark"],
      female: ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Helen", "Sandra"]
    },
    lastNames: ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris"],
    businessSuffixes: {
      'Restaurant': ["Restaurant", "Bistro"],
      'Wine Shop': ["Wine Merchants", "Wine & Spirits", "Wine Gallery"],
      'Private Collector': ["Wines", "Wine Trading", "Fine Wines"],
      'Chain Store': ["Inc.", "Corporation", "International"]
    }
  }
} as const;



// ===== FUTURE CONSTANTS =====
// This file can be extended with other game constants as needed:
// - Vineyard constants (land values, prestige factors)
// - Winery constants (fermentation rates, aging effects)
// - Financial constants (loan rates, taxes)
// - Time constants (season lengths, aging periods)
