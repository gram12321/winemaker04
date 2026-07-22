// Weekly decay system for prestige events and relationship boosts
import {
  listPrestigeEventsForDecay,
  updatePrestigeEventAmount,
  deletePrestigeEvents,
} from '@/lib/features/prestige/database/prestigeEventsDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Apply one week of decay to prestige events only.
 * - Multiplies amount by decay_rate for rows with 0 < decay_rate < 1
 * - Cleans up rows that fall below the minimum threshold
 */
export async function decayPrestigeEventsOneWeek(): Promise<void> {
  const companyId = getCurrentCompanyId();
  const PRESTIGE_EVENT_MIN_AMOUNT = 0.001;

  try {
    const prestigeRows = await listPrestigeEventsForDecay(companyId);
    if (prestigeRows && prestigeRows.length > 0) {
      const toDelete: string[] = [];
      for (const row of prestigeRows) {
        const newAmount = (row.amount_base || 0) * (row.decay_rate || 1);
        // For both positive and negative values, check if absolute value is below threshold
        if (Math.abs(newAmount) < PRESTIGE_EVENT_MIN_AMOUNT) {
          toDelete.push(row.id);
        } else {
          await updatePrestigeEventAmount(row.id, newAmount, companyId);
        }
      }
      if (toDelete.length > 0) {
        await deletePrestigeEvents(toDelete, companyId);
      }
    }
  } catch (error) {
    console.error('Failed to apply weekly decay to prestige events:', error);
  }
}
