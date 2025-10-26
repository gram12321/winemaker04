// Feature Service
// Consolidates all feature-related business logic from:
// - featureDisplayService.ts
// - featureEffectsService.ts  
// - featureRiskHelper.ts
// - featureRiskService.ts
// - FeatureDisplay.tsx business logic

import { WineBatch, WineCharacteristics, CustomerType } from '../../../types/types';
import { WineFeature, FeatureConfig, CreateFeatureOptions, inferRiskAccumulationStrategy } from '../../../types/wineFeatures';
import { getAllFeatureConfigs, getTimeBasedFeatures, getEventTriggeredFeatures, getFeatureConfig } from '../../../constants/wineFeatures/commonFeaturesUtil';
import { loadWineBatches, bulkUpdateWineBatches } from '../../../database/activities/inventoryDB';
import { loadVineyards } from '../../../database/activities/vineyardDB';
import { notificationService } from '../../core/notificationService';
import { NotificationCategory } from '../../../types/types';
import { addFeaturePrestigeEvent } from '../../prestige/prestigeService';
import { getBottleAgingSeverity } from './agingService';

// ===== UNIFIED INTERFACES =====

export interface FeatureImpact {
  featureId: string;
  featureName: string;
  icon: string;
  severity: number;
  qualityImpact: number;
  characteristicModifiers: Partial<Record<keyof WineCharacteristics, number>>;
  description: string;
}

export interface FeatureRiskInfo {
  featureId: string;
  featureName: string;
  icon: string;
  currentRisk: number;
  newRisk: number;
  riskIncrease: number;
  isPresent: boolean;
  severity: number;
  qualityImpact?: number;
  description?: string;
}

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

// ===== FEATURE CREATION & INITIALIZATION =====

/**
 * Create a new feature instance from config
 */
export function createNewFeature(config: FeatureConfig, options?: Partial<CreateFeatureOptions>): WineFeature {
  return {
    id: config.id,
    risk: options?.initialRisk ?? 0,
    isPresent: options?.isPresent ?? false,
    severity: options?.severity ?? 0,
    name: config.name,
    type: config.type,
    icon: config.icon
  };
}

/**
 * Initialize features array for a new wine batch
 */
export function initializeBatchFeatures(): WineFeature[] {
  const configs = getAllFeatureConfigs();
  return configs.map(config => {
    const shouldStartPresent = config.type === 'feature' && config.manifestation === 'graduated';
    
    return createNewFeature(config, {
      isPresent: shouldStartPresent,
      severity: shouldStartPresent ? 0 : 0,
      initialRisk: shouldStartPresent ? 0.001 : 0
    });
  });
}

// ===== FEATURE DISPLAY CALCULATIONS =====

/**
 * Get comprehensive feature display data for UI components
 * Consolidates all feature calculations used across the application
 */
export function getFeatureDisplayData(batch: WineBatch): FeatureDisplayData {
  const configs = getAllFeatureConfigs();
  const features = batch.features || [];
  
  // Get all relevant features
  const relevantFeatures = configs
    .map(config => {
      const feature = features.find(f => f.id === config.id);
      const strategy = inferRiskAccumulationStrategy(config.riskAccumulation);
      
      return {
        feature: feature || { 
          id: config.id, 
          name: config.name, 
          icon: config.icon, 
          risk: 0, 
          isPresent: false, 
          severity: 0,
          type: config.type
        },
        config,
        strategy
      };
    })
    .filter(({ feature }) => {
      if (feature.isPresent && feature.severity > 0) return true;
      if (feature.risk > 0) return true;
      return false;
    });

  // Categorize features
  const evolvingFeatures = relevantFeatures
    .filter(({ feature, config }) => {
      if (!feature.isPresent || feature.severity === 0) return false;
      
      const baseGrowthRate = config.riskAccumulation.severityGrowth?.rate || 0;
      const multiplierValue = config.riskAccumulation.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
      const stateMultiplier = typeof multiplierValue === 'function' ? multiplierValue(batch) : multiplierValue;
      const weeklyGrowthRate = (baseGrowthRate || 0) * (stateMultiplier || 1.0);
      
      return weeklyGrowthRate > 0;
    })
    .map(({ feature, config }) => {
      const baseGrowthRate = config.riskAccumulation.severityGrowth?.rate || 0;
      const multiplierValue = config.riskAccumulation.severityGrowth?.stateMultipliers?.[batch.state] ?? 1.0;
      const stateMultiplier = typeof multiplierValue === 'function' ? multiplierValue(batch) : multiplierValue;
      const weeklyGrowthRate = (baseGrowthRate || 0) * (stateMultiplier || 1.0);
      
      // Calculate weekly effects
      const weeklyEffects: Record<string, number> = {};
      if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
        config.effects.characteristics.forEach(({ characteristic, modifier }) => {
          const effectValue = typeof modifier === 'function' 
            ? modifier(feature.severity) 
            : modifier * feature.severity;
          weeklyEffects[characteristic] = effectValue;
        });
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
      // Calculate quality impact
      const qualityImpact = calculateQualityImpact(batch, config, feature.severity);
      
      // Calculate characteristic effects
      const characteristicEffects: Record<string, number> = {};
      if (config.effects.characteristics && Array.isArray(config.effects.characteristics)) {
        config.effects.characteristics.forEach(({ characteristic, modifier }) => {
          const effectValue = typeof modifier === 'function' 
            ? modifier(feature.severity) 
            : modifier * feature.severity;
          characteristicEffects[characteristic] = effectValue;
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
    .filter(({ feature, strategy }) => !feature.isPresent && feature.risk > 0 && strategy !== 'independent')
    .map(({ feature, config }) => {
      const expectedWeeks = feature.risk > 0 ? Math.ceil(1 / feature.risk) : undefined;
      return {
        feature,
        config,
        expectedWeeks: expectedWeeks && expectedWeeks < 50 ? expectedWeeks : undefined
      };
    });

  // Calculate combined effects
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
 * Calculate quality impact for a feature
 */
function calculateQualityImpact(batch: WineBatch, config: FeatureConfig, severity: number): number {
  const effect = config.effects.quality;
  
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

// ===== FEATURE EFFECTS CALCULATIONS =====

/**
 * Apply feature effects directly to wine batch quality and balance
 * This modifies the batch in-place and should be called during game ticks
 * 
 * @param batch - Wine batch to modify
 * @returns Updated batch with feature effects applied
 */
export function applyFeatureEffectsToBatch(batch: WineBatch): WineBatch {
  const configs = getAllFeatureConfigs();
  const presentFeatures = (batch.features || []).filter(f => f.isPresent);
  
  // Start from born grape quality (baseline)
  let currentGrapeQuality = batch.bornGrapeQuality;
  
  // Apply all feature quality effects
  for (const feature of presentFeatures) {
    const config = configs.find(c => c.id === feature.id);
    if (!config) continue;
    
    currentGrapeQuality = applyQualityEffect(currentGrapeQuality, batch, config, feature.severity);
  }
  
  // Update batch with new quality
  return {
    ...batch,
    grapeQuality: Math.max(0, Math.min(1, currentGrapeQuality))
  };
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
    
    if (config.manifestation === 'graduated') {
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
      const modifier = typeof effect.modifier === 'function'
        ? effect.modifier(feature.severity)
        : effect.modifier * feature.severity;

      modifiers[effect.characteristic] = (modifiers[effect.characteristic] || 0) + modifier;
    }
  }

  return modifiers;
}

// ===== FEATURE RISK CALCULATIONS =====

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
    return {
      featureId: risk.featureId,
      featureName: risk.featureName,
      icon: risk.icon,
      currentRisk: risk.currentRisk,
      newRisk: risk.newRisk,
      riskIncrease: risk.riskIncrease,
      isPresent: false,
      severity: 0,
      qualityImpact: config?.effects.quality.type === 'linear'
        ? (config.effects.quality.amount as number)
        : undefined,
      description: config?.description
    };
  });
}

/**
 * Internal preview event risks calculation
 */
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
    
    if (feature?.isPresent && config.manifestation === 'binary') {
      continue;
    }
    
    const triggers = config.riskAccumulation.eventTriggers || [];
    
    for (const trigger of triggers) {
      if (trigger.event === event) {
        const triggerContext = { options: context, batch };
        const conditionMet = trigger.condition(triggerContext);

        // Always calculate risk, even if condition is not met (for preview purposes)
        const riskIncrease = conditionMet 
          ? (typeof trigger.riskIncrease === 'function'
              ? trigger.riskIncrease(triggerContext)
              : trigger.riskIncrease)
          : 0; // Show 0 risk if condition not met
        
        let newRisk: number;
        const strategy = inferRiskAccumulationStrategy(config.riskAccumulation);
        
        if (strategy === 'independent') {
          newRisk = riskIncrease;
        } else {
          newRisk = Math.min(1.0, currentRisk + riskIncrease);
        }
        
        // Calculate quality impact if the feature manifests
        let qualityImpact = 0;
        if (config.effects?.quality) {
          const qualityEffect = config.effects.quality;
          if (qualityEffect.type === 'power') {
            // For power effects: basePenalty * (quality ^ exponent)
            const basePenalty = qualityEffect.basePenalty || 0;
            const exponent = qualityEffect.exponent || 1;
            qualityImpact = basePenalty * Math.pow(batch.grapeQuality || 0.5, exponent);
          } else {
            qualityImpact = qualityEffect.basePenalty || 0;
          }
        }

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
  const strategy = config?.riskAccumulation ? inferRiskAccumulationStrategy(config.riskAccumulation) : 'cumulative';
  
  const sources: Array<{ source: string; risk: number }> = [];
  let total = 0;
  
  if (strategy === 'independent') {
    if (newRiskIncrease > 0) {
      sources.push({ source: newSource, risk: newRiskIncrease });
      total = newRiskIncrease;
    }
  } else {
    total = existingFeature?.risk || 0;
    
    if (existingFeature && existingFeature.risk > 0) {
      sources.push({ source: 'Previous events', risk: existingFeature.risk });
    }
    
    if (newRiskIncrease > 0) {
      sources.push({ source: newSource, risk: newRiskIncrease });
      total += newRiskIncrease;
    }
  }
  
  return { total: Math.min(1.0, total), sources };
}

// ===== FEATURE UTILITIES =====

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
 * Check if batch has any faults
 */
export function hasAnyFaults(batch: WineBatch): boolean {
  const configs = getAllFeatureConfigs();
  
  return (batch.features || []).some(feature => {
    if (!feature.isPresent) return false;
    const config = configs.find(c => c.id === feature.id);
    return config?.type === 'fault';
  });
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
  
  return presentFeatures.sort((a, b) => a.config.ui.sortPriority - b.config.ui.sortPriority);
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
 * Get comprehensive feature impact information for display
 * Consolidates feature calculations used across multiple UI components
 * Used by GrapeQualityFactorsBreakdown, WineryFeatureStatusGrid, etc.
 * 
 * @param batch - Wine batch to calculate for
 * @returns Array of feature impacts with quality and characteristic effects
 */
export function getFeatureImpacts(batch: WineBatch): FeatureImpact[] {
  const configs = getAllFeatureConfigs();
  const presentFeatures = (batch.features || []).filter(f => f.isPresent);
  
  return presentFeatures.map(feature => {
    const config = configs.find(c => c.id === feature.id);
    if (!config) return null;
    
    // Calculate quality impact
    const qualityEffect = config.effects.quality;
    let qualityImpact = 0;
    
    if (qualityEffect.type === 'linear' && typeof qualityEffect.amount === 'number') {
      qualityImpact = qualityEffect.amount * feature.severity;
    } else if (qualityEffect.type === 'power') {
      const penaltyFactor = Math.pow(batch.grapeQuality, qualityEffect.exponent!);
      const scaledPenalty = qualityEffect.basePenalty! * (1 + penaltyFactor);
      qualityImpact = -scaledPenalty;
    } else if (qualityEffect.type === 'bonus') {
      const bonusAmount = typeof qualityEffect.amount === 'function' 
        ? qualityEffect.amount(feature.severity)
        : qualityEffect.amount;
      qualityImpact = bonusAmount || 0;
    }
    
    // Calculate characteristic modifiers
    const characteristicModifiers: Partial<Record<keyof WineCharacteristics, number>> = {};
    if (config.effects.characteristics) {
      for (const effect of config.effects.characteristics) {
        const modifier = typeof effect.modifier === 'function'
          ? effect.modifier(feature.severity)
          : effect.modifier * feature.severity;
        characteristicModifiers[effect.characteristic] = modifier;
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

// ===== RISK DISPLAY UTILITIES =====

/**
 * Get risk severity label based on risk value
 */
export function getRiskSeverityLabel(risk: number): string {
  if (risk < 0.05) return 'Minimal Risk';
  if (risk < 0.08) return 'Low Risk';
  if (risk < 0.15) return 'Moderate Risk';
  if (risk < 0.30) return 'High Risk';
  return 'Critical Risk';
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
 * Get harvest risks (negative features that can occur during harvest)
 */
export function getHarvestRisks(batch?: WineBatch, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling' = 'harvest', context?: any): Array<FeatureRiskInfo & { config: any }> {
  const risks = previewFeatureRisks(batch, event, context);
  return risks
    .map(risk => {
      const config = getFeatureConfig(risk.featureId);
      return { ...risk, config };
    })
    .filter(riskWithConfig => 
      riskWithConfig.config?.harvestContext?.isHarvestRisk === true
    );
}

/**
 * Get harvest influences (positive features that manifest during harvest)
 */
export function getHarvestInfluences(batch?: WineBatch, event: 'harvest' | 'crushing' | 'fermentation' | 'bottling' = 'harvest', context?: any): Array<FeatureRiskInfo & { config: any }> {
  const risks = previewFeatureRisks(batch, event, context);
  return risks
    .map(risk => {
      const config = getFeatureConfig(risk.featureId);
      return { ...risk, config };
    })
    .filter(riskWithConfig => 
      riskWithConfig.config?.harvestContext?.isHarvestInfluence === true
    );
}

/**
 * Get all present features on a batch with their details
 * For displaying existing features in modals
 */
export function getPresentFeaturesInfo(batch: WineBatch): FeatureRiskInfo[] {
  return (batch.features || [])
    .filter(f => f.isPresent)
    .map(feature => {
      const config = getFeatureConfig(feature.id);
      return {
        featureId: feature.id,
        featureName: feature.name,
        icon: feature.icon,
        currentRisk: feature.risk,
        newRisk: feature.risk,
        riskIncrease: 0,
        isPresent: true,
        severity: feature.severity,
        qualityImpact: config?.effects.quality.type === 'linear' 
          ? (config.effects.quality.amount as number)
          : undefined,
        description: config?.description
      };
    });
}

/**
 * Get all at-risk features on a batch (not yet present but accumulating risk)
 * For displaying potential risks in modals
 */
export function getAtRiskFeaturesInfo(batch: WineBatch, threshold: number = 0.05): FeatureRiskInfo[] {
  return (batch.features || [])
    .filter(f => !f.isPresent && f.risk >= threshold)
    .map(feature => {
      const config = getFeatureConfig(feature.id);
      return {
        featureId: feature.id,
        featureName: feature.name,
        icon: feature.icon,
        currentRisk: feature.risk,
        newRisk: feature.risk,
        riskIncrease: 0,
        isPresent: false,
        severity: 0,
        qualityImpact: config?.effects.quality.type === 'linear' 
          ? (config.effects.quality.amount as number)
          : undefined,
        description: config?.description
      };
    });
}

// ===== FEATURE PROCESSING (from featureRiskService.ts) =====

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
  
  const vineyard = event === 'harvest' ? context : undefined;
  
  for (const config of eventConfigs) {
    const triggers = config.riskAccumulation.eventTriggers || [];
    
    for (const trigger of triggers) {
      if (trigger.event === event) {
        const triggerContext = { options: context, batch };
        const conditionMet = trigger.condition(triggerContext);

        if (conditionMet) {
          const riskIncrease = typeof trigger.riskIncrease === 'function'
            ? trigger.riskIncrease(triggerContext)
            : trigger.riskIncrease;
          
          updatedFeatures = await applyRiskIncrease(batch, config, updatedFeatures, riskIncrease, vineyard);
        }
      }
    }
  }
  
  return { ...batch, features: updatedFeatures };
}

// ===== INTERNAL HELPER FUNCTIONS =====

function getOrCreateFeature(features: WineFeature[], config: FeatureConfig): WineFeature {
  const existing = features.find(f => f.id === config.id);
  if (existing) return existing;
  return createNewFeature(config);
}

function calculateRiskIncrease(batch: WineBatch, config: FeatureConfig, feature: WineFeature): number {
  const baseRate = config.riskAccumulation.baseRate || 0;
  
  let stateMultiplier = 1.0;
  const multiplierValue = config.riskAccumulation.stateMultipliers?.[batch.state];
  if (typeof multiplierValue === 'function') {
    stateMultiplier = multiplierValue(batch);
  } else if (typeof multiplierValue === 'number') {
    stateMultiplier = multiplierValue;
  }
  
  const compoundMultiplier = config.riskAccumulation.compoundEffect 
    ? (1 + feature.risk)
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
  
  if (feature.isPresent && config.manifestation === 'binary') return features;
  
  const riskIncrease = calculateRiskIncrease(batch, config, feature);
  const newRisk = Math.min(1.0, feature.risk + riskIncrease);
  const previousRisk = feature.risk;
  
  let isPresent = feature.isPresent;
  let severity = feature.severity;
  
  if (!isPresent) {
    isPresent = checkManifestation(newRisk);
    if (isPresent) {
      severity = config.manifestation === 'binary' ? 1.0 : newRisk;
      await handleManifestation(batch, config, vineyard);
    }
  } else if (config.manifestation === 'graduated') {
    const baseGrowthRate = config.riskAccumulation.severityGrowth?.rate || 0;
    
    let stateMultiplier = 1.0;
    const multiplierValue = config.riskAccumulation.severityGrowth?.stateMultipliers?.[batch.state];
    if (typeof multiplierValue === 'function') {
      stateMultiplier = multiplierValue(batch);
    } else if (typeof multiplierValue === 'number') {
      stateMultiplier = multiplierValue;
    }
    
    const effectiveGrowthRate = baseGrowthRate * stateMultiplier;
    const cap = config.riskAccumulation.severityGrowth?.cap || 1.0;
    severity = Math.min(cap, severity + effectiveGrowthRate);
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

async function applyRiskIncrease(
  batch: WineBatch,
  config: FeatureConfig,
  features: WineFeature[],
  riskIncrease: number,
  vineyard?: any
): Promise<WineFeature[]> {
  const feature = getOrCreateFeature(features, config);
  
  if (feature.isPresent && config.manifestation === 'binary') return features;
  
  const newRisk = Math.min(1.0, feature.risk + riskIncrease);
  let isPresent = feature.isPresent;
  let severity = feature.severity;
  
  if (!isPresent) {
    isPresent = checkManifestation(newRisk);
    if (isPresent) {
      severity = config.manifestation === 'binary' ? 1.0 : newRisk;
      await handleManifestation(batch, config, vineyard);
    }
  }
  
  return updateFeatureInArray(features, {
    ...feature,
    risk: newRisk,
    isPresent,
    severity
  });
}

function shouldWarnAboutRisk(config: FeatureConfig, previousRisk: number, newRisk: number): boolean {
  const thresholds = config.ui.warningThresholds || [];
  
  for (const threshold of thresholds) {
    if (previousRisk < threshold && newRisk >= threshold) {
      return true;
    }
  }
  
  return false;
}

async function sendManifestationNotification(batch: WineBatch, config: FeatureConfig): Promise<void> {
  const message = config.type === 'fault'
    ? `${config.name}! ${batch.vineyardName} ${batch.grape} (${batch.state}) has developed ${config.name.toLowerCase()}.`
    : `${config.name}! ${batch.vineyardName} ${batch.grape} (${batch.state}) now shows ${config.name.toLowerCase()}.`;
  
  await notificationService.addMessage(
    message,
    `wine.feature.${config.id}`,
    config.name,
    NotificationCategory.WINEMAKING_PROCESS
  );
}

async function sendRiskWarning(batch: WineBatch, config: FeatureConfig, risk: number): Promise<void> {
  const riskPercent = (risk * 100).toFixed(1);
  const thresholds = config.ui.warningThresholds || [];
  
  let severity: 'info' | 'warning' | 'critical' = 'info';
  let title = `${config.name} Risk`;
  
  if (thresholds.length >= 3) {
    if (risk >= thresholds[2]) {
      severity = 'critical';
      title = `Critical ${config.name} Risk`;
    } else if (risk >= thresholds[1]) {
      severity = 'warning';
      title = `High ${config.name} Risk`;
    }
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
