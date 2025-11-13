import { FeatureConfig, WineFeature } from '../../types/wineFeatures';
import { Vineyard } from '../../types/types';

const clampWeek = (week: number, min: number, max: number): number => {
  if (!Number.isFinite(week)) return min;
  return Math.max(min, Math.min(max, week));
};

const calculateLatenessFactor = (season: string, week: number): number => {

  if (season === 'Fall') {
    if (week < NOBLE_ROT_CONSTANTS.FALL_LATE_START) {
      return 0;
    }
    const clampedWeek = clampWeek(week, NOBLE_ROT_CONSTANTS.FALL_LATE_START, NOBLE_ROT_CONSTANTS.FALL_LATE_END);
    const progress = (clampedWeek - NOBLE_ROT_CONSTANTS.FALL_LATE_START) /
      (NOBLE_ROT_CONSTANTS.FALL_LATE_END - NOBLE_ROT_CONSTANTS.FALL_LATE_START);
    return Math.min(0.5, progress * 0.5);
  }

  if (season === 'Winter') {
    const clampedWeek = clampWeek(week, 1, NOBLE_ROT_CONSTANTS.WINTER_LATE_END);
    const progress = (clampedWeek - 1) / (NOBLE_ROT_CONSTANTS.WINTER_LATE_END - 1 || 1);
    return Math.min(1.0, 0.5 + progress * 0.5);
  }

  return 0;
};

/**
 * Noble Rot Feature
 * - Behavior: Accumulation + Evolving (risk accumulates linearly during late harvest, manifests probabilistically, then evolves)
 * - Effect: Positive effects (quality bonus, price premium, sweetness boost, acidity reduction)
 * 
 * Risk Accumulation:
 * - Risk accumulates linearly (not compound) during late harvest periods (Fall week 7+, Winter)
 * - Simple accumulation: newRisk = currentRisk + weeklyRiskIncrease
 * - Weekly risk increase based on lateness factor (how late in the season)
 * - Manifests based on risk probability
 * - Initial severity = risk% when manifested
 * 
 * Evolution:
 * - Evolves before harvest (tracked on Vineyard as pendingFeatures)
 * - Continues evolving after harvest while batch.state === 'grapes'
 * - Severity increases weekly (faster than risk accumulation)
 * - Triggers Grey Rot risk accumulation once manifested
 * 
 * Effects:
 * - Quality bonus (scales with severity)
 * - Price premium for dessert wine lovers
 * - Sweetness boost (small, <0.2 typically good for balance)
 * - Acidity reduction (small, <0.2 typically good for balance)
 */
export const NOBLE_ROT_FEATURE: FeatureConfig = {
  id: 'noble_rot',
  name: 'Noble Rot',
  icon: '🍯',
  description: 'Botrytis cinerea fungus that dehydrates grapes, concentrating sugars and flavors. Desirable for dessert wines, but can turn into Grey Rot if left too long.',
  
  behavior: 'accumulation',
  
  behaviorConfig: {
    baseRate: 0.35,    // Calibrated base rate (scaled by lateness factor) to approach 100% by late winter
    compound: false,   // Not using compound formula, using custom exponential formula instead
    spawnActive: true, // Starts accumulating from late harvest periods
    spawnEvent: 'harvest',  // Triggered by harvest event (but accumulation happens before harvest via processVineyardFeatures)
    
    // State multipliers: only accumulate while in 'grapes' state (before processing)
    stateMultipliers: {
      'grapes': 1.0,         // Full accumulation while grapes are unprocessed
      'must_ready': 0.0,     // Stops accumulating once processed
      'must_fermenting': 0.0,
      'bottled': 0.0
    },
    
    // Evolution after manifestation
    severityFromRisk: true,  // Initial severity = risk% when manifested (graduated effects)
    canEvolveAfterManifestation: true, // Can evolve after manifestation
    evolutionRate: 0.08,     // 8% severity growth per week (faster than risk accumulation)
    evolutionCap: 1.0        // Can reach 100% severity
  },
  
  effects: {
    quality: {
      type: 'bonus',
      amount: (severity: number) => {
        // Quality bonus scales with severity: 0% at 0 severity, +15% at 100% severity
        return severity * 0.15;
      }
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      {
        characteristic: 'sweetness',
        modifier: (severity: number) => {
          // Sweetness boost: 0-20% based on severity (small, typically good)
          return severity * 0.20;
        }
      },
      { 
        characteristic: 'acidity', 
        modifier: (severity: number) => {
          // Acidity reduction: 0-20% based on severity (small, typically good)
          return -(severity * 0.20);
        }
      },
      {
        characteristic: 'aroma',
        modifier: (severity: number) => {
          // Aroma enhancement: 0-10% based on severity
          return severity * 0.10;
        }
      }
    ]
  },
  
  customerSensitivity: {
    'Restaurant': 1.05,        // +5% premium (dessert wines)
    'Wine Shop': 1.10,         // +10% premium
    'Private Collector': 1.20, // +20% premium (dessert wine lovers)
    'Chain Store': 1.0         // No premium
  },
  
  displayPriority: 2,  // Show after faults but before neutral features
  badgeColor: 'success', // Positive feature
  
  // Risk Display Configuration
  riskDisplay: {
    showAsRange: false  // Show single current value instead of range
  },
  
  // Vineyard Processing: Handle risk accumulation and evolution before harvest
  // This is needed because accumulation happens on vineyards (before batch exists)
  // and needs to be conditional on game date (late harvest periods)
  processVineyardFeatures: (
    features: WineFeature[],
    _vineyard: Vineyard,
    gameState: { season: string; week: number; year: number }
  ): WineFeature[] => {
    const accumulationConfig = NOBLE_ROT_FEATURE.behaviorConfig as any;
    const { season, week } = gameState;
    
    // Check if we're in late harvest period
    const isLateHarvest = (season === 'Fall' && week >= NOBLE_ROT_CONSTANTS.FALL_LATE_START) || season === 'Winter';
    
    if (!isLateHarvest) {
      return features; // No processing outside late harvest period
    }
    
    // Find or create Noble Rot feature
    let nobleRotFeature = features.find(f => f.id === 'noble_rot');
    if (!nobleRotFeature) {
      // Create new feature instance
      nobleRotFeature = {
        id: NOBLE_ROT_FEATURE.id,
        isPresent: false,
        severity: 0,
        risk: 0,
        name: NOBLE_ROT_FEATURE.name,
        icon: NOBLE_ROT_FEATURE.icon
      };
      features = [...features, nobleRotFeature];
    }
    
    // If already manifested, evolve it (severity increases)
    if (nobleRotFeature.isPresent) {
      const evolutionRate = NOBLE_ROT_CONSTANTS.EVOLUTION_RATE;
      const evolutionCap = NOBLE_ROT_CONSTANTS.EVOLUTION_CAP;
      const newSeverity = Math.min(evolutionCap, nobleRotFeature.severity + evolutionRate);
      
      nobleRotFeature = {
        ...nobleRotFeature,
        severity: newSeverity
      };
      
      // Update feature in array
      const index = features.findIndex(f => f.id === 'noble_rot');
      if (index >= 0) {
        const updated = [...features];
        updated[index] = nobleRotFeature;
        return updated;
      }
      return features;
    }
    
    // If not manifested, accumulate risk exponentially
    const latenessFactor = calculateLatenessFactor(season, week);
    const baseRate = accumulationConfig.baseRate || 0.35;
    
    // Weekly risk increase scales with lateness (how late in the season)
    // latenessFactor: 0.0 (early Fall week 7) to 1.0 (late Winter week 12)
    // This makes risk accumulate faster as the season progresses
    const baseWeeklyRate = baseRate * latenessFactor;
    
    // Exponential accumulation: risk grows faster as it increases
    // Formula: newRisk = 1 - (1 - currentRisk) * exp(-baseWeeklyRate)
    // This gives exponential growth from 0 to 1, starting slow and accelerating
    const currentRisk = nobleRotFeature.risk || 0;
    const exponentialGrowth = 1 - (1 - currentRisk) * Math.exp(-baseWeeklyRate);
    const newRisk = Math.min(1.0, exponentialGrowth);
    
    // Check for manifestation (probability-based)
    // At 100% risk, always manifest (deterministic)
    const manifested = newRisk >= 1.0 || Math.random() < newRisk;
    
    if (manifested) {
      // Manifest with severity = risk (graduated effects based on when it manifests)
      nobleRotFeature = {
        ...nobleRotFeature,
        isPresent: true,
        severity: newRisk, // Initial severity = risk% (graduated)
        risk: newRisk
      };
    } else {
      nobleRotFeature = {
        ...nobleRotFeature,
        risk: newRisk
      };
    }
    
    // Update feature in array
    const index = features.findIndex(f => f.id === 'noble_rot');
    if (index >= 0) {
      const updated = [...features];
      updated[index] = nobleRotFeature;
      return updated;
    }
    return [...features, nobleRotFeature];
  }
};

/**
 * Noble Rot feature constants
 * Exported for reference and balance tuning
 */
export const NOBLE_ROT_CONSTANTS = {
  // Harvest timing thresholds
  FALL_LATE_START: 7,        // Week 7 of Fall = start of late harvest
  FALL_LATE_END: 12,         // Week 12 of Fall = maximum Fall lateness
  WINTER_LATE_END: 12,       // Week 12 of Winter = maximum Winter lateness
  
  // Evolution rates
  EVOLUTION_RATE: 0.08,      // 8% severity growth per week
  EVOLUTION_CAP: 1.0,        // Maximum severity (100%)
  
  // Characteristic modifiers
  SWEETNESS_BOOST: { min: 0.0, max: 0.20 },   // 0-20% sweetness increase
  ACIDITY_REDUCTION: { min: 0.0, max: 0.20 },  // 0-20% acidity decrease
  AROMA_BOOST: { min: 0.0, max: 0.10 },        // 0-10% aroma increase
  QUALITY_BONUS: { min: 0.0, max: 0.15 }       // 0-15% quality bonus
} as const;

