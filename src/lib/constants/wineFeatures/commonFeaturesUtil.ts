// Wine Features Registry
// Central registry of all active feature configurations

import { FeatureConfig } from '../../types/wineFeatures';
import { OXIDATION_FEATURE } from './oxidation';
import { GREEN_FLAVOR_FEATURE } from './greenFlavor';
import { STUCK_FERMENTATION_FEATURE } from './stuckFermentation';
import { TERROIR_FEATURE } from './terroir';
import { BOTTLE_AGING_FEATURE } from './bottleAging';
import { LATE_HARVEST_FEATURE } from './lateHarvest';

// ===== PRESTIGE CONFIGURATION HELPERS =====

export interface PrestigeConfigOptions {
  manifestationCompany?: { baseAmount: number; maxImpact: number };
  manifestationVineyard?: { baseAmount: number; maxImpact: number };
  saleCompany?: { baseAmount: number; maxImpact: number };
  saleVineyard?: { baseAmount: number; maxImpact: number };
  decayRate?: number;
}

export function createPrestigeConfig(options: PrestigeConfigOptions) {
  const { 
    manifestationCompany, 
    manifestationVineyard, 
    saleCompany, 
    saleVineyard,
    decayRate = 0.995 
  } = options;

  const prestige: FeatureConfig['effects']['prestige'] = {};

  if (manifestationCompany || manifestationVineyard) {
    prestige.onManifestation = {};
    
    if (manifestationCompany) {
      prestige.onManifestation.company = {
        calculation: 'dynamic',
        baseAmount: manifestationCompany.baseAmount,
        scalingFactors: {
          batchSizeWeight: 1.0,
          qualityWeight: 1.0,
          prestigeWeight: 1.0
        },
        decayRate,
        maxImpact: manifestationCompany.maxImpact
      };
    }
    
    if (manifestationVineyard) {
      prestige.onManifestation.vineyard = {
        calculation: 'dynamic',
        baseAmount: manifestationVineyard.baseAmount,
        scalingFactors: {
          batchSizeWeight: 1.0,
          qualityWeight: 1.0,
          prestigeWeight: 1.0
        },
        decayRate,
        maxImpact: manifestationVineyard.maxImpact
      };
    }
  }

  if (saleCompany || saleVineyard) {
    prestige.onSale = {};
    
    if (saleCompany) {
      prestige.onSale.company = {
        calculation: 'dynamic',
        baseAmount: saleCompany.baseAmount,
        scalingFactors: {
          volumeWeight: 1.0,
          valueWeight: 1.0,
          prestigeWeight: 1.0
        },
        decayRate,
        maxImpact: saleCompany.maxImpact
      };
    }
    
    if (saleVineyard) {
      prestige.onSale.vineyard = {
        calculation: 'dynamic',
        baseAmount: saleVineyard.baseAmount,
        scalingFactors: {
          volumeWeight: 1.0,
          valueWeight: 1.0,
          prestigeWeight: 1.0
        },
        decayRate,
        maxImpact: saleVineyard.maxImpact
      };
    }
  }

  return prestige;
}

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
  LATE_HARVEST_FEATURE,       // Triggered behavior
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
 * Get features that use time-based behavior (evolving or accumulation)
 * Called by game tick system
 */
export function getTimeBasedFeatures(): FeatureConfig[] {
  return ACTIVE_FEATURES.filter(
    config => config.behavior === 'evolving' || config.behavior === 'accumulation'
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

