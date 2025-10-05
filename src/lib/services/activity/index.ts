export { WorkCategory } from '../../types/types';
export { calculateTotalWork, type WorkFactor } from './workcalculators/workCalculator';

// Activity system APIs
export {
  initializeActivitySystem,
  createActivity,
  getAllActivities,
  getActivityById,
  cancelActivity,
  progressActivities,
  getActivityProgress
} from './activitymanagers/activityManager';

// Vineyard-specific work calculators
export {
  getFragilityModifier,
  getAltitudeModifier,
  calculatePlantingWork,
  calculateHarvestWork
} from './workcalculators/vineyardWorkCalculator';

// Bookkeeping system
export {
  calculateBookkeepingWork,
  calculateBookkeepingSpillover,
  calculateTotalBookkeepingWork,
  completeBookkeeping
} from './workcalculators/bookkeepingWorkCalculator';

export {
  checkAndTriggerBookkeeping
} from './activitymanagers/bookkeepingManager';