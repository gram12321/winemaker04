import { FeatureConfig } from '../../types/wineFeatures';

/**
 * Terroir Expression Feature
 * 
 * A positive wine feature that represents the unique characteristics
 * imparted by the vineyard's environment (soil, climate, microclimate)
 * 
 * Characteristics:
 * - Type: Feature (positive)
 * - Behavior: Evolving (always present, grows over time)
 * - Spawns active at harvest
 * - Effects: Quality bonus + characteristic modifications
 * 
 * Growth Pattern:
 * - Starts present at 0% severity when wine batch is created
 * - Grows faster during fermentation (microbial activity)
 * - Grows slower when bottled (limited oxygen exposure)
 * - State multipliers affect growth rate
 */
export const TERROIR_FEATURE: FeatureConfig = {
  id: 'terroir',
  name: 'Terroir Expression',
  icon: '🏔️',
  description: 'Unique characteristics from vineyard environment, developing complexity over time',
  
  behavior: 'evolving',
  
  behaviorConfig: {
    spawnActive: true,  // Spawn active at harvest (severity starts > 0)
    
    severityGrowth: {
      rate: 0.005, // 0.5% per week base rate
      cap: 1.0,    // Maximum 100% severity
      stateMultipliers: {
        'grapes': 0.01,         // Slow growth in grapes (minimal interaction)
        'must_ready': 3.0,     // Normal growth in must
        'must_fermenting': 5.0, // Fast growth during fermentation (microbial activity)
        'bottled': 0.3         // Slow growth when bottled (limited oxygen)
      }
    }
  },
  
  effects: {
    quality: {
      type: 'bonus',
      amount: (severity: number) => severity * 0.15 // Up to +15% quality at 100% severity
    },
    price: {
      type: 'premium',
      premiumPercentage: (severity: number) => severity * 0.25 // Up to +25% price premium
    },
    characteristics: [
      // Terroir adds complexity and character (can help or hurt balance)
      { characteristic: 'aroma', modifier: (severity: number) => severity * 0.12 },      // +12% max
      { characteristic: 'body', modifier: (severity: number) => severity * 0.08 },       // +8% max
      { characteristic: 'tannins', modifier: (severity: number) => severity * 0.10 },    // +10% max
      { characteristic: 'spice', modifier: (severity: number) => severity * 0.06 },      // +6% max
      { characteristic: 'acidity', modifier: (severity: number) => -severity * 0.04 }    // -4% max (terroir can soften acidity)
    ],
    prestige: {
      onSale: {
        company: {
          calculation: 'dynamic',
          baseAmount: 0.05, // Positive prestige for selling terroir-expressive wines
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.0,
            prestigeWeight: 1.0
          },
          decayRate: 0.998, // Long-lasting positive reputation
          maxImpact: 8.0    // Cap for very large sales
        },
        vineyard: {
          calculation: 'dynamic',
          baseAmount: 0.08, // Vineyard gets credit for terroir expression
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.0,
            prestigeWeight: 1.0
          },
          decayRate: 0.995, // Very long-lasting vineyard reputation
          maxImpact: 12.0   // Higher cap for vineyard reputation
        }
      }
    }
  },
  
  customerSensitivity: {
    'Restaurant': 1.15,        // +15% premium (restaurants value terroir)
    'Wine Shop': 1.25,         // +25% premium (wine shops love terroir stories)
    'Private Collector': 1.35, // +35% premium (collectors highly value terroir)
    'Chain Store': 1.05        // +5% premium (chain stores less interested)
  },
  
  displayPriority: 3, // Show after faults (oxidation=1, green_flavor=2)
  badgeColor: 'success',
  
  tips: [
    {
      triggerEvent: 'harvest',
      message: '🌿 Terroir Expression will develop in this wine over time, enhancing quality and characteristics.'
    }
  ]
};
