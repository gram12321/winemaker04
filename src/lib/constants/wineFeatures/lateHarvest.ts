import { FeatureConfig } from '../../types/wineFeatures';
import { GameDate, Season } from '../../types/types';

type HarvestTiming = {
  season: Season;
  week: number;
};

const clampWeek = (week: number, min: number, max: number): number => {
  if (!Number.isFinite(week)) return min;
  return Math.max(min, Math.min(max, week));
};

const extractTimingFromGameDate = (date?: GameDate | null): HarvestTiming | null => {
  if (!date) return null;
  if (!date.season || typeof date.week !== 'number') return null;
  return {
    season: date.season,
    week: date.week
  };
};

const resolveHarvestTiming = (context: any): HarvestTiming | null => {
  if (!context) return null;

  // Direct season/week on context (used by risk previews)
  if (typeof context.season === 'string' && typeof context.week === 'number') {
    return {
      season: context.season as Season,
      week: context.week
    };
  }

  // Batch harvest dates (check first - most reliable for actual processing)
  // Check both context.batch and context.options?.batch
  const batch = context.batch || context.options?.batch;
  if (batch) {
    const batchHarvestDate = extractTimingFromGameDate(batch.harvestEndDate) || extractTimingFromGameDate(batch.harvestStartDate);
    if (batchHarvestDate) {
      return batchHarvestDate;
    }
  }

  // Nested options (standard triggerContext shape { options, batch })
  if (context.options) {
    const { season, week } = context.options;
    if (typeof season === 'string' && typeof week === 'number') {
      return {
        season: season as Season,
        week
      };
    }

    const optionHarvestDate = extractTimingFromGameDate(context.options.harvestEndDate || context.options.harvestStartDate);
    if (optionHarvestDate) {
      return optionHarvestDate;
    }
  }

  return null;
};

const calculateLatenessFactor = (timing: HarvestTiming | null): number => {
  if (!timing) return 0;
  const { season, week } = timing;

  if (season === 'Fall') {
    if (week < LATE_HARVEST_CONSTANTS.FALL_LATE_START) {
      return 0;
    }
    const clampedWeek = clampWeek(week, LATE_HARVEST_CONSTANTS.FALL_LATE_START, LATE_HARVEST_CONSTANTS.FALL_LATE_END);
    const progress = (clampedWeek - LATE_HARVEST_CONSTANTS.FALL_LATE_START) /
      (LATE_HARVEST_CONSTANTS.FALL_LATE_END - LATE_HARVEST_CONSTANTS.FALL_LATE_START);
    return Math.min(0.5, progress * 0.5);
  }

  if (season === 'Winter') {
    const clampedWeek = clampWeek(week, 1, LATE_HARVEST_CONSTANTS.WINTER_LATE_END);
    const progress = (clampedWeek - 1) / (LATE_HARVEST_CONSTANTS.WINTER_LATE_END - 1 || 1);
    return Math.min(1.0, 0.5 + progress * 0.5);
  }

  return 0;
};

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
    severityFromRisk: true,
    eventTriggers: [
      {
        event: 'harvest',
        condition: (context: any) => {
          const timing = resolveHarvestTiming(context);
          if (!timing) return false;
          const { season, week } = timing;
          return (season === 'Fall' && week >= LATE_HARVEST_CONSTANTS.FALL_LATE_START) || season === 'Winter';
        },
        riskIncrease: (context: any) => {
          const timing = resolveHarvestTiming(context);
          return Math.min(1.0, calculateLatenessFactor(timing));
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
    showAsRange: false  // Show single current value instead of range
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
