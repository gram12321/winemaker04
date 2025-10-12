// Feature Effects Service
// Calculates quality, price, and characteristic impacts from wine features

import { WineBatch, CustomerType } from '../../types/types';
import { WineFeature, FeatureConfig } from '../../types/wineFeatures';
import { getAllFeatureConfigs } from '../../constants/wineFeatures';

/**
 * Calculate effective quality after applying all feature effects
 * This is the main quality calculation used by pricing and display
 * 
 * @param batch - Wine batch to calculate for
 * @returns Effective quality (0-1 scale) after all feature penalties/bonuses
 */
export function calculateEffectiveQuality(batch: WineBatch): number {
  const configs = getAllFeatureConfigs();
  let quality = batch.quality;
  
  const presentFeatures = (batch.features || []).filter(f => f.isPresent);
  
  for (const feature of presentFeatures) {
    const config = configs.find(c => c.id === feature.id);
    if (!config) continue;
    
    quality = applyQualityEffect(quality, batch, config, feature.severity);
  }
  
  // Clamp to valid range
  return Math.max(0, Math.min(1, quality));
}

/**
 * Apply a single feature's quality effect
 */
function applyQualityEffect(
  quality: number,
  batch: WineBatch,
  config: FeatureConfig,
  severity: number
): number {
  const effect = config.effects.quality;
  
  switch (effect.type) {
    case 'power': {
      // Premium wines hit harder (oxidation-style)
      // Formula: quality × (1 - (basePenalty × (1 + quality^exponent)))
      const penaltyFactor = Math.pow(quality, effect.exponent!);
      const scaledPenalty = effect.basePenalty! * (1 + penaltyFactor);
      
      // Also apply grape-specific severity for oxidation
      let severityMultiplier = 1.0;
      if (config.id === 'oxidation') {
        // Grapes prone to oxidation suffer more when oxidized
        severityMultiplier = 0.85 - (batch.proneToOxidation * 0.2);
      }
      
      return quality * (1 - scaledPenalty) * severityMultiplier;
    }
      
    case 'linear': {
      // Simple penalty or bonus
      const amount = typeof effect.amount === 'function' 
        ? effect.amount(severity) 
        : (effect.amount! * severity);
      return quality + amount;
    }
      
    case 'bonus': {
      // Positive effect (terroir-style)
      const bonus = typeof effect.amount === 'function' 
        ? effect.amount(severity) 
        : effect.amount!;
      return quality + bonus;
    }
      
    case 'custom': {
      if (effect.calculate) {
        return effect.calculate(quality, severity, batch.proneToOxidation);
      }
      return quality;
    }
      
    default:
      return quality;
  }
}

/**
 * Calculate price multiplier from customer sensitivity to features
 * This multiplier is applied to the bid price in order generation
 * 
 * @param batch - Wine batch being sold
 * @param customerType - Type of customer making the offer
 * @returns Price multiplier (e.g., 0.6 = 40% penalty, 1.25 = 25% premium)
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
    
    // For graduated features, interpolate between 1.0 and full sensitivity based on severity
    if (config.manifestation === 'graduated') {
      const adjustedSensitivity = 1.0 + (sensitivity - 1.0) * feature.severity;
      multiplier *= adjustedSensitivity;
    } else {
      // Binary features apply full sensitivity
      multiplier *= sensitivity;
    }
  }
  
  return multiplier;
}

/**
 * Get display string for feature risk
 * Used in UI tooltips and displays
 */
export function getFeatureRiskDisplay(feature: WineFeature, config: FeatureConfig): string {
  if (feature.isPresent) {
    if (config.manifestation === 'binary') {
      return config.name;
    } else {
      return `${config.name} (${Math.round(feature.severity * 100)}%)`;
    }
  }
  
  return `${(feature.risk * 100).toFixed(1)}% risk`;
}

/**
 * Get all present features for a batch, sorted by priority
 * Used for UI display
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
  
  // Sort by UI priority
  return presentFeatures.sort((a, b) => a.config.ui.sortPriority - b.config.ui.sortPriority);
}

/**
 * Check if batch has any faults
 * Useful for quality checks and warnings
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

