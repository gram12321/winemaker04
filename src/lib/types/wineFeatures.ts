// Wine Features Framework - Redesigned Type Definitions
// Simplified system with three clear feature types: Evolving, Triggered, Accumulation

import { WineBatchState, WineCharacteristics, CustomerType } from './types';

// ===== CORE FEATURE TYPES =====

export type FeatureBehavior = 'evolving' | 'triggered' | 'accumulation';

/**
 * Wine Feature - represents a single feature or fault on a wine batch
 * Stored in WineBatch.features as JSONB array
 */
export interface WineFeature {
  id: string;              // 'oxidation', 'green_flavor', 'terroir', etc.
  isPresent: boolean;      // Has the feature manifested?
  severity: number;        // 0-1 scale (affects effects intensity)
  risk?: number;           // 0-1 scale, probability (only for accumulation features)
  
  // Metadata (cached from config for performance)
  name: string;
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
  icon: string;
  description: string;
  
  // Behavior Type
  behavior: FeatureBehavior;
  
  // Behavior-specific configuration
  behaviorConfig: EvolvingConfig | TriggeredConfig | AccumulationConfig;
  
  // Effects
  effects: FeatureEffects;
  
  // Customer Perception
  customerSensitivity: Record<CustomerType, number>;
  
  // UI Display
  displayPriority: number;  // Display order (1 = most important)
  badgeColor: 'destructive' | 'warning' | 'info' | 'success';
  
  // Contextual Tips (optional)
  tips?: Array<{
    triggerEvent: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
    message: string;
  }>;
  
  // Custom Tooltip Content (optional)
  // If provided, generates dynamic tooltip content based on feature state
  // If not provided, uses default tooltip (name + description)
  tooltip?: (severity: number) => string;
  
  // Risk Display Configuration (optional)
  riskDisplay?: {
    // How to display risk in main UI (vineyard/winery views)
    showAsRange?: boolean;  // true = show min-max range, false = show single current value
    
    // Custom function to generate option combinations for tooltip display
    // If not provided, uses default behavior based on event type
    customOptionCombinations?: (event: 'harvest' | 'crushing' | 'fermentation' | 'bottling') => any[];
  };
}

// ===== BEHAVIOR CONFIGURATIONS =====

/**
 * Evolving features are always present (manifested) but may be passive (severity = 0)
 * They grow severity over time and may spawn active (terroir) or passive (bottle aging before bottling)
 */
export interface EvolvingConfig {
  spawnActive: boolean;  // true = spawn with severity > 0 (terroir), false = spawn passive (bottle aging)
  
  // Severity growth configuration
  severityGrowth: {
    rate: number;                                    // Base growth rate per week
    cap: number;                                    // Maximum severity (0-1)
    stateMultipliers?: Record<WineBatchState, number | ((batch: any) => number)>;  // State-based growth rates
  };
}

/**
 * Triggered features only manifest when triggered by events
 * Risk is calculated dynamically based on context parameters
 */
export interface TriggeredConfig {
  eventTriggers: Array<{
    event: 'harvest' | 'crushing' | 'fermentation' | 'bottling';
    condition: (context: any) => boolean;           // When does this trigger?
    riskIncrease: number | ((context: any) => number);  // Risk from this event
  }>;
}

/**
 * Accumulation features accumulate compound risk over time
 * Risk compounds weekly until manifesting
 */
export interface AccumulationConfig {
  baseRate: number;  // Base weekly risk increase
  
  // When does accumulation start?
  spawnActive: boolean;  // true = spawn active when triggered by event, false = spawn passive
  spawnEvent?: 'harvest' | 'crushing' | 'fermentation' | 'bottling';  // Which event triggers the spawn
  
  // Risk multipliers and modifiers
  stateMultipliers?: Record<WineBatchState, number | ((batch: any) => number)>;
  manifestationMultipliers?: Record<WineBatchState, number | ((batch: any) => number)>;
  riskModifiers?: Array<{
    source: 'vineyard' | 'batch' | 'options';
    parameter: string;  // e.g., 'ripeness', 'fragile', 'pressingIntensity'
    multiplier: number | ((context: any) => number);
  }>;
  
  compound: boolean;  // If true, risk accelerates: rate × (1 + currentRisk)
}

// ===== EFFECTS CONFIGURATION =====

/**
 * Combined feature effects on quality, price, characteristics, and prestige
 */
export interface FeatureEffects {
  // Quality impact
  quality?: {
    type: 'linear' | 'power' | 'bonus' | 'custom';
    amount?: number | ((severity: number) => number);
    exponent?: number;  // For power function
    basePenalty?: number;  // For power function
    calculate?: (quality: number, severity: number, context?: any) => number;  // Custom calculation
  };
  
  // Price impact
  price?: {
    type: 'customer_sensitivity' | 'direct_multiplier' | 'premium';
    multiplier?: number;
    premiumPercentage?: number | ((severity: number) => number);
  };
  
  // Characteristic modifications
  characteristics?: Array<{
    characteristic: keyof WineCharacteristics;
    modifier: number | ((severity: number) => number);
  }>;
  
  // Prestige impact
  prestige?: PrestigeEffects;
}

/**
 * Prestige effects configuration
 * Simplified from previous complex structure
 */
export interface PrestigeEffects {
  // Prestige when feature manifests (appears)
  onManifestation?: {
    company?: PrestigeConfig;
    vineyard?: PrestigeConfig;
  };
  
  // Prestige when selling affected wine
  onSale?: {
    company?: PrestigeConfig;
    vineyard?: PrestigeConfig;
  };
}

/**
 * Prestige calculation configuration
 * Supports both fixed amounts and dynamic scaling
 */
export interface PrestigeConfig {
  calculation: 'fixed' | 'dynamic';
  baseAmount: number;  // Base prestige amount
  
  // Scaling factors for dynamic calculations
  scalingFactors?: {
    // For company/vineyard level
    volumeWeight?: number;        // Bottle count weight (log scaling)
    valueWeight?: number;         // Sale value weight (log scaling)
    prestigeWeight?: number;      // Current prestige weight (sqrt scaling)
    
    // For batch/vineyard level
    batchSizeWeight?: number;     // Batch size weight (log scaling)
    qualityWeight?: number;       // Grape quality weight (linear)
  };
  
  decayRate: number;    // Weekly decay rate
  maxImpact?: number;   // Cap for very large events
}

// ===== HELPER TYPES =====

/**
 * Risk modifier context for accumulation features
 */
export interface RiskModifierContext {
  vineyard?: any;
  batch?: any;
  options?: any;
}

/**
 * Feature impact calculation result
 */
export interface FeatureImpact {
  featureId: string;
  featureName: string;
  icon: string;
  severity: number;
  qualityImpact: number;
  characteristicModifiers: Partial<Record<keyof WineCharacteristics, number>>;
  description: string;
}

/**
 * Feature risk info for display
 */
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
