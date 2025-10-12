// Wine Features Framework - Core Type Definitions
// Generic system for managing wine faults (oxidation, green flavor) and positive features (terroir)

import { WineBatchState, WineCharacteristics, CustomerType } from './types';

// ===== CORE FEATURE TYPES =====

export type FeatureType = 'fault' | 'feature';
export type ManifestationType = 'binary' | 'graduated';
export type TriggerType = 'time_based' | 'event_triggered' | 'hybrid';

/**
 * Wine Feature - represents a single feature or fault on a wine batch
 * Stored in WineBatch.features as JSONB array
 */
export interface WineFeature {
  id: string;              // 'oxidation', 'green_flavor', 'terroir', etc.
  risk: number;            // 0-1 scale, probability of occurrence/growth
  isPresent: boolean;      // Has the feature manifested?
  severity: number;        // 0-1 scale (1.0 for binary, variable for graduated)
  
  // Metadata (cached from config for performance)
  name: string;
  type: FeatureType;
  icon: string;
}

// ===== FEATURE CONFIGURATION TYPES =====

/**
 * Complete configuration for a wine feature
 * Defines how the feature behaves, accumulates risk, and affects wine
 */
export interface FeatureConfig {
  // Identity
  id: string;
  name: string;
  type: FeatureType;
  icon: string;
  description: string;
  
  // Risk & Manifestation
  manifestation: ManifestationType;
  riskAccumulation: RiskAccumulationConfig;
  
  // Effects
  effects: FeatureEffects;
  
  // Customer Perception
  customerSensitivity: Record<CustomerType, number>;
  
  // UI
  ui: FeatureUIConfig;
  
  // Harvest context
  harvestContext?: HarvestContextConfig;
}

/**
 * Risk accumulation configuration
 * Supports time-based (weekly), event-triggered, or hybrid accumulation
 */
export interface RiskAccumulationConfig {
  trigger: TriggerType;
  
  // For time-based accumulation (like oxidation)
  baseRate?: number;               // Per game tick (week)
  stateMultipliers?: Record<WineBatchState, number | ((batch: any) => number)>;  // Can be number or function for activity-aware multipliers
  compoundEffect?: boolean;        // Risk accelerates with current risk
  
  // For event-triggered (like green flavor from crushing)
  eventTriggers?: Array<{
    event: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
    condition: (context: any) => boolean;
    riskIncrease: number | ((context: any) => number);
  }>;
  
  // Severity progression (for graduated features)
  severityGrowth?: {
    rate: number;                  // Per game tick
    cap: number;                   // Maximum severity (0-1)
    stateMultipliers?: Record<WineBatchState, number>; // State-based growth rates
  };
}

/**
 * Risk accumulation strategy types - inferred from existing config parameters
 */
export type RiskAccumulationStrategy = 'independent' | 'cumulative' | 'severity_growth';

/**
 * Infer risk accumulation strategy from existing config parameters
 */
export function inferRiskAccumulationStrategy(config: RiskAccumulationConfig): RiskAccumulationStrategy {
  // If has severityGrowth, it's severity_growth pattern
  if (config.severityGrowth) {
    return 'severity_growth';
  }
  
  // If has eventTriggers but no baseRate, it's independent events
  if (config.eventTriggers && config.eventTriggers.length > 0 && !config.baseRate) {
    return 'independent';
  }
  
  // If has baseRate or compoundEffect, it's cumulative
  if (config.baseRate || config.compoundEffect) {
    return 'cumulative';
  }
  
  // Default fallback
  return 'cumulative';
}

/**
 * Feature effects on wine quality, price, characteristics, and prestige
 */
export interface FeatureEffects {
  // Quality impact
  quality: QualityEffect;
  
  // Price impact (via customer sensitivity)
  price: PriceEffect;
  
  // Characteristic modifications (for future Wine Influences system)
  characteristics?: Array<{
    characteristic: keyof WineCharacteristics;
    modifier: number | ((severity: number) => number);
  }>;
  
  // Prestige impact
  prestige?: {
    onManifestation?: PrestigeImpact;  // When feature appears
    onSale?: PrestigeImpact;            // When selling affected wine
  };
}

/**
 * Quality effect configuration
 * Supports multiple calculation types for flexibility
 */
export interface QualityEffect {
  type: 'power' | 'linear' | 'custom' | 'bonus';
  
  // For power function (premium wines hit harder)
  exponent?: number;
  basePenalty?: number;
  amount?: number | ((severity: number) => number);
  calculate?: (quality: number, severity: number, proneToOxidation?: number) => number;
}

/**
 * Price effect configuration
 * Customer sensitivity is primary mechanism
 */
export interface PriceEffect {
  type: 'customer_sensitivity' | 'direct_multiplier' | 'premium';
  multiplier?: number;
  premiumPercentage?: number | ((severity: number) => number);
}

/**
 * Prestige calculation types
 * - fixed: Static amount (simple)
 * - dynamic_sale: Scales with sale volume, value, and company prestige
 * - dynamic_manifestation: Scales with batch size, quality, and vineyard prestige
 */
export type PrestigeCalculationType = 'fixed' | 'dynamic_sale' | 'dynamic_manifestation';

/**
 * Prestige impact configuration for a single level (company or vineyard)
 * Supports both fixed amounts and dynamic calculations
 */
export interface PrestigeImpactConfig {
  calculation: PrestigeCalculationType;
  baseAmount: number;  // Base scandal/achievement amount
  
  // Scaling factors for dynamic calculations
  scalingFactors?: {
    // For dynamic_sale (company level)
    volumeWeight?: number;        // How much bottle count matters (log scaling)
    valueWeight?: number;          // How much sale value matters (log scaling)
    companyPrestigeWeight?: number; // How much current prestige matters (sqrt scaling)
    
    // For dynamic_manifestation (vineyard level)
    batchSizeWeight?: number;      // How much batch size matters (log scaling)
    qualityWeight?: number;         // How much wine quality matters (linear)
    vineyardPrestigeWeight?: number; // How much vineyard prestige matters (sqrt scaling)
  };
  
  decayRate: number;
  maxImpact?: number;  // Cap for very large scandals/achievements (default: -10 or +10)
}

/**
 * Prestige impact configuration
 * Separate company and vineyard impacts with dynamic calculation support
 */
export interface PrestigeImpact {
  company?: PrestigeImpactConfig;
  vineyard?: PrestigeImpactConfig;
}

/**
 * UI configuration for feature display
 */
export interface FeatureUIConfig {
  badgeColor: 'destructive' | 'warning' | 'info' | 'success';
  warningThresholds?: number[];    // Risk thresholds for warnings
  sortPriority: number;             // Display order (1 = most important)
}

/**
 * Harvest context configuration for features
 */
export interface HarvestContextConfig {
  isHarvestRisk?: boolean;     // True if this is a risk during harvest (like green flavor)
  isHarvestInfluence?: boolean; // True if this is an influence during harvest (like terroir)
}

// ===== HELPER TYPES =====

/**
 * Feature creation helper
 * Used when initializing new features on wine batches
 */
export interface CreateFeatureOptions {
  id: string;
  config: FeatureConfig;
  initialRisk?: number;
  isPresent?: boolean;
  severity?: number;
}

