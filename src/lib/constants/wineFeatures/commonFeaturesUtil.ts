// Wine Features Registry
// Central registry of all active feature configurations

import { FeatureConfig } from '../../types/wineFeatures';
import { OXIDATION_FEATURE } from './oxidation';
import { GREEN_FLAVOR_FEATURE } from './greenFlavor';
import { STUCK_FERMENTATION_FEATURE } from './stuckFermentation';
import { TERROIR_FEATURE } from './terroir';
import { BOTTLE_AGING_FEATURE } from './bottleAging';
import { NOBLE_ROT_FEATURE } from './nobleRot';
import { GREY_ROT_FEATURE } from './greyRot';

// ===== FEATURE REGISTRY FUNCTIONS =====

/**
 * Active features in the game
 * Add new features here as they are implemented
 */
export const ACTIVE_FEATURES: FeatureConfig[] = [
  OXIDATION_FEATURE,          // Accumulation behavior
  GREEN_FLAVOR_FEATURE,       // Triggered behavior
  STUCK_FERMENTATION_FEATURE, // Triggered behavior
  TERROIR_FEATURE,            // Evolving behavior
  BOTTLE_AGING_FEATURE,       // Evolving behavior
  NOBLE_ROT_FEATURE,          // Accumulation + Evolving behavior
  GREY_ROT_FEATURE,           // Conditional Accumulation behavior
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
 * Get features that use time-based behavior (evolving, accumulation, or triggered with evolution)
 * Called by game tick system
 */
export function getTimeBasedFeatures(): FeatureConfig[] {
  return ACTIVE_FEATURES.filter(config => {
    if (config.behavior === 'evolving' || config.behavior === 'accumulation') {
      return true;
    }
    // Include triggered features that can evolve after manifestation
    if (config.behavior === 'triggered') {
      const triggeredConfig = config.behaviorConfig as any;
      return triggeredConfig.canEvolveAfterManifestation === true;
    }
    return false;
  });
}

/**
 * Get features that respond to a specific event
 * @param event - Event type (harvest, crushing, fermentation, bottling)
 */
export function getEventTriggeredFeatures(
  event: 'harvest' | 'crushing' | 'fermentation' | 'bottling'
): FeatureConfig[] {
  return ACTIVE_FEATURES.filter(config => {
    if (config.behavior === 'triggered') {
      const behaviorConfig = config.behaviorConfig as any;
      const triggers = behaviorConfig.eventTriggers || [];
      return triggers.some((trigger: any) => trigger.event === event);
    }
    
    // Also check accumulation features for event-based risk modifiers
    if (config.behavior === 'accumulation') {
      const behaviorConfig = config.behaviorConfig as any;
      const riskModifiers = behaviorConfig.riskModifiers || [];
      return riskModifiers.some(() => {
        // Check if risk modifier is triggered by the event
        // This would need to be determined by the parameter being modified
        return true; // For now, include all accumulation features
      });
    }
    
    return false;
  });
}