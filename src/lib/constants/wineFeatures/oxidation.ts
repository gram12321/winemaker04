import { FeatureConfig } from '../../types/wineFeatures';
import { formatNumber } from '../../utils/utils';
import { createPrestigeConfig } from './commonFeaturesUtil';

/**
 * Oxidation Feature
 * - Type: Fault (negative)
 * - Behavior: Accumulation (compound risk over time)
 * - Trigger: Events add to accumulated risk
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
  icon: '⚠️',
  description: 'Wine exposed to oxygen, resulting in flavor degradation and browning. Risk influenced by fermentation method.',
  
  behavior: 'accumulation',
  
  behaviorConfig: {
    baseRate: 0.002,    // 0.2% per week base rate
    compound: true,     // Risk accelerates: rate × (1 + currentRisk)
    spawnActive: true,  // Starts accumulating from harvest
    spawnEvent: 'harvest',  // Triggered by harvest event
    
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
    
    // Risk modifiers from crushing events
    riskModifiers: [
      {
        source: 'options',
        parameter: 'pressingIntensity',
        multiplier: (context: any) => {
          const { options, batch } = context;
          
          // Trigger for fragile grapes - delicate grapes bruise easily during crushing
          if ((batch.fragile || 0) <= 0.3) return 1.0;  // No modifier for robust grapes
          
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
    prestige: createPrestigeConfig({
      manifestationCompany: { baseAmount: -0.05, maxImpact: -5.0 },
      manifestationVineyard: { baseAmount: -0.5, maxImpact: -10.0 },
      saleCompany: { baseAmount: -0.1, maxImpact: -10.0 },
      saleVineyard: { baseAmount: -0.2, maxImpact: -8.0 },
      decayRate: 0.995
    })
  },
  
  customerSensitivity: {
    'Restaurant': 0.85,        // -15% extra penalty
    'Wine Shop': 0.80,         // -20% extra penalty
    'Private Collector': 0.60, // -40% extra penalty (collectors HATE flaws!)
    'Chain Store': 0.90        // -10% extra penalty (bulk buyers less picky)
  },
  
  displayPriority: 1, // Show first (most serious fault)
  badgeColor: 'destructive',
  
  tips: [
    {
      triggerEvent: 'crushing',
      message: '💡 TIP: Fragile grapes (like Pinot Noir) with high pressing intensity increase oxidation risk.'
    }
  ],
  
  tooltip: (severity: number) => {
    const severityPercent = severity * 100;
    const severityPercentFormatted = formatNumber(severityPercent, { smartDecimals: true });
    
    const description = severityPercent < 25 
      ? 'Minor oxidation - barely noticeable'
      : severityPercent < 50 
      ? 'Moderate oxidation - some off-flavors'
      : severityPercent < 75 
      ? 'Significant oxidation - clearly affected'
      : 'Severe oxidation - wine may be undrinkable';
    
    return `Oxidation: ${severityPercentFormatted}% developed\n\nThis shows how oxidized the wine has become:\n• ${severityPercentFormatted}% = ${description}\n\nOxidation reduces grape quality and can make it unsellable.`;
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
