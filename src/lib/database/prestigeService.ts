// Prestige events management service - handles dynamic prestige system
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { getGameState } from '../services/gameState';
import { loadVineyards } from './database';
import { calculateVineyardPrestige } from '../services/wine/vineyardValueCalc';
import { getCompanyQuery, getCurrentCompanyId } from '../utils/companyUtils';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks } from '../utils/utils';

/**
 * Calculate current prestige from all events with decay
 */
export async function calculateCurrentPrestige(): Promise<{
  totalPrestige: number;
  eventBreakdown: Array<{
    id: string;
    type: string;
    description: string;
    originalAmount: number;
    currentAmount: number;
    decayRate: number;
  }>;
}> {
  const { data, error } = await getCompanyQuery('prestige_events')
    .order('created_game_week', { ascending: false });

  if (error) {
    console.error('Failed to load prestige events:', error);
    return { totalPrestige: 1, eventBreakdown: [] }; // Fallback to starting prestige
  }

  const events = data || [];
  
  // No real-time decay here. Amounts are assumed to have been decayed on weekly ticks.
  const eventBreakdown = events.map(row => ({
    id: row.id,
    type: row.type,
    description: row.description,
    originalAmount: row.amount,
    currentAmount: row.amount,
    decayRate: row.decay_rate
  }));

  const totalPrestige = eventBreakdown.reduce((sum, event) => sum + event.currentAmount, 0);

  return {
    totalPrestige: Math.max(1, totalPrestige), // Minimum 1 prestige
    eventBreakdown: eventBreakdown.filter(event => event.currentAmount > 0)
  };
}

/**
 * Update or create base prestige events (company value)
 */
export async function updateBasePrestigeEvent(
  type: 'company_value' | 'vineyard',
  sourceId: string,
  newAmount: number,
  description: string
): Promise<void> {
  // Try to find existing event for this source
  const { data: existingEvents, error: fetchError } = await supabase
    .from('prestige_events')
    .select('id, amount')
    .eq('company_id', getCurrentCompanyId())
    .eq('type', type)
    .eq('source_id', sourceId)
    .limit(1);

  if (fetchError) {
    console.error('Failed to fetch existing prestige event:', fetchError);
    return;
  }

  if (existingEvents && existingEvents.length > 0) {
    // Update existing event
    const { error } = await supabase
      .from('prestige_events')
      .update({ 
        amount: newAmount,
        description: description,
        timestamp: Date.now() // Update timestamp for base prestige changes
      })
      .eq('id', existingEvents[0].id)
      .eq('company_id', getCurrentCompanyId());

    if (error) {
      console.error('Failed to update prestige event:', error);
    } else {
      triggerGameUpdate(); // Notify UI of prestige changes
    }
  } else {
    // Create new base prestige event
    const { error } = await supabase
      .from('prestige_events')
      .insert([{
        id: uuidv4(),
        type,
        amount: newAmount,
        created_game_week: (() => { const gs = getGameState(); return calculateAbsoluteWeeks(gs.week!, gs.season!, gs.currentYear!); })(),
        decay_rate: 0, // Base prestige doesn't decay
        description,
        source_id: sourceId,
        company_id: getCurrentCompanyId()
      }]);

    if (error) {
      console.error('Failed to create prestige event:', error);
    } else {
      triggerGameUpdate(); // Notify UI of prestige changes
    }
  }
}

/**
 * Add prestige from a wine sale
 */
export async function addSalePrestigeEvent(
  saleValue: number,
  customerName: string,
  wineName: string
): Promise<void> {
  const prestigeAmount = saleValue / 10000; // Reverted to original scaling
  const description = `Sale to ${customerName}: ${wineName}`;
  
  const { error } = await supabase
    .from('prestige_events')
    .insert([{
      id: uuidv4(),
      type: 'sale',
      amount: prestigeAmount,
      created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
      decay_rate: 0.95, // 5% weekly decay
      description,
      source_id: null,
      company_id: getCurrentCompanyId()
    }]);

  if (error) {
    console.error('Failed to create sale prestige event:', error);
  } else {
    triggerGameUpdate(); // Notify UI of prestige changes
  }
}

/**
 * Initialize base prestige events from current game state
 */
export async function initializeBasePrestigeEvents(): Promise<void> {
  const gameState = getGameState();
  
  // Create company value prestige event with logarithmic scaling for diminishing returns
  const companyValuePrestige = Math.log((gameState.money || 0) / 1000000 + 1) * 2;
  await updateBasePrestigeEvent(
    'company_value',
    'company_money',
    companyValuePrestige,
    `Company value: €${(gameState.money || 0).toLocaleString()}`
  );
  
  // Create vineyard prestige events
  await updateVineyardPrestigeEvents();
}

/**
 * Update vineyard prestige events based on current vineyards
 */
export async function updateVineyardPrestigeEvents(): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    
    for (const vineyard of vineyards) {
      // Use the new sophisticated vineyard prestige calculation
      const vineyardPrestige = calculateVineyardPrestige(vineyard);
      await updateBasePrestigeEvent(
        'vineyard',
        vineyard.id,
        vineyardPrestige,
        `Vineyard: ${vineyard.name} (${vineyard.region}, ${vineyard.country})`
      );
    }
  } catch (error) {
    console.error('Failed to update vineyard prestige events:', error);
  }
}

// ===== RELATIONSHIP BOOSTS =====

/**
 * Create a relationship boost when an order is accepted
 */
export async function createRelationshipBoost(
  customerId: string,
  orderValue: number,
  companyPrestige: number,
  description: string
): Promise<void> {
  // Calculate boost amount with diminishing returns for higher prestige companies
  const prestigeFactor = 1 / (1 + companyPrestige / 100);
  const boostAmount = (orderValue / 10000) * prestigeFactor * 0.1;

  const { error } = await supabase
    .from('relationship_boosts')
    .insert([{
      id: uuidv4(),
      customer_id: customerId,
      amount: boostAmount,
      created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
      decay_rate: 0.95, // Same as sales prestige events
      description,
      company_id: getCurrentCompanyId()
    }]);

  if (error) {
    console.error('Failed to create relationship boost:', error);
  } else {
    triggerGameUpdate(); // Notify UI of relationship changes
  }
}

/**
 * Calculate current relationship boost for a customer (amounts are pre-decayed on weekly ticks)
 */
export async function calculateCustomerRelationshipBoost(customerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('relationship_boosts')
    .select('*')
    .eq('company_id', getCurrentCompanyId())
    .eq('customer_id', customerId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Failed to load relationship boosts:', error);
    return 0;
  }

  const boosts = data || [];
  
  // Sum current amounts directly; decay occurs on weekly ticks
  const totalBoost = boosts.reduce((sum, row) => sum + (row.amount || 0), 0);
  return totalBoost;
}

// ===== WEEKLY DECAY (game tick driven) =====

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

