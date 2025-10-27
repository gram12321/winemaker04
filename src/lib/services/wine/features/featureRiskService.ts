import { WineBatch, Vineyard } from '../../../types/types';
import { previewFeatureRisks } from './featureService';
import { FeatureRiskInfo } from '../../../types/wineFeatures';
import { getFeatureConfig, getAllFeatureConfigs } from '../../../constants/wineFeatures/commonFeaturesUtil';
import { isActionAvailable } from '../winery/wineryService';
import { getColorClass, getColorCategory } from '../../../utils/utils';

export interface FeatureRiskContext {
  type: 'vineyard' | 'winery';
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
  batch?: WineBatch;
  vineyard?: Vineyard;
  nextAction?: 'crush' | 'ferment' | 'bottle';
}

export interface FeatureRiskDisplayData {
  features: Array<FeatureRiskInfo & { 
    config: any; 
    contextInfo?: string; 
    riskCombinations?: Array<{ options: any; risk: number; label: string }> | null;
    riskRanges?: Array<{ groupLabel: string; minRisk: number; maxRisk: number; combinations: Array<{ options: any; risk: number; label: string }> }> | null;
    weeklyRiskIncrease?: number;  // For accumulation features: weekly risk increase
  }>;
  showForNextAction: boolean;
  nextAction?: string;
}

/**
 * Get feature risks and influences for display
 * Works for both vineyard (harvest) and winery (crushing/fermentation/bottling) contexts
 */
export function getFeatureRisksForDisplay(context: FeatureRiskContext): FeatureRiskDisplayData {
  const { type, event, batch, vineyard, nextAction } = context;
  
  // Determine if we should show risks for the next action only
  const showForNextAction = type === 'winery' && nextAction !== undefined;
  
  // Get the appropriate event to check risks for
  const targetEvent = showForNextAction && nextAction 
    ? (nextAction === 'crush' ? 'crushing' : 
       nextAction === 'ferment' ? 'fermentation' : 
       nextAction === 'bottle' ? 'bottling' : event)
    : event;
  
  // Get risks and influences using the existing service
  // For winery context, pass batch as context; for vineyard, pass vineyard
  const contextForEvent = type === 'winery' ? batch : vineyard;
  
  // For winery events, provide proper context with options
  // We need to pass the actual options for each feature, not empty object
  const eventContext = type === 'winery' ? batch : contextForEvent;
  
  // Get all triggered features
  const triggeredFeatures = previewFeatureRisks(batch, targetEvent, eventContext);
  
  // Get all feature configs to check for evolving and accumulation features
  const allConfigs = getAllFeatureConfigs();
  
  // Filter configs for evolving features with spawnActive: true (like Terroir)
  const evolvingFeatures = allConfigs
    .filter((config: any) => {
      if (config.behavior !== 'evolving') return false;
      const behaviorConfig = config.behaviorConfig as any;
      return behaviorConfig.spawnActive === true;
    })
    .map((config: any) => {
      // Get actual feature state from batch if available
      const existingFeature = batch?.features?.find((f: any) => f.id === config.id);
      
      // Create a feature info for evolving features
      return {
        featureId: config.id,
        featureName: config.name,
        icon: config.icon,
        currentRisk: 0,
        newRisk: 0,
        riskIncrease: 0,
        isPresent: existingFeature?.isPresent || false,
        severity: existingFeature?.severity || 0,
        qualityImpact: config.effects.quality ? 
          (typeof config.effects.quality.amount === 'number' ? config.effects.quality.amount : 0) : 
          undefined,
        description: config.description,
        config
      };
    });
  
  // Filter configs for accumulation features with spawnActive: true
  // Include both: 1) Features spawning at this event, AND 2) Features already spawned and accumulating
  const accumulationFeatures = allConfigs
    .filter((config: any) => {
      if (config.behavior !== 'accumulation') return false;
      const behaviorConfig = config.behaviorConfig as any;
      
      // Check if this feature spawns at the current event
      const spawnsAtCurrentEvent = behaviorConfig.spawnActive === true && behaviorConfig.spawnEvent === targetEvent;
      
      // Check if this feature already exists in the batch (was spawned earlier)
      const existingFeature = batch?.features?.find((f: any) => f.id === config.id);
      const alreadySpawned = existingFeature !== undefined;
      
      // Include if spawning now OR already spawned
      return spawnsAtCurrentEvent || alreadySpawned;
    })
    .map((config: any) => {
      // Get actual risk from batch if available
      const existingFeature = batch?.features?.find((f: any) => f.id === config.id);
      const currentRisk = existingFeature?.risk || 0;
      
      // Create a feature info for accumulation features
      return {
        featureId: config.id,
        featureName: config.name,
        icon: config.icon,
        currentRisk,
        newRisk: currentRisk, // For accumulation, current and new are the same (no event risk increase)
        riskIncrease: 0,
        isPresent: existingFeature?.isPresent || false,
        severity: existingFeature?.severity || 0,
        qualityImpact: config.effects.quality ? 
          (typeof config.effects.quality.amount === 'number' ? config.effects.quality.amount : 0) : 
          undefined,
        description: config.description,
        config
      };
    });
  
  // Combine all features
  const allFeatures = [...triggeredFeatures, ...evolvingFeatures, ...accumulationFeatures];
  
  // Add config to each feature
  const featuresWithConfig = allFeatures.map((feature: any) => {
    const config = feature.config || getFeatureConfig(feature.featureId);
    return { ...feature, config };
  });
  
  // Filter out already manifested features - they shouldn't show in the Risk column
  const featuresNotManifested = featuresWithConfig.filter(feature => !feature.isPresent);
  
  // Filter to only show features for the next action if specified
  const filteredFeatures = showForNextAction 
    ? featuresNotManifested.filter(feature => {
        if (feature.config?.behavior === 'triggered') {
          const behaviorConfig = feature.config.behaviorConfig as any;
          return behaviorConfig.eventTriggers?.some((trigger: any) => trigger.event === targetEvent);
        }
        // Always show evolving and accumulation features if they match the spawn event
        if (feature.config?.behavior === 'evolving' || feature.config?.behavior === 'accumulation') {
          return true;
        }
        return false;
      })
    : featuresNotManifested;
  
  // Add context-specific information and all combinations
  // For fermentation, show all combinations (discrete options)
  // For crushing/harvest, show ranges (continuous inputs)
  const shouldUseRanges = targetEvent === 'crushing' || targetEvent === 'harvest';
  
  const featuresWithContext = filteredFeatures.map(feature => {
    const combinations = getFeatureRiskCombinations(feature, context, targetEvent);
    
    // Check if feature should show ranges or single value in main display
    const config = feature.config || getFeatureConfig(feature.featureId);
    const showAsRange = config?.riskDisplay?.showAsRange ?? true;  // Default to showing ranges
    const useRangesForDisplay = shouldUseRanges && showAsRange;
    
    // Calculate weekly risk increase for accumulation features
    const weeklyRiskIncrease = calculateWeeklyRiskIncrease(batch, feature);
    
    return {
      ...feature,
      contextInfo: getContextInfo(feature, context),
      riskCombinations: useRangesForDisplay ? null : combinations,
      riskRanges: useRangesForDisplay ? calculateRiskRangesForCombinations(feature, context, targetEvent) : null,
      weeklyRiskIncrease
    };
  });
  
  return {
    features: featuresWithContext,
    showForNextAction,
    nextAction: showForNextAction ? nextAction : undefined
  };
}


/**
 * Get context-specific information for a risk/influence
 */
function getContextInfo(risk: FeatureRiskInfo, context: FeatureRiskContext): string {
  const { type, vineyard, batch } = context;
  
  // Vineyard-specific context (harvest)
  if (type === 'vineyard' && vineyard) {
    const ripeness = vineyard.ripeness || 0;
    
    // Green flavor shows ripeness context
    if (risk.featureId === 'green_flavor') {
      return ripeness < 0.5 
        ? `(Ripeness ${Math.round(ripeness * 100)}% - Underripe)`
        : `(Ripeness ${Math.round(ripeness * 100)}% - Good level)`;
    }
    
    // Terroir shows vineyard location
    if (risk.featureId === 'terroir_expression') {
      return `(Vineyard: ${vineyard.region}, ${vineyard.country})`;
    }
    
    // Other features don't need context info for vineyard context
    return '';
  }
  
  // Winery-specific context
  if (type === 'winery' && batch) {
    switch (risk.featureId) {
      case 'oxidation':
        const fragile = batch.fragile || 0;
        const proneToOxidation = batch.proneToOxidation || 0;
        const currentRisk = risk.currentRisk || 0;
        return `(Current: ${(currentRisk * 100).toFixed(1)}%, Fragile: ${Math.round(fragile * 100)}%, Prone: ${Math.round(proneToOxidation * 100)}%)`;
      
      case 'volatile_acidity':
        const proneToOxidationVA = batch.proneToOxidation || 0;
        return `(Oxidation prone: ${Math.round(proneToOxidationVA * 100)}%)`;
      
      default:
        return '';
    }
  }
  
  return '';
}

/**
 * Get the next available action for a wine batch
 */
export function getNextWineryAction(batch: WineBatch): 'crush' | 'ferment' | 'bottle' | null {
  if (isActionAvailable(batch, 'crush')) return 'crush';
  if (isActionAvailable(batch, 'ferment')) return 'ferment';
  if (isActionAvailable(batch, 'bottle')) return 'bottle';
  return null;
}

/**
 * Format risk severity for display
 * Uses inverted quality category (risk = probability, higher = worse)
 */
export function getRiskSeverityLabel(risk: number): string {
  // Invert risk to use quality categories (higher risk = lower quality)
  const inverted = 1 - risk;
  return getColorCategory(inverted);
}

/**
 * Get color class for risk level
 * Uses inverted color logic (higher risk = worse color)
 */
export function getRiskColorClass(risk: number): string {
  // Invert risk to get color (higher risk = worse, so invert)
  return getColorClass(1 - risk);
}

/**
 * Calculate all possible risk combinations for a feature
 * Shows risks for all available options (methods, temperatures, etc.)
 * Groups by option combinations and shows ranges for range inputs
 */

/**
 * Generate a human-readable label for a group of combinations
 */
function generateGroupLabel(combinations: Array<{ options: any; risk: number; label: string }>, event: string): string {
  const firstCombo = combinations[0];
  
  // For season-based grouping (late harvest)
  if (firstCombo.options.season && firstCombo.options.week !== undefined) {
    const season = firstCombo.options.season;
    const weeks = combinations.map(c => c.options.week).sort((a, b) => a - b);
    const minWeek = weeks[0];
    const maxWeek = weeks[weeks.length - 1];
    return `${season} Harvest (Weeks ${minWeek}-${maxWeek})`;
  }
  
  // For ripeness-based grouping
  if (firstCombo.options.ripeness !== undefined) {
    return 'Risk (varies with ripeness)';
  }
  
  // For crushing - use method and options
  if (event === 'crushing' && firstCombo.options.method) {
    const destemmingText = firstCombo.options.destemming ? 'Destemmed' : 'Stems';
    const coldSoakText = firstCombo.options.coldSoak ? 'Cold Soak' : 'No Cold Soak';
    return `${firstCombo.options.method} (${destemmingText}, ${coldSoakText}, 0-100% pressure)`;
  }
  
  // For fermentation
  if (event === 'fermentation' && firstCombo.options.method && firstCombo.options.temperature) {
    return `${firstCombo.options.method} + ${firstCombo.options.temperature}`;
  }
  
  // Default: use first label
  return firstCombo.label || 'Risk';
}

/**
 * Calculate weekly risk increase for accumulation features
 */
function calculateWeeklyRiskIncrease(batch: WineBatch | undefined, feature: FeatureRiskInfo): number | undefined {
  if (!batch) {
    return undefined;
  }
  
  const config = getFeatureConfig(feature.featureId);
  if (!config || config.behavior !== 'accumulation') {
    return undefined;
  }
  
  const behaviorConfig = config.behaviorConfig as any;
  const baseRate = behaviorConfig.baseRate || 0;
  
  // Get state multiplier
  let stateMultiplier = 1.0;
  const multiplierValue = behaviorConfig.stateMultipliers?.[batch.state];
  if (typeof multiplierValue === 'function') {
    stateMultiplier = multiplierValue(batch);
  } else if (typeof multiplierValue === 'number') {
    stateMultiplier = multiplierValue;
  }
  
  // Compound multiplier (if enabled)
  const compoundMultiplier = behaviorConfig.compound 
    ? (1 + (feature.currentRisk || 0))
    : 1.0;
  
  // Feature-specific multipliers (like oxidation multiplier)
  let featureMultiplier = 1.0;
  if (config.id === 'oxidation') {
    featureMultiplier = batch.proneToOxidation || 1.0;
  }
  
  return baseRate * stateMultiplier * compoundMultiplier * featureMultiplier;
}

/**
 * Calculate risk ranges for each option combination group
 * Groups combinations by non-range options and shows min/max for range options
 */
function calculateRiskRangesForCombinations(
  risk: FeatureRiskInfo, 
  context: FeatureRiskContext, 
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'
): Array<{ groupLabel: string; minRisk: number; maxRisk: number; combinations: Array<{ options: any; risk: number; label: string }> }> | null {
  const combinations = getFeatureRiskCombinations(risk, context, event);
  if (!combinations || combinations.length === 0) {
    return null;
  }

  // Group combinations using inferred grouping logic
  const groups = new Map<string, Array<{ options: any; risk: number; label: string }>>();
  
  for (const combination of combinations) {
    let groupKey: string;
    
    // Infer grouping from option structure
    switch (event) {
      case 'harvest':
        // If options have season property, group by season (e.g., late harvest)
        if (combination.options.season) {
          groupKey = `${risk.featureId}-${combination.options.season}`;
        } else {
          // Default: group by ripeness (e.g., green flavor)
          groupKey = `${risk.featureId}-ripeness-range`;
        }
        break;
      case 'crushing':
        // Group by method + destemming + coldSoak (not separating by pressure)
        const destemmingKey = combination.options.destemming ? 'destemmed' : 'stems';
        const coldSoakKey = combination.options.coldSoak ? 'coldsoak' : 'nocoldsoak';
        groupKey = `${combination.options.method}-${destemmingKey}-${coldSoakKey}`;
        break;
      case 'fermentation':
        // Group by method-temperature combination
        groupKey = `${combination.options.method}-${combination.options.temperature}`;
        break;
      case 'bottling':
        groupKey = combination.options.method;
        break;
      default:
        groupKey = 'default';
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(combination);
  }

  // Convert groups to range format
  const ranges: Array<{ groupLabel: string; minRisk: number; maxRisk: number; combinations: Array<{ options: any; risk: number; label: string }> }> = [];

  for (const [, groupCombinations] of groups) {
    const risks = groupCombinations.map(c => c.risk);
    const minRisk = Math.min(...risks);
    const maxRisk = Math.max(...risks);
    
    // Generate group label from combinations
    const groupLabel = generateGroupLabel(groupCombinations, event);

    ranges.push({
      groupLabel,
      minRisk,
      maxRisk,
      combinations: groupCombinations
    });
  }

  // Sort by max risk (highest first)
  ranges.sort((a, b) => b.maxRisk - a.maxRisk);

  return ranges;
}


/**
 * Get feature risk combinations with calculated risk values
 * Generates option combinations and calculates actual risk values for each
 */
function getFeatureRiskCombinations(
  risk: FeatureRiskInfo, 
  context: FeatureRiskContext, 
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'
): Array<{ options: any; risk: number; label: string }> | null {
  // Only calculate for features with option-dependent risks
  if (!context.batch && !context.vineyard) {
    return null;
  }

  // Check if this feature depends on options
  const config = (risk as any).config;
  if (!config?.behaviorConfig) {
    return null;
  }

  const behaviorConfig = config.behaviorConfig as any;
  const triggers = behaviorConfig.eventTriggers || [];
  const trigger = triggers.find((t: any) => t.event === event);
  if (!trigger || typeof trigger.riskIncrease !== 'function') {
    return null;
  }

  const batch = context.batch;
  const vineyard = context.vineyard;
  const combinations: Array<{ options: any; risk: number; label: string }> = [];

  // Get feature-specific option combinations for this event
  const allOptionCombinations = getFeatureSpecificOptions(risk.featureId, event);
  
  for (const optionSet of allOptionCombinations) {
    try {
      // For harvest events, check if feature needs special context
      let contextForRisk: any;
      if (event === 'harvest') {
        // Check if feature uses season/week context (like late harvest)
        if (optionSet.season && optionSet.week !== undefined) {
          contextForRisk = { 
            vineyard: vineyard || batch, 
            season: optionSet.season, 
            week: optionSet.week 
          };
        } else {
          // Default: use vineyard as options
          contextForRisk = { options: vineyard || batch, batch: batch || vineyard };
        }
      } else {
        // Non-harvest events use optionSet as options
        contextForRisk = { options: optionSet, batch: batch || vineyard };
      }
      
      const riskValue = trigger.riskIncrease(contextForRisk);
      const label = generateOptionLabel(optionSet, event);
      
      combinations.push({
        options: optionSet,
        risk: riskValue,
        label
      });
    } catch (error) {
      console.warn(`Error calculating risk for ${risk.featureId} with options:`, optionSet, error);
    }
  }

  return combinations.length > 0 ? combinations : null;
}

/**
 * Get feature-specific option combinations from config
 * Generates all possible option combinations for calculating risk ranges
 */
function getFeatureSpecificOptions(featureId: string, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'): any[] {
  const config = getFeatureConfig(featureId);
  
  // Check if feature has custom option combinations function
  if (config?.riskDisplay?.customOptionCombinations) {
    return config.riskDisplay.customOptionCombinations(event);
  }
  
  const combinations: any[] = [];
  
  switch (event) {
    case 'fermentation':
      // Generate all combinations of method × temperature
      const methods = ['Basic', 'Temperature Controlled', 'Extended Maceration'];
      const temperatures = ['Ambient', 'Cool', 'Warm'];
      
      for (const method of methods) {
        for (const temperature of temperatures) {
          combinations.push({ method, temperature });
        }
      }
      break;
      
    case 'crushing':
      // Generate combinations for crushing
      const crushingMethods = ['Hand Press', 'Mechanical Press', 'Pneumatic Press'];
      const destemmingOptions = [true, false];
      const coldSoakOptions = [true, false];
      
      for (const method of crushingMethods) {
        for (const destemming of destemmingOptions) {
          for (const coldSoak of coldSoakOptions) {
            // Add min and max pressure for each discrete combination
            combinations.push({ 
              method, 
              destemming, 
              coldSoak, 
              pressingIntensity: 0,
              _isMin: true 
            });
            combinations.push({ 
              method, 
              destemming, 
              coldSoak, 
              pressingIntensity: 1,
              _isMax: true 
            });
          }
        }
      }
      break;
      
      case 'harvest':
        // Generate ripeness steps (but we'll handle this differently for ranges)
        // For features like green_flavor, show min/max risk based on low/high ripeness
        if (featureId === 'green_flavor') {
          combinations.push({ ripeness: 0, _isMin: true });   // Minimum ripeness = max risk
          combinations.push({ ripeness: 1, _isMax: true });   // Maximum ripeness = min risk
        }
        // Other features use customOptionCombinations from config
        break;
      
    case 'bottling':
      // TODO: Add bottling combinations when needed
      break;
  }
  
  return combinations;
}


/**
 * Generate a human-readable label for option combinations
 * Uses custom labels from config if available, otherwise generates default labels
 */
function generateOptionLabel(options: any, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'): string {
  // Auto-generated labels
  switch (event) {
    case 'harvest':
      // Use custom label if provided (for late harvest)
      if (options._label) {
        return options._label;
      }
      if (options.ripeness !== undefined) {
        return `Ripeness ${Math.round(options.ripeness * 100)}%`;
      }
      return 'Default Harvest';
    case 'fermentation':
      return `${options.method} + ${options.temperature}`;
    case 'crushing':
      if (options._isMin || options._isMax) {
        const pressureText = options._isMin ? '0% pressure' : '100% pressure';
        return `Pressure: ${pressureText}`;
      }
      const destemmingText = options.destemming ? 'Destemmed' : 'Stems';
      const coldSoakText = options.coldSoak ? 'Cold Soak' : 'No Cold Soak';
      const pressureText = `${Math.round(options.pressingIntensity * 100)}% pressure`;
      return `${options.method} (${destemmingText}, ${coldSoakText}, ${pressureText})`;
    case 'bottling':
      return `${options.method} + ${options.corkType}`;
    default:
      return 'Default';
  }
}

