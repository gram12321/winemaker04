export { WorkCategory } from '../../types/types';
export { calculateTotalWork, type WorkFactor } from './WorkCalculators/workCalculator';

// Activity system APIs
export {
  initializeActivitySystem,
  createActivity,
  getAllActivities,
  getActivityById,
  cancelActivity,
  progressActivities,
  getActivityProgress
} from './activityManager';

// Vineyard-specific work calculators
export {
  getFragilityModifier,
  getAltitudeModifier,
  calculatePlantingWork,
  calculateHarvestWork
} from './WorkCalculators/VineyardWorkCalculator';

// Bookkeeping system
export {
  calculateBookkeepingWork,
  calculateBookkeepingSpillover,
  calculateTotalBookkeepingWork,
  completeBookkeeping
} from './WorkCalculators/BookkeepingWorkCalculator';

export {
  checkAndTriggerBookkeeping
} from './bookkeepingManager';