// Feature Display Service
// UI-friendly feature calculations and display data
// Consolidates feature impact calculations used across UI components

import { WineBatch, WineCharacteristics } from '../../../types/types';
import { getAllFeatureConfigs } from '../../../constants/wineFeatures';
import { getBottleAgingSeverity } from './agingService';

// ===== FEATURE IMPACT INTERFACE =====

export interface FeatureImpact {
  featureId: string;
  featureName: string;
  icon: string;
  severity: number;
  qualityImpact: number;
  characteristicModifiers: Partial<Record<keyof WineCharacteristics, number>>;
  description: string;
}

// ===== FEATURE IMPACT CALCULATIONS =====

/**
 * Get comprehensive feature impact information for display
 * Consolidates feature calculations used across multiple UI components
 * Used by QualityFactorsBreakdown, WineryFeatureStatusGrid, etc.
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
      const penaltyFactor = Math.pow(batch.quality, qualityEffect.exponent!);
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

/**
 * Get display-friendly feature severity for UI components
 * Handles special cases like bottle aging showing normalized progress
 * 
 * @param batch - Wine batch
 * @param featureId - Feature to get severity for
 * @returns Display severity (0-1 scale)
 */
export function getFeatureDisplaySeverity(batch: WineBatch, featureId: string): number {
  const feature = batch.features?.find(f => f.id === featureId);
  if (!feature || !feature.isPresent) return 0;
  
  // Special case: bottle aging shows normalized aging progress instead of raw severity
  if (featureId === 'bottle_aging') {
    return getBottleAgingSeverity(batch);
  }
  
  return feature.severity;
}

