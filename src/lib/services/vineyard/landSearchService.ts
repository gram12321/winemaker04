import { Activity, WorkCategory, Aspect } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { createActivity } from '../activity/activitymanagers/activityManager';
import { notificationService } from '@/components/layout/NotificationCenter';
import { NotificationCategory } from '@/lib/types/types';
import { addTransaction } from '../user/financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateTotalWork } from '../activity/workcalculators/workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { REGION_PRESTIGE_RANKINGS, COUNTRY_REGION_MAP, REGION_SOIL_TYPES, REGION_ASPECT_RATINGS, REGION_ALTITUDE_RANGES, REGION_GRAPE_SUITABILITY, ALL_SOIL_TYPES } from '@/lib/constants/vineyardConstants';
import { NAMES } from '@/lib/constants/namesConstants';
import { calculateLandValue } from './vineyardValueCalc';
import { v4 as uuidv4 } from 'uuid';
import { probabilityMassInRange, getRandomHectares, NormalizeScrewed1000To01WithTail, calculateInvertedSkewedMultiplier } from '@/lib/utils/calculator';

/**
 * Interface for vineyard purchase options (before actual purchase)
 */
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
  altitudeRating: number; // Altitude rating normalized to regional range (0-1)
}

/**
 * Generate a vineyard name based on country and aspect
 */
export function generateVineyardName(country: string, aspect: Aspect): string {
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

/**
 * Land search options interface
 */
export interface LandSearchOptions {
  numberOfOptions: number;
  regions: string[]; // Selected regions (empty = all accessible)
  selectedCountries?: string[]; // Selected countries for filtering (empty = all countries)
  altitudeRange?: [number, number];
  aspectPreferences?: Aspect[];
  hectareRange: [number, number];
  soilTypes?: string[];
  minGrapeSuitability?: number;
  grapeVarieties?: string[]; // Selected grape varieties for suitability filtering
}

/**
 * Search work estimate with cost
 */
export interface LandSearchEstimate {
  totalWork: number;
  timeEstimate: string;
  cost: number;
}

/**
 * Calculate the cost of a land search based on parameters
 * Uses average-then-power scaling: Base * (Σ constraints / count)^count * (n-2)
 */
export function calculateSearchCost(options: LandSearchOptions, _companyPrestige: number): number {
  const baseCost = 5000;
  
  // Track which constraints are active and their intensities
  const activeConstraints: number[] = [];
  
  // Region filtering constraint - penalize when regions are excluded (manually OR by soil filtering OR by grape suitability)
  const totalRegions = Object.values(COUNTRY_REGION_MAP).flat().length;
  let excludedRegions = new Set(options.regions); // Start with manually excluded regions
  
  // Add regions excluded by soil filtering
  if (options.soilTypes && options.soilTypes.length > 0 && options.soilTypes.length < ALL_SOIL_TYPES.length) {
    for (const country of Object.keys(COUNTRY_REGION_MAP)) {
      const regions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
      for (const region of regions as any) {
        if (!meetsSoilRequirement(country, region, options.soilTypes)) {
          excludedRegions.add(region);
        }
      }
    }
  }
  
  // Add regions excluded by grape suitability filtering
  if (options.grapeVarieties && options.grapeVarieties.length > 0 && options.minGrapeSuitability && options.minGrapeSuitability > 0) {
    for (const country of Object.keys(COUNTRY_REGION_MAP)) {
      const regions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
      for (const region of regions as any) {
        if (!meetsGrapeSuitabilityRequirement(country, region, options.grapeVarieties, options.minGrapeSuitability)) {
          excludedRegions.add(region);
        }
      }
    }
  }
  
  // Apply region constraint if any regions are excluded
  if (excludedRegions.size > 0) {
    const exclusionRatio = excludedRegions.size / totalRegions;
    const regionModifier = 1.8; // Base multiplier for region constraint
    const regionIntensity = 1 + (exclusionRatio * 2); // 1.0-3.0 based on exclusion ratio
    activeConstraints.push(regionModifier * regionIntensity);
  }
  
  
  // Hectare range constraint - use distribution mass removed as intensity
  {
    const [minHa, maxHa] = options.hectareRange;
    const massKept = probabilityMassInRange(minHa, maxHa); // 0-1
    const massRemoved = 1 - massKept; // 0-1, higher when excluding common small sizes
    if (massRemoved > 0) {
      const hectareModifier = 1.8; // Strong base since this filter is impactful
      // Nonlinear penalty to emphasize removing common small sizes
      const hectareIntensity = 1 + Math.pow(massRemoved, 0.75) * 2.5; // 1.0-3.5
      activeConstraints.push(hectareModifier * hectareIntensity);
    }
  }
  
  // Altitude range constraint - normalized 0-1 width
  if (options.altitudeRange) {
    const width = Math.max(0, Math.min(1, (options.altitudeRange[1] - options.altitudeRange[0])));
    if (width < 1) {
      const removal = 1 - width; // 0-1 removed fraction
      const altitudeModifier = 1.5;
      const altitudeIntensityValue = 1 + Math.pow(removal, 0.85) * 2.0; // 1.0-3.0
      activeConstraints.push(altitudeModifier * altitudeIntensityValue);
    }
  }
  
  // Aspect preferences constraint - penalize when aspects are deselected (restricted)
  if (options.aspectPreferences && options.aspectPreferences.length < 8) {
    const deselectedAspects = 8 - options.aspectPreferences.length; // How many aspects deselected
    const restrictionRatio = deselectedAspects / 8; // 0-1 based on how many aspects deselected
    const aspectModifier = 1.4; // Base multiplier for aspect constraint
    const aspectIntensityValue = 1 + (restrictionRatio * 2.5); // 1.0-3.5 based on how many aspects deselected
    activeConstraints.push(aspectModifier * aspectIntensityValue);
  }
  
  // Soil type constraint - penalize when soils are deselected (restricted)
  if (options.soilTypes && options.soilTypes.length < ALL_SOIL_TYPES.length) {
    const deselectedSoils = ALL_SOIL_TYPES.length - options.soilTypes.length; // How many soils deselected
    const restrictionRatio = deselectedSoils / ALL_SOIL_TYPES.length; // 0-1 based on how many soils deselected
    const soilModifier = 1.3; // Base multiplier for soil constraint
    const soilIntensityValue = 1 + (restrictionRatio * 2.5); // 1.0-3.5 based on how many soils deselected
    activeConstraints.push(soilModifier * soilIntensityValue);
  }
  
  
  // Average-then-power: Base × (Σ constraints / count)^count
  const constraintCount = activeConstraints.length;
  let totalMultiplier = 1;
  
  if (constraintCount > 0) {
    const constraintSum = activeConstraints.reduce((sum, constraint) => sum + constraint, 0);
    const constraintAverage = constraintSum / constraintCount;
    totalMultiplier = Math.pow(constraintAverage, constraintCount);
  }
  
  // Initial + variable cost (average-then-power):
  // cost = initialCost + baseCost * (totalMultiplier) * (n - 2)
  // where totalMultiplier = (Σ constraints / count)^count
  const n = Math.max(3, Math.min(10, options.numberOfOptions || 3));
  const initialCost = 20000; // Fixed activation cost, independent of options
  const finalCost = initialCost + (baseCost * totalMultiplier * (n - 2));
  
  return Math.round(finalCost);
}

/**
 * Calculate work required for land search activity
 * Uses multiplicative scaling similar to cost calculation - more constraints = more work
 */
export function calculateSearchWork(options: LandSearchOptions, _companyPrestige: number): number {
  const rate = TASK_RATES[WorkCategory.ADMINISTRATION];
  const initialWork = INITIAL_WORK[WorkCategory.ADMINISTRATION];
  
  // Track which constraints are active and their intensities (similar to cost calculation)
  const activeConstraints: number[] = [];
  
  // Region filtering constraint - penalize when regions are excluded (manually OR by soil filtering OR by grape suitability) - work calculation
  const totalRegions = Object.values(COUNTRY_REGION_MAP).flat().length;
  let excludedRegions = new Set(options.regions); // Start with manually excluded regions
  
  // Add regions excluded by soil filtering
  if (options.soilTypes && options.soilTypes.length > 0 && options.soilTypes.length < ALL_SOIL_TYPES.length) {
    for (const country of Object.keys(COUNTRY_REGION_MAP)) {
      const regions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
      for (const region of regions as any) {
        if (!meetsSoilRequirement(country, region, options.soilTypes)) {
          excludedRegions.add(region);
        }
      }
    }
  }
  
  // Add regions excluded by grape suitability filtering
  if (options.grapeVarieties && options.grapeVarieties.length > 0 && options.minGrapeSuitability && options.minGrapeSuitability > 0) {
    for (const country of Object.keys(COUNTRY_REGION_MAP)) {
      const regions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
      for (const region of regions as any) {
        if (!meetsGrapeSuitabilityRequirement(country, region, options.grapeVarieties, options.minGrapeSuitability)) {
          excludedRegions.add(region);
        }
      }
    }
  }
  
  // Apply region constraint if any regions are excluded
  if (excludedRegions.size > 0) {
    const exclusionRatio = excludedRegions.size / totalRegions;
    const regionModifier = 1.5; // Base multiplier for region constraint (lower than cost)
    const regionIntensity = 1 + (exclusionRatio * 1.5); // 1.0-2.5 based on exclusion ratio
    activeConstraints.push(regionModifier * regionIntensity);
  }
  
  
  // Hectare range constraint - use distribution mass removed as intensity (same approach as cost)
  {
    const [minHa, maxHa] = options.hectareRange;
    const massKept = probabilityMassInRange(minHa, maxHa); // 0-1
    const massRemoved = 1 - massKept; // 0-1
    if (massRemoved > 0) {
      const hectareModifier = 1.3; // milder than cost
      const hectareIntensity = 1 + Math.pow(massRemoved, 0.8) * 2.0; // 1.0-3.0
      activeConstraints.push(hectareModifier * hectareIntensity);
    }
  }
  
  // Altitude range constraint - normalized 0-1 width (work model)
  if (options.altitudeRange) {
    const width = Math.max(0, Math.min(1, (options.altitudeRange[1] - options.altitudeRange[0])));
    if (width < 1) {
      const removal = 1 - width;
      const altitudeModifier = 1.2;
      const altitudeIntensityValue = 1 + Math.pow(removal, 0.85) * 1.6; // 1.0-2.6
      activeConstraints.push(altitudeModifier * altitudeIntensityValue);
    }
  }
  
  // Aspect preferences constraint - penalize when aspects are deselected (restricted)
  if (options.aspectPreferences && options.aspectPreferences.length < 8) {
    const deselectedAspects = 8 - options.aspectPreferences.length; // How many aspects deselected
    const restrictionRatio = deselectedAspects / 8; // 0-1 based on how many aspects deselected
    const aspectModifier = 1.15; // Base multiplier for aspect constraint
    const aspectIntensityValue = 1 + (restrictionRatio * 2.0); // 1.0-3.0 based on how many aspects deselected
    activeConstraints.push(aspectModifier * aspectIntensityValue);
  }
  
  // Soil type constraint - penalize when soils are deselected (restricted)
  if (options.soilTypes && options.soilTypes.length < ALL_SOIL_TYPES.length) {
    const deselectedSoils = ALL_SOIL_TYPES.length - options.soilTypes.length; // How many soils deselected
    const restrictionRatio = deselectedSoils / ALL_SOIL_TYPES.length; // 0-1 based on how many soils deselected
    const soilModifier = 1.1; // Base multiplier for soil constraint
    const soilIntensityValue = 1 + (restrictionRatio * 2.0); // 1.0-3.0 based on how many soils deselected
    activeConstraints.push(soilModifier * soilIntensityValue);
  }
  
  
  // Average-then-power: Base × (Σ constraints / count)^count (less aggressive than cost)
  const constraintCount = activeConstraints.length;
  let totalMultiplier = 1;
  
  if (constraintCount > 0) {
    const constraintSum = activeConstraints.reduce((sum, constraint) => sum + constraint, 0);
    const constraintAverage = constraintSum / constraintCount;
    totalMultiplier = Math.pow(constraintAverage, constraintCount);
  }
  
  // Strong final multiplier for work (less aggressive than cost): (totalMultiplier^2) * (n - 2)
  const n = Math.max(3, Math.min(10, options.numberOfOptions || 3));
  const combinedMultiplier = Math.pow(totalMultiplier, 2) * (n - 2);
  
  // Convert to work modifiers format
  const workModifiers = [combinedMultiplier - 1];
  
  return calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers
  });
}

/**
 * Check if a region meets the grape suitability requirements
 * Returns true if ALL selected grape varieties have suitability >= minSuitability in this region
 */
function meetsGrapeSuitabilityRequirement(
  country: string, 
  region: string, 
  grapeVarieties: string[], 
  minSuitability: number
): boolean {
  if (!grapeVarieties || grapeVarieties.length === 0 || minSuitability <= 0) return true; // No requirement
  
  const countrySuitability = REGION_GRAPE_SUITABILITY[country as keyof typeof REGION_GRAPE_SUITABILITY];
  if (!countrySuitability) return false;
  
  const regionSuitability = countrySuitability[region as keyof typeof countrySuitability];
  if (!regionSuitability) return false;
  
  // Check if ALL selected grape varieties meet the minimum suitability
  return grapeVarieties.every(grape => {
    const suitability = regionSuitability[grape as keyof typeof regionSuitability];
    return suitability !== undefined && suitability >= minSuitability;
  });
}

/**
 * Check if a region meets the soil type requirements
 * Returns true if the region has at least one of the selected soil types
 */
function meetsSoilRequirement(
  country: string, 
  region: string, 
  selectedSoils: string[]
): boolean {
  if (!selectedSoils || selectedSoils.length === 0) return true; // No requirement
  
  const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
  if (!countryData) return false;
  
  const regionSoils = countryData[region as keyof typeof countryData] as readonly string[] || [];
  
  // Check if the region has at least one of the selected soil types
  return selectedSoils.some(soil => regionSoils.includes(soil));
}

/**
 * Get region prestige from REGION_PRESTIGE_RANKINGS
 */
function getRegionPrestige(region: string): number {
  // Search through all countries for the region
  for (const country of Object.keys(REGION_PRESTIGE_RANKINGS)) {
    const countryData = REGION_PRESTIGE_RANKINGS[country as keyof typeof REGION_PRESTIGE_RANKINGS];
    if (countryData[region as keyof typeof countryData] !== undefined) {
      return countryData[region as keyof typeof countryData];
    }
  }
  return 0.5; // Default if not found
}


/**
 * Calculate region distribution with prestige-based redistribution
 * Returns probabilities for each region and total sum
 */
export function calculateRegionDistribution(
  regions: string[],
  companyPrestige: number
): { probabilities: Array<{region: string, probability: number}>, totalSum: number } {
  if (regions.length === 0) {
    return { probabilities: [], totalSum: 0 };
  }
  
  const normalizedCompanyPrestige = NormalizeScrewed1000To01WithTail(companyPrestige);
  
  // Step 1: Start with equal distribution (100% / number of regions)
  const equalProbability = 1.0 / regions.length;
  
  // Step 2: Apply prestige-based redistribution
  // Low prestige regions get higher weight, high prestige regions get lower weight
  const redistributedWeights = regions.map(region => {
    const regionPrestige = getRegionPrestige(region);
    
    // Prestige modifier: low prestige = higher weight
    // Use regionPrestige (0-1) and companyPrestige (0-1) for less screwing
    // Make it MORE aggressive by using higher powers
    const baseModifier = (1 - regionPrestige) * (1 - normalizedCompanyPrestige) + 1;
    const prestigeModifier = Math.pow(baseModifier, 10); // ^10 makes it much more aggressive
    
    return {
      region,
      weight: equalProbability * prestigeModifier
    };
  });
  
  // Step 3: Normalize to sum to 1
  const totalWeight = redistributedWeights.reduce((sum, r) => sum + r.weight, 0);
  const normalizedWeights = redistributedWeights.map(r => ({
    region: r.region,
    probability: r.weight / totalWeight
  }));
  
  // Step 4: Apply max region cap AFTER normalization
  const cappedRegions = normalizedWeights.map(r => {
    const regionPrestige = getRegionPrestige(r.region);
    
    // Use inverted skewed multiplier for unified, non-linear max cap system
    // Input: (1 - regionPrestige) + normalizedCompanyPrestige
    // This gives us a value where high prestige regions get low input, low prestige regions get high input
    const capInput = Math.min(1.0, (1 - regionPrestige) + normalizedCompanyPrestige);
    
    // Double inversion: apply calculateInvertedSkewedMultiplier twice
    // This makes high prestige regions (low input) extremely low, while keeping low prestige regions (high input) high
    const firstInversion = calculateInvertedSkewedMultiplier(capInput);
    const secondInversion = calculateInvertedSkewedMultiplier(firstInversion);
    
    // Apply power scaling to make high prestige regions even more restrictive
    // This will make Bourgogne go from 41% to <1%
    const maxCap = Math.pow(secondInversion, 5) * 0.7; 
    
    return {
      region: r.region,
      probability: Math.min(r.probability, maxCap),
      maxCap
    };
  });
  
  // Step 5: Redistribute remainder among uncapped regions
  const totalCapped = cappedRegions.reduce((sum, r) => sum + r.probability, 0);
  const remainder = 1.0 - totalCapped;
  
  const uncappedRegions = cappedRegions.filter(r => r.probability < r.maxCap);
  
  if (remainder > 0 && uncappedRegions.length > 0) {
    const uncappedWeight = uncappedRegions.reduce((sum, r) => sum + (r.maxCap - r.probability), 0);
    
    const finalProbabilities = cappedRegions.map(r => {
      if (r.probability < r.maxCap) {
        const additionalWeight = (r.maxCap - r.probability) / uncappedWeight;
        const additionalProbability = remainder * additionalWeight;
        return {
          region: r.region,
          probability: Math.min(r.probability + additionalProbability, r.maxCap)
        };
      }
      return {
        region: r.region,
        probability: r.probability
      };
    });
    
    const totalSum = finalProbabilities.reduce((sum, r) => sum + r.probability, 0);
    return { probabilities: finalProbabilities, totalSum };
  }
  
  // If no uncapped regions or remainder <= 0, return capped probabilities
  // This ensures max caps are enforced even when total < 100%
  const totalSum = cappedRegions.reduce((sum, r) => sum + r.probability, 0);
  return { 
    probabilities: cappedRegions.map(r => ({ region: r.region, probability: r.probability })), 
    totalSum 
  };
}

/**
 * Get accessible regions (simplified - no max probability caps)
 */
export function getAccessibleRegions(
  _companyPrestige: number, 
  grapeVarieties: string[] = [], 
  minGrapeSuitability: number = 0,
  selectedSoils: string[] = []
): string[] {
  const accessibleRegions: string[] = [];
  
  // Get all regions from all countries
  for (const country of Object.keys(COUNTRY_REGION_MAP)) {
    const regions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
    for (const region of regions as any) {
      // Filter by grape suitability requirement
      if (!meetsGrapeSuitabilityRequirement(country, region, grapeVarieties, minGrapeSuitability)) {
        continue;
      }
      
      // Filter by soil requirement
      if (!meetsSoilRequirement(country, region, selectedSoils)) {
        continue;
      }
      
      // Include regions that meet both requirements
      accessibleRegions.push(region);
    }
  }
  
  return accessibleRegions;
}


/**
 * Generate vineyard search results based on criteria
 * Uses the new RegionDistribution function for probability calculation
 */
export function generateVineyardSearchResults(
  options: LandSearchOptions, 
  companyPrestige: number
): VineyardPurchaseOption[] {
  // Get accessible regions (filtered by grape suitability and soil types)
  const accessibleRegions = getAccessibleRegions(
    companyPrestige, 
    options.grapeVarieties || [], 
    options.minGrapeSuitability || 0,
    options.soilTypes || []
  );
  
  // Filter by selected regions if any
  const targetRegions = options.regions.length > 0 
    ? accessibleRegions.filter(region => !options.regions.includes(region))
    : accessibleRegions;
  
  if (targetRegions.length === 0) {
    throw new Error('No accessible regions match your criteria');
  }
  
  // Calculate region distribution
  const distribution = calculateRegionDistribution(targetRegions, companyPrestige);
  
  // If total probability < 100%, there's a risk we won't find properties
  if (distribution.totalSum < 0.99) {
    throw new Error(`Insufficient accessible regions. Total probability: ${(distribution.totalSum * 100).toFixed(1)}%`);
  }
  
  // Generate exactly the requested number of properties using weighted selection
  const results: VineyardPurchaseOption[] = [];
  for (let i = 0; i < options.numberOfOptions; i++) {
    const selectedRegion = selectWeightedRegion(distribution.probabilities);
    const vineyard = generateMatchingVineyard(selectedRegion, options);
    results.push(vineyard);
  }
  
  return results;
}

/**
 * Select a region based on weighted probability
 */
function selectWeightedRegion(regions: Array<{region: string, probability: number}>): {region: string, probability: number} {
  const totalWeight = regions.reduce((sum, r) => sum + r.probability, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const region of regions) {
    currentWeight += region.probability;
    if (random <= currentWeight) {
      return region;
    }
  }
  
  return regions[regions.length - 1]; // Fallback
}

/**
 * Generate a vineyard matching the specified criteria
 */
function generateMatchingVineyard(
  regionInfo: {region: string, probability: number}, 
  options: LandSearchOptions
): VineyardPurchaseOption {
  // Find country for this region
  let country = '';
  for (const [countryName, regions] of Object.entries(COUNTRY_REGION_MAP)) {
    if ((regions as any).includes(regionInfo.region)) {
      country = countryName;
      break;
    }
  }
  
  if (!country) {
    throw new Error(`Country not found for region: ${regionInfo.region}`);
  }
  
  // Build vineyard option directly from constants and user filters
  
  // Hectares: sample distribution until within [min,max]
  const [minHectares, maxHectares] = options.hectareRange;
  let hectares = getRandomHectares();
  // Ensure we honour user range strictly
  while (hectares < minHectares || hectares > maxHectares) {
    hectares = getRandomHectares();
  }

  // Altitude: map normalized 0-1 window to region-specific meter range
  const countryAlts = REGION_ALTITUDE_RANGES[country as keyof typeof REGION_ALTITUDE_RANGES] as any;
  const regionAltRange = countryAlts ? (countryAlts[regionInfo.region] as [number, number]) : [0, 1000];
  const [regionAltMin, regionAltMax] = regionAltRange;
  let altitudeRating = 0.5;
  if (options.altitudeRange) {
    const [minN, maxN] = options.altitudeRange; // 0-1
    altitudeRating = Math.random() * (maxN - minN) + minN;
  } else {
    altitudeRating = 0.5;
  }
  const altitude = Math.round(regionAltMin + altitudeRating * (regionAltMax - regionAltMin));
  
  // Select aspect from preferences or pick randomly
  let aspect: Aspect;
  if (options.aspectPreferences && options.aspectPreferences.length > 0) {
    aspect = options.aspectPreferences[Math.floor(Math.random() * options.aspectPreferences.length)];
  } else {
    const aspectsPool: Aspect[] = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'];
    aspect = aspectsPool[Math.floor(Math.random() * aspectsPool.length)];
  }
  
  // Select soil types from intersection of region availability and user filter
  // Use same logic as getRandomSoils for consistency
  let soil: string[] = [];
  {
    const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
    const availableSoils = countryData ? (countryData as any)[regionInfo.region] || [] : [];
    const allowed = (options.soilTypes && options.soilTypes.length > 0)
      ? options.soilTypes.filter(s => availableSoils.includes(s))
      : availableSoils;
    
    if (allowed.length > 0) {
      const numberOfSoils = Math.floor(Math.random() * 3) + 1; // 1-3 soil types (same as getRandomSoils)
      const selectedSoils = new Set<string>();
      
      while (selectedSoils.size < numberOfSoils && selectedSoils.size < allowed.length) {
        selectedSoils.add(allowed[Math.floor(Math.random() * allowed.length)]);
      }
      
      soil = Array.from(selectedSoils);
    }
  }
  
  // Compute values and construct option
  const landValue = calculateLandValue(country, regionInfo.region, altitude, aspect);
  const totalPrice = landValue * hectares;
  const countryAspects = REGION_ASPECT_RATINGS[country as keyof typeof REGION_ASPECT_RATINGS];
  const regionAspects = countryAspects ? (countryAspects as any)[regionInfo.region] : null;
  const aspectRating = regionAspects ? (regionAspects[aspect] ?? 0.5) : 0.5;
  
  // Use the existing generateVineyardName function
  const name = generateVineyardName(country, aspect);

  return {
    id: uuidv4(),
    name,
    region: regionInfo.region,
    country,
    hectares,
    altitude,
    aspect,
    soil,
    landValue,
    totalPrice,
    aspectRating,
    altitudeRating
  };
}


/**
 * Start a land search activity
 */
export async function startLandSearch(options: LandSearchOptions): Promise<string | null> {
  try {
    const gameState = getGameState();
    const searchCost = calculateSearchCost(options, gameState.prestige || 0);
    const totalWork = calculateSearchWork(options, gameState.prestige || 0);
    
    // Check if we have enough money
    const currentMoney = gameState.money || 0;
    if (currentMoney < searchCost) {
      await notificationService.addMessage(
        `Insufficient funds for land search. Need €${searchCost.toFixed(2)}, have €${currentMoney.toFixed(2)}`,
        'landSearchService.startLandSearch',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      return null;
    }
    
    // Deduct search cost immediately
    await addTransaction(
      -searchCost,
      `Land search for ${options.numberOfOptions} propert${options.numberOfOptions > 1 ? 'ies' : 'y'} (${options.regions.length > 0 ? options.regions.join(', ') : 'all regions'})`,
      TRANSACTION_CATEGORIES.LAND_SEARCH,
      false
    );
    
    // Create the search activity
    const activityId = await createActivity({
      category: WorkCategory.LAND_SEARCH,
      title: 'Search for Land',
      totalWork,
      params: {
        searchOptions: options,
        searchCost,
        companyPrestige: gameState.prestige
      },
      isCancellable: true
    });
    
    if (activityId) {
      await notificationService.addMessage(
        `Land search started! Cost: €${searchCost.toFixed(2)}`,
        'landSearchService.startLandSearch',
        'Land Search Started',
        NotificationCategory.ACTIVITIES_TASKS
      );
    }
    
    return activityId;
  } catch (error) {
    console.error('Error starting land search:', error);
    return null;
  }
}

/**
 * Complete land search activity
 */
export async function completeLandSearch(activity: Activity): Promise<void> {
  try {
    const searchOptions = activity.params.searchOptions as LandSearchOptions;
    const companyPrestige = activity.params.companyPrestige as number;
    
    if (!searchOptions) {
      console.error('No search options found in activity params');
      return;
    }
    
    // Generate results based on search parameters
    const results = generateVineyardSearchResults(searchOptions, companyPrestige);
    
    // Store results in game state for modal to access
    updateGameState({
      pendingLandSearchResults: {
        activityId: activity.id,
        options: results,
        searchOptions,
        timestamp: Date.now()
      }
    });
    
    await notificationService.addMessage(
      `Land search complete! Found ${results.length} propert${results.length > 1 ? 'ies' : 'y'} matching your criteria.`,
      'landSearchService.completeLandSearch',
      'Land Search Complete',
      NotificationCategory.ACTIVITIES_TASKS
    );
  } catch (error) {
    console.error('Error completing land search:', error);
    await notificationService.addMessage(
      `Land search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'landSearchService.completeLandSearch',
      'Land Search Failed',
      NotificationCategory.ACTIVITIES_TASKS
    );
  }
}

/**
 * Clear pending land search results
 */
export function clearPendingLandSearchResults(): void {
  updateGameState({
    pendingLandSearchResults: undefined
  });
}
