// Oxidation Feature Configuration
// First implementation of the Wine Features Framework

import { FeatureConfig } from '../../types/wineFeatures';

/**
 * Oxidation Feature
 * - Type: Fault (negative)
 * - Manifestation: Binary (0% → 100% instant)
 * - Trigger: Time-based (weekly accumulation)
 * - Compound: Yes (risk accelerates with current risk)
 * - Activity-Aware: Fermentation method influences oxidation risk
 *   - Temperature Controlled: 40% less risk (sealed tanks)
 *   - Extended Maceration: 40% more risk (oxygen exposure)
 *   - Basic: Standard fermentation protection
 */
export const OXIDATION_FEATURE: FeatureConfig = {
  id: 'oxidation',
  name: 'Oxidation',
  type: 'fault',
  icon: '⚠️',
  description: 'Wine exposed to oxygen, resulting in flavor degradation and browning. Risk influenced by fermentation method.',
  
  manifestation: 'binary',  // Jumps from 0% to 100% severity
  
  riskAccumulation: {
    trigger: 'time_based',
    baseRate: 0.002,          // 0.2% per week base rate
    stateMultipliers: {
      'grapes': 3.0,         // Fresh grapes highly exposed to air
      'must_ready': 1.5,     // Exposed must has moderate risk
      'must_fermenting': (batch) => {
        // Base protection from CO2 during fermentation
        let multiplier = 0.8;
        
        // Fermentation method modifies oxidation risk
        const method = batch.fermentationOptions?.method;
        if (method === 'Temperature Controlled') {
          // Temperature controlled = sealed tanks, better protection
          multiplier *= 0.6;  // 40% less oxidation risk (final: 0.48)
        } else if (method === 'Extended Maceration') {
          // Extended skin contact = more oxygen exposure
          multiplier *= 1.4;  // 40% more oxidation risk (final: 1.12)
        }
        // 'Basic' fermentation uses base multiplier (0.8)
        
        return multiplier;
      },
      'bottled': 0.3         // Sealed environment greatly reduces risk
    },
    compoundEffect: true     // Risk accelerates: rate × (1 + currentRisk)
  },
  
  effects: {
    quality: {
      type: 'power',
      exponent: 1.5,         // Premium wines (high quality) hit harder
      basePenalty: 0.25      // 25% base reduction
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      { characteristic: 'aroma', modifier: -0.20 },    // Fresh fruit → nutty/sherry
      { characteristic: 'acidity', modifier: -0.12 },  // Flattened acidity
      { characteristic: 'body', modifier: -0.08 },     // Thinner structure
      { characteristic: 'sweetness', modifier: +0.08 } // Relative increase from acid loss
    ],
    prestige: {
      onManifestation: {
        company: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.05,  // Company scandal when oxidation manifests
          scalingFactors: {
            batchSizeWeight: 1.0,         // Larger batches hurt more
            qualityWeight: 1.0,            // Premium wine oxidizing is worse
            companyPrestigeWeight: 1.0     // Higher prestige = bigger fall
          },
          decayRate: 0.995,   // Decays over ~20 years (1040 weeks)
          maxImpact: -5.0     // Cap for company manifestation events
        },
        vineyard: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.5,  // Base scandal amount
          scalingFactors: {
            batchSizeWeight: 1.0,         // Larger batches hurt more
            qualityWeight: 1.0,            // Premium wine oxidizing is worse
            vineyardPrestigeWeight: 1.0    // Premium vineyards held to higher standard
          },
          decayRate: 0.98,    // Decays over ~3 years (156 weeks)
          maxImpact: -10.0    // Cap at -10 prestige for massive batches
        }
      },
      onSale: {
        company: {
          calculation: 'dynamic_sale',
          baseAmount: -0.1,  // Base scandal amount
          scalingFactors: {
            volumeWeight: 1.0,             // More bottles = bigger scandal
            valueWeight: 1.0,              // Higher value = bigger scandal
            companyPrestigeWeight: 1.0     // Higher prestige = bigger fall
          },
          decayRate: 0.995,   // Decays over ~20 years (1040 weeks)
          maxImpact: -10.0    // Cap at -10 prestige for massive sales
        },
        vineyard: {
          calculation: 'dynamic_sale',
          baseAmount: -0.2,  // Vineyard scandal when selling oxidized wine
          scalingFactors: {
            volumeWeight: 1.0,             // More bottles = bigger scandal
            valueWeight: 1.0,              // Higher value = bigger scandal
            vineyardPrestigeWeight: 1.0    // Higher prestige = bigger fall
          },
          decayRate: 0.98,    // Decays over ~3 years (156 weeks)
          maxImpact: -8.0     // Cap for vineyard sale events
        }
      }
    }
  },
  
  customerSensitivity: {
    'Restaurant': 0.85,        // -15% extra penalty
    'Wine Shop': 0.80,         // -20% extra penalty
    'Private Collector': 0.60, // -40% extra penalty (collectors HATE flaws!)
    'Chain Store': 0.90        // -10% extra penalty (bulk buyers less picky)
  },
  
  ui: {
    badgeColor: 'destructive',
    warningThresholds: [0.10, 0.20, 0.40],  // 10%, 20%, 40% risk warnings
    sortPriority: 1  // Show first (most serious fault)
  },
  
  harvestContext: {
    isHarvestRisk: false,        // Oxidation is not a harvest risk (time-based)
    isHarvestInfluence: false    // Not a harvest influence
  }
};

/**
 * Customer oxidation sensitivity constants
 * Exported separately for use in sales/pricing services
 */
export const CUSTOMER_OXIDATION_SENSITIVITY = OXIDATION_FEATURE.customerSensitivity;

/**
 * Oxidation quality penalty parameters
 * Exported for testing and balance tuning
 */
export const OXIDATION_QUALITY_PENALTY = {
  EXPONENT: 1.5,
  BASE_PENALTY: 0.25
} as const;

/**
 * Oxidation prestige decay rates
 * Exported for reference and documentation
 */
export const OXIDATION_PRESTIGE_DECAY = {
  COMPANY: 0.995,  // ~20 years (1040 weeks)
  VINEYARD: 0.98   // ~3 years (156 weeks)
} as const;

