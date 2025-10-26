// Feature Risk Service
// Unified service for handling feature risks across vineyard and winery contexts
// Replaces hardcoded harvest-specific logic with generic risk/influence system

import { WineBatch, Vineyard } from '../../../types/types';
import { previewFeatureRisks } from './featureService';
import { FeatureRiskInfo } from '../../../types/wineFeatures';
import { getFeatureConfig, getAllFeatureConfigs } from '../../../constants/wineFeatures/commonFeaturesUtil';
import { isActionAvailable } from '../winery/wineryService';

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
      // Create a feature info for evolving features
      return {
        featureId: config.id,
        featureName: config.name,
        icon: config.icon,
        currentRisk: 0,
        newRisk: 0,
        riskIncrease: 0,
        isPresent: false,
        severity: 0,
        qualityImpact: config.effects.quality ? 
          (typeof config.effects.quality.amount === 'number' ? config.effects.quality.amount : 0) : 
          undefined,
        description: config.description,
        config
      };
    });
  
  // Filter configs for accumulation features with spawnActive: true and matching spawnEvent
  const accumulationFeatures = allConfigs
    .filter((config: any) => {
      if (config.behavior !== 'accumulation') return false;
      const behaviorConfig = config.behaviorConfig as any;
      return behaviorConfig.spawnActive === true && behaviorConfig.spawnEvent === targetEvent;
    })
    .map((config: any) => {
      // Create a feature info for accumulation features
      return {
        featureId: config.id,
        featureName: config.name,
        icon: config.icon,
        currentRisk: 0,
        newRisk: 0,
        riskIncrease: 0,
        isPresent: false,
        severity: 0,
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
  
  // Filter to only show features for the next action if specified
  const filteredFeatures = showForNextAction 
    ? featuresWithConfig.filter(feature => {
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
    : featuresWithConfig;
  
  // Add context-specific information and all combinations
  // For fermentation, show all combinations (discrete options)
  // For crushing/harvest, show ranges (continuous inputs)
  const shouldUseRanges = targetEvent === 'crushing' || targetEvent === 'harvest';
  
  const featuresWithContext = filteredFeatures.map(feature => {
    const combinations = getFeatureRiskCombinations(feature, context, targetEvent);
    return {
      ...feature,
      contextInfo: getContextInfo(feature, context),
      riskCombinations: shouldUseRanges ? null : combinations,
      riskRanges: shouldUseRanges ? calculateRiskRangesForCombinations(feature, context, targetEvent) : null
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
    
    switch (risk.featureId) {
      case 'green_flavor':
        return ripeness < 0.5 
          ? `(Ripeness ${Math.round(ripeness * 100)}% - Underripe)`
          : `(Ripeness ${Math.round(ripeness * 100)}% - Good level)`;
      
      case 'late_harvest':
        // Late harvest is based on harvest timing (season/week), not ripeness
        // Return empty string to avoid confusing context info
        return '';
      
      case 'terroir_expression':
        return `(Vineyard: ${vineyard.region}, ${vineyard.country})`;
      
      default:
        return '';
    }
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
 */
export function getRiskSeverityLabel(risk: number): string {
  if (risk < 0.1) return 'Very Low';
  if (risk < 0.3) return 'Low';
  if (risk < 0.6) return 'Moderate';
  if (risk < 0.8) return 'High';
  return 'Very High';
}

/**
 * Get color class for risk level
 */
export function getRiskColorClass(risk: number): string {
  if (risk < 0.1) return 'text-green-600';
  if (risk < 0.3) return 'text-yellow-600';
  if (risk < 0.6) return 'text-orange-600';
  if (risk < 0.8) return 'text-red-600';
  return 'text-red-800';
}

/**
 * Calculate all possible risk combinations for a feature
 * Shows risks for all available options (methods, temperatures, etc.)
 * Groups by option combinations and shows ranges for range inputs
 */

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

  // Group combinations using hardcoded grouping logic
  const groups = new Map<string, Array<{ options: any; risk: number; label: string }>>();

  for (const combination of combinations) {
    let groupKey: string;
    
    // Use hardcoded grouping logic
    switch (event) {
      case 'harvest':
        // Late harvest uses season-based grouping
        if (risk.featureId === 'late_harvest') {
          groupKey = `${risk.featureId}-${combination.options.season}`;
        } else {
          // All ripeness-based features get grouped together
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

  for (const [groupKey, groupCombinations] of groups) {
    const risks = groupCombinations.map(c => c.risk);
    const minRisk = Math.min(...risks);
    const maxRisk = Math.max(...risks);
    
        // Generate group label using hardcoded logic
        let groupLabel: string;
        
        switch (event) {
          case 'harvest':
            if (groupKey.includes('late_harvest-Fall')) {
              groupLabel = 'Fall Harvest (Weeks 7-12)';
            } else if (groupKey.includes('late_harvest-Winter')) {
              groupLabel = 'Winter Harvest (Weeks 1-12)';
            } else if (groupKey.includes('green_flavor')) {
              groupLabel = 'Green Flavor Risk (varies with ripeness)';
            } else {
              groupLabel = 'Harvest Risk (varies with ripeness)';
            }
            break;
          case 'crushing':
            {
              const firstCombo = groupCombinations[0];
              const destemmingText = firstCombo.options.destemming ? 'Destemmed' : 'Stems';
              const coldSoakText = firstCombo.options.coldSoak ? 'Cold Soak' : 'No Cold Soak';
              groupLabel = `${firstCombo.options.method} (${destemmingText}, ${coldSoakText}, 0-100% pressure)`;
            }
            break;
          case 'fermentation':
            const fermentCombo = groupCombinations[0];
            groupLabel = `${fermentCombo.options.method} + ${fermentCombo.options.temperature}`;
            break;
          case 'bottling':
            groupLabel = `${groupKey} Method`;
            break;
          default:
            groupLabel = groupKey;
        }

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
      // For harvest events, handle different features differently
      let contextForRisk: any;
      if (event === 'harvest') {
        if (risk.featureId === 'late_harvest') {
          // Late harvest uses season and week from optionSet
          contextForRisk = { 
            vineyard: vineyard || batch, 
            season: optionSet.season, 
            week: optionSet.week 
          };
        } else {
          // Other harvest features use vineyard as options
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
        } else if (featureId === 'late_harvest') {
          // Late harvest is based on harvest timing (season + week)
          // Generate key harvest date points to show in tooltip
          // Fall weeks 7-12 (start of late harvest to end of Fall)
          for (let week = 7; week <= 12; week++) {
            combinations.push({ season: 'Fall', week, _label: `Fall Week ${week}` });
          }
          // Winter weeks 1-12 (all Winter = late harvest)
          for (let week = 1; week <= 12; week++) {
            combinations.push({ season: 'Winter', week, _label: `Winter Week ${week}` });
          }
        }
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

