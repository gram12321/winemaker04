// Weekly decay system for prestige events and relationship boosts
import { listPrestigeEventsForDecay, updatePrestigeEventAmount, deletePrestigeEvents } from '../../database/customers/prestigeEventsDB';
import { listRelationshipBoostsForDecay, updateRelationshipBoostAmount, deleteRelationshipBoosts } from '../../database/customers/relationshipBoostsDB';

/**
 * Apply one week of decay to prestige events only.
 * - Multiplies amount by decay_rate for rows with 0 < decay_rate < 1
 * - Cleans up rows that fall below the minimum threshold
 */
export async function decayPrestigeEventsOneWeek(): Promise<void> {
  const PRESTIGE_EVENT_MIN_AMOUNT = 0.001;

  try {
    const prestigeRows = await listPrestigeEventsForDecay();
    if (prestigeRows && prestigeRows.length > 0) {
      const toDelete: string[] = [];
      for (const row of prestigeRows) {
        const newAmount = (row.amount_base || 0) * (row.decay_rate || 1);
        // For both positive and negative values, check if absolute value is below threshold
        if (Math.abs(newAmount) < PRESTIGE_EVENT_MIN_AMOUNT) {
          toDelete.push(row.id);
        } else {
          await updatePrestigeEventAmount(row.id, newAmount);
        }
      }
      if (toDelete.length > 0) {
        await deletePrestigeEvents(toDelete);
      }
    }
  } catch (error) {
    console.error('Failed to apply weekly decay to prestige events:', error);
  }
}

/**
 * Apply one week of decay to relationship boosts only.
 * - Multiplies amount by decay_rate for rows with 0 < decay_rate < 1
 * - Cleans up rows that fall below the minimum threshold
 */
export async function decayRelationshipBoostsOneWeek(): Promise<void> {
  const RELATIONSHIP_MIN_AMOUNT = 0.001;
  try {
    const boostRows = await listRelationshipBoostsForDecay();
    if (boostRows && boostRows.length > 0) {
      const toDeleteBoosts: string[] = [];
      for (const row of boostRows) {
        const newAmount = (row.amount || 0) * (row.decay_rate || 1);
        if (newAmount < RELATIONSHIP_MIN_AMOUNT) {
          toDeleteBoosts.push(row.id);
        } else {
          await updateRelationshipBoostAmount(row.id, newAmount);
        }
      }
      if (toDeleteBoosts.length > 0) {
        await deleteRelationshipBoosts(toDeleteBoosts);
      }
    }
  } catch (error) {
    console.error('Failed to apply weekly decay to relationship boosts:', error);
  }
}
