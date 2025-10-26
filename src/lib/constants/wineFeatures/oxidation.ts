import { FeatureConfig } from '../../types/wineFeatures';

/**
 * Oxidation Feature
 * - Type: Fault (negative)
 * - Manifestation: Binary (0% → 100% instant)
 * - Trigger: Hybrid (time-based + event-triggered)
 * - Compound: Yes (risk accelerates with current risk)
 * 
 * Time-based accumulation:
 * - Weekly risk based on wine state (grapes most vulnerable, bottled least)
 * - Fermentation method influences risk (Temperature Controlled = less, Extended Maceration = more)
 * - Compound effect: risk accelerates over time
 * 
 * Event-triggered accumulation:
 * - Crushing fragile grapes with high pressure increases oxidation risk
 * - Delicate grapes bruise easily, exposing juice to oxygen
 * 
 * Grape-specific modifiers:
 * - proneToOxidation: Scales all oxidation risk (both time-based and event)
 * - fragile: Scales crushing oxidation risk (bruising = oxygen exposure)
 */
export const OXIDATION_FEATURE: FeatureConfig = {
  id: 'oxidation',
  name: 'Oxidation',
  type: 'fault',
  icon: '⚠️',
  description: 'Wine exposed to oxygen, resulting in flavor degradation and browning. Risk influenced by fermentation method.',
  
  manifestation: 'binary',  // Jumps from 0% to 100% severity
  
  riskAccumulation: {
    trigger: 'hybrid',  // Both time-based and event-triggered
    baseRate: 0.002,    // 0.2% per week base rate
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
    compoundEffect: true,    // Risk accelerates: rate × (1 + currentRisk)
    
    // Event-triggered oxidation from crushing fragile grapes
    eventTriggers: [
      {
        event: 'crushing',
        condition: (context: { options: any; batch: any }) => {
          // Trigger for fragile grapes - delicate grapes bruise easily during crushing
          const { batch } = context;
          return (batch.fragile || 0) > 0.3;  // Only for moderately fragile+ grapes
        },
        riskIncrease: (context: { options: any; batch: any }) => {
          const { options, batch } = context;
          
          // Base risk from crushing fragile grapes
          // fragile = 0.3 → 1.5% risk, fragile = 1.0 → 5% base risk
          const fragile = batch.fragile || 0;
          const baseRisk = (fragile - 0.3) * 0.07;  // Scales from 0% to 5%
          
          // Pressing intensity multiplier (harder pressing = more bruising)
          // pressingIntensity: 0.0 (low) → 0.5x, 1.0 (high) → 1.5x
          const intensityMultiplier = 0.5 + options.pressingIntensity;
          
          // Grape's natural oxidation susceptibility
          const proneToOxidation = batch.proneToOxidation || 0.5;
          
          const finalRisk = baseRisk * intensityMultiplier * (0.5 + proneToOxidation);
          
          return Math.min(0.10, finalRisk);  // Cap at 10% max from crushing
        }
      }
    ]
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
  },
  
  // Risk display options - only show pressure range for oxidation
  riskDisplayOptions: {
    crushing: {
      optionCombinations: [
        { options: { pressingIntensity: 0.0, _isMin: true }, label: 'Pressure: 0% pressure' },
        { options: { pressingIntensity: 1.0, _isMax: true }, label: 'Pressure: 100% pressure' }
      ],
      groupBy: ['pressure-range']
    }
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

