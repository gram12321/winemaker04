import { FeatureConfig } from '../../types/wineFeatures';

/**
 * Grey Rot Feature
 * - Behavior: Conditional Accumulation (only accumulates if Noble Rot is present)
 * - Effect: Negative effects (quality penalty, price reduction, extreme sweetness/acidity)
 * 
 * Risk Accumulation:
 * - Risk only starts accumulating once Noble Rot manifests
 * - Accumulation rate increases over time (faster than Noble Rot evolution)
 * - Accumulates while Noble Rot is present and grapes are not harvested
 * 
 * Manifestation:
 * - Manifests based on accumulated risk probability
 * - When manifested, applies 100% severity effects
 * - Stops Noble Rot evolution once manifested
 * 
 * Effects:
 * - Quality penalty (significant)
 * - Price reduction
 * - Extreme sweetness boost (large, breaks balance)
 * - Extreme acidity reduction (large, breaks balance)
 */
export const GREY_ROT_FEATURE: FeatureConfig = {
  id: 'grey_rot',
  name: 'Grey Rot',
  icon: '🦠',
  description: 'Botrytis cinerea that has progressed too far, causing quality degradation. Extreme sugar concentration and acidity loss break wine balance.',
  
  behavior: 'accumulation',
  
  behaviorConfig: {
    baseRate: 0.05,    // 5% per week base rate (faster than Noble Rot evolution)
    compound: true,    // Risk accelerates: rate × (1 + currentRisk)
    spawnActive: false, // Does not spawn automatically
    spawnEvent: undefined, // Spawns conditionally (only if Noble Rot present)
    
    // Conditional accumulation: only accumulates if Noble Rot is present
    conditionalAccumulation: {
      requiresFeature: 'noble_rot', // Only accumulates if this feature is present
      requiresFeaturePresent: true  // Feature must be manifested (not just risk)
    },
    
    stateMultipliers: {
      'grapes': 1.0,         // Accumulates while grapes are unprocessed
      'must_ready': 0.0,     // Stops once pressed into must
      'must_fermenting': 0.0, // No growth during fermentation
      'bottled': 0.0         // No growth after bottling
    },
    
    // Manifestation: always hits with 100% severity (not graduated)
    severityFromRisk: false  // Always manifests at 100% severity (not graduated like Noble Rot)
  },
  
  effects: {
    quality: {
      type: 'linear',
      amount: -0.30  // 30% quality penalty at 100% severity
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      {
        characteristic: 'sweetness',
        modifier: 0.60  // +60% sweetness (extreme, breaks balance)
      },
      { 
        characteristic: 'acidity', 
        modifier: -0.60  // -60% acidity (extreme, breaks balance)
      },
      {
        characteristic: 'aroma',
        modifier: -0.15  // -15% aroma (off-flavors)
      }
    ]
  },
  
  customerSensitivity: {
    'Restaurant': 0.80,        // -20% penalty
    'Wine Shop': 0.75,         // -25% penalty
    'Private Collector': 0.60, // -40% penalty (collectors hate faults)
    'Chain Store': 0.85        // -15% penalty
  },
  
  displayPriority: 1,  // Show first (serious fault)
  badgeColor: 'destructive',
  
  // Feature interaction: stops Noble Rot evolution
  stopsEvolutionOf: ['noble_rot'],

  processVineyardFeatures: (features, _vineyard, _gameState) => {
    let greyRotFeature = features.find(f => f.id === 'grey_rot');
    if (!greyRotFeature) {
      greyRotFeature = {
        id: GREY_ROT_FEATURE.id,
        name: GREY_ROT_FEATURE.name,
        icon: GREY_ROT_FEATURE.icon,
        isPresent: false,
        severity: 0,
        risk: 0
      };
      features = [...features, greyRotFeature];
    }

    const nobleRotFeature = features.find(f => f.id === 'noble_rot' && f.isPresent);

    if (!nobleRotFeature || !nobleRotFeature.isPresent) {
      if (greyRotFeature.risk && greyRotFeature.risk > 0) {
        const updated = [...features];
        const index = updated.findIndex(f => f.id === 'grey_rot');
        updated[index] = { ...greyRotFeature, risk: greyRotFeature.risk };
        return updated;
      }
      return features;
    }

    const accumulationConfig = GREY_ROT_FEATURE.behaviorConfig as any;
    const baseRate = accumulationConfig.baseRate || 0.05;

    const currentRisk = greyRotFeature.risk || 0;

    const severityFactor = Math.max(0.25, nobleRotFeature.severity || 0);
    const compoundMultiplier = accumulationConfig.compound ? (1 + currentRisk) : 1;
    const weeklyIncrease = baseRate * severityFactor * compoundMultiplier;

    const newRisk = Math.min(1, currentRisk + weeklyIncrease);

    const manifests = newRisk >= 1 || Math.random() < newRisk;

    let updatedGreyRot: typeof greyRotFeature = {
      ...greyRotFeature,
      risk: newRisk
    };

    if (manifests) {
      updatedGreyRot = {
        ...updatedGreyRot,
        isPresent: true,
        severity: 1.0,
        risk: newRisk
      };
    }

    const index = features.findIndex(f => f.id === 'grey_rot');
    if (index >= 0) {
      const updated = [...features];
      updated[index] = updatedGreyRot;
      return updated;
    }

    return [...features, updatedGreyRot];
  }
};

/**
 * Grey Rot feature constants
 * Exported for reference and balance tuning
 */
export const GREY_ROT_CONSTANTS = {
  // Accumulation rates
  BASE_RATE: 0.05,     // 5% per week base rate
  COMPOUND: true,      // Risk accelerates
  
  // Characteristic modifiers (at 100% severity)
  SWEETNESS_BOOST: 0.60,    // +60% sweetness (extreme)
  ACIDITY_REDUCTION: 0.60,  // -60% acidity (extreme)
  AROMA_PENALTY: 0.15,      // -15% aroma
  QUALITY_PENALTY: 0.30     // -30% quality
} as const;

