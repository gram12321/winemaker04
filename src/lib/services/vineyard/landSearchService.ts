// Land Search Service
// Business logic for searching and purchasing land through the activity system

import { Activity, WorkCategory, Aspect } from '@/lib/types/types';
import { getGameState, updateGameState } from '../core/gameState';
import { createActivity } from '../activity/activitymanagers/activityManager';
import { notificationService } from '@/components/layout/NotificationCenter';
import { NotificationCategory } from '@/lib/types/types';
import { addTransaction } from '../user/financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { calculateTotalWork } from '../activity/workcalculators/workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { 
  REGION_PRESTIGE_RANKINGS, 
  COUNTRY_REGION_MAP, 
  REGION_SOIL_TYPES, 
  REGION_ASPECT_RATINGS
} from '@/lib/constants/vineyardConstants';
import { 
  generateVineyardPurchaseOptions, 
  VineyardPurchaseOption
} from './vinyardBuyingService';
import { squashNormalizeTail } from '@/lib/utils/calculator';

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
 * Uses exponential scaling for search constraints
 */
export function calculateSearchCost(options: LandSearchOptions, _companyPrestige: number): number {
  const baseCost = 5000;
  
  // Count number of search constraints (exponential scaling)
  let constraintCount = 0;
  
  // Region filtering constraint (small penalty)
  if (options.regions.length > 0) {
    constraintCount += 0.5; // Small penalty for region filtering
  }
  
  // Hectare range constraint
  const hectareRange = options.hectareRange[1] - options.hectareRange[0];
  if (hectareRange < 15) { // Less than full range (1-20)
    constraintCount += 1;
  }
  
  // Altitude range constraint
  if (options.altitudeRange && (options.altitudeRange[1] - options.altitudeRange[0]) < 1000) {
    constraintCount += 1;
  }
  
  // Aspect preferences constraint
  if (options.aspectPreferences && options.aspectPreferences.length > 0) {
    constraintCount += 1;
  }
  
  // Soil type constraint
  if (options.soilTypes && options.soilTypes.length > 0) {
    constraintCount += 1;
  }
  
  // Grape suitability constraint
  if (options.minGrapeSuitability && options.minGrapeSuitability > 0.3) {
    constraintCount += 1;
  }
  
  // Number of options multiplier (linear scaling)
  const optionsMultiplier = 1 + ((options.numberOfOptions - 1) * 0.3);
  
  // Exponential cost scaling: baseCost * (1.5 ^ constraintCount)
  const exponentialMultiplier = Math.pow(1.5, constraintCount);
  
  return Math.round(baseCost * exponentialMultiplier * optionsMultiplier);
}

/**
 * Calculate work required for land search activity
 * Uses similar exponential scaling as cost calculation
 */
export function calculateSearchWork(options: LandSearchOptions, _companyPrestige: number): number {
  const rate = TASK_RATES[WorkCategory.ADMINISTRATION];
  const initialWork = INITIAL_WORK[WorkCategory.ADMINISTRATION];
  
  // Count number of search constraints (exponential scaling for work too)
  let constraintCount = 0;
  
  // Region filtering constraint (small penalty)
  if (options.regions.length > 0) {
    constraintCount += 0.3; // Small penalty for region filtering
  }
  
  // Hectare range constraint
  const hectareRange = options.hectareRange[1] - options.hectareRange[0];
  if (hectareRange < 15) { // Less than full range (1-20)
    constraintCount += 0.5;
  }
  
  // Altitude range constraint
  if (options.altitudeRange && (options.altitudeRange[1] - options.altitudeRange[0]) < 1000) {
    constraintCount += 0.5;
  }
  
  // Aspect preferences constraint
  if (options.aspectPreferences && options.aspectPreferences.length > 0) {
    constraintCount += 0.5;
  }
  
  // Soil type constraint
  if (options.soilTypes && options.soilTypes.length > 0) {
    constraintCount += 0.5;
  }
  
  // Grape suitability constraint
  if (options.minGrapeSuitability && options.minGrapeSuitability > 0.3) {
    constraintCount += 0.5;
  }
  
  // Number of options modifier (linear scaling)
  const optionsModifier = (options.numberOfOptions - 1) * 0.1; // 0.1 per additional option
  
  // Exponential work scaling: 1.3 ^ constraintCount
  const exponentialModifier = Math.pow(1.3, constraintCount);
  
  // Convert to work modifiers format
  const workModifiers = [exponentialModifier - 1, optionsModifier]; // -1 to get the additional work
  
  return calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers
  });
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
 * Normalize company prestige for comparison (0-1 scale)
 * Designed for realistic prestige distribution:
 * - Most companies: 0.1-10 prestige (maps to ~0.1-0.7)
 * - Some companies: 10-100 prestige (maps to ~0.7-0.9) 
 * - Few companies: 100-1000 prestige (maps to ~0.9-0.98)
 * - Exceptional: >1000 prestige (uses tail squash to prevent hard 1.0)
 */
function normalizeCompanyPrestige(prestige: number): number {
  const safePrestige = Math.max(0, prestige || 0);
  
  let normalized: number;
  
  if (safePrestige <= 10) {
    // Most companies: 0.1-10 prestige → 0.1-0.7 (linear with slight curve)
    const ratio = safePrestige / 10;
    normalized = 0.1 + (0.6 * Math.pow(ratio, 0.8)); // Slight curve upward
  } else if (safePrestige <= 100) {
    // Some companies: 10-100 prestige → 0.7-0.9 (logarithmic)
    const ratio = (safePrestige - 10) / 90;
    normalized = 0.7 + (0.2 * Math.log(1 + 3 * ratio) / Math.log(4)); // Logarithmic growth
  } else if (safePrestige <= 1000) {
    // Few companies: 100-1000 prestige → 0.9-0.98 (very slow growth)
    const ratio = (safePrestige - 100) / 900;
    normalized = 0.9 + (0.08 * Math.pow(ratio, 0.5)); // Square root growth
  } else {
    // Exceptional cases: >1000 prestige → 0.98+ (use tail squash)
    const excess = safePrestige - 1000;
    const excessRatio = Math.min(excess / 1000, 1); // Cap at 2000 for calculation
    normalized = 0.98 + (0.02 * excessRatio);
  }
  
  // Use squashNormalizeTail only for very high prestige (>1000) to prevent hard 1.0
  if (safePrestige > 1000) {
    const result = squashNormalizeTail(normalized, 0.98, 0.999, 5);
    return result;
  }
  
  return Math.min(0.999, Math.max(0.001, normalized));
}

/**
 * Calculate max probability for a region based on company prestige vs region prestige
 * This serves as the maximum probability cap for any region
 */
export function calculateMaxRegionProbability(regionPrestige: number, companyPrestige: number): number {
  const normalizedCompanyPrestige = normalizeCompanyPrestige(companyPrestige);
  
  // Much more restrictive scaling - prestige difference has exponential impact
  // For low prestige companies, high prestige regions should be nearly impossible
  const prestigeRatio = normalizedCompanyPrestige / regionPrestige;
  
  // Use exponential decay: maxProbability = (prestigeRatio)^3 * 0.1
  // This ensures low prestige companies have very low chances for high prestige regions
  const maxProbability = Math.pow(Math.max(0, prestigeRatio), 3) * 0.1;
  
  // Cap at reasonable maximum (40% for very high prestige companies)
  return Math.min(maxProbability, 0.4);
}

/**
 * Calculate region probability based on company prestige vs region prestige
 * Uses diminishing power function - DEPRECATED: Use calculateMaxRegionProbability instead
 */
export function calculateRegionProbability(regionPrestige: number, companyPrestige: number): number {
  return calculateMaxRegionProbability(regionPrestige, companyPrestige);
}

/**
 * Get accessible regions with max probability caps
 */
export function getAccessibleRegionsWithMaxCaps(companyPrestige: number): Array<{region: string, maxProbability: number}> {
  const accessibleRegions: Array<{region: string, maxProbability: number}> = [];
  
  // Get all regions from all countries
  for (const country of Object.keys(COUNTRY_REGION_MAP)) {
      const regions = COUNTRY_REGION_MAP[country as keyof typeof COUNTRY_REGION_MAP];
      for (const region of regions as any) {
      const regionPrestige = getRegionPrestige(region);
      const maxProbability = calculateMaxRegionProbability(regionPrestige, companyPrestige);
      
      // Include all regions regardless of probability
      accessibleRegions.push({ region, maxProbability });
    }
  }
  
  // Sort by max probability (highest first)
  return accessibleRegions.sort((a, b) => b.maxProbability - a.maxProbability);
}

/**
 * Calculate redistributed probabilities when regions are filtered
 * @param allRegions All available regions with max probabilities
 * @param selectedRegions Array of selected region names (empty = all regions)
 * @returns Array of regions with redistributed probabilities that sum to 100%
 */
export function calculateRedistributedProbabilities(
  allRegions: Array<{region: string, maxProbability: number}>,
  selectedRegions: string[] = []
): Array<{region: string, probability: number}> {
  // If no regions selected, use all regions
  const targetRegions = selectedRegions.length > 0 
    ? allRegions.filter(r => selectedRegions.includes(r.region))
    : allRegions;
  
  if (targetRegions.length === 0) {
    return [];
  }
  
  // Calculate total max probability of target regions
  const totalMaxProbability = targetRegions.reduce((sum, r) => sum + r.maxProbability, 0);
  
  // Intended behavior:
  // - If the sum of max caps is >= 100%, normalize so probabilities sum to 100%
  // - If the sum of max caps is < 100%, return max caps as-is (total < 100%)
  //   which signals the UI that the search may fail
  if (totalMaxProbability >= 1.0) {
    const scaleFactor = 1.0 / totalMaxProbability;
    return targetRegions.map(r => ({
      region: r.region,
      probability: Math.min(r.maxProbability, r.maxProbability * scaleFactor)
    }));
  }
  
  // totalMaxProbability < 1.0 → not enough accessible probability to guarantee success
  return targetRegions.map(r => ({
    region: r.region,
    probability: r.maxProbability
  }));
}

/**
 * Get accessible regions based on company prestige - DEPRECATED: Use getAccessibleRegionsWithMaxCaps instead
 */
export function getAccessibleRegions(companyPrestige: number): Array<{region: string, probability: number}> {
  const maxCapRegions = getAccessibleRegionsWithMaxCaps(companyPrestige);
  return calculateRedistributedProbabilities(maxCapRegions);
}

/**
 * Generate vineyard search results based on criteria
 * INTENDED DESIGN: Always generate exactly X properties with 100% success rate
 * Only fails when sum of maxProbabilities < 100% (insufficient accessible regions)
 */
export function generateVineyardSearchResults(
  options: LandSearchOptions, 
  companyPrestige: number
): VineyardPurchaseOption[] {
  // Get all regions with max probability caps
  const allRegionsWithMaxCaps = getAccessibleRegionsWithMaxCaps(companyPrestige);
  
  // Calculate redistributed probabilities based on selected regions
  const targetRegions = calculateRedistributedProbabilities(allRegionsWithMaxCaps, options.regions);
  
  if (targetRegions.length === 0) {
    throw new Error('No accessible regions match your criteria');
  }
  
  // Calculate total probability for individual attempts
  const totalProbability = targetRegions.reduce((sum, region) => sum + region.probability, 0);
  
  // Generate properties with individual probability attempts
  const results: VineyardPurchaseOption[] = [];
  
  for (let i = 0; i < options.numberOfOptions; i++) {
    // Each attempt has totalProbability chance of success
    if (Math.random() < totalProbability) {
      // Weighted random selection of region using redistributed probabilities
      const selectedRegion = selectWeightedRegion(targetRegions);
      
      // Generate vineyard matching all criteria
      const vineyard = generateMatchingVineyard(selectedRegion, options);
      
      results.push(vineyard);
    }
    // If random >= totalProbability, this attempt fails (no property generated)
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
  
  // Generate vineyards using existing system but with filters
  const tempOptions = generateVineyardPurchaseOptions(1, []);
  const vineyard = tempOptions[0];
  
  // Override with criteria-based generation
  const [minHectares, maxHectares] = options.hectareRange;
  const hectares = Math.random() * (maxHectares - minHectares) + minHectares;
  
  // Generate altitude within range if specified
  let altitude = vineyard.altitude;
  if (options.altitudeRange) {
    const [minAlt, maxAlt] = options.altitudeRange;
    altitude = Math.floor(Math.random() * (maxAlt - minAlt + 1)) + minAlt;
  }
  
  // Select aspect if preferences specified
  let aspect = vineyard.aspect;
  if (options.aspectPreferences && options.aspectPreferences.length > 0) {
    aspect = options.aspectPreferences[Math.floor(Math.random() * options.aspectPreferences.length)];
  }
  
  // Select soil types if specified
  let soil = vineyard.soil;
  if (options.soilTypes && options.soilTypes.length > 0) {
    const countryData = REGION_SOIL_TYPES[country as keyof typeof REGION_SOIL_TYPES];
    const availableSoils = countryData ? (countryData as any)[regionInfo.region] || [] : [];
    const matchingSoils = options.soilTypes.filter(s => availableSoils.includes(s));
    
    if (matchingSoils.length > 0) {
      const numSoils = Math.min(Math.floor(Math.random() * 3) + 1, matchingSoils.length);
      soil = matchingSoils.slice(0, numSoils);
    }
  }
  
  // Recalculate values with new parameters
  const landValue = vineyard.landValue; // Use existing calculation
  const totalPrice = landValue * hectares;
  const countryAspects = REGION_ASPECT_RATINGS[country as keyof typeof REGION_ASPECT_RATINGS];
  const regionAspects = countryAspects ? (countryAspects as any)[regionInfo.region] : null;
  const aspectRating = regionAspects ? (regionAspects[aspect] ?? 0.5) : 0.5;
  const altitudeRating = Math.max(0, Math.min(1, altitude / 1000)); // Normalize to 0-1
  
  return {
    ...vineyard,
    name: `${vineyard.name.split("'s")[0]}'s ${aspect} Vineyard`, // Update name with aspect
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
      title: `Search: ${options.numberOfOptions} propert${options.numberOfOptions > 1 ? 'ies' : 'y'} in ${options.regions.length > 0 ? options.regions.join(', ') : 'accessible regions'}`,
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
