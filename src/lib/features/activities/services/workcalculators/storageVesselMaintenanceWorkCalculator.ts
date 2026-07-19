import { INITIAL_WORK, TASK_RATES } from '@/lib/features/activities/constants/activityConstants';
import { WorkCategory } from '@/lib/types/types';
import { calculateTotalWork, type WorkFactor } from './workCalculator';

export interface StorageVesselMaintenanceWorkEstimate {
  totalWork: number;
  factors: WorkFactor[];
}

/** Calculate the cellar work required to empty a batch's allocated vessels. */
export function calculateEmptyStorageVesselWork(volumeLitres: number): StorageVesselMaintenanceWorkEstimate {
  const safeVolumeLitres = Math.max(1, volumeLitres);
  const rate = TASK_RATES[WorkCategory.MAINTENANCE];
  const initialWork = INITIAL_WORK[WorkCategory.MAINTENANCE];

  return {
    totalWork: calculateTotalWork(safeVolumeLitres, { rate, initialWork }),
    factors: [
      { label: 'Wine to discard', value: safeVolumeLitres, unit: 'L', isPrimary: true },
      { label: 'Emptying rate', value: rate, unit: 'L/week' },
      { label: 'Cellar preparation', value: initialWork, unit: 'work units' },
    ],
  };
}
