import { FeatureConfig } from '../../types/wineFeatures';

/**
 * Late Harvest Feature
 * - Manifestation: Graduated (severity increases over time)
 * - Trigger: Event-triggered (harvest timing)
 * - Effect: Sweetness boost, acidity reduction
 * 
 * Harvest timing effects:
 * - Late harvest = higher sugar content, lower acidity
 * - Severity based on how late the harvest was
 * - Graduated manifestation allows for different levels of late harvest
 * 
 * Wine characteristic modifications:
 * - Sweetness: +0.15 to +0.35 (15-35% increase)
 * - Acidity: -0.10 to -0.25 (10-25% decrease)

 */
export const LATE_HARVEST_FEATURE: FeatureConfig = {
  id: 'late_harvest',
  name: 'Late Harvest',
  type: 'feature',
  icon: '🍇',
  description: 'Grapes harvested late in the season, developing higher sugar content and lower acidity. Can be good for something, but eventually sugar will dominate without acidity.',
  
  manifestation: 'graduated',  // Severity increases based on harvest timing
  
  riskAccumulation: {
    trigger: 'event_triggered',  // Triggered during harvest
    eventTriggers: [
      {
        event: 'harvest',
        condition: (context: { vineyard: any; season: string; week: number }) => {
          // Late harvest condition: harvest in Fall (weeks 7-12) or Winter (weeks 1-12)
          const { season, week } = context;
          return (season === 'Fall' && week >= 7) || season === 'Winter';
        },
        riskIncrease: (context: { vineyard: any; season: string; week: number }) => {
          const { season, week } = context;
          
          // Calculate lateness factor (0-1 scale) across Fall weeks 7-12 and Winter weeks 1-12
          let latenessFactor = 0;
          
          if (season === 'Fall') {
            // Fall weeks 7-12: increasing lateness
            // Week 7 = 0.0, Week 12 = 0.5 (halfway through harvest period)
            latenessFactor = Math.max(0, (week - 6) / 12); // Scale to 0-0.5
          } else if (season === 'Winter') {
            // Winter weeks 1-12: continuing lateness progression
            // Week 1 = 0.5, Week 12 = 1.0 (completing harvest period)
            latenessFactor = 0.5 + (week / 12); // Scale from 0.5 to 1.0
          }
          
          // Base risk increase (becomes severity for features)
          // 0.0 lateness = 0% feature, 1.0 lateness = 100% feature
          return latenessFactor;
        }
      }
    ],
    
    // Severity growth for graduated manifestation
    severityGrowth: {
      rate: 0.0,  // No time-based growth (set at harvest)
      cap: 1.0,   // Maximum 100% severity
      stateMultipliers: {
        'grapes': 1.0,           // No change during grape storage
        'must_ready': 1.0,       // No change during must preparation
        'must_fermenting': 1.0,   // No change during fermentation
        'bottled': 1.0           // No change after bottling
      }
    }
  },
  
  effects: {
    quality: {
      type: 'bonus',  // No quality effect
      amount: () => 0  // No quality bonus
    },
    price: {
      type: 'customer_sensitivity'  // No direct price premium
    },
    characteristics: [
      { 
        characteristic: 'sweetness', 
        modifier: (severity: number) => {
          // Sweetness boost: 0-20% based on severity (no initial bonus)
          return severity * 0.90;
        }
      },
      { 
        characteristic: 'acidity', 
        modifier: (severity: number) => {
          // Acidity reduction: 0-15% based on severity (no initial reduction)
          return -(severity * 0.90);
        }
      }
    ]
  },
  
  customerSensitivity: {
    'Restaurant': 1.0,         // No premium
    'Wine Shop': 1.0,          // No premium
    'Private Collector': 1.0,  // No premium
    'Chain Store': 1.0          // No premium
  },
  
  ui: {
    badgeColor: 'destructive',
    warningThresholds: [0.10, 0.20, 0.40],  // 10%, 20%, 40% risk warnings
    sortPriority: 3  // Show after faults but before neutral features
  },
  
  harvestContext: {
    isHarvestRisk: true,        // Is a risk
    isHarvestInfluence: false     // This is a harvest influence
  },
  
  // Risk display options - show harvest timing for late harvest
  riskDisplayOptions: {
    harvest: {
      optionCombinations: [
        { options: { week: 7, season: 'Fall' }, label: 'Fall Week 7 (Early)' },
        { options: { week: 9, season: 'Fall' }, label: 'Fall Week 9 (Mid)' },
        { options: { week: 12, season: 'Fall' }, label: 'Fall Week 12 (Late)' },
        { options: { week: 3, season: 'Winter' }, label: 'Winter Week 3 (Very Late)' },
        { options: { week: 6, season: 'Winter' }, label: 'Winter Week 6 (Extremely Late)' },
        { options: { week: 12, season: 'Winter' }, label: 'Winter Week 12 (Latest)' }
      ],
      groupBy: ['harvest-timing']
    }
  }
};

/**
 * Late Harvest feature constants
 * Exported for reference and balance tuning
 */
export const LATE_HARVEST_CONSTANTS = {
  // Harvest timing thresholds
  FALL_LATE_START: 7,        // Week 7 of Fall = start of late harvest
  FALL_LATE_END: 12,         // Week 12 of Fall = maximum Fall lateness
  WINTER_LATE_END: 12,       // Week 12 of Winter = maximum Winter lateness
  
  // Characteristic modifiers (no initial bonuses)
  SWEETNESS_BOOST: { min: 0.0, max: 0.90 },   // 0-90% sweetness increase
  ACIDITY_REDUCTION: { min: 0.0, max: 0.90 },  // 0-90% acidity decrease
} as const;
