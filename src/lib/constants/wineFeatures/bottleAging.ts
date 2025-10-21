import { FeatureConfig } from '../../types/wineFeatures';
import { GRAPE_CONST } from '../grapeConstants';

/**
 * Bottle Aging Feature
 * 
 * A positive wine feature that represents maturation and development
 * of complexity through time spent aging in the bottle
 * 
 * Characteristics:
 * - Type: Feature (positive)
 * - Manifestation: Graduated (develops over time)
 * - Trigger: Hybrid (starts on bottling + time-based growth)
 * - Effects: Quality bonus, characteristic smoothing, price premium
 * 
 * Growth Pattern:
 * - Starts present at 0% severity when bottled
 * - Grows based on wine age with diminishing returns
 * - Early peak: Fast growth (years 0-3)
 * - Late peak: Moderate growth (years 3-7+, grape-dependent)
 * - Plateau: Minimal growth after late peak
 * 
 * Risk Balance:
 * - Oxidation continues during aging (separate feature)
 * - Longer aging = higher oxidation risk
 * - Optimal strategy: Age to peak window, sell before oxidation
 */
export const BOTTLE_AGING_FEATURE: FeatureConfig = {
  id: 'bottle_aging',
  name: 'Bottle Aging',
  type: 'feature',
  icon: '🕰️',
  description: 'Wine develops complexity and smoothness through aging in the bottle. Characteristics soften and flavors mature over time.',
  
  manifestation: 'graduated',
  
  riskAccumulation: {
    trigger: 'hybrid',
    baseRate: 0, // No risk accumulation (this is a positive feature)
    
    // Starts on bottling (guaranteed manifestation)
    eventTriggers: [{
      event: 'bottling',
      condition: () => true,
      riskIncrease: 0.001 // Immediate manifestation at minimal severity
    }],
    
    // Severity growth with age-based diminishing returns
    severityGrowth: {
      rate: 0.003, // Base rate (~7 years to 100% at 3x multiplier)
      cap: 1.0,    // Maximum 100% severity
      stateMultipliers: {
        'grapes': 0,           // No aging in grapes
        'must_ready': 0,       // No aging in must
        'must_fermenting': 0,  // No aging during fermentation
        'bottled': (batch: any) => {
          // Age-based growth with diminishing returns
          const ageInYears = (batch.agingProgress || 0) / 52;
          const grapeData = GRAPE_CONST[batch.grape as keyof typeof GRAPE_CONST];
          const profile = grapeData?.agingProfile;
          
          if (!profile) return 1.0; // Fallback if no profile
          
          // Fast growth before early peak
          if (ageInYears < profile.earlyPeak) {
            return 3.0;
          }
          
          // Moderate growth between early and late peak
          if (ageInYears < profile.latePeak) {
            return 1.0;
          }
          
          // Minimal growth after late peak (plateau, not decline)
          return 0.1;
        }
      }
    }
  },
  
  effects: {
    quality: {
      type: 'bonus',
      amount: (severity: number) => severity * 0.10 // Up to +10% quality at full maturity
    },
    
    price: {
      type: 'premium',
      premiumPercentage: (severity: number) => severity * 2.20 // Up to +20% price premium //TODO make this dynamic/power/assymetrical something
    },
    
    // Age-specific characteristic changes
    // Acids soften, aromatics develop, perceived sweetness increases
    characteristics: [
      { characteristic: 'acidity', modifier: (severity: number) => -severity * 0.08 },   // -8% (acids integrate)
      { characteristic: 'aroma', modifier: (severity: number) => severity * 0.10 },      // +10% (complexity develops)
      { characteristic: 'spice', modifier: (severity: number) => severity * 0.08 },      // +8% (spice notes emerge)
      { characteristic: 'sweetness', modifier: (severity: number) => severity * 0.06 },  // +6% (perceived sweetness from acid softening)
      { characteristic: 'body', modifier: (severity: number) => -severity * 0.04 }       // -4% (slight lightening with age)
    ],
    
    prestige: {
      // Prestige events when selling aged wines
      onSale: {
        company: {
          calculation: 'dynamic_sale',
          baseAmount: 0.05,  // Base prestige for aged wine sales
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.5,  // Aged wine value matters more
            companyPrestigeWeight: 1.0
          },
          decayRate: 0.998,  // Very long-lasting (aged wine reputation)
          maxImpact: 15.0
        }
      }
    }
  },
  
  // Customer appreciation for aged wines
  customerSensitivity: {
    'Restaurant': 1.10,        // +10% (aged wines for special occasions)
    'Wine Shop': 1.15,         // +15% (wine shops value age)
    'Private Collector': 1.30, // +30% (collectors highly value aged wines)
    'Chain Store': 1.00        // No premium (chain stores don't care about age)
  },
  
  ui: {
    badgeColor: 'info',  // Blue for aging
    sortPriority: 4      // Show after faults (oxidation=1, green_flavor=2) and terroir=3
  },
  
  harvestContext: {
    isHarvestRisk: false,
    isHarvestInfluence: false
  }
};

