// Feature Risk Service
// Unified service for handling feature risks across vineyard and winery contexts
// Replaces hardcoded harvest-specific logic with generic risk/influence system

import { WineBatch, Vineyard } from '../../../types/types';
import { FeatureRiskInfo, previewFeatureRisks } from './featureService';
import { getFeatureConfig } from '../../../constants/wineFeatures/commonFeaturesUtil';
import { isActionAvailable } from '../winery/wineryService';

export interface FeatureRiskContext {
  type: 'vineyard' | 'winery';
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
  batch?: WineBatch;
  vineyard?: Vineyard;
  nextAction?: 'crush' | 'ferment' | 'bottle';
}

export interface FeatureRiskDisplayData {
  risks: Array<FeatureRiskInfo & { 
    config: any; 
    contextInfo?: string; 
    riskCombinations?: Array<{ options: any; risk: number; label: string }> | null;
    riskRanges?: Array<{ groupLabel: string; minRisk: number; maxRisk: number; combinations: Array<{ options: any; risk: number; label: string }> }> | null;
  }>;
  influences: Array<FeatureRiskInfo & { 
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
  
  const allRisks = getRisksForEvent(batch, targetEvent, eventContext);
  const allInfluences = getInfluencesForEvent(batch, targetEvent, eventContext);
  
  // Filter to only show risks for the next action if specified
  const risks = showForNextAction 
    ? allRisks.filter(risk => risk.config?.riskAccumulation?.eventTriggers?.some((trigger: any) => trigger.event === targetEvent))
    : allRisks;
    
  const influences = showForNextAction
    ? allInfluences.filter(influence => influence.config?.riskAccumulation?.eventTriggers?.some((trigger: any) => trigger.event === targetEvent))
    : allInfluences;
  
  // Add context-specific information and all combinations
  const risksWithContext = risks.map(risk => ({
    ...risk,
    contextInfo: getContextInfo(risk, context),
    riskCombinations: getFeatureRiskCombinations(risk, context, targetEvent),
    riskRanges: calculateRiskRangesForCombinations(risk, context, targetEvent)
  }));
  
  const influencesWithContext = influences.map(influence => ({
    ...influence,
    contextInfo: getContextInfo(influence, context),
    riskCombinations: getFeatureRiskCombinations(influence, context, targetEvent),
    riskRanges: calculateRiskRangesForCombinations(influence, context, targetEvent)
  }));
  
  return {
    risks: risksWithContext,
    influences: influencesWithContext,
    showForNextAction,
    nextAction: showForNextAction ? nextAction : undefined
  };
}

/**
 * Get risks for a specific event
 */
function getRisksForEvent(
  batch: WineBatch | undefined, 
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): Array<FeatureRiskInfo & { config: any }> {
  const risks = previewFeatureRisks(batch, event, context);
  
  return risks
    .map((risk: any) => {
      const config = getFeatureConfig(risk.featureId);
      return { ...risk, config };
    })
    .filter((riskWithConfig: any) => 
      riskWithConfig.config?.harvestContext?.isHarvestInfluence !== true
    );
}

/**
 * Get influences for a specific event
 */
function getInfluencesForEvent(
  batch: WineBatch | undefined,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling', 
  context: any
): Array<FeatureRiskInfo & { config: any }> {
  const risks = previewFeatureRisks(batch, event, context);
  
  return risks
    .map((risk: any) => {
      const config = getFeatureConfig(risk.featureId);
      return { ...risk, config };
    })
    .filter((riskWithConfig: any) => 
      riskWithConfig.config?.harvestContext?.isHarvestInfluence === true
    );
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
        const lateHarvestThreshold = 0.8;
        const isLateHarvest = ripeness > lateHarvestThreshold;
        return isLateHarvest
          ? `(Ripeness ${Math.round(ripeness * 100)}% - Late harvest conditions)`
          : `(Ripeness ${Math.round(ripeness * 100)}% - Normal harvest timing)`;
      
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

  // Group combinations using config-based grouping or fallback logic
  const groups = new Map<string, Array<{ options: any; risk: number; label: string }>>();
  
  // Get grouping configuration from feature config
  const config = getFeatureConfig(risk.featureId);
  const eventOptions = config?.riskDisplayOptions?.[event];
  const groupByFields = eventOptions?.groupBy || [];

  for (const combination of combinations) {
    let groupKey: string;
    
    if (groupByFields.length > 0) {
      // Use config-based grouping
      const groupValues = groupByFields.map(field => {
        if (field === 'pressure-range' && (combination.options._isMin || combination.options._isMax)) {
          return 'pressure-range';
        }
        if (field === 'ripeness-range' && combination.options.ripeness !== undefined) {
          return 'ripeness-range';
        }
        if (field === 'harvest-timing' && combination.options.week !== undefined) {
          return 'harvest-timing';
        }
        return combination.options[field] || 'default';
      });
      groupKey = groupValues.join('-');
    } else {
      // Fallback to hardcoded grouping logic
      switch (event) {
        case 'harvest':
          groupKey = `${risk.featureId}-ripeness-range`;
          break;
        case 'crushing':
          if (combination.options._isMin || combination.options._isMax) {
            groupKey = 'pressure-range';
          } else {
            groupKey = `${combination.options.method}-${combination.options.destemming}-${combination.options.coldSoak}`;
          }
          break;
        case 'fermentation':
          groupKey = `${combination.options.method}-${combination.options.temperature}`;
          break;
        case 'bottling':
          groupKey = combination.options.method;
          break;
        default:
          groupKey = 'default';
      }
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
    
        // Generate group label using config-based logic or fallback
        let groupLabel: string;
        
        if (groupByFields.length > 0) {
          // Use config-based grouping to generate labels
          if (groupKey.includes('pressure-range')) {
            groupLabel = 'Pressure Range (0-100%)';
          } else if (groupKey.includes('ripeness-range')) {
            if (risk.featureId === 'green_flavor') {
              groupLabel = 'Green Flavor Risk (varies with ripeness)';
            } else {
              groupLabel = 'Harvest Risk (varies with ripeness)';
            }
          } else if (groupKey.includes('harvest-timing')) {
            groupLabel = 'Late Harvest Risk (varies with harvest timing)';
          } else {
            // Use the first combination's label as the group label
            groupLabel = groupCombinations[0]?.label || groupKey;
          }
        } else {
          // Fallback to hardcoded label generation
          switch (event) {
            case 'harvest':
              if (groupKey.includes('green_flavor')) {
                groupLabel = 'Green Flavor Risk (varies with ripeness)';
              } else if (groupKey.includes('late_harvest')) {
                groupLabel = 'Late Harvest Risk (varies with ripeness)';
              } else {
                groupLabel = 'Harvest Risk (varies with ripeness)';
              }
              break;
            case 'crushing':
              if (groupKey === 'pressure-range') {
                groupLabel = 'Pressure Range (0-100%)';
              } else {
                const firstCombo = groupCombinations[0];
                const destemmingText = firstCombo.options.destemming ? 'Destemmed' : 'Stems';
                const coldSoakText = firstCombo.options.coldSoak ? 'Cold Soak' : 'No Cold Soak';
                groupLabel = `${firstCombo.options.method} (${destemmingText}, ${coldSoakText}, 0-100% pressure)`;
              }
              break;
            case 'fermentation':
              const [method, temperature] = groupKey.split('-');
              groupLabel = `${method} (${temperature})`;
              break;
            case 'bottling':
              groupLabel = `${groupKey} Method`;
              break;
            default:
              groupLabel = groupKey;
          }
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
  if (!config?.riskAccumulation?.eventTriggers) {
    return null;
  }

  const trigger = config.riskAccumulation.eventTriggers.find((t: any) => t.event === event);
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
      // For harvest events, pass vineyard as options; for others, pass optionSet as options
      const contextForRisk = event === 'harvest' 
        ? { options: vineyard || batch, batch: batch || vineyard }
        : { options: optionSet, batch: batch || vineyard };
      
      const riskValue = trigger.riskIncrease(contextForRisk);
      const label = generateOptionLabel(optionSet, event, risk.featureId);
      
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
 * Uses the riskDisplayOptions in each feature config instead of hardcoded logic
 */
function getFeatureSpecificOptions(featureId: string, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'): any[] {
  const config = getFeatureConfig(featureId);
  
  if (!config?.riskDisplayOptions?.[event]) {
    return [];
  }
  
  const eventOptions = config.riskDisplayOptions[event];
  return eventOptions.optionCombinations.map(combo => combo.options);
}


/**
 * Generate a human-readable label for option combinations
 * Uses custom labels from config if available, otherwise generates default labels
 */
function generateOptionLabel(options: any, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling', featureId?: string): string {
  // Try to get custom label from config first
  if (featureId) {
    const config = getFeatureConfig(featureId);
    const eventOptions = config?.riskDisplayOptions?.[event];
    if (eventOptions) {
      const matchingCombo = eventOptions.optionCombinations.find(combo => 
        JSON.stringify(combo.options) === JSON.stringify(options)
      );
      if (matchingCombo?.label) {
        return matchingCombo.label;
      }
    }
  }
  
  // Fallback to auto-generated labels
  switch (event) {
    case 'harvest':
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

