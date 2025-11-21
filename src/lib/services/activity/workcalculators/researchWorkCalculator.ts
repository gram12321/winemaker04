import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/types/types';

/**
 * Calculate work required for research
 */
export function calculateResearchWork(
      targetName: string
): { totalWork: number; factors: WorkFactor[] } {
      const category = WorkCategory.ADMINISTRATION_AND_RESEARCH;
      const rate = TASK_RATES[category] || 1; // Fallback if not set
      const initialWork = INITIAL_WORK[category] || 10;

      // Research is a fixed amount of work for now, maybe scaled by something?
      // For now, let's say it takes 100 units of work (arbitrary)
      const researchAmount = 100;

      const totalWork = calculateTotalWork(researchAmount, {
            rate,
            initialWork
      });

      const factors: WorkFactor[] = [
            { label: 'Research Goal', value: targetName, isPrimary: true },
            { label: 'Complexity', value: researchAmount, unit: 'points' },
            { label: 'Base Rate', value: rate, unit: 'points/week' },
            { label: 'Initial Setup', value: initialWork, unit: 'work units' }
      ];

      return { totalWork, factors };
}
