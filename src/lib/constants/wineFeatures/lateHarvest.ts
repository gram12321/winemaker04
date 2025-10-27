import { FeatureConfig } from '../../types/wineFeatures';

/**
 * Late Harvest Feature
 * - Behavior: Triggered (severity set at harvest timing)
 * - Effect: Sweetness boost, acidity reduction
 * 
 * Harvest timing effects:
 * - Late harvest = higher sugar content, lower acidity
 * - Severity based on how late the harvest was
 * - Graduated effect allows for different levels of late harvest
 * 
 * Wine characteristic modifications:
 * - Sweetness: +0.15 to +0.35 (15-35% increase)
 * - Acidity: -0.10 to -0.25 (10-25% decrease)
 */
export const LATE_HARVEST_FEATURE: FeatureConfig = {
  id: 'late_harvest',
  name: 'Late Harvest',
  icon: '🍇',
  description: 'Grapes harvested late in the season, developing higher sugar content and lower acidity. Can be good for something, but eventually sugar will dominate without acidity.',
  
  behavior: 'triggered',
  
  behaviorConfig: {
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
            // Scale from 0 to 0.5 over 6 weeks (weeks 7-12)
            latenessFactor = (week - 7) / 5 * 0.5; // Scale to 0-0.5
          } else if (season === 'Winter') {
            // Winter weeks 1-12: continuing lateness progression
            // Week 1 = 0.5, Week 12 = 1.0 (completing harvest period)
            // Use (week - 1) / 11 to scale from 0 to 1 across 12 weeks, then add 0.5
            latenessFactor = 0.5 + ((week - 1) / 11) * 0.5; // Scale from 0.5 to 1.0
          }
          
          // Base risk increase (becomes severity for features)
          // 0.0 lateness = 0% feature, 1.0 lateness = 100% feature
          // Cap at 1.0 to prevent exceeding 100%
          return Math.min(1.0, latenessFactor);
        }
      }
    ]
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
          // Sweetness boost: 0-90% based on severity
          return severity * 0.90;
        }
      },
      { 
        characteristic: 'acidity', 
        modifier: (severity: number) => {
          // Acidity reduction: 0-90% based on severity
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
  
  displayPriority: 3,  // Show after faults but before neutral features
  badgeColor: 'destructive',
  
  // Risk Display Configuration
  riskDisplay: {
    showAsRange: false,  // Show single current value instead of range
    customOptionCombinations: (event: 'harvest' | 'crushing' | 'fermentation' | 'bottling') => {
      if (event !== 'harvest') return [];
      
      // Generate min/max combinations for Fall and Winter ranges
      return [
        { season: 'Fall', week: 7, _isMin: true, _label: 'Fall Week 7' },
        { season: 'Fall', week: 12, _isMax: true, _label: 'Fall Week 12' },
        { season: 'Winter', week: 1, _isMin: true, _label: 'Winter Week 1' },
        { season: 'Winter', week: 12, _isMax: true, _label: 'Winter Week 12' }
      ];
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
  
  // Characteristic modifiers
  SWEETNESS_BOOST: { min: 0.0, max: 0.90 },   // 0-90% sweetness increase
  ACIDITY_REDUCTION: { min: 0.0, max: 0.90 },  // 0-90% acidity decrease
} as const;
