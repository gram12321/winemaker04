// Prestige events management service - handles dynamic prestige system
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { getGameState } from '../services/gameState';
import { loadVineyards } from './database';
import { getCurrentCompany } from '../services/gameState';

/**
 * Calculate current prestige from all events with decay
 */
export async function calculateCurrentPrestige(companyId?: string): Promise<{
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
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  const { data, error } = await supabase
    .from('prestige_events')
    .select('*')
    .eq('company_id', companyId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Failed to load prestige events:', error);
    return { totalPrestige: 1, eventBreakdown: [] }; // Fallback to starting prestige
  }

  const events = data || [];
  const currentTime = Date.now();
  const cleanupCandidates: string[] = [];
  
  const eventBreakdown = events.map(row => {
    const event = {
      id: row.id,
      type: row.type,
      amount: row.amount,
      timestamp: row.timestamp,
      decayRate: row.decay_rate,
      description: row.description,
      sourceId: row.source_id
    };

    let currentAmount = event.amount;
    
    if (event.decayRate > 0 && event.decayRate < 1) {
      // Calculate decay based on time elapsed
      const timeElapsed = currentTime - event.timestamp;
      const weeksElapsed = timeElapsed / (1000 * 60 * 60 * 24 * 7); // Convert to weeks
      currentAmount = event.amount * Math.pow(event.decayRate, weeksElapsed);
      
      // Mark for cleanup if decayed below threshold
      if (currentAmount < 0.1) {
        cleanupCandidates.push(event.id);
        currentAmount = 0; // Don't count in total
      }
    }
    
    return {
      id: event.id,
      type: event.type,
      description: event.description,
      originalAmount: event.amount,
      currentAmount,
      decayRate: event.decayRate
    };
  });

  // Clean up decayed events (fire and forget)
  if (cleanupCandidates.length > 0) {
    supabase
      .from('prestige_events')
      .delete()
      .in('id', cleanupCandidates)
      .then(() => console.log(`[Prestige] Cleaned up ${cleanupCandidates.length} decayed events`));
  }

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
  description: string,
  companyId?: string
): Promise<void> {
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  // Try to find existing event for this source
  const { data: existingEvents, error: fetchError } = await supabase
    .from('prestige_events')
    .select('id, amount')
    .eq('type', type)
    .eq('source_id', sourceId)
    .eq('company_id', companyId)
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
        timestamp: Date.now() // Update timestamp for base prestige changes
      })
      .eq('id', existingEvents[0].id);

    if (error) {
      console.error('Failed to update prestige event:', error);
    }
  } else {
    // Create new base prestige event
    const { error } = await supabase
      .from('prestige_events')
      .insert([{
        id: uuidv4(),
        type,
        amount: newAmount,
        timestamp: Date.now(),
        decay_rate: 0, // Base prestige doesn't decay
        description,
        source_id: sourceId,
        company_id: companyId
      }]);

    if (error) {
      console.error('Failed to create prestige event:', error);
    }
  }
}

/**
 * Add prestige from a wine sale
 */
export async function addSalePrestigeEvent(
  saleValue: number,
  customerName: string,
  wineName: string,
  companyId?: string
): Promise<void> {
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  const prestigeAmount = saleValue / 10000; // Same formula as old system
  const description = `Sale to ${customerName}: ${wineName}`;
  
  const { error } = await supabase
    .from('prestige_events')
    .insert([{
      id: uuidv4(),
      type: 'sale',
      amount: prestigeAmount,
      timestamp: Date.now(),
      decay_rate: 0.95, // 5% weekly decay
      description,
      source_id: null,
      company_id: companyId
    }]);

  if (error) {
    console.error('Failed to create sale prestige event:', error);
  }
}

/**
 * Initialize base prestige events from current game state
 */
export async function initializeBasePrestigeEvents(companyId?: string): Promise<void> {
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  const gameState = getGameState();
  
  // Create company value prestige event
  const companyValuePrestige = (gameState.money || 0) / 10000000; // Same formula as old system
  await updateBasePrestigeEvent(
    'company_value',
    'company_money',
    companyValuePrestige,
    `Company value: €${(gameState.money || 0).toLocaleString()}`,
    companyId
  );
  
  // Create vineyard prestige events
  await updateVineyardPrestigeEvents(companyId);
}

/**
 * Update vineyard prestige events based on current vineyards
 */
export async function updateVineyardPrestigeEvents(companyId?: string): Promise<void> {
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  try {
    const vineyards = await loadVineyards(companyId);
    
    for (const vineyard of vineyards) {
      const vineyardPrestige = vineyard.fieldPrestige || 1; // Use fieldPrestige or default to 1
      await updateBasePrestigeEvent(
        'vineyard',
        vineyard.id,
        vineyardPrestige,
        `Vineyard: ${vineyard.name} (${vineyard.region}, ${vineyard.country})`,
        companyId
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
  description: string,
  companyId?: string
): Promise<void> {
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  // Calculate boost amount with diminishing returns for higher prestige companies
  const prestigeFactor = 1 / (1 + companyPrestige / 100);
  const boostAmount = (orderValue / 10000) * prestigeFactor * 0.1;

  const { error } = await supabase
    .from('relationship_boosts')
    .insert([{
      id: uuidv4(),
      customer_id: customerId,
      amount: boostAmount,
      timestamp: Date.now(),
      decay_rate: 0.95, // Same as sales prestige events
      description,
      company_id: companyId
    }]);

  if (error) {
    console.error('Failed to create relationship boost:', error);
  }
}

/**
 * Calculate current relationship boost for a customer with decay
 */
export async function calculateCustomerRelationshipBoost(customerId: string, companyId?: string): Promise<number> {
  // Get current company ID if not provided
  if (!companyId) {
    const currentCompany = getCurrentCompany();
    companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  }

  const { data, error } = await supabase
    .from('relationship_boosts')
    .select('*')
    .eq('customer_id', customerId)
    .eq('company_id', companyId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Failed to load relationship boosts:', error);
    return 0;
  }

  const boosts = data || [];
  const currentTime = Date.now();
  const cleanupCandidates: string[] = [];
  
  let totalBoost = 0;
  
  for (const row of boosts) {
    const boost = {
      id: row.id,
      customerId: row.customer_id,
      amount: row.amount,
      timestamp: row.timestamp,
      decayRate: row.decay_rate,
      description: row.description
    };

    let currentAmount = boost.amount;
    
    if (boost.decayRate > 0 && boost.decayRate < 1) {
      const timeElapsed = currentTime - boost.timestamp;
      const weeksElapsed = timeElapsed / (1000 * 60 * 60 * 24 * 7);
      currentAmount = boost.amount * Math.pow(boost.decayRate, weeksElapsed);
      
      if (currentAmount < 0.01) { // Lower threshold for relationship boosts
        cleanupCandidates.push(boost.id);
        currentAmount = 0;
      }
    }
    
    totalBoost += currentAmount;
  }

  // Clean up decayed boosts (fire and forget)
  if (cleanupCandidates.length > 0) {
    supabase
      .from('relationship_boosts')
      .delete()
      .in('id', cleanupCandidates)
      .then(() => console.log(`[Relationship] Cleaned up ${cleanupCandidates.length} decayed boosts`));
  }

  return totalBoost;
}
