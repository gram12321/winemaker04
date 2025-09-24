export { WorkCategory } from '../../types/types';
export { calculateTotalWork, type WorkFactor } from './workCalculator';

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
} from './VineyardWorkCalculator';
