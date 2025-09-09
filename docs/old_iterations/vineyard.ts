import { GameDate, BASE_YIELD_PER_ACRE, BASELINE_VINE_DENSITY, CONVENTIONAL_YIELD_BONUS, DEFAULT_VINEYARD_HEALTH, ORGANIC_CERTIFICATION_YEARS } from '@/lib/core/constants/gameConstants';
import { GrapeVariety, Aspect, FarmingMethod, COUNTRY_REGION_MAP, REGION_SOIL_TYPES, REGION_ALTITUDE_RANGES, REGION_ASPECT_RATINGS, REGION_PRESTIGE_RANKINGS, GRAPE_SUITABILITY, REGION_REAL_PRICE_RANGES, getResourceByGrapeVariety } from '@/lib/core/constants/vineyardConstants';
import { italianMaleNames, italianFemaleNames, germanMaleNames, germanFemaleNames, spanishMaleNames, spanishFemaleNames, frenchMaleNames, frenchFemaleNames, usMaleNames, usFemaleNames } from '@/lib/core/constants/staffConstants';
import { getGameState } from '@/gameState';

// Vineyard interface
export interface Vineyard {
  id: string;
  name: string;
  country: string;
  region: string;
  acres: number;
  grape: GrapeVariety | null;
  vineAge: number;
  soil: string[];
  altitude: number;
  aspect: Aspect;
  density: number;
  vineyardHealth: number;
  landValue: number;
  status: string;
  ripeness: number;
  vineyardPrestige: number;
  completedClearingTasks: string[];
  annualYieldFactor: number;
  annualQualityFactor: number;
  farmingMethod: FarmingMethod;
  organicYears: number;
  remainingYield: number | null;
  ownedSince: GameDate;
  upgrades?: string[];
  //generateFarmlandPreview not implemented yet (Creates a specific Farmland instance based on country/region for starting conditions)
}

export function calculateVineyardYield(vineyard: Vineyard): number {
  // Get resource data
  const resource = getResourceByGrapeVariety(vineyard.grape);
  
  if (!vineyard.grape || !resource || vineyard.annualYieldFactor === 0 || vineyard.status === 'Harvested') {
    return 0;
  }

  const densityModifier = vineyard.density / BASELINE_VINE_DENSITY;
  // Update quality multiplier to include naturalYield (as per old logic)
  const qualityMultiplier = (vineyard.ripeness + resource.naturalYield + vineyard.vineyardHealth) / 3;
  let expectedYield = BASE_YIELD_PER_ACRE * vineyard.acres * qualityMultiplier * vineyard.annualYieldFactor * densityModifier;
  
  // Apply bonus multiplier if conventional
  if (vineyard.farmingMethod === 'Conventional') {
    expectedYield *= CONVENTIONAL_YIELD_BONUS;
  }

  // Round the final yield
  return Math.round(expectedYield);
}

export function getRemainingYield(vineyard: Vineyard): number {
  // If harvest hasn't started yet, return full yield
  if (vineyard.remainingYield === null) {
    return calculateVineyardYield(vineyard);
  }
  // Otherwise return what's left
  return vineyard.remainingYield;
}

/**
 * Calculates the land value based on country, region, altitude, and aspect,
 * incorporating real price ranges.
 */
export function calculateLandValue(country: string, region: string, altitude: number, aspect: Aspect): number {
  // Get normalized factors (0-1 range, roughly)
  const prestigeKey = `${region}, ${country}`;
  const prestigeNormalized = REGION_PRESTIGE_RANKINGS[prestigeKey] || 0.5; 
  
  // Explicitly define altitudeRange type and handle defaults
  let altitudeRange: [number, number];
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  if (countryData && countryData[region as keyof typeof countryData]) {
    altitudeRange = countryData[region as keyof typeof countryData] as [number, number];
  } else {
    altitudeRange = [0, 100]; // Default range
  }
  const altitudeNormalized = normalizeAltitude(altitude, altitudeRange);

  // Use REGION_ASPECT_RATINGS instead of ASPECT_FACTORS
  const countryAspects = REGION_ASPECT_RATINGS[country as keyof typeof REGION_ASPECT_RATINGS];
  const regionAspects = countryAspects ? countryAspects[region as keyof typeof countryAspects] : null;
  const aspectNormalized = regionAspects ? (regionAspects[aspect as keyof typeof regionAspects] ?? 0.5) : 0.5; // Default to 0.5 if not found

  // Calculate raw price factor by averaging normalized values (as per old logic)
  const rawPriceFactor = (prestigeNormalized + aspectNormalized + altitudeNormalized) / 3;

  // Integrate real price range (use lower bound as base price per hectare)
  const realPriceRange = REGION_REAL_PRICE_RANGES[prestigeKey as keyof typeof REGION_REAL_PRICE_RANGES] || [5000, 10000] as [number, number]; 
  const basePricePerHectare = realPriceRange[0]; 

  // Convert hectare price to acre price (1 hectare = 2.47105 acres) 
  const pricePerAcre = basePricePerHectare / 2.47105;

  // Apply the combined factor to the base price per acre (as per old logic)
  const finalValue = (rawPriceFactor + 1) * pricePerAcre;

  return Math.round(finalValue);
}

export function normalizeAltitude(altitude: number, range: [number, number]): number {
  const [minAltitude, maxAltitude] = range;
  // Revert to old normalization logic (0.3 to 0.7 range)
  if (maxAltitude <= minAltitude) return 0.5; // Avoid division by zero, return midpoint
  const normalized = (altitude - minAltitude) / (maxAltitude - minAltitude);
  const clamped = Math.max(0, Math.min(1, normalized)); // Clamp between 0 and 1
  return 0.3 + clamped * (0.7 - 0.3);
}

export function calculateVineyardPrestige(vineyard: Vineyard): number {
  // Age contribution (30%) - Needs refinement if old logic was different
  const ageContribution = calculateAgeContribution(vineyard.vineAge); // Existing function

  // Land value contribution (25%) - Refined to use new landValue
  const landValueContribution = calculateLandValueContribution(vineyard.landValue); // Existing function (may need adjustment based on new landValue range)

  // Region prestige contribution (25%) - Refined
  const prestigeRankingContribution = calculateRegionPrestigeContribution(vineyard.region, vineyard.country); // Existing function

  // Grape variety suitability (20%) - Placeholder remains
  const grapeContribution = calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country); // Existing function

  const finalPrestige = (
    (ageContribution * 0.30) +
    (landValueContribution * 0.25) +
    (prestigeRankingContribution * 0.25) +
    (grapeContribution * 0.20)
  ) || 0.01; // Ensure weights sum to 1.0

  return Math.max(0.01, Math.min(1, finalPrestige));
}

function calculateAgeContribution(vineAge: number): number {
  if (vineAge <= 0) return 0;
  
  if (vineAge <= 3) {
    return (vineAge * vineAge) / 100 + 0.01;
  } else if (vineAge <= 25) {
    return 0.1 + (vineAge - 3) * (0.4 / 22);
  } else if (vineAge <= 100) {
    return 0.5 + (Math.atan((vineAge - 25) / 20) / Math.PI) * (0.95 - 0.5);
  } else {
    return 0.95;
  } 
}

// Refine normalization to match old logic
function calculateLandValueContribution(landValue: number): number {
  // Normalize land value by dividing by the old constant 190000
  const normalizedValue = landValue / 190000;
  // Return the normalized value, allowing values potentially > 1 as per old comment
  return Math.max(0, normalizedValue); // Ensure non-negative
}

function calculateRegionPrestigeContribution(region: string, country: string): number {
  // Use the migrated REGION_PRESTIGE_RANKINGS
  const prestigeKey = `${region}, ${country}`;
  return REGION_PRESTIGE_RANKINGS[prestigeKey] || 0.5; // Default if not found, weighting happens later
}

// Use GRAPE_SUITABILITY constant
function calculateGrapeSuitabilityContribution(grape: GrapeVariety | null, region: string, country: string): number {
  if (!grape || !country || !region) return 0;

  const countrySuitability = GRAPE_SUITABILITY[country as keyof typeof GRAPE_SUITABILITY];
  if (!countrySuitability) return 0.5; // Default if country not found

  const regionSuitability = countrySuitability[region as keyof typeof countrySuitability];
  if (!regionSuitability) return 0.5; // Default if region not found

  // Return the suitability for the specific grape, or default 0.5
  return regionSuitability[grape as keyof typeof regionSuitability] ?? 0.5;
}

export function createVineyard(id: string, options: Partial<Vineyard> = {}): Vineyard {
  const country = options.country || getRandomFromObject(COUNTRY_REGION_MAP);
  const countryRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
  const region = options.region || (countryRegions ? getRandomFromArray(countryRegions) : "");
  const aspect = options.aspect || getRandomAspect();
  const name = options.name || generateVineyardName(country, aspect); // Keep placeholder name gen
  const soil = options.soil ? (Array.isArray(options.soil) ? options.soil : [options.soil]) : getRandomSoils(country, region);
  const altitude = options.altitude || getRandomAltitude(country, region);
  const acres = options.acres || getRandomAcres();

  const { week, season, currentYear } = getGameState();
  const ownedSince: GameDate = options.ownedSince || { week, season, year: currentYear };

  // Determine initial farming method - Default to Non-Conventional?
  const initialFarmingMethod = options.farmingMethod || "Non-Conventional";

  const vineyard: Vineyard = {
    id,
    name,
    country,
    region,
    acres,
    grape: options.grape || null,
    vineAge: options.vineAge || 0,
    soil,
    altitude,
    aspect,
    density: options.density || 0, // Default density to 0 if not planted
    vineyardHealth: options.vineyardHealth || DEFAULT_VINEYARD_HEALTH, // Use constant
    landValue: 0, // Will be calculated below
    status: options.status || 'Ready to be planted',
    ripeness: options.ripeness || 0.0,
    vineyardPrestige: 0, // Will be calculated below
    completedClearingTasks: options.completedClearingTasks || [],
    annualYieldFactor: options.annualYieldFactor || (0.75 + Math.random()), // Keep random for now
    annualQualityFactor: options.annualQualityFactor || Math.random(), // Keep random for now
    farmingMethod: initialFarmingMethod, // Initialize new field
    organicYears: options.organicYears || (initialFarmingMethod === 'Ecological' ? ORGANIC_CERTIFICATION_YEARS : 0), // Initialize new field
    remainingYield: options.remainingYield === undefined ? null : options.remainingYield,
    ownedSince,
    upgrades: options.upgrades || [], // Initialize new field
  };

  // Calculate land value after other properties are set
  vineyard.landValue = calculateLandValue(vineyard.country, vineyard.region, vineyard.altitude, vineyard.aspect);

  // Calculate prestige after land value is set
  vineyard.vineyardPrestige = calculateVineyardPrestige(vineyard);

  return vineyard;
}

// Helper functions

function getRandomFromObject<T>(obj: Record<string, T>): string {
  const keys = Object.keys(obj);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getRandomFromArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomAspect(): Aspect {
  const aspects: Aspect[] = [
    "North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"
  ];
  return getRandomFromArray(aspects);
}

// Updated generateVineyardName function
function generateVineyardName(country: string, aspect: Aspect): string {
  let names: string[] = [];

  // Determine gender-based name list based on the aspect
  const isFemaleAspect = ["East", "Southeast", "South", "Southwest"].includes(aspect);

  switch (country) {
    case 'Italy':
      names = isFemaleAspect ? italianFemaleNames : italianMaleNames;
      break;
    case 'Germany':
      names = isFemaleAspect ? germanFemaleNames : germanMaleNames;
      break;
    case 'Spain':
      names = isFemaleAspect ? spanishFemaleNames : spanishMaleNames;
      break;
    case 'France':
      names = isFemaleAspect ? frenchFemaleNames : frenchMaleNames;
      break;
    case 'United States':
      names = isFemaleAspect ? usFemaleNames : usMaleNames;
      break;
    default:
      // Fallback for unmapped countries or if name lists are empty
      return `${country} ${aspect} Vineyard`; 
  }

  // Handle empty name list case
  if (names.length === 0) {
     return `${country} ${aspect} Vineyard`;
  }

  const randomIndex = Math.floor(Math.random() * names.length);
  // Construct the name like "[Random Name]'s [Aspect] Vineyard"
  return `${names[randomIndex]}'s ${aspect} Vineyard`;
}

function getRandomSoils(country: string, region: string): string[] {
  // Handle country data with type assertion
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  const soils = countryData ? countryData[region as keyof typeof countryData] || [] : [];
  
  const numberOfSoils = Math.floor(Math.random() * 3) + 1; // 1-3 soil types
  const selectedSoils = new Set<string>();

  while (selectedSoils.size < numberOfSoils && selectedSoils.size < soils.length) {
    selectedSoils.add(getRandomFromArray(soils));
  }

  return Array.from(selectedSoils);
}

function getRandomAltitude(country: string, region: string): number {
  // Handle country data with type assertion
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange: [number, number] = countryData ? (countryData[region as keyof typeof countryData] as [number, number] || [0, 100]) : [0, 100];
  const [min, max] = altitudeRange;
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomAcres(): number {
  const rand = Math.random() * 100;
  let acres;

  if (rand < 25) { // Very Small: 25%
    acres = 0.1 + Math.random() * 0.9;
  } else if (rand < 60) { // Small: 35%
    acres = 1 + Math.random() * 4;
  } else if (rand < 85) { // Medium: 25%
    acres = 5 + Math.random() * 15;
  } else if (rand < 93) { // Large: 8%
    acres = 20 + Math.random() * 30;
  } else if (rand < 96) { // Very Large: 3%
    acres = 50 + Math.random() * 450;
  } else if (rand < 96.5) { // Extra Large: 0.5%
    acres = 500 + Math.random() * 500;
  } else if (rand < 96.6) { // Ultra Large: 0.1%
    acres = 1000 + Math.random() * 4000;
  } else { // Fallback to medium size
    acres = 5 + Math.random() * 15;
  }

  return Number(acres.toFixed(2));
}

