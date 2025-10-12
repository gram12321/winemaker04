// Green Flavor Feature Configuration
// Event-triggered fault from underripe grapes or rough processing

import { FeatureConfig } from '../../types/wineFeatures';
import { Vineyard } from '../../types/types';
import { CrushingOptions } from '../../services/wine/characteristics/crushingCharacteristics';

/**
 * Green Flavor/Vegetal Character
 * 
 * A wine fault characterized by herbaceous, vegetal, or "green" flavors
 * Caused by:
 * - Harvesting underripe grapes (ripeness < 0.5)
 * - Rough crushing with stems included
 * - Poor handling during crushing
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
    baseRate: 0,  // No weekly accumulation
    compoundEffect: false,
    
    eventTriggers: [
      {
        event: 'harvest',
        condition: (vineyard: Vineyard) => {
          // Trigger if grapes are significantly underripe
          return (vineyard.ripeness || 0) < 0.5;
        },
        riskIncrease: (vineyard: Vineyard) => {
          // More underripe = higher risk
          // Risk = (0.5 - ripeness) × 0.6
          // Examples:
          // - Ripeness 0.4 → 6% risk
          // - Ripeness 0.3 → 12% risk
          // - Ripeness 0.2 → 18% risk
          const ripeness = vineyard.ripeness || 0;
          return Math.max(0, (0.5 - ripeness) * 0.6);
        }
      },
      {
        event: 'crushing',
        condition: (options: CrushingOptions) => {
          // Trigger if using Hand Press method without destemming
          // Hand Press without destemming means stems remain in contact with must
          // This can extract harsh, green tannins and vegetal flavors
          return options.method === 'Hand Press' && !options.destemming;
        },
        riskIncrease: 0.20  // 20% risk from hand pressing with stems
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
          calculation: 'dynamic_sale',
          baseAmount: -0.02,  // Company scandal when green flavor manifests (lighter than oxidation)
          scalingFactors: {
            volumeWeight: 1.0,             // Batch size affects company reputation
            valueWeight: 1.0,              // Wine value affects scandal size
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
  }
};

