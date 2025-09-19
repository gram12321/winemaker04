// Weekly decay system for prestige events and relationship boosts
import { supabase } from '../supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';

/**
 * Apply one week of decay to prestige events only.
 * - Multiplies amount by decay_rate for rows with 0 < decay_rate < 1
 * - Cleans up rows that fall below the minimum threshold
 */
export async function decayPrestigeEventsOneWeek(): Promise<void> {
  const PRESTIGE_EVENT_MIN_AMOUNT = 0.001;

  try {
    // Decay prestige events
    const { data: prestigeRows, error: prestigeLoadError } = await supabase
      .from('prestige_events')
      .select('id, amount, decay_rate')
      .eq('company_id', getCurrentCompanyId())
      .gt('decay_rate', 0)
      .lt('decay_rate', 1);

    if (!prestigeLoadError && prestigeRows && prestigeRows.length > 0) {
      const toDelete: string[] = [];

      for (const row of prestigeRows) {
        const newAmount = (row.amount || 0) * (row.decay_rate || 1);
        if (newAmount < PRESTIGE_EVENT_MIN_AMOUNT) {
          toDelete.push(row.id);
        } else {
          await supabase
            .from('prestige_events')
            .update({ amount: newAmount })
            .eq('id', row.id)
            .eq('company_id', getCurrentCompanyId());
        }
      }

      if (toDelete.length > 0) {
        await supabase
          .from('prestige_events')
          .delete()
          .in('id', toDelete)
          .eq('company_id', getCurrentCompanyId());
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
    const { data: boostRows, error: boostLoadError } = await supabase
      .from('relationship_boosts')
      .select('id, amount, decay_rate')
      .eq('company_id', getCurrentCompanyId())
      .gt('decay_rate', 0)
      .lt('decay_rate', 1);

    if (!boostLoadError && boostRows && boostRows.length > 0) {
      const toDeleteBoosts: string[] = [];

      for (const row of boostRows) {
        const newAmount = (row.amount || 0) * (row.decay_rate || 1);
        if (newAmount < RELATIONSHIP_MIN_AMOUNT) {
          toDeleteBoosts.push(row.id);
        } else {
          await supabase
            .from('relationship_boosts')
            .update({ amount: newAmount })
            .eq('id', row.id)
            .eq('company_id', getCurrentCompanyId());
        }
      }

      if (toDeleteBoosts.length > 0) {
        await supabase
          .from('relationship_boosts')
          .delete()
          .in('id', toDeleteBoosts)
          .eq('company_id', getCurrentCompanyId());
      }
    }
  } catch (error) {
    console.error('Failed to apply weekly decay to relationship boosts:', error);
  }
}
