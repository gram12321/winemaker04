import { WorkCategory } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { LandSearchOptions } from '@/lib/services';
import { COUNTRY_REGION_MAP, REGION_SOIL_TYPES, REGION_GRAPE_SUITABILITY, ALL_SOIL_TYPES } from '@/lib/constants/vineyardConstants';
import { probabilityMassInRange } from '@/lib/utils/calculator';

/**
 * Calculate work required for land search activity
 */
export function calculateLandSearchWork(options: LandSearchOptions, _companyPrestige: number): {
  totalWork: number;
  factors: WorkFactor[];
} {
  const rate = TASK_RATES[WorkCategory.LAND_SEARCH];
  const initialWork = INITIAL_WORK[WorkCategory.LAND_SEARCH];
  
  // Track which constraints are active and their intensities (similar to cost calculation)
  const activeConstraints: number[] = [];
  
  // Declare variables for factor display
  let regionModifier = 1;
  let regionIntensity = 1;
  let altitudeModifier = 1;
  let altitudeIntensityValue = 1;
  let aspectModifier = 1;
  let aspectIntensityValue = 1;
  let soilModifier = 1;
  let soilIntensityValue = 1;
  
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
    regionModifier = 1.5; // Base multiplier for region constraint (lower than cost)
    regionIntensity = 1 + (exclusionRatio * 1.5); // 1.0-2.5 based on exclusion ratio
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
      altitudeModifier = 1.2;
      altitudeIntensityValue = 1 + Math.pow(removal, 0.85) * 1.6; // 1.0-2.6
      activeConstraints.push(altitudeModifier * altitudeIntensityValue);
    }
  }
  
  // Aspect preferences constraint - penalize when aspects are deselected (restricted)
  if (options.aspectPreferences && options.aspectPreferences.length < 8) {
    const deselectedAspects = 8 - options.aspectPreferences.length; // How many aspects deselected
    const restrictionRatio = deselectedAspects / 8; // 0-1 based on how many aspects deselected
    aspectModifier = 1.15; // Base multiplier for aspect constraint
    aspectIntensityValue = 1 + (restrictionRatio * 2.0); // 1.0-3.0 based on how many aspects deselected
    activeConstraints.push(aspectModifier * aspectIntensityValue);
  }
  
  // Soil type constraint - penalize when soils are deselected (restricted)
  if (options.soilTypes && options.soilTypes.length < ALL_SOIL_TYPES.length) {
    const deselectedSoils = ALL_SOIL_TYPES.length - options.soilTypes.length; // How many soils deselected
    const restrictionRatio = deselectedSoils / ALL_SOIL_TYPES.length; // 0-1 based on how many soils deselected
    soilModifier = 1.1; // Base multiplier for soil constraint
    soilIntensityValue = 1 + (restrictionRatio * 2.0); // 1.0-3.0 based on how many soils deselected
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
  
  const totalWork = calculateTotalWork(1, {
    rate,
    initialWork,
    workModifiers
  });

  // Build work factors for UI display
  const factors: WorkFactor[] = [
    { label: 'Search Options', value: options.numberOfOptions, unit: 'properties', isPrimary: true },
    { label: 'Processing Rate', value: rate, unit: 'searches/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];

  // Add constraint factors
  if (excludedRegions.size > 0) {
    factors.push({
      label: 'Region Restrictions',
      value: `${excludedRegions.size} regions excluded`,
      modifier: regionModifier * regionIntensity - 1,
      modifierLabel: 'region filtering complexity'
    });
  }

  if (options.altitudeRange) {
    const width = Math.max(0, Math.min(1, (options.altitudeRange[1] - options.altitudeRange[0])));
    if (width < 1) {
      factors.push({
        label: 'Altitude Range',
        value: `${options.altitudeRange[0]}-${options.altitudeRange[1]}m`,
        modifier: altitudeModifier * altitudeIntensityValue - 1,
        modifierLabel: 'altitude filtering complexity'
      });
    }
  }

  if (options.aspectPreferences && options.aspectPreferences.length < 8) {
    factors.push({
      label: 'Aspect Preferences',
      value: `${options.aspectPreferences.length}/8 aspects`,
      modifier: aspectModifier * aspectIntensityValue - 1,
      modifierLabel: 'aspect filtering complexity'
    });
  }

  if (options.soilTypes && options.soilTypes.length < ALL_SOIL_TYPES.length) {
    factors.push({
      label: 'Soil Type Filter',
      value: `${options.soilTypes.length}/${ALL_SOIL_TYPES.length} soil types`,
      modifier: soilModifier * soilIntensityValue - 1,
      modifierLabel: 'soil filtering complexity'
    });
  }

  return { totalWork, factors };
}

/**
 * Check if a region meets the grape suitability requirements
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
