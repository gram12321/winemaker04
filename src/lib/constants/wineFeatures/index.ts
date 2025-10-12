// Wine Features Registry
// Central registry of all active feature configurations

import { FeatureConfig } from '../../types/wineFeatures';
import { OXIDATION_FEATURE } from './oxidation';
import { GREEN_FLAVOR_FEATURE } from './greenFlavor';
import { TERROIR_FEATURE } from './terroir';

/**
 * Active features in the game
 * Add new features here as they are implemented
 */
export const ACTIVE_FEATURES: FeatureConfig[] = [
  OXIDATION_FEATURE,
  GREEN_FLAVOR_FEATURE,  // Phase 2 - Event-triggered fault
  TERROIR_FEATURE,       // Phase 3 - Positive graduated feature
];

/**
 * Get all active feature configurations
 * @returns Array of all active feature configs
 */
export function getAllFeatureConfigs(): FeatureConfig[] {
  return ACTIVE_FEATURES;
}

/**
 * Get a specific feature configuration by ID
 * @param featureId - Feature ID to look up
 * @returns Feature config or undefined if not found
 */
export function getFeatureConfig(featureId: string): FeatureConfig | undefined {
  return ACTIVE_FEATURES.find(config => config.id === featureId);
}

/**
 * Get features that use time-based risk accumulation
 * Called by game tick system
 */
export function getTimeBasedFeatures(): FeatureConfig[] {
  return ACTIVE_FEATURES.filter(
    config => config.riskAccumulation.trigger === 'time_based' || 
              config.riskAccumulation.trigger === 'hybrid'
  );
}

/**
 * Get features that respond to a specific event
 * @param event - Event type (harvest, crushing, fermentation, bottling)
 */
export function getEventTriggeredFeatures(
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'
): FeatureConfig[] {
  return ACTIVE_FEATURES.filter(config => {
    if (config.riskAccumulation.trigger === 'event_triggered' || 
        config.riskAccumulation.trigger === 'hybrid') {
      const triggers = config.riskAccumulation.eventTriggers || [];
      return triggers.some(trigger => trigger.event === event);
    }
    return false;
  });
}

// Re-export for convenience
export { OXIDATION_FEATURE } from './oxidation';
export { GREEN_FLAVOR_FEATURE } from './greenFlavor';
export { TERROIR_FEATURE } from './terroir';

