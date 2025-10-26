import { FeatureConfig } from '../../types/wineFeatures';
import { WineBatch } from '../../types/types';

/**
 * Stuck Fermentation
 * 
 * A wine fault where yeast stops fermenting before completing sugar conversion
 * Caused by:
 * - Cool temperatures with red wines (tannins inhibit yeast activity)
 * - Extended maceration stress on yeast populations
 * - Temperature-method mismatches
 * 
 * Effects:
 * - Reduces quality significantly (incomplete fermentation)
 * - Increases sweetness (residual unfermented sugar)
 * - Reduces body (lower alcohol, less structure)
 * - Major customer rejection (serious fault)
 * 
 * Color-specific behavior:
 * - Red wines: High risk with cool temps (tannins + cold = yeast stress)
 * - White wines: Low risk overall (less tannin interference)
 */
export const STUCK_FERMENTATION_FEATURE: FeatureConfig = {
  id: 'stuck_fermentation',
  name: 'Stuck Fermentation',
  type: 'fault',
  icon: '🧊',
  description: 'Incomplete fermentation where yeast stops working, leaving residual sugar and lower alcohol',
  
  // Binary manifestation - either happens or not
  manifestation: 'binary',
  
  riskAccumulation: {
    trigger: 'event_triggered',
    baseRate: 0,  // No weekly accumulation
    compoundEffect: false,
    
    eventTriggers: [
      {
        event: 'fermentation',
        condition: () => true,  // Always evaluate (dynamic risk for all fermentation setups)
        riskIncrease: (context: { options: any; batch: WineBatch }) => {
          const { options, batch } = context;
          
          // Use context options if available (from modal), otherwise use batch options
          const method = options?.method || batch.fermentationOptions?.method;
          const temperature = options?.temperature || batch.fermentationOptions?.temperature;
          
          if (!method || !temperature) return 0;
          const isRed = batch.grapeColor === 'red';
          
          // Base risk by color (reds have higher base risk due to tannins)
          let baseRisk = isRed ? 0.08 : 0.03;  // 8% red, 3% white
          
          // Temperature multipliers (color-specific)
          let tempMultiplier = 1.0;
          if (isRed) {
            // Red wines: Cool temps are dangerous (tannins + cold = yeast stress)
            if (temperature === 'Cool') tempMultiplier = 2.5;      // 20% risk
            else if (temperature === 'Ambient') tempMultiplier = 1.0;  // 8% risk
            else if (temperature === 'Warm') tempMultiplier = 0.5;     // 4% risk
          } else {
            // White wines: More tolerant to cool temps, warm is slightly risky
            if (temperature === 'Cool') tempMultiplier = 0.8;      // 2.4% risk
            else if (temperature === 'Ambient') tempMultiplier = 1.0;  // 3% risk
            else if (temperature === 'Warm') tempMultiplier = 1.5;     // 4.5% risk
          }
          
          // Method multipliers (Extended Maceration stresses yeast)
          let methodMultiplier = 1.0;
          if (method === 'Extended Maceration' && isRed) {
            methodMultiplier = 1.5;  // More tannins = more stress
          } else if (method === 'Temperature Controlled') {
            methodMultiplier = 0.7;  // Better control = lower risk
          }
          
          const finalRisk = baseRisk * tempMultiplier * methodMultiplier;
          
          return Math.min(0.30, finalRisk);  // Cap at 30% max risk
        }
      }
    ]
  },
  
  effects: {
    quality: {
      type: 'linear',
      amount: -0.35  // 35% quality reduction (serious fault - incomplete fermentation)
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      { characteristic: 'sweetness', modifier: +0.25 },  // Residual sugar from incomplete fermentation
      { characteristic: 'body', modifier: -0.18 },       // Lower alcohol = less body
      { characteristic: 'aroma', modifier: -0.12 }       // Fermentation aromatics incomplete
    ],
    prestige: {
      onManifestation: {
        company: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.08,  // Serious fault (worse than green flavor)
          scalingFactors: {
            batchSizeWeight: 1.0,
            qualityWeight: 1.0,
            companyPrestigeWeight: 1.0
          },
          decayRate: 0.995,
          maxImpact: -4.0
        },
        vineyard: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.4,  // Vineyard scandal (technical failure)
          scalingFactors: {
            batchSizeWeight: 1.0,
            qualityWeight: 1.0,
            vineyardPrestigeWeight: 1.0
          },
          decayRate: 0.98,
          maxImpact: -9.0
        }
      },
      onSale: {
        company: {
          calculation: 'dynamic_sale',
          baseAmount: -0.08,
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.0,
            companyPrestigeWeight: 1.0
          },
          decayRate: 0.995,
          maxImpact: -9.0
        },
        vineyard: {
          calculation: 'dynamic_sale',
          baseAmount: -0.15,
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.0,
            vineyardPrestigeWeight: 1.0
          },
          decayRate: 0.98,
          maxImpact: -6.0
        }
      }
    }
  },
  
  // Customers very sensitive - stuck fermentation is a serious fault
  customerSensitivity: {
    'Restaurant': 0.75,        // -25% penalty
    'Wine Shop': 0.70,         // -30% penalty
    'Private Collector': 0.50, // -50% penalty (collectors hate technical faults)
    'Chain Store': 0.85        // -15% penalty (less discriminating)
  },
  
  ui: {
    badgeColor: 'destructive',
    warningThresholds: [0.10, 0.20],  // 10%, 20% risk warnings
    sortPriority: 3  // Show after oxidation (1) and green flavor (2)
  },

  harvestContext: {
    isHarvestRisk: false,        // Stuck fermentation is not a harvest risk
    isHarvestInfluence: false    // Not a harvest influence
  },
  
  // Risk display options - show all method + temperature combinations
  riskDisplayOptions: {
    fermentation: {
      optionCombinations: [
        { options: { method: 'Basic', temperature: 'Ambient', duration: 1 } },
        { options: { method: 'Basic', temperature: 'Cool', duration: 1 } },
        { options: { method: 'Basic', temperature: 'Warm', duration: 1 } },
        { options: { method: 'Extended Maceration', temperature: 'Ambient', duration: 1 } },
        { options: { method: 'Extended Maceration', temperature: 'Cool', duration: 1 } },
        { options: { method: 'Extended Maceration', temperature: 'Warm', duration: 1 } },
        { options: { method: 'Temperature Controlled', temperature: 'Ambient', duration: 1 } },
        { options: { method: 'Temperature Controlled', temperature: 'Cool', duration: 1 } },
        { options: { method: 'Temperature Controlled', temperature: 'Warm', duration: 1 } }
      ],
      groupBy: ['method', 'temperature']
    }
  }
};

