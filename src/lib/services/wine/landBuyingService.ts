// Land buying service - generates vineyard options for purchase
// Reimplements the old buyLandOverlay.js functionality with modern architecture

import { v4 as uuidv4 } from 'uuid';
import { Vineyard, Aspect } from '../../types/types';
import { calculateLandValue } from './vineyardValueCalc';
import { getRandomHectares } from '../../utils/calculator';
import { getRandomFromArray } from '../../utils';
import { 
  COUNTRY_REGION_MAP, 
  REGION_SOIL_TYPES, 
  REGION_ALTITUDE_RANGES,
  REGION_ASPECT_RATINGS
} from '../../constants/vineyardConstants';
import { NAMES } from '../../constants/namesConstants';
import { ASPECTS } from '../../types/types';

// Constants for land buying
export const LAND_BUYING_CONSTANTS = {
  NUMBER_OF_OPTIONS: 5, // Number of vineyard options to generate
} as const;

// Interface for vineyard purchase options (before actual purchase)
export interface VineyardPurchaseOption {
  id: string;
  name: string;
  country: string;
  region: string;
  hectares: number;
  soil: string[];
  altitude: number;
  aspect: Aspect;
  landValue: number; // Price per hectare
  totalPrice: number; // Total price for the vineyard
  aspectRating: number; // Aspect rating for display
}

// Helper functions for random vineyard generation
function getRandomFromObject<T>(obj: Record<string, T>): string {
  const keys = Object.keys(obj);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getRandomAspect(): Aspect {
  return getRandomFromArray(ASPECTS);
}

function getRandomSoils(country: string, region: string): string[] {
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  const soils = countryData ? (countryData[region as keyof typeof countryData] as readonly string[] || []) : [];
  
  const numberOfSoils = Math.floor(Math.random() * 3) + 1; // 1-3 soil types
  const selectedSoils = new Set<string>();

  while (selectedSoils.size < numberOfSoils && selectedSoils.size < soils.length) {
    selectedSoils.add(getRandomFromArray(soils));
  }

  return Array.from(selectedSoils);
}

function getRandomAltitude(country: string, region: string): number {
  const countryData = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES];
  const altitudeRange: [number, number] = countryData ? (countryData[region as keyof typeof countryData] as [number, number] || [0, 100]) : [0, 100];
  const [min, max] = altitudeRange;
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a vineyard name based on country and aspect
function generateVineyardName(country: string, aspect: Aspect): string {
  const isFemaleAspect = ["East", "Southeast", "South", "Southwest"].includes(aspect);
  const nameData = NAMES[country as keyof typeof NAMES];
  
  if (!nameData) {
    console.error(`No name data found for country: ${country}. Cannot generate vineyard name.`);
    throw new Error(`No name data found for country: ${country}. Cannot generate vineyard name.`);
  }
  
  // Select appropriate name list based on aspect gender
  const names = isFemaleAspect ? nameData.firstNames.female : nameData.firstNames.male;
  
  // Select a random name
  const randomIndex = Math.floor(Math.random() * names.length);
  const selectedName = names[randomIndex];
  
  // Construct the name like "[Random Name]'s [Aspect] Vineyard"
  return `${selectedName}'s ${aspect} Vineyard`;
}

// Get aspect rating for display purposes
function getAspectRating(country: string, region: string, aspect: Aspect): number {
  const countryAspects = REGION_ASPECT_RATINGS[country as keyof typeof REGION_ASPECT_RATINGS];
  const regionAspects = countryAspects ? countryAspects[region as keyof typeof countryAspects] : null;
  return regionAspects ? (regionAspects[aspect as keyof typeof regionAspects] ?? 0.5) : 0.5;
}

/**
 * Generate vineyard purchase options for the land buying modal
 * @param numberOfOptions Number of options to generate (defaults to LAND_BUYING_CONSTANTS.NUMBER_OF_OPTIONS)
 * @param existingVineyards Array of existing vineyards to avoid duplicates
 * @returns Array of vineyard purchase options
 */
export function generateVineyardPurchaseOptions(
  numberOfOptions: number = LAND_BUYING_CONSTANTS.NUMBER_OF_OPTIONS,
  existingVineyards: Vineyard[] = []
): VineyardPurchaseOption[] {
  const options: VineyardPurchaseOption[] = [];
  const existingNames = new Set(existingVineyards.map(v => v.name));

  while (options.length < numberOfOptions) {
    const country = getRandomFromObject(COUNTRY_REGION_MAP);
    const countryRegions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
    const region = countryRegions ? getRandomFromArray(countryRegions) : "Bordeaux";
    const aspect = getRandomAspect();
    const hectares = getRandomHectares();
    const soil = getRandomSoils(country, region);
    const altitude = getRandomAltitude(country, region);
    
    // Generate vineyard name
    const vineyardName = generateVineyardName(country, aspect);
    
    // Skip if name already exists
    if (existingNames.has(vineyardName)) {
      continue;
    }
    
    // Calculate land value
    const landValue = calculateLandValue(country, region, altitude, aspect);
    const totalPrice = landValue * hectares;
    
    // Get aspect rating for display
    const aspectRating = getAspectRating(country, region, aspect);
    
    const option: VineyardPurchaseOption = {
      id: uuidv4(),
      name: vineyardName,
      country,
      region,
      hectares,
      soil,
      altitude,
      aspect,
      landValue,
      totalPrice,
      aspectRating
    };
    
    options.push(option);
    existingNames.add(vineyardName); // Prevent duplicates in the same generation
  }
  
  return options;
}

/**
 * Convert a vineyard purchase option to a full Vineyard object
 * @param option The purchase option to convert
 * @returns Full Vineyard object ready for saving
 */
export function convertPurchaseOptionToVineyard(option: VineyardPurchaseOption): Omit<Vineyard, 'id'> {
  return {
    name: option.name,
    country: option.country,
    region: option.region,
    hectares: option.hectares,
    grape: null,
    vineAge: null,
    soil: option.soil,
    altitude: option.altitude,
    aspect: option.aspect,
    density: 0, // No density until planted
    vineyardHealth: 1.0, // Default perfect health
    landValue: option.landValue,
    vineyardTotalValue: option.totalPrice,
    status: 'Barren',
    vineyardPrestige: 0,
    vineYield: 0.02, // Default vine yield factor
    ripeness: 0 // No ripeness until planted and growing
  };
}
