import { WineBatch, WineCharacteristics, CustomerType, Vineyard } from '../../../types/types';
import { WineFeature, FeatureConfig, FeatureImpact, FeatureRiskInfo } from '../../../types/wineFeatures';
import { getAllFeatureConfigs, getTimeBasedFeatures, getEventTriggeredFeatures, getFeatureConfig } from '../../../constants/wineFeatures/commonFeaturesUtil';
import { isActionAvailable } from '../winery/wineryService';
import { getColorClass, getColorCategory } from '../../../utils/utils';
import { loadWineBatches, bulkUpdateWineBatches } from '../../../database/activities/inventoryDB';
import { loadVineyards } from '../../../database/activities/vineyardDB';
import { notificationService } from '../../core/notificationService';
import { NotificationCategory } from '../../../types/types';
import { addFeaturePrestigeEvent } from '../../prestige/prestigeService';
import { getBottleAgingSeverity } from './agingService';

// ===== CORE INTERFACES =====

export interface FeatureDisplayData {
  evolvingFeatures: Array<{
    feature: WineFeature;
    config: FeatureConfig;
    weeklyGrowthRate: number;
    weeklyEffects: Record<string, number>;
  }>;
  activeFeatures: Array<{
    feature: WineFeature;
    config: FeatureConfig;
    qualityImpact: number;
    characteristicEffects: Record<string, number>;
  }>;
  riskFeatures: Array<{
    feature: WineFeature;
    config: FeatureConfig;
    expectedWeeks?: number;
  }>;
  combinedWeeklyEffects: Record<string, number>;
  combinedActiveEffects: Record<string, number>;
  totalQualityEffect: number;
}

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
    weeklyRiskIncrease?: number;
  }>;
  showForNextAction: boolean;
  nextAction?: string;
}

// ===== FEATURE CREATION & INITIALIZATION =====

/**
 * Create a new feature instance from config
 */
export function createNewFeature(config: FeatureConfig, options?: { isPresent?: boolean; severity?: number; risk?: number }): WineFeature {
  const feature: WineFeature = {
    id: config.id,
    isPresent: options?.isPresent ?? false,
    severity: options?.severity ?? 0,
    name: config.name,
    icon: config.icon
  };
  
  if (config.behavior === 'accumulation') {
    feature.risk = options?.risk ?? 0;
  }
  
  return feature;
}

/**
 * Initialize features array for a new wine batch
 */
export function initializeBatchFeatures(): WineFeature[] {
  const configs = getAllFeatureConfigs();
  return configs.map(config => {
    let isPresent = false;
    let severity = 0;
    let risk: number | undefined = undefined;
    
    if (config.behavior === 'evolving') {
      const behaviorConfig = config.behaviorConfig as any;
      isPresent = behaviorConfig.spawnActive;
      severity = behaviorConfig.spawnActive ? 0.001 : 0;
    } else if (config.behavior === 'accumulation') {
      const behaviorConfig = config.behaviorConfig as any;
      if (behaviorConfig.spawnActive) {
        risk = 0;
      }
    }
    
    return createNewFeature(config, {
      isPresent,
      severity,
      risk
    });
  });
}

// ===== DISPLAY CALCULATIONS =====

/**
 * Get comprehensive feature display data for UI components
 * Consolidates all feature calculations used across the application
 */
export function getFeatureDisplayData(batch: WineBatch): FeatureDisplayData {
  const configs = getAllFeatureConfigs();
  const features = batch.features || [];
  
  const relevantFeatures = configs
    .map(config => {
      const feature = features.find(f => f.id === config.id);
      
      return {
        feature: feature || { 
          id: config.id, 
          name: config.name, 
          icon: config.icon, 
          risk: config.behavior === 'accumulation' ? 0 : undefined,
          isPresent: false, 
          severity: 0
        },
        config
      };
    })
    .filter(({ feature }) => {
      if (feature.isPresent && feature.severity > 0) return true;
      if (feature.risk && feature.risk > 0) return true;
      return false;
    });

  const evolvingFeatures = relevantFeatures
    .filter(({ feature, config }) => {
      if (config.behavior !== 'evolving') return false;
      if (!feature.isPresent || feature.severity === 0) return false;
      
      // Special case: bottle_aging weekly growth is derived from aging progress curve
      if (config.id === 'bottle_aging' && batch.state === 'bottled') {
        const currentSeverity = getFeatureDisplaySeverity(batch, 'bottle_aging');
        const currentAgingProgress = batch.agingProgress || 0;
        const nextWeekBatch = {
          ...batch,
          agingProgress: currentAgingProgress + 1
        };
        const nextWeekSeverity = getBottleAgingSeverity(nextWeekBatch);
        const weeklyGrowthRate = nextWeekSeverity - currentSeverity;
        return weeklyGrowthRate > 0.0001; // Very small threshold for aging
      }
      
      const behaviorConfig = config.behaviorConfig as any;
      const baseGrowthRate = behaviorConfig.severityGrowth?.rate || 0;
      const multiplierValue = behaviorConfig.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
      const stateMultiplier = typeof multiplierValue === 'function' ? multiplierValue(batch) : multiplierValue;
      const weeklyGrowthRate = (baseGrowthRate || 0) * (stateMultiplier || 1.0);
      
      return weeklyGrowthRate > 0;
    })
    .map(({ feature, config }) => {
      const behaviorConfig = config.behaviorConfig as any;
      
      // Special case: bottle_aging weekly growth is derived from aging progress curve
      let weeklyGrowthRate: number;
      let currentSeverityForEffects: number;
      
      if (config.id === 'bottle_aging' && batch.state === 'bottled') {
        // Use calculated severity from aging progress
        currentSeverityForEffects = getFeatureDisplaySeverity(batch, 'bottle_aging');
        
        // Calculate growth rate as difference between current and next week's severity
        const currentAgingProgress = batch.agingProgress || 0;
        const nextWeekBatch = {
          ...batch,
          agingProgress: currentAgingProgress + 1
        };
        const nextWeekSeverity = getBottleAgingSeverity(nextWeekBatch);
        weeklyGrowthRate = nextWeekSeverity - currentSeverityForEffects;
      } else {
        // Standard calculation for other features
        const baseGrowthRate = behaviorConfig.severityGrowth?.rate || 0;
        const multiplierValue = behaviorConfig.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
        const stateMultiplier = typeof multiplierValue === 'function' ? multiplierValue(batch) : multiplierValue;
        weeklyGrowthRate = (baseGrowthRate || 0) * (stateMultiplier || 1.0);
        currentSeverityForEffects = feature.severity;
      }
      
      const weeklyEffects: Record<string, number> = {};
      
      // Calculate weekly effects as the CHANGE per week, not the total effect
      const nextSeverity = Math.min(1.0, currentSeverityForEffects + weeklyGrowthRate);
      
      if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
        config.effects.characteristics.forEach(({ characteristic, modifier }) => {
          // Calculate effect at current severity
          const currentEffect = applyModifier(modifier, currentSeverityForEffects);
          // Calculate effect at next severity (after weekly growth)
          const nextEffect = applyModifier(modifier, nextSeverity);
          // Weekly effect is the difference (change per week)
          weeklyEffects[characteristic] = nextEffect - currentEffect;
        });
      }
      
      if (config.effects.quality) {
        const qualityEffect = config.effects.quality;
        let weeklyQualityEffect = 0;
        
        if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
          weeklyQualityEffect = qualityEffect.amount * weeklyGrowthRate;
        } else if (qualityEffect.type === 'bonus') {
          const nextSeverityForQuality = Math.min(1.0, currentSeverityForEffects + weeklyGrowthRate);
          const currentBonus = typeof qualityEffect.amount === 'function' 
            ? qualityEffect.amount(currentSeverityForEffects)
            : (qualityEffect.amount || 0);
          const nextBonus = typeof qualityEffect.amount === 'function'
            ? qualityEffect.amount(nextSeverityForQuality)
            : (qualityEffect.amount || 0);
          weeklyQualityEffect = nextBonus - currentBonus;
        }
        
        if (Math.abs(weeklyQualityEffect) > 0.001) {
          weeklyEffects['quality'] = weeklyQualityEffect;
        }
      }
      
      return {
        feature,
        config,
        weeklyGrowthRate,
        weeklyEffects
      };
    });

  const activeFeatures = relevantFeatures
    .filter(({ feature }) => feature.isPresent && feature.severity > 0)
    .map(({ feature, config }) => {
      // Use getFeatureDisplaySeverity for bottle_aging to ensure consistency across displays
      const displaySeverity = config.id === 'bottle_aging' 
        ? getFeatureDisplaySeverity(batch, 'bottle_aging')
        : feature.severity;
      
      const qualityImpact = calculateQualityImpact(batch, config, displaySeverity);
      
      const characteristicEffects: Record<string, number> = {};
      if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
        config.effects.characteristics.forEach(({ characteristic, modifier }) => {
          characteristicEffects[characteristic] = applyModifier(modifier, displaySeverity);
        });
      }
      
      return {
        feature,
        config,
        qualityImpact,
        characteristicEffects
      };
    });

  const riskFeatures = relevantFeatures
    .filter(({ feature, config }) => {
      if (feature.isPresent) return false;
      if (config.behavior === 'triggered') return false;
      if (feature.risk && feature.risk > 0) return true;
      return false;
    })
    .map(({ feature, config }) => {
      const expectedWeeks = feature.risk && feature.risk > 0 ? Math.ceil(1 / feature.risk) : undefined;
      return {
        feature,
        config,
        expectedWeeks: expectedWeeks && expectedWeeks < 50 ? expectedWeeks : undefined
      };
    });

  const combinedWeeklyEffects: Record<string, number> = {};
  evolvingFeatures.forEach(({ weeklyEffects }) => {
    Object.entries(weeklyEffects).forEach(([characteristic, effect]) => {
      combinedWeeklyEffects[characteristic] = (combinedWeeklyEffects[characteristic] || 0) + effect;
    });
  });

  const combinedActiveEffects: Record<string, number> = {};
  let totalQualityEffect = 0;
  
  activeFeatures.forEach(({ characteristicEffects, qualityImpact }) => {
    Object.entries(characteristicEffects).forEach(([characteristic, effect]) => {
      combinedActiveEffects[characteristic] = (combinedActiveEffects[characteristic] || 0) + effect;
    });
    totalQualityEffect += qualityImpact;
  });

  return {
    evolvingFeatures,
    activeFeatures,
    riskFeatures,
    combinedWeeklyEffects,
    combinedActiveEffects,
    totalQualityEffect
  };
}

/**
 * Get comprehensive feature impact information for display
 * Consolidates feature calculations used across multiple UI components
 */
export function getFeatureImpacts(batch: WineBatch): FeatureImpact[] {
  const configs = getAllFeatureConfigs();
  const presentFeatures = (batch.features || []).filter(f => f.isPresent);
  
  return presentFeatures.map(feature => {
    const config = configs.find(c => c.id === feature.id);
    if (!config) return null;
    
    const qualityImpact = calculateQualityImpact(batch, config, feature.severity);
    
    const characteristicModifiers: Partial<Record<keyof WineCharacteristics, number>> = {};
    if (config.effects.characteristics) {
      for (const effect of config.effects.characteristics) {
        characteristicModifiers[effect.characteristic] = applyModifier(effect.modifier, feature.severity);
      }
    }
    
    return {
      featureId: feature.id,
      featureName: config.name,
      icon: config.icon,
      severity: feature.severity,
      qualityImpact,
      characteristicModifiers,
      description: config.description
    };
  }).filter(Boolean) as FeatureImpact[];
}

// ===== EFFECT CALCULATIONS =====

/**
 * Apply feature effects directly to wine batch quality and balance
 * This modifies the batch in-place and should be called during game ticks
 */
export function applyFeatureEffectsToBatch(batch: WineBatch): WineBatch {
  const configs = getAllFeatureConfigs();
  const presentFeatures = (batch.features || []).filter(f => f.isPresent);
  
  let currentGrapeQuality = batch.bornGrapeQuality;
  
  for (const feature of presentFeatures) {
    const config = configs.find(c => c.id === feature.id);
    if (!config) continue;
    
    currentGrapeQuality = applyQualityEffect(currentGrapeQuality, batch, config, feature.severity);
  }
  
  return {
    ...batch,
    grapeQuality: Math.max(0, Math.min(1, currentGrapeQuality))
  };
}

/**
 * Calculate price multiplier from customer sensitivity to features
 */
export function calculateFeaturePriceMultiplier(
  batch: WineBatch,
  customerType: CustomerType
): number {
  const configs = getAllFeatureConfigs();
  let multiplier = 1.0;
  
  const presentFeatures = (batch.features || []).filter(f => f.isPresent);
  
  for (const feature of presentFeatures) {
    const config = configs.find(c => c.id === feature.id);
    if (!config) continue;
    
    const sensitivity = config.customerSensitivity[customerType];
    
    if (config.behavior === 'evolving' && feature.severity > 0) {
      const adjustedSensitivity = 1.0 + (sensitivity - 1.0) * feature.severity;
      multiplier *= adjustedSensitivity;
    } else {
      multiplier *= sensitivity;
    }
  }
  
  return multiplier;
}

/**
 * Calculate characteristic modifications from all present features
 */
export function calculateFeatureCharacteristicModifiers(batch: WineBatch): Partial<Record<keyof WineCharacteristics, number>> {
  const configs = getAllFeatureConfigs();
  const modifiers: Partial<Record<keyof WineCharacteristics, number>> = {};

  const presentFeatures = (batch.features || []).filter(f => f.isPresent);

  for (const feature of presentFeatures) {
    const config = configs.find(c => c.id === feature.id);
    if (!config?.effects.characteristics) continue;

    for (const effect of config.effects.characteristics) {
      const modifier = applyModifier(effect.modifier, feature.severity);
      modifiers[effect.characteristic] = (modifiers[effect.characteristic] || 0) + modifier;
    }
  }

  return modifiers;
}

/**
 * Apply feature characteristic effects to wine batch characteristics
 * Modifies characteristics and adds effects to breakdown for UI display
 */
export function applyFeatureCharacteristicEffects(batch: WineBatch, featureConfig: FeatureConfig): WineBatch {
  if (!featureConfig.effects.characteristics) {
    return batch;
  }
  
  const feature = (batch.features || []).find(f => f.id === featureConfig.id);
  if (!feature || !feature.isPresent) {
    return batch;
  }
  
  let modifiedCharacteristics = { ...batch.characteristics };
  const breakdownEffects = [...(batch.breakdown?.effects || [])];
  
  for (const effect of featureConfig.effects.characteristics) {
    const modifier = applyModifier(effect.modifier, feature.severity);
    
    const currentValue = modifiedCharacteristics[effect.characteristic];
    modifiedCharacteristics[effect.characteristic] = Math.max(0, Math.min(1, currentValue + modifier));
    
    breakdownEffects.push({
      characteristic: effect.characteristic,
      modifier,
      description: featureConfig.name
    });
  }
  
  return {
    ...batch,
    characteristics: modifiedCharacteristics,
    breakdown: {
      effects: breakdownEffects
    }
  };
}

// ===== RISK CALCULATIONS =====

/**
 * Preview event risks for UI display
 */
export function previewFeatureRisks(
  batch: WineBatch | undefined,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): FeatureRiskInfo[] {
  const targetBatch = batch || {
    features: [],
    id: 'preview',
    vineyardId: context.id,
    vineyardName: context.name,
    grape: context.grape,
    quantity: 0,
    state: 'grapes' as const,
    bornGrapeQuality: 0,
    bornBalance: 0,
    grapeQuality: 0,
    balance: 0,
    characteristics: { acidity: 0, aroma: 0, body: 0, spice: 0, sweetness: 0, tannins: 0 },
    estimatedPrice: 0,
    grapeColor: 'red' as const,
    naturalYield: 0,
    fragile: 0,
    proneToOxidation: 0,
    harvestStartDate: { week: 1, season: 'Spring' as const, year: 2024 },
    harvestEndDate: { week: 1, season: 'Spring' as const, year: 2024 }
  };
  
  const risks = previewEventRisksInternal(targetBatch, event, context);
  
  return risks.map(risk => {
    const config = getFeatureConfig(risk.featureId);
    const qualityEffect = config?.effects.quality;
    let qualityImpact: number | undefined = undefined;
    
    if (qualityEffect && qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
      qualityImpact = qualityEffect.amount;
    }
    
    return {
      featureId: risk.featureId,
      featureName: risk.featureName,
      icon: risk.icon,
      currentRisk: risk.currentRisk,
      newRisk: risk.newRisk,
      riskIncrease: risk.riskIncrease,
      isPresent: false,
      severity: 0,
      qualityImpact,
      description: config?.description
    };
  });
}

/**
 * Calculate cumulative risks for a specific feature
 */
export function calculateCumulativeRisk(
  batch: WineBatch,
  featureId: string,
  newRiskIncrease: number,
  newSource: string
): { total: number; sources: Array<{ source: string; risk: number }> } {
  const existingFeature = getFeature(batch, featureId);
  
  if (existingFeature?.isPresent) {
    return { total: 1.0, sources: [{ source: 'Already present', risk: 1.0 }] };
  }
  
  const config = getFeatureConfig(featureId);
  
  const sources: Array<{ source: string; risk: number }> = [];
  let total = 0;
  
  if (config?.behavior === 'triggered') {
    if (newRiskIncrease > 0) {
      sources.push({ source: newSource, risk: newRiskIncrease });
      total = newRiskIncrease;
    }
  } else {
    total = existingFeature?.risk || 0;
    
    if (existingFeature && existingFeature.risk && existingFeature.risk > 0) {
      sources.push({ source: 'Previous events', risk: existingFeature.risk });
    }
    
    if (newRiskIncrease > 0) {
      sources.push({ source: newSource, risk: newRiskIncrease });
      total += newRiskIncrease;
    }
  }
  
  return { total: Math.min(1.0, total), sources };
}

/**
 * Get feature risks and influences for display
 * Works for both vineyard (harvest) and winery (crushing/fermentation/bottling) contexts
 */
export function getFeatureRisksForDisplay(context: FeatureRiskContext): FeatureRiskDisplayData {
  const { type, event, batch, vineyard, nextAction } = context;
  
  const showForNextAction = type === 'winery' && nextAction !== undefined;
  
  const targetEvent = showForNextAction && nextAction 
    ? (nextAction === 'crush' ? 'crushing' : 
       nextAction === 'ferment' ? 'fermentation' : 
       nextAction === 'bottle' ? 'bottling' : event)
    : event;
  
  const contextForEvent = type === 'winery' ? batch : vineyard;
  const eventContext = type === 'winery' ? batch : contextForEvent;
  
  const triggeredFeatures = previewFeatureRisks(batch, targetEvent, eventContext);
  
  const allConfigs = getAllFeatureConfigs();
  
  const evolvingFeatures = allConfigs
    .filter((config: any) => {
      if (config.behavior !== 'evolving') return false;
      const behaviorConfig = config.behaviorConfig as any;
      return behaviorConfig.spawnActive === true;
    })
    .map((config: any) => {
      const existingFeature = batch?.features?.find((f: any) => f.id === config.id);
      
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
  
  const accumulationFeatures = allConfigs
    .filter((config: any) => {
      if (config.behavior !== 'accumulation') return false;
      const behaviorConfig = config.behaviorConfig as any;
      
      const spawnsAtCurrentEvent = behaviorConfig.spawnActive === true && behaviorConfig.spawnEvent === targetEvent;
      const existingFeature = batch?.features?.find((f: any) => f.id === config.id);
      const alreadySpawned = existingFeature !== undefined;
      
      return spawnsAtCurrentEvent || alreadySpawned;
    })
    .map((config: any) => {
      const existingFeature = batch?.features?.find((f: any) => f.id === config.id);
      const currentRisk = existingFeature?.risk || 0;
      
      return {
        featureId: config.id,
        featureName: config.name,
        icon: config.icon,
        currentRisk,
        newRisk: currentRisk,
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
  
  const allFeatures = [...triggeredFeatures, ...evolvingFeatures, ...accumulationFeatures];
  
  const featuresWithConfig = allFeatures.map((feature: any) => {
    const config = feature.config || getFeatureConfig(feature.featureId);
    return { ...feature, config };
  });
  
  const featuresNotManifested = featuresWithConfig.filter(feature => !feature.isPresent);
  
  const filteredFeatures = showForNextAction 
    ? featuresNotManifested.filter(feature => {
        if (feature.config?.behavior === 'triggered') {
          const behaviorConfig = feature.config.behaviorConfig as any;
          return behaviorConfig.eventTriggers?.some((trigger: any) => trigger.event === targetEvent);
        }
        if (feature.config?.behavior === 'evolving' || feature.config?.behavior === 'accumulation') {
          return true;
        }
        return false;
      })
    : featuresNotManifested;
  
  const shouldUseRanges = targetEvent === 'crushing' || targetEvent === 'harvest';
  
  const featuresWithContext = filteredFeatures.map(feature => {
    const combinations = getFeatureRiskCombinations(feature, context, targetEvent);
    
    const config = feature.config || getFeatureConfig(feature.featureId);
    const showAsRange = config?.riskDisplay?.showAsRange ?? true;
    const useRangesForDisplay = shouldUseRanges && showAsRange;
    
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

// ===== WEEKLY PROCESSING =====

/**
 * Process weekly risk accumulation for all time-based features
 */
export async function processWeeklyFeatureRisks(): Promise<void> {
  try {
    const batches = await loadWineBatches();
    const vineyards = await loadVineyards();
    const timeBasedConfigs = getTimeBasedFeatures();
    
    const updates: Array<{ id: string; updates: Partial<WineBatch> }> = [];
    
    for (const batch of batches) {
      if (batch.state === 'bottled' && batch.quantity === 0) continue;
      
      let updatedFeatures = [...(batch.features || [])];
      const vineyard = vineyards.find(v => v.id === batch.vineyardId);
      
      for (const config of timeBasedConfigs) {
        updatedFeatures = await processTimeBased(batch, config, updatedFeatures, vineyard);
      }
      
      if (JSON.stringify(updatedFeatures) !== JSON.stringify(batch.features)) {
        updates.push({
          id: batch.id,
          updates: { features: updatedFeatures }
        });
      }
    }
    
    if (updates.length > 0) {
      await bulkUpdateWineBatches(updates);
    }
  } catch (error) {
    console.error('Error processing weekly feature risks:', error);
  }
}

/**
 * Process event-triggered features
 */
export async function processEventTrigger(
  batch: WineBatch,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): Promise<WineBatch> {
  const eventConfigs = getEventTriggeredFeatures(event);
  let updatedFeatures = [...(batch.features || [])];
  let updatedBatch = { ...batch };
  
  const vineyard = event === 'harvest' ? context : undefined;
  
  for (const config of eventConfigs) {
    let triggers: any[] = [];
    if (config.behavior === 'triggered') {
      const behaviorConfig = config.behaviorConfig as any;
      triggers = behaviorConfig.eventTriggers || [];
    }
    
    for (const trigger of triggers) {
      if (trigger.event === event) {
        const triggerContext = { options: context, batch };
        const conditionMet = trigger.condition(triggerContext);

        if (conditionMet) {
          const riskIncrease = typeof trigger.riskIncrease === 'function'
            ? trigger.riskIncrease(triggerContext)
            : trigger.riskIncrease;
          
          const { features: newFeatures, manifested } = await applyRiskIncrease(
            updatedBatch, 
            config, 
            updatedFeatures, 
            riskIncrease, 
            vineyard
          );
          updatedFeatures = newFeatures;
          
          if (manifested) {
            updatedBatch = applyFeatureEffectsToBatch({ ...updatedBatch, features: updatedFeatures });
            updatedBatch = applyFeatureCharacteristicEffects({ ...updatedBatch, features: updatedFeatures }, config);
          }
        }
      }
    }
  }
  
  return { ...updatedBatch, features: updatedFeatures };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get specific feature from batch
 */
export function getFeature(batch: WineBatch, featureId: string): WineFeature | undefined {
  return (batch.features || []).find(f => f.id === featureId);
}

/**
 * Check if specific feature is present
 */
export function hasFeature(batch: WineBatch, featureId: string): boolean {
  return getFeature(batch, featureId)?.isPresent ?? false;
}

/**
 * Get all present features for a batch, sorted by priority
 */
export function getPresentFeaturesSorted(batch: WineBatch): Array<{ feature: WineFeature; config: FeatureConfig }> {
  const configs = getAllFeatureConfigs();
  const presentFeatures = (batch.features || [])
    .filter(f => f.isPresent)
    .map(feature => ({
      feature,
      config: configs.find(c => c.id === feature.id)!
    }))
    .filter(item => item.config !== undefined);
  
  return presentFeatures.sort((a, b) => a.config.displayPriority - b.config.displayPriority);
}

/**
 * Get display-friendly feature severity for UI components
 */
export function getFeatureDisplaySeverity(batch: WineBatch, featureId: string): number {
  const feature = batch.features?.find(f => f.id === featureId);
  if (!feature || !feature.isPresent) return 0;
  
  if (featureId === 'bottle_aging') {
    return getBottleAgingSeverity(batch);
  }
  
  return feature.severity;
}

/**
 * Get risk severity label based on risk value
 */
export function getRiskSeverityLabel(risk: number): string {
  return getColorCategory(1 - risk);
}

/**
 * Get color class for risk level
 */
export function getRiskColorClass(risk: number): string {
  return getColorClass(1 - risk);
}

/**
 * Get risk severity icon with label
 */
export function getRiskSeverityIcon(risk: number): string {
  if (risk < 0.08) return 'ℹ️';
  if (risk < 0.15) return '⚠️ MODERATE RISK';
  if (risk < 0.30) return '⚠️ HIGH RISK';
  return '🚨 CRITICAL RISK';
}

/**
 * Format risk as warning message
 */
export function formatFeatureRiskWarning(riskInfo: FeatureRiskInfo): string {
  const riskPercent = (riskInfo.newRisk * 100).toFixed(1);
  const severityIcon = getRiskSeverityIcon(riskInfo.newRisk);
  
  const parts: string[] = [];
  parts.push(`${severityIcon}: ${riskPercent}% chance of ${riskInfo.featureName} (${riskInfo.description}).`);
  
  if (riskInfo.qualityImpact) {
    const impactPercent = Math.abs(riskInfo.qualityImpact * 100);
    parts.push(`Wine quality will be reduced by ${impactPercent}% if this occurs.`);
  }
  
  return parts.join(' ');
}

/**
 * Get all present features on a batch with their details
 */
export function getPresentFeaturesInfo(batch: WineBatch): FeatureRiskInfo[] {
  return (batch.features || [])
    .filter(f => f.isPresent)
    .map(feature => {
      const config = getFeatureConfig(feature.id);
      const qualityEffect = config?.effects.quality;
      let qualityImpact: number | undefined = undefined;
      
      if (qualityEffect && qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
        qualityImpact = qualityEffect.amount;
      }
      
      return {
        featureId: feature.id,
        featureName: feature.name,
        icon: feature.icon,
        currentRisk: feature.risk || 0,
        newRisk: feature.risk || 0,
        riskIncrease: 0,
        isPresent: true,
        severity: feature.severity,
        qualityImpact,
        description: config?.description
      };
    });
}

/**
 * Get all at-risk features on a batch (not yet present but accumulating risk)
 */
export function getAtRiskFeaturesInfo(batch: WineBatch, threshold: number = 0.05): FeatureRiskInfo[] {
  return (batch.features || [])
    .filter(f => !f.isPresent && f.risk && f.risk >= threshold)
    .map(feature => {
      const config = getFeatureConfig(feature.id);
      const qualityEffect = config?.effects.quality;
      let qualityImpact: number | undefined = undefined;
      
      if (qualityEffect && qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
        qualityImpact = qualityEffect.amount;
      }
      
      return {
        featureId: feature.id,
        featureName: feature.name,
        icon: feature.icon,
        currentRisk: feature.risk || 0,
        newRisk: feature.risk || 0,
        riskIncrease: 0,
        isPresent: false,
        severity: 0,
        qualityImpact,
        description: config?.description
      };
    });
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

// ===== INTERNAL HELPERS =====

/**
 * Calculate quality impact for a feature
 * Unified implementation used by all display and processing functions
 */
function calculateQualityImpact(batch: WineBatch, config: FeatureConfig, severity: number): number {
  const effect = config.effects.quality;
  if (!effect) return 0;
  
  switch (effect.type) {
    case 'linear':
      if (typeof effect.amount === 'number') {
        return effect.amount * severity;
      }
      return 0;
      
    case 'power':
      const penaltyFactor = Math.pow(batch.grapeQuality, effect.exponent!);
      const scaledPenalty = effect.basePenalty! * (1 + penaltyFactor);
      return -scaledPenalty;
      
    case 'bonus':
      const bonusAmount = typeof effect.amount === 'function' 
        ? effect.amount(severity) 
        : effect.amount;
      return bonusAmount || 0;
      
    case 'custom':
      if (effect.calculate) {
        return effect.calculate(batch.grapeQuality, severity, batch.proneToOxidation);
      }
      return 0;
      
    default:
      return 0;
  }
}

/**
 * Apply a modifier (function or number) with severity scaling
 * Unified helper for all characteristic effect calculations
 */
function applyModifier(modifier: number | ((severity: number) => number), severity: number): number {
  return typeof modifier === 'function' ? modifier(severity) : modifier * severity;
}

/**
 * Apply a single feature's quality effect
 */
function applyQualityEffect(
  grapeQuality: number,
  batch: WineBatch,
  config: FeatureConfig,
  severity: number
): number {
  const effect = config.effects.quality;
  if (!effect) return grapeQuality;
  
  switch (effect.type) {
    case 'power': {
      const penaltyFactor = Math.pow(grapeQuality, effect.exponent!);
      const scaledPenalty = effect.basePenalty! * (1 + penaltyFactor);
      
      let severityMultiplier = 1.0;
      if (config.id === 'oxidation') {
        severityMultiplier = 0.85 - (batch.proneToOxidation * 0.2);
      }
      
      return grapeQuality * (1 - scaledPenalty) * severityMultiplier;
    }
      
    case 'linear': {
      const amount = typeof effect.amount === 'function' 
        ? effect.amount(severity) 
        : (effect.amount! * severity);
      return grapeQuality + amount;
    }
      
    case 'bonus': {
      const bonus = typeof effect.amount === 'function' 
        ? effect.amount(severity) 
        : effect.amount!;
      return grapeQuality + bonus;
    }
      
    case 'custom': {
      if (effect.calculate) {
        return effect.calculate(grapeQuality, severity, batch.proneToOxidation);
      }
      return grapeQuality;
    }
      
    default:
      return grapeQuality;
  }
}

function previewEventRisksInternal(
  batch: WineBatch,
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling',
  context: any
): Array<{ featureId: string; featureName: string; icon: string; riskIncrease: number; currentRisk: number; newRisk: number; qualityImpact: number }> {
  const eventConfigs = getEventTriggeredFeatures(event);
  const results: Array<{ featureId: string; featureName: string; icon: string; riskIncrease: number; currentRisk: number; newRisk: number; qualityImpact: number }> = [];
  
  for (const config of eventConfigs) {
    const feature = batch.features?.find(f => f.id === config.id);
    const currentRisk = feature?.risk || 0;
    
    if (feature?.isPresent && config.behavior === 'triggered') {
      continue;
    }
    
    let triggers: any[] = [];
    if (config.behavior === 'triggered') {
      const behaviorConfig = config.behaviorConfig as any;
      triggers = behaviorConfig.eventTriggers || [];
    } else if (config.behavior === 'accumulation') {
      triggers = [];
    }
    
    for (const trigger of triggers) {
      if (trigger.event === event) {
        const triggerContext = { options: context, batch };
        const conditionMet = trigger.condition(triggerContext);

        const riskIncrease = conditionMet 
          ? (typeof trigger.riskIncrease === 'function'
              ? trigger.riskIncrease(triggerContext)
              : trigger.riskIncrease)
          : 0;
        
        let newRisk: number;
        
        if (config.behavior === 'triggered') {
          newRisk = riskIncrease;
        } else {
          newRisk = Math.min(1.0, currentRisk + riskIncrease);
        }
        
        const qualityImpact = calculateQualityImpact(batch, config, 1.0);

        results.push({
          featureId: config.id,
          featureName: config.name,
          icon: config.icon,
          riskIncrease,
          currentRisk,
          newRisk,
          qualityImpact
        });
      }
    }
  }
  
  return results;
}

function getOrCreateFeature(features: WineFeature[], config: FeatureConfig): WineFeature {
  const existing = features.find(f => f.id === config.id);
  if (existing) return existing;
  return createNewFeature(config);
}

function calculateRiskIncrease(batch: WineBatch, config: FeatureConfig, feature: WineFeature): number {
  if (config.behavior !== 'accumulation') return 0;
  
  const behaviorConfig = config.behaviorConfig as any;
  const baseRate = behaviorConfig.baseRate || 0;
  
  let stateMultiplier = 1.0;
  const multiplierValue = behaviorConfig.stateMultipliers?.[batch.state];
  if (typeof multiplierValue === 'function') {
    stateMultiplier = multiplierValue(batch);
  } else if (typeof multiplierValue === 'number') {
    stateMultiplier = multiplierValue;
  }
  
  const compoundMultiplier = behaviorConfig.compound 
    ? (1 + (feature.risk || 0))
    : 1.0;
  
  const oxidationMultiplier = config.id === 'oxidation' 
    ? batch.proneToOxidation 
    : 1.0;
  
  return baseRate * stateMultiplier * compoundMultiplier * oxidationMultiplier;
}

function checkManifestation(risk: number): boolean {
  return Math.random() < risk;
}

async function handleManifestation(
  batch: WineBatch,
  config: FeatureConfig,
  vineyard?: any
): Promise<void> {
  await sendManifestationNotification(batch, config);
  
  if (config.effects.prestige?.onManifestation) {
    await addFeaturePrestigeEvent(batch, config, 'manifestation', { vineyard });
  }
}

function updateFeatureInArray(features: WineFeature[], updatedFeature: WineFeature): WineFeature[] {
  const index = features.findIndex(f => f.id === updatedFeature.id);
  if (index >= 0) {
    const updated = [...features];
    updated[index] = updatedFeature;
    return updated;
  }
  return [...features, updatedFeature];
}

async function processTimeBased(
  batch: WineBatch,
  config: FeatureConfig,
  features: WineFeature[],
  vineyard?: any
): Promise<WineFeature[]> {
  const feature = getOrCreateFeature(features, config);
  
  if (config.behavior === 'accumulation') {
    if (feature.isPresent) return features;
    
    const riskIncrease = calculateRiskIncrease(batch, config, feature);
    const newRisk = Math.min(1.0, (feature.risk || 0) + riskIncrease);
    const previousRisk = feature.risk || 0;
    
    let isPresent: boolean = feature.isPresent;
    let severity = feature.severity;
    
    if (!isPresent) {
      isPresent = checkManifestation(newRisk);
      if (isPresent) {
        severity = 1.0;
        await handleManifestation(batch, config, vineyard);
      }
    }
    
    if (!isPresent && shouldWarnAboutRisk(config, previousRisk, newRisk)) {
      await sendRiskWarning(batch, config, newRisk);
    }
    
    return updateFeatureInArray(features, {
      ...feature,
      risk: newRisk,
      isPresent,
      severity
    });
  }
  
  if (config.behavior === 'evolving') {
    if (!feature.isPresent) return features;
    
    // Special case: bottle_aging severity growth is derived from agingProgress calculation
    // This ensures the standard severity accumulation system stays in sync with the aging progress curve
    if (config.id === 'bottle_aging') {
      if (batch.state === 'bottled') {
        // Calculate current severity from aging progress
        const currentSeverity = getBottleAgingSeverity(batch);
        
        // Calculate what severity will be next week (agingProgress + 1)
        const currentAgingProgress = batch.agingProgress || 0;
        const nextWeekBatch = {
          ...batch,
          agingProgress: currentAgingProgress + 1
        };
        const nextWeekSeverity = getBottleAgingSeverity(nextWeekBatch);
        
        // The growth rate is the difference (this is what we add each week)
        const weeklyGrowth = nextWeekSeverity - currentSeverity;
        
        // Apply growth using standard system (but derived from aging progress curve)
        const cap = (config.behaviorConfig as any).severityGrowth?.cap || 1.0;
        const newSeverity = Math.min(cap, currentSeverity + weeklyGrowth);
        
        return updateFeatureInArray(features, {
          ...feature,
          severity: newSeverity,
          isPresent: newSeverity > 0
        });
      }
      // For non-bottled wines, keep severity at 0
      return updateFeatureInArray(features, {
        ...feature,
        severity: 0,
        isPresent: false
      });
    }
    
    const behaviorConfig = config.behaviorConfig as any;
    const baseGrowthRate = behaviorConfig.severityGrowth?.rate || 0;
    
    let stateMultiplier = 1.0;
    const multiplierValue = behaviorConfig.severityGrowth?.stateMultipliers?.[batch.state];
    if (typeof multiplierValue === 'function') {
      stateMultiplier = multiplierValue(batch);
    } else if (typeof multiplierValue === 'number') {
      stateMultiplier = multiplierValue;
    }
    
    const effectiveGrowthRate = baseGrowthRate * stateMultiplier;
    const cap = behaviorConfig.severityGrowth?.cap || 1.0;
    const newSeverity = Math.min(cap, feature.severity + effectiveGrowthRate);
    
    return updateFeatureInArray(features, {
      ...feature,
      severity: newSeverity
    });
  }
  
  return features;
}

async function applyRiskIncrease(
  batch: WineBatch,
  config: FeatureConfig,
  features: WineFeature[],
  riskIncrease: number,
  vineyard?: any
): Promise<{ features: WineFeature[]; manifested: boolean }> {
  const feature = getOrCreateFeature(features, config);
  
  if (feature.isPresent && config.behavior === 'triggered') {
    return { features, manifested: false };
  }
  
  const newRisk = Math.min(1.0, (feature.risk || 0) + riskIncrease);
  let isPresent = feature.isPresent;
  let severity = feature.severity;
  let manifested = false;
  
  if (!isPresent) {
    isPresent = checkManifestation(newRisk);
    if (isPresent) {
      severity = config.behavior === 'triggered' ? 1.0 : newRisk;
      await handleManifestation(batch, config, vineyard);
      manifested = true;
    }
  }
  
  return {
    features: updateFeatureInArray(features, {
      ...feature,
      risk: newRisk,
      isPresent,
      severity
    }),
    manifested
  };
}

function shouldWarnAboutRisk(_config: FeatureConfig, previousRisk: number, newRisk: number): boolean {
  if (previousRisk < 0.10 && newRisk >= 0.10) return true;
  if (previousRisk < 0.30 && newRisk >= 0.30) return true;
  
  return false;
}

async function sendManifestationNotification(batch: WineBatch, config: FeatureConfig): Promise<void> {
  const message = `${config.name}! ${batch.vineyardName} ${batch.grape} (${batch.state}) has developed ${config.name.toLowerCase()}.`;
  
  await notificationService.addMessage(
    message,
    `wine.feature.${config.id}`,
    config.name,
    NotificationCategory.WINEMAKING_PROCESS
  );
}

async function sendRiskWarning(batch: WineBatch, config: FeatureConfig, risk: number): Promise<void> {
  const riskPercent = (risk * 100).toFixed(1);
  
  let severity: 'info' | 'warning' | 'critical' = 'info';
  let title = `${config.name} Risk`;
  
  if (risk >= 0.30) {
    severity = 'critical';
    title = `Critical ${config.name} Risk`;
  } else if (risk >= 0.10) {
    severity = 'warning';
    title = `High ${config.name} Risk`;
  }
  
  const message = severity === 'critical'
    ? `Critical Risk! ${batch.vineyardName} ${batch.grape} has ${riskPercent}% ${config.name.toLowerCase()} risk (${batch.state}). Process immediately!`
    : `${title}: ${batch.vineyardName} ${batch.grape} has ${riskPercent}% ${config.name.toLowerCase()} risk (${batch.state}).`;
  
  await notificationService.addMessage(
    message,
    `wine.feature.${config.id}.risk`,
    title,
    NotificationCategory.WINEMAKING_PROCESS
  );
}

function getContextInfo(risk: FeatureRiskInfo, context: FeatureRiskContext): string {
  const { type, vineyard, batch } = context;
  
  if (type === 'vineyard' && vineyard) {
    const ripeness = vineyard.ripeness || 0;
    
    if (risk.featureId === 'green_flavor') {
      return ripeness < 0.5 
        ? `(Ripeness ${Math.round(ripeness * 100)}% - Underripe)`
        : `(Ripeness ${Math.round(ripeness * 100)}% - Good level)`;
    }
    
    return '';
  }
  
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
  
  let stateMultiplier = 1.0;
  const multiplierValue = behaviorConfig.stateMultipliers?.[batch.state];
  if (typeof multiplierValue === 'function') {
    stateMultiplier = multiplierValue(batch);
  } else if (typeof multiplierValue === 'number') {
    stateMultiplier = multiplierValue;
  }
  
  const compoundMultiplier = behaviorConfig.compound 
    ? (1 + (feature.currentRisk || 0))
    : 1.0;
  
  let featureMultiplier = 1.0;
  if (config.id === 'oxidation') {
    featureMultiplier = batch.proneToOxidation || 1.0;
  }
  
  return baseRate * stateMultiplier * compoundMultiplier * featureMultiplier;
}

function generateGroupLabel(combinations: Array<{ options: any; risk: number; label: string }>, event: string): string {
  const firstCombo = combinations[0];
  
  if (firstCombo.options.season && firstCombo.options.week !== undefined) {
    const season = firstCombo.options.season;
    const weeks = combinations.map(c => c.options.week).sort((a, b) => a - b);
    const minWeek = weeks[0];
    const maxWeek = weeks[weeks.length - 1];
    return `${season} Harvest (Weeks ${minWeek}-${maxWeek})`;
  }
  
  if (firstCombo.options.ripeness !== undefined) {
    return 'Risk (varies with ripeness)';
  }
  
  if (event === 'crushing' && firstCombo.options.method) {
    const destemmingText = firstCombo.options.destemming ? 'Destemmed' : 'Stems';
    const coldSoakText = firstCombo.options.coldSoak ? 'Cold Soak' : 'No Cold Soak';
    return `${firstCombo.options.method} (${destemmingText}, ${coldSoakText}, 0-100% pressure)`;
  }
  
  if (event === 'fermentation' && firstCombo.options.method && firstCombo.options.temperature) {
    return `${firstCombo.options.method} + ${firstCombo.options.temperature}`;
  }
  
  return firstCombo.label || 'Risk';
}

function calculateRiskRangesForCombinations(
  risk: FeatureRiskInfo, 
  context: FeatureRiskContext, 
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'
): Array<{ groupLabel: string; minRisk: number; maxRisk: number; combinations: Array<{ options: any; risk: number; label: string }> }> | null {
  const combinations = getFeatureRiskCombinations(risk, context, event);
  if (!combinations || combinations.length === 0) {
    return null;
  }

  const groups = new Map<string, Array<{ options: any; risk: number; label: string }>>();
  
  for (const combination of combinations) {
    let groupKey: string;
    
    switch (event) {
      case 'harvest':
        if (combination.options.season) {
          groupKey = `${risk.featureId}-${combination.options.season}`;
        } else {
          groupKey = `${risk.featureId}-ripeness-range`;
        }
        break;
      case 'crushing':
        const destemmingKey = combination.options.destemming ? 'destemmed' : 'stems';
        const coldSoakKey = combination.options.coldSoak ? 'coldsoak' : 'nocoldsoak';
        groupKey = `${combination.options.method}-${destemmingKey}-${coldSoakKey}`;
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

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(combination);
  }

  const ranges: Array<{ groupLabel: string; minRisk: number; maxRisk: number; combinations: Array<{ options: any; risk: number; label: string }> }> = [];

  for (const [, groupCombinations] of groups) {
    const risks = groupCombinations.map(c => c.risk);
    const minRisk = Math.min(...risks);
    const maxRisk = Math.max(...risks);
    
    const groupLabel = generateGroupLabel(groupCombinations, event);

    ranges.push({
      groupLabel,
      minRisk,
      maxRisk,
      combinations: groupCombinations
    });
  }

  ranges.sort((a, b) => b.maxRisk - a.maxRisk);

  return ranges;
}

function getFeatureRiskCombinations(
  risk: FeatureRiskInfo, 
  context: FeatureRiskContext, 
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'
): Array<{ options: any; risk: number; label: string }> | null {
  if (!context.batch && !context.vineyard) {
    return null;
  }

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

  const allOptionCombinations = getFeatureSpecificOptions(risk.featureId, event);
  
  for (const optionSet of allOptionCombinations) {
    try {
      let contextForRisk: any;
      if (event === 'harvest') {
        if (optionSet.season && optionSet.week !== undefined) {
          contextForRisk = { 
            vineyard: vineyard || batch, 
            season: optionSet.season, 
            week: optionSet.week 
          };
        } else {
          contextForRisk = { options: vineyard || batch, batch: batch || vineyard };
        }
      } else {
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

function getFeatureSpecificOptions(featureId: string, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'): any[] {
  const config = getFeatureConfig(featureId);
  
  if (config?.riskDisplay?.customOptionCombinations) {
    return config.riskDisplay.customOptionCombinations(event);
  }
  
  const combinations: any[] = [];
  
  switch (event) {
    case 'fermentation':
      const methods = ['Basic', 'Temperature Controlled', 'Extended Maceration'];
      const temperatures = ['Ambient', 'Cool', 'Warm'];
      
      for (const method of methods) {
        for (const temperature of temperatures) {
          combinations.push({ method, temperature });
        }
      }
      break;
      
    case 'crushing':
      const crushingMethods = ['Hand Press', 'Mechanical Press', 'Pneumatic Press'];
      const destemmingOptions = [true, false];
      const coldSoakOptions = [true, false];
      
      for (const method of crushingMethods) {
        for (const destemming of destemmingOptions) {
          for (const coldSoak of coldSoakOptions) {
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
      if (featureId === 'green_flavor') {
        combinations.push({ ripeness: 0, _isMin: true });
        combinations.push({ ripeness: 1, _isMax: true });
      }
      break;
      
    case 'bottling':
      break;
  }
  
  return combinations;
}

function generateOptionLabel(options: any, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'): string {
  switch (event) {
    case 'harvest':
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