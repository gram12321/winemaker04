// Comprehensive vineyard constants - factor-based organization
// Combines and organizes data from vineyardConstants.ts and names.js

// Removed unused imports - types are only used in constants, not in functions

// ===== COUNTRY-REGION MAPPING =====

export const COUNTRY_REGION_MAP = {
  "France": ["Bordeaux", "Bourgogne", "Champagne", //"Loire Valley", 
   "Rhone Valley", "Jura"],
  "Germany": ["Ahr", "Mosel", "Pfalz", "Rheingau", "Rheinhessen"],
  "Italy": ["Piedmont", "Puglia", "Sicily", "Tuscany", "Veneto"],
  "Spain": ["Jumilla", "La Mancha", "Ribera del Duero", "Rioja", "Jerez"],
  "United States": ["Central Coast", "Finger Lakes", "Napa Valley", "Sonoma County", "Willamette Valley"]
} as const;

// ===== REGIONAL CHARACTERISTICS =====

// Soil types by region
export const REGION_SOIL_TYPES = {
  "France": {
    "Bordeaux": ["Clay", "Gravel", "Limestone", "Sand"],
    "Bourgogne": ["Clay-Limestone", "Limestone", "Marl"],
    "Champagne": ["Chalk", "Clay", "Limestone"],
    //"Loire Valley": ["Clay", "Flint", "Limestone", "Sand", "Schist"],
    "Rhone Valley": ["Clay", "Granite", "Limestone", "Sand"],
    "Jura": ["Clay", "Limestone", "Marl"]
  },
  "Germany": {
    "Ahr": ["Devonian Slate", "Greywacke", "Loess", "Volcanic Soil"],
    "Mosel": ["Blue Devonian Slate", "Red Devonian Slate"],
    "Pfalz": ["Basalt", "Limestone", "Loess", "Sandstone"],
    "Rheingau": ["Loess", "Phyllite", "Quartzite", "Slate"],
    "Rheinhessen": ["Clay", "Limestone", "Loess", "Quartz"]
  },
  "Italy": {
    "Piedmont": ["Clay", "Limestone", "Marl", "Sand"],
    "Puglia": ["Clay", "Limestone", "Red Earth", "Sand"],
    "Sicily": ["Clay", "Limestone", "Sand", "Volcanic Soil"],
    "Tuscany": ["Clay", "Galestro", "Limestone", "Sandstone"],
    "Veneto": ["Alluvial", "Clay", "Limestone", "Volcanic Soil"]
  },
  "Spain": {
    "Jumilla": ["Clay", "Limestone", "Sand"],
    "La Mancha": ["Clay", "Clay-Limestone", "Sand"],
    "Ribera del Duero": ["Alluvial", "Clay", "Limestone"],
    "Rioja": ["Alluvial", "Clay", "Clay-Limestone", "Ferrous Clay"],
    "Jerez": ["Albariza", "Barros", "Arenas"]
  },
  "United States": {
    "Central Coast": ["Clay", "Loam", "Sand", "Shale"],
    "Finger Lakes": ["Clay", "Gravel", "Limestone", "Shale"],
    "Napa Valley": ["Alluvial", "Clay", "Loam", "Volcanic"],
    "Sonoma County": ["Clay", "Loam", "Sand", "Volcanic"],
    "Willamette Valley": ["Basalt", "Clay", "Marine Sediment", "Volcanic"]
  }
} as const;

// Soil difficulty modifiers for clearing work (0-1 scale, positive = more work)
export const SOIL_DIFFICULTY_MODIFIERS = {
  // Easy soils (negative modifiers = less work)
  'Sand': -0.10,           // -10% work
  'Loam': -0.05,           // -5% work
  'Loess': -0.03,          // -3% work
  
  // Medium soils (no modifier)
  'Alluvial': 0.00,        // 0% work
  'Clay': 0.00,            // 0% work
  'Limestone': 0.00,       // 0% work
  
  // Difficult soils (positive modifiers = more work)
  'Clay-Limestone': 0.05,  // +5% work
  'Gravel': 0.08,          // +8% work
  'Marl': 0.10,            // +10% work
  'Shale': 0.12,           // +12% work
  
  // Very difficult soils (high modifiers = much more work)
  'Heavy Clay': 0.15,      // +15% work
  'Rocky': 0.20,           // +20% work
  'Granite': 0.18,         // +18% work
  'Basalt': 0.20,          // +20% work
  'Sandstone': 0.15,       // +15% work
  'Slate': 0.22,           // +22% work
  'Schist': 0.25,          // +25% work
  'Chalk': 0.15,           // +15% work
  'Volcanic Soil': 0.18,   // +18% work
  'Volcanic': 0.18,        // +18% work
  'Galestro': 0.20,        // +20% work
  'Ferrous Clay': 0.16,    // +16% work
  'Marine Sediment': 0.14, // +14% work
  'Devonian Slate': 0.24,  // +24% work
  'Blue Devonian Slate': 0.25, // +25% work
  'Red Devonian Slate': 0.25,  // +25% work
  'Greywacke': 0.20,       // +20% work
  'Phyllite': 0.18,        // +18% work
  'Quartzite': 0.20,       // +20% work
  'Quartz': 0.22,          // +22% work
  'Red Earth': 0.12,       // +12% work
  'Albariza': 0.16,        // +16% work
  'Barros': 0.14,          // +14% work
  'Arenas': 0.08,          // +8% work
  'Flint': 0.26,           // +26% work (very hard)
} as const;

// Altitude ranges by region (in meters)
export const REGION_ALTITUDE_RANGES = {
  "France": {
    "Bordeaux": [0, 100],
    "Bourgogne": [200, 500],
    "Champagne": [100, 300],
    //"Loire Valley": [50, 200],
    "Rhone Valley": [100, 400],
    "Jura": [250, 400]
  },
  "Germany": {
    "Ahr": [100, 300],
    "Mosel": [100, 350],
    "Pfalz": [100, 300],
    "Rheingau": [80, 250],
    "Rheinhessen": [80, 250]
  },
  "Italy": {
    "Piedmont": [150, 600],
    "Puglia": [0, 200],
    "Sicily": [50, 900],
    "Tuscany": [150, 600],
    "Veneto": [50, 400]
  },
  "Spain": {
    "Jumilla": [400, 800],
    "La Mancha": [600, 800],
    "Ribera del Duero": [700, 900],
    "Rioja": [300, 700],
    "Jerez": [0, 100]
  },
  "United States": {
    "Central Coast": [0, 500],
    "Finger Lakes": [100, 300],
    "Napa Valley": [0, 600],
    "Sonoma County": [0, 500],
    "Willamette Valley": [50, 300]
  }
} as const;

// Aspect ratings by region (0-1 scale, where 1.0 is optimal)
export const REGION_ASPECT_RATINGS = {
  "Italy": {
    "Piedmont": { "North": 0.25, "Northeast": 0.45, "East": 0.65, "Southeast": 1.00, "South": 0.90, "Southwest": 0.80, "West": 0.60, "Northwest": 0.40 },
    "Tuscany": { "North": 0.30, "Northeast": 0.55, "East": 0.75, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.70, "Northwest": 0.50 },
    "Veneto": { "North": 0.20, "Northeast": 0.40, "East": 0.60, "Southeast": 0.95, "South": 1.00, "Southwest": 0.85, "West": 0.65, "Northwest": 0.35 },
    "Sicily": { "North": 0.45, "Northeast": 0.65, "East": 0.85, "Southeast": 1.00, "South": 0.90, "Southwest": 0.80, "West": 0.70, "Northwest": 0.55 },
    "Puglia": { "North": 0.50, "Northeast": 0.65, "East": 0.85, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.75, "Northwest": 0.55 }
  },
  "France": {
    "Bordeaux": { "North": 0.30, "Northeast": 0.40, "East": 0.60, "Southeast": 0.85, "South": 1.00, "Southwest": 0.95, "West": 0.80, "Northwest": 0.50 },
    "Bourgogne": { "North": 0.25, "Northeast": 0.45, "East": 0.65, "Southeast": 1.00, "South": 0.90, "Southwest": 0.80, "West": 0.55, "Northwest": 0.40 },
    "Champagne": { "North": 0.20, "Northeast": 0.35, "East": 0.55, "Southeast": 0.90, "South": 1.00, "Southwest": 0.80, "West": 0.60, "Northwest": 0.35 },
    //"Loire Valley": { "North": 0.30, "Northeast": 0.50, "East": 0.65, "Southeast": 0.85, "South": 1.00, "Southwest": 0.90, "West": 0.75, "Northwest": 0.45 },
    "Rhone Valley": { "North": 0.25, "Northeast": 0.50, "East": 0.70, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.65, "Northwest": 0.40 },
    "Jura": { "North": 0.20, "Northeast": 0.45, "East": 0.65, "Southeast": 0.95, "South": 1.00, "Southwest": 0.85, "West": 0.60, "Northwest": 0.35 }
  },
  "Spain": {
    "Rioja": { "North": 0.40, "Northeast": 0.55, "East": 0.75, "Southeast": 0.85, "South": 1.00, "Southwest": 0.90, "West": 0.80, "Northwest": 0.60 },
    "Ribera del Duero": { "North": 0.35, "Northeast": 0.60, "East": 0.80, "Southeast": 0.90, "South": 1.00, "Southwest": 0.85, "West": 0.70, "Northwest": 0.55 },
    "Jumilla": { "North": 0.50, "Northeast": 0.65, "East": 0.85, "Southeast": 1.00, "South": 0.90, "Southwest": 0.80, "West": 0.70, "Northwest": 0.60 },
    "La Mancha": { "North": 0.45, "Northeast": 0.60, "East": 0.85, "Southeast": 1.00, "South": 0.90, "Southwest": 0.80, "West": 0.75, "Northwest": 0.50 },
    "Jerez": { "North": 0.50, "Northeast": 0.70, "East": 0.85, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.80, "Northwest": 0.60 }
  },
  "United States": {
    "Napa Valley": { "North": 0.40, "Northeast": 0.65, "East": 0.85, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.75, "Northwest": 0.60 },
    "Sonoma County": { "North": 0.35, "Northeast": 0.60, "East": 0.80, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.75, "Northwest": 0.55 },
    "Willamette Valley": { "North": 0.20, "Northeast": 0.45, "East": 0.70, "Southeast": 0.85, "South": 1.00, "Southwest": 0.90, "West": 0.65, "Northwest": 0.35 },
    "Finger Lakes": { "North": 0.25, "Northeast": 0.50, "East": 0.70, "Southeast": 0.85, "South": 1.00, "Southwest": 0.85, "West": 0.75, "Northwest": 0.45 },
    "Central Coast": { "North": 0.35, "Northeast": 0.60, "East": 0.80, "Southeast": 1.00, "South": 0.90, "Southwest": 0.85, "West": 0.70, "Northwest": 0.50 }
  },
  "Germany": {
    "Mosel": { "North": 0.15, "Northeast": 0.35, "East": 0.65, "Southeast": 0.95, "South": 1.00, "Southwest": 0.85, "West": 0.60, "Northwest": 0.30 },
    "Rheingau": { "North": 0.20, "Northeast": 0.50, "East": 0.70, "Southeast": 0.90, "South": 1.00, "Southwest": 0.85, "West": 0.75, "Northwest": 0.40 },
    "Rheinhessen": { "North": 0.25, "Northeast": 0.60, "East": 0.80, "Southeast": 0.90, "South": 1.00, "Southwest": 0.85, "West": 0.70, "Northwest": 0.50 },
    "Pfalz": { "North": 0.30, "Northeast": 0.65, "East": 0.80, "Southeast": 0.90, "South": 1.00, "Southwest": 0.85, "West": 0.70, "Northwest": 0.50 },
    "Ahr": { "North": 0.10, "Northeast": 0.40, "East": 0.65, "Southeast": 0.85, "South": 1.00, "Southwest": 0.80, "West": 0.65, "Northwest": 0.35 }
  }
} as const;

// ===== MARKET DATA =====

// Prestige rankings by region (0-1 scale, where 1.0 is highest prestige)
export const REGION_PRESTIGE_RANKINGS = {
  "France": {
    "Bourgogne": 1.00,
    "Champagne": 0.98,
    "Bordeaux": 0.87,
    "Jura": 0.65,
//    "Loire Valley": 0.61,
    "Rhone Valley": 0.60
  },
  "United States": {
    "Napa Valley": 0.90,
    "Sonoma County": 0.76,
    "Willamette Valley": 0.67,
    "Central Coast": 0.63,
    "Finger Lakes": 0.48
  },
  "Italy": {
    "Tuscany": 0.83,
    "Piedmont": 0.80,
    "Veneto": 0.55,
    "Sicily": 0.46,
    "Puglia": 0.35
  },
  "Germany": {
    "Rheingau": 0.73,
    "Mosel": 0.72,
    "Pfalz": 0.57,
    "Ahr": 0.41,
    "Rheinhessen": 0.37
  },
  "Spain": {
    "Rioja": 0.70,
    "Ribera del Duero": 0.65,
    "Jerez": 0.51,
    "La Mancha": 0.42,
    "Jumilla": 0.39
  }
} as const;

// Real price ranges per hectare (in euros)
export const REGION_PRICE_RANGES = {
  "France": {
    "Bourgogne": [1000000, 10000000],
    "Champagne": [500000, 2000000],
    "Bordeaux": [100000, 1000000],
    //"Loire Valley": [20000, 80000],
    "Rhone Valley": [30000, 120000],
    "Jura": [25000, 45000]
  },
  "United States": {
    "Napa Valley": [300000, 1000000],
    "Sonoma County": [100000, 500000],
    "Willamette Valley": [50000, 250000],
    "Central Coast": [20000, 150000],
    "Finger Lakes": [10000, 50000]
  },
  "Italy": {
    "Tuscany": [80000, 1000000],
    "Piedmont": [50000, 700000],
    "Veneto": [20000, 100000],
    "Sicily": [10000, 60000],
    "Puglia": [5000, 30000]
  },
  "Germany": {
    "Rheingau": [50000, 200000],
    "Mosel": [30000, 150000],
    "Pfalz": [15000, 60000],
    "Ahr": [20000, 50000],
    "Rheinhessen": [10000, 40000]
  },
  "Spain": {
    "Rioja": [30000, 100000],
    "Ribera del Duero": [30000, 80000],
    "Jerez": [10000, 40000],
    "La Mancha": [5000, 30000],
    "Jumilla": [5000, 25000]
  }
} as const;

// ===== GRAPE SUITABILITY =====

// Grape variety suitability by region (0-1 scale, where 1.0 is optimal)
export const REGION_GRAPE_SUITABILITY = {
  "Italy": {
    "Piedmont": { "Barbera": 1.0, "Chardonnay": 0.8, "Pinot Noir": 0.6, "Primitivo": 0.5, "Sauvignon Blanc": 0.6 },
    "Tuscany": { "Barbera": 0.9, "Chardonnay": 0.7, "Pinot Noir": 0.5, "Primitivo": 0.7, "Sauvignon Blanc": 0.7 },
    "Veneto": { "Barbera": 0.85, "Chardonnay": 0.75, "Pinot Noir": 0.7, "Primitivo": 0.6, "Sauvignon Blanc": 0.8 },
    "Sicily": { "Barbera": 0.8, "Chardonnay": 0.6, "Pinot Noir": 0.3, "Primitivo": 0.8, "Sauvignon Blanc": 0.5 },
    "Puglia": { "Barbera": 0.9, "Chardonnay": 0.65, "Pinot Noir": 0.4, "Primitivo": 1.0, "Sauvignon Blanc": 0.4 }
  },
  "France": {
    "Bordeaux": { "Barbera": 0.7, "Chardonnay": 0.8, "Pinot Noir": 0.6, "Primitivo": 0.6, "Sauvignon Blanc": 0.9 },
    "Bourgogne": { "Barbera": 0.4, "Chardonnay": 0.9, "Pinot Noir": 0.9, "Primitivo": 0.3, "Sauvignon Blanc": 0.7 },
    "Champagne": { "Barbera": 0.2, "Chardonnay": 0.9, "Pinot Noir": 0.8, "Primitivo": 0.2, "Sauvignon Blanc": 0.6 },
    //"Loire Valley": { "Barbera": 0.35, "Chardonnay": 0.85, "Pinot Noir": 0.7, "Primitivo": 0.3, "Sauvignon Blanc": 1.0 },
    "Rhone Valley": { "Barbera": 0.85, "Chardonnay": 0.75, "Pinot Noir": 0.5, "Primitivo": 0.7, "Sauvignon Blanc": 0.7 },
    "Jura": { "Barbera": 0.3, "Chardonnay": 0.9, "Pinot Noir": 0.8, "Primitivo": 0.2, "Sauvignon Blanc": 0.6 }
  },
  "Spain": {
    "Rioja": { "Barbera": 0.85, "Chardonnay": 0.7, "Pinot Noir": 0.4, "Primitivo": 0.5, "Sauvignon Blanc": 0.6 },
    "Ribera del Duero": { "Barbera": 0.8, "Chardonnay": 0.6, "Pinot Noir": 0.35, "Primitivo": 0.4, "Sauvignon Blanc": 0.5 },
    "Jumilla": { "Barbera": 0.9, "Chardonnay": 0.5, "Pinot Noir": 0.3, "Primitivo": 0.85, "Sauvignon Blanc": 0.4 },
    "La Mancha": { "Barbera": 0.85, "Chardonnay": 0.55, "Pinot Noir": 0.25, "Primitivo": 0.8, "Sauvignon Blanc": 0.5 },
    "Jerez": { "Barbera": 0.8, "Chardonnay": 0.5, "Pinot Noir": 0.2, "Primitivo": 0.7, "Sauvignon Blanc": 0.4 }
  },
  "United States": {
    "Napa Valley": { "Barbera": 0.9, "Chardonnay": 1.0, "Pinot Noir": 0.7, "Primitivo": 0.85, "Sauvignon Blanc": 0.8 },
    "Sonoma County": { "Barbera": 0.85, "Chardonnay": 0.95, "Pinot Noir": 0.75, "Primitivo": 0.8, "Sauvignon Blanc": 0.7 },
    "Willamette Valley": { "Barbera": 0.4, "Chardonnay": 0.85, "Pinot Noir": 1.0, "Primitivo": 0.3, "Sauvignon Blanc": 0.6 },
    "Finger Lakes": { "Barbera": 0.3, "Chardonnay": 0.7, "Pinot Noir": 0.75, "Primitivo": 0.2, "Sauvignon Blanc": 0.5 },
    "Central Coast": { "Barbera": 0.85, "Chardonnay": 0.8, "Pinot Noir": 0.6, "Primitivo": 0.75, "Sauvignon Blanc": 0.7 }
  },
  "Germany": {
    "Mosel": { "Barbera": 0.15, "Chardonnay": 0.8, "Pinot Noir": 1.0, "Primitivo": 0.1, "Sauvignon Blanc": 0.8 },
    "Rheingau": { "Barbera": 0.2, "Chardonnay": 0.85, "Pinot Noir": 0.9, "Primitivo": 0.15, "Sauvignon Blanc": 0.85 },
    "Rheinhessen": { "Barbera": 0.25, "Chardonnay": 0.8, "Pinot Noir": 0.85, "Primitivo": 0.2, "Sauvignon Blanc": 0.8 },
    "Pfalz": { "Barbera": 0.3, "Chardonnay": 0.75, "Pinot Noir": 0.8, "Primitivo": 0.25, "Sauvignon Blanc": 0.75 },
    "Ahr": { "Barbera": 0.1, "Chardonnay": 0.7, "Pinot Noir": 0.95, "Primitivo": 0.1, "Sauvignon Blanc": 0.6 }
  }
} as const;

// ===== RIPENESS SYSTEM =====

// Ripeness progression per season (weekly increase)
export const RIPENESS_INCREASE = {
  Spring: 0.01,  // 1% per week
  Summer: 0.02,  // 2% per week  
  Fall: 0.05,    // 5% per week (main ripening season)
  Winter: 0      // No ripening in winter
} as const;

// Vineyard health constants
export const DEFAULT_VINEYARD_HEALTH = 0.6; // Default health for new vineyards (60% - requires some clearing)

// Aspect modifiers for ripeness (0-1 scale)
export const ASPECT_RIPENESS_MODIFIERS = {
  'North': -0.1,
  'Northeast': -0.05,
  'Northwest': -0.05,
  'East': 0,
  'West': 0,
  'Southeast': 0.05,
  'Southwest': 0.05,
  'South': 0.1
} as const;

// Seasonal randomness ranges for ripeness (as multipliers)
export const SEASONAL_RIPENESS_RANDOMNESS = {
  Spring: { min: 0.5, max: 1.75 },   // -50% to +75%
  Summer: { min: 0.75, max: 2.0 },   // -25% to +100%
  Fall: { min: 0.0, max: 1.5 },     // -100% to +50%
  Winter: { min: 0, max: 0 }        // No ripening
} as const;

