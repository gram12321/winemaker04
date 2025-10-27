import { FeatureConfig } from '../../types/wineFeatures';
import { GRAPE_CONST } from '../grapeConstants';
import { formatNumber } from '../../utils/utils';

/**
 * Bottle Aging Feature
 * 
 * A positive wine feature that represents maturation and development
 * of complexity through time spent aging in the bottle
 * 
 * Characteristics:
 * - Type: Feature (positive)
 * - Behavior: Evolving (spawns passive, becomes active when bottled)
 * - Effects: Quality bonus, characteristic smoothing, price premium
 * 
 * Growth Pattern:
 * - Spawns passive before bottling (severity = 0, hidden from UI)
 * - Becomes active when bottled (starts at 0% severity)
 * - Grows based on wine age with diminishing returns
 * - Early peak: Fast growth (years 0-3)
 * - Late peak: Moderate growth (years 3-7+, grape-dependent)
 * - Plateau: Minimal growth after late peak
 */
export const BOTTLE_AGING_FEATURE: FeatureConfig = {
  id: 'bottle_aging',
  name: 'Bottle Aging',
  icon: '🕰️',
  description: 'Wine develops complexity and smoothness through aging in the bottle. Characteristics soften and flavors mature over time.',
  
  behavior: 'evolving',
  
  behaviorConfig: {
    spawnActive: false,  // Spawn passive until bottled (severity stays 0)
    
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
      premiumPercentage: (severity: number) => severity * 2.20 // Up to +220% price premium
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
          calculation: 'dynamic',
          baseAmount: 0.05,  // Base prestige for aged wine sales
          scalingFactors: {
            volumeWeight: 1.0,
            valueWeight: 1.5,  // Aged wine value matters more
            prestigeWeight: 1.0
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
  
  displayPriority: 4,      // Show after faults (oxidation=1, green_flavor=2) and terroir=3
  badgeColor: 'info',  // Blue for aging
  
  tooltip: (severity: number) => {
    const severityPercent = severity * 100;
    const severityPercentFormatted = formatNumber(severityPercent, { smartDecimals: true });
    
    const description = severityPercent < 25 
      ? 'Early development - subtle complexity emerging'
      : severityPercent < 50 
      ? 'Moderate aging - noticeable smoothness'
      : severityPercent < 75 
      ? 'Well-aged - pronounced complexity'
      : 'Fully matured - maximum aging benefits';
    
    return `Bottle Aging: ${severityPercentFormatted}% developed\n\nThis shows how much complexity and smoothness has developed through aging:\n• ${severityPercentFormatted}% = ${description}\n\nAging improves grape quality, characteristics, and increases value.`;
  }
};
