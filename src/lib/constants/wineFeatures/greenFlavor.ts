import { FeatureConfig } from '../../types/wineFeatures';
import { Vineyard } from '../../types/types';
import { CrushingOptions } from '../../services/wine/characteristics/crushingCharacteristics';
import { formatNumber } from '../../utils/utils';
import { createPrestigeConfig } from './commonFeaturesUtil';

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
  name: 'Green Flavors',
  icon: '🌿',
  description: 'Herbaceous, vegetal flavors from underripe grapes or rough handling during crushing',
  
  behavior: 'triggered',
  
  behaviorConfig: {
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
    prestige: createPrestigeConfig({
      manifestationCompany: { baseAmount: -0.02, maxImpact: -3.0 },
      manifestationVineyard: { baseAmount: -0.3, maxImpact: -8.0 },
      saleCompany: { baseAmount: -0.05, maxImpact: -8.0 },
      saleVineyard: { baseAmount: -0.1, maxImpact: -5.0 },
      decayRate: 0.995
    })
  },
  
  // Customers less sensitive to green flavor than oxidation
  // Some markets (chain stores) barely care
  customerSensitivity: {
    'Restaurant': 0.90,       // -10% penalty (restaurants less picky)
    'Wine Shop': 0.85,        // -15% penalty
    'Private Collector': 0.70, // -30% penalty (collectors notice but not as bad as oxidation)
    'Chain Store': 0.95       // -5% penalty (chain stores don't care much)
  },
  
  displayPriority: 2, // Show after oxidation (priority 1)
  badgeColor: 'warning',  // Orange/yellow vs red for oxidation
  
  tips: [
    {
      triggerEvent: 'harvest',
      message: '💡 TIP: Wait for ripeness ≥ 50% to avoid green flavor risk.'
    },
    {
      triggerEvent: 'crushing',
      message: '💡 TIP: Enable destemming or use Mechanical/Pneumatic Press to avoid this risk.'
    }
  ],
  
  tooltip: (severity: number) => {
    const severityPercent = severity * 100;
    const severityPercentFormatted = formatNumber(severityPercent, { smartDecimals: true });
    
    const description = severityPercent < 25 
      ? 'Subtle green notes'
      : severityPercent < 50 
      ? 'Noticeable unripe character'
      : severityPercent < 75 
      ? 'Strong green flavors'
      : 'Severe green, harsh taste';
    
    return `Green Flavor: ${severityPercentFormatted}% severity\n\nThis indicates the intensity of green, unripe flavors:\n• ${severityPercentFormatted}% = ${description}\n\nGreen flavors reduce grape quality and marketability.`;
  }
};
