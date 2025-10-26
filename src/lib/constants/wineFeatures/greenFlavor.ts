import { FeatureConfig } from '../../types/wineFeatures';
import { Vineyard } from '../../types/types';
import { CrushingOptions } from '../../services/wine/characteristics/crushingCharacteristics';

/**
 * Green Flavor/Vegetal Character
 * 
 * A wine fault characterized by herbaceous, vegetal, or "green" flavors
 * Caused by:
 * - Harvesting underripe grapes (ripeness < 0.5)
 * - Aggressive crushing with high pressure
 * - Crushing delicate grapes roughly
 * - Not destemming (stems = harsh vegetal compounds)
 * 
 * Grape-specific modifiers:
 * - White grapes: 30% more prone (lack tannin masking)
 * - Fragile grapes: Scale with crushing pressure (bruising releases harsh compounds)
 * 
 * Effects:
 * - Reduces quality by 20% (linear penalty)
 * - Reduces aroma (vegetal vs fruity)
 * - Reduces sweetness (underripe)
 * - Increases tannins (green/harsh tannins)
 * - Customers less sensitive than to oxidation
 */
export const GREEN_FLAVOR_FEATURE: FeatureConfig = {
  id: 'green_flavor',
  name: 'Green/Vegetal',
  type: 'fault',
  icon: '🌿',
  description: 'Herbaceous, vegetal flavors from underripe grapes or rough handling during crushing',
  
  // Binary manifestation - either present or not
  manifestation: 'binary',
  
  riskAccumulation: {
    trigger: 'event_triggered',
    baseRate: 0,  // No weekly accumulation (inferred as independent)
    compoundEffect: false,
    
    eventTriggers: [
      {
        event: 'harvest',
        condition: (context: { options: Vineyard; batch?: any }) => {
          // Trigger if grapes are significantly underripe
          const vineyard = context.options;
          return (vineyard.ripeness || 0) < 0.5;
        },
        riskIncrease: (context: { options: Vineyard; batch?: any }) => {
          // More underripe = higher risk
          // Base formula: (0.5 - ripeness) × 0.6
          // White grapes show green/vegetal notes more prominently (lack tannin masking)
          const vineyard = context.options;
          const ripeness = vineyard.ripeness || 0;
          const baseRisk = Math.max(0, (0.5 - ripeness) * 0.6);
          
          // Grape color multiplier (white grapes 30% more prone to showing vegetal character)
          // This will be applied when batch is created with grape metadata
          // For now, return base risk - batch processing will apply multiplier
          return baseRisk;
        }
      },
      {
        event: 'crushing',
        condition: () => true,  // Always evaluate
        riskIncrease: (context: { options: CrushingOptions; batch: any }) => {
          const { options, batch } = context;
          
          // Dynamic risk calculation based on crushing options
          // Base rates by method (reflects extraction aggressiveness)
          const baseRates: Record<CrushingOptions['method'], number> = {
            'Hand Press': 0.05,        // 5% base (gentlest method)
            'Mechanical Press': 0.15,  // 15% base (most aggressive)
            'Pneumatic Press': 0.10    // 10% base (middle ground)
          };
          
          // Pressing intensity multiplier (0.5x to 1.5x)
          // Low pressure = less extraction = less risk
          // High pressure = more extraction = more risk
          const intensityMultiplier = 0.5 + options.pressingIntensity;
          
          // Destemming modifier (removing stems reduces risk)
          // Stems contain harsh, green tannins and vegetal compounds
          const destemmingModifier = options.destemming ? 0.5 : 1.0;
          
          // Fragile grape multiplier - delicate grapes bruise easier, releasing harsh compounds
          // fragile = 0.0 (robust) → 1.0x, fragile = 1.0 (delicate) → up to 1.8x
          const fragile = batch.fragile || 0;
          const fragileMultiplier = 1.0 + (fragile * options.pressingIntensity * 0.8);
          
          // White grape multiplier (30% more prone to showing vegetal character)
          const grapeColorMultiplier = batch.grapeColor === 'white' ? 1.3 : 1.0;
          
          const baseRate = baseRates[options.method];
          const finalRisk = baseRate * intensityMultiplier * destemmingModifier * fragileMultiplier * grapeColorMultiplier;
          
          return Math.min(0.45, finalRisk);  // Cap at 45% max risk
        }
      }
    ]
  },
  
  effects: {
    quality: {
      type: 'linear',
      amount: -0.20  // 20% flat quality reduction (simpler than oxidation's power function)
    },
    price: {
      type: 'customer_sensitivity'
    },
    characteristics: [
      { characteristic: 'aroma', modifier: -0.15 },    // Vegetal vs fruity aromas
      { characteristic: 'sweetness', modifier: -0.10 }, // Underripe = less sweet
      { characteristic: 'tannins', modifier: +0.12 }    // Green/harsh tannins
    ],
    prestige: {
      onManifestation: {
        company: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.02,  // Company scandal when green flavor manifests (lighter than oxidation)
          scalingFactors: {
            batchSizeWeight: 1.0,         // Larger batches hurt more
            qualityWeight: 1.0,            // Premium wine with green flavor is worse
            companyPrestigeWeight: 1.0     // Higher prestige = bigger fall
          },
          decayRate: 0.995,   // Decays over ~20 years (1040 weeks)
          maxImpact: -3.0     // Cap for company manifestation events (lighter than oxidation)
        },
        vineyard: {
          calculation: 'dynamic_manifestation',
          baseAmount: -0.3,  // Base scandal (lighter than oxidation)
          scalingFactors: {
            batchSizeWeight: 1.0,         // Larger batches hurt more
            qualityWeight: 1.0,            // Premium wine with green flavor is worse
            vineyardPrestigeWeight: 1.0    // Premium vineyards held to higher standard
          },
          decayRate: 0.98,    // Decays over ~3 years (156 weeks)
          maxImpact: -8.0     // Lower cap than oxidation
        }
      },
      onSale: {
        company: {
          calculation: 'dynamic_sale',
          baseAmount: -0.05,  // Lighter base than oxidation (green flavor less serious)
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.0,
            companyPrestigeWeight: 1.0
          },
          decayRate: 0.995,   // Decays over ~20 years (1040 weeks)
          maxImpact: -8.0     // Lower cap than oxidation
        },
        vineyard: {
          calculation: 'dynamic_sale',
          baseAmount: -0.1,  // Vineyard scandal when selling wine with green flavor (lighter than oxidation)
          scalingFactors: {
            volumeWeight: 1.0,             // More bottles = bigger scandal
            valueWeight: 1.0,              // Higher value = bigger scandal
            vineyardPrestigeWeight: 1.0    // Higher prestige = bigger fall
          },
          decayRate: 0.98,    // Decays over ~3 years (156 weeks)
          maxImpact: -5.0     // Cap for vineyard sale events (lighter than oxidation)
        }
      }
    }
  },
  
  // Customers less sensitive to green flavor than oxidation
  // Some markets (chain stores) barely care
  customerSensitivity: {
    'Restaurant': 0.90,       // -10% penalty (restaurants less picky)
    'Wine Shop': 0.85,        // -15% penalty
    'Private Collector': 0.70, // -30% penalty (collectors notice but not as bad as oxidation)
    'Chain Store': 0.95       // -5% penalty (chain stores don't care much)
  },
  
  ui: {
    badgeColor: 'warning',  // Orange/yellow vs red for oxidation
    warningThresholds: [0.15, 0.30],  // Only 2 thresholds (less aggressive than oxidation)
    sortPriority: 2  // Show after oxidation (priority 1)
  },

  harvestContext: {
    isHarvestRisk: true,         // Green flavor is a harvest risk
    isHarvestInfluence: false    // Not a positive influence
  },
  
  // Risk display options - show ripeness levels for harvest
  riskDisplayOptions: {
    harvest: {
      optionCombinations: [
        { options: { ripeness: 0.0 }, label: 'Ripeness 0%' },
        { options: { ripeness: 0.2 }, label: 'Ripeness 20%' },
        { options: { ripeness: 0.4 }, label: 'Ripeness 40%' },
        { options: { ripeness: 0.6 }, label: 'Ripeness 60%' },
        { options: { ripeness: 0.8 }, label: 'Ripeness 80%' },
        { options: { ripeness: 1.0 }, label: 'Ripeness 100%' }
      ],
      groupBy: ['ripeness-range']
    }
  }
};

