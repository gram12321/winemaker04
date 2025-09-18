// Prestige events management service - handles dynamic prestige system
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { getGameState } from '../services/gameState';
import { loadVineyards, saveVineyard } from './database';
import { calculateGrapeSuitabilityContribution } from '../services/wine/vineyardValueCalc';
import { vineyardAgePrestigeModifier, calculateAsymmetricalMultiplier } from '../utils/calculator';
import { getCompanyQuery, getCurrentCompanyId } from '../utils/companyUtils';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks } from '../utils/utils';

/**
 * Generate tooltip calculation text for vineyard prestige events
 */
export function getVineyardPrestigeEventCalculation(event: { type: string; description: string; currentAmount: number }): string | null {
  if (event.type === 'vineyard_age') {
    // Extract age and suitability from description: "Vine Age (X years, Y% suitability)"
    const ageMatch = event.description.match(/\((\d+) years, (\d+)% suitability\)/);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      const suitability = parseInt(ageMatch[2]) / 100;
      
      // Calculate the actual values using the real functions
      const ageFactor = vineyardAgePrestigeModifier(age);
      const agePrestige = calculateAsymmetricalMultiplier(ageFactor);
      const modifiedAgePrestige = agePrestige * suitability;
      
      return `ageModifier(${age}) = ${ageFactor.toFixed(2)} → ${agePrestige.toFixed(2)} × ${suitability.toFixed(2)} = ${modifiedAgePrestige.toFixed(2)}`;
    }
  }
  
  if (event.type === 'vineyard_land') {
    // Extract land value info from description: "Land Value (€X/ha × Yha, Z% suitability)"
    const landMatch = event.description.match(/€([\d,]+)\/ha × ([\d.]+)ha, (\d+)% suitability/);
    if (landMatch) {
      const landValuePerHectare = parseInt(landMatch[1].replace(/,/g, ''));
      const hectares = parseFloat(landMatch[2]);
      const suitability = parseInt(landMatch[3]) / 100;
      const totalLandValue = landValuePerHectare * hectares;
      const landValuePrestige = Math.log(totalLandValue / 1000000 + 1) * 2;
      return `log(€${totalLandValue.toLocaleString()}/1M+1)×2 = ${landValuePrestige.toFixed(2)} × ${suitability.toFixed(2)} = ${event.currentAmount.toFixed(2)}`;
    }
  }
  
  return null;
}

/**
 * Update or create the base company value prestige event based on current money.
 */
export async function updateCompanyValuePrestige(money: number): Promise<void> {
  try {
    const companyValuePrestige = Math.log((money || 0) / 1000000 + 1) * 2;
    await updateBasePrestigeEvent(
      'company_value',
      'company_money',
      companyValuePrestige,
      `Company value: €${(money || 0).toLocaleString()}`
    );
  } catch (error) {
    console.error('Failed to update company value prestige:', error);
  }
}

/**
 * Calculate current prestige from all events with decay
 * Now includes separate breakdown for company and vineyard prestige
 */
export async function calculateCurrentPrestige(): Promise<{
  totalPrestige: number;
  companyPrestige: number;
  vineyardPrestige: number;
  eventBreakdown: Array<{
    id: string;
    type: string;
    description: string;
    originalAmount: number;
    currentAmount: number;
    decayRate: number;
    category: 'company' | 'vineyard';
  }>;
  vineyards: Array<{
    id: string;
    name: string;
    prestige: number;
    events: Array<{
      id: string;
      type: string;
      description: string;
      originalAmount: number;
      currentAmount: number;
      decayRate: number;
    }>;
  }>;
}> {
  const { data, error } = await getCompanyQuery('prestige_events')
    .order('created_game_week', { ascending: false });

  if (error) {
    console.error('Failed to load prestige events:', error);
    return { 
      totalPrestige: 1, 
      companyPrestige: 1, 
      vineyardPrestige: 0, 
      eventBreakdown: [],
      vineyards: []
    }; // Fallback to starting prestige
  }

  const events = data || [];
  
  // No real-time decay here. Amounts are assumed to have been decayed on weekly ticks.
  const eventBreakdown = events.map(row => {
    const isVineyardEvent = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land'].includes(row.type);
    
    return {
    id: row.id,
    type: row.type,
    description: row.description,
    originalAmount: row.amount,
    currentAmount: row.amount,
      decayRate: row.decay_rate,
      category: isVineyardEvent ? 'vineyard' as const : 'company' as const
    };
  });

  const companyPrestige = eventBreakdown
    .filter(event => event.category === 'company')
    .reduce((sum, event) => sum + event.currentAmount, 0);
    
  const vineyardPrestige = eventBreakdown
    .filter(event => event.category === 'vineyard')
    .reduce((sum, event) => sum + event.currentAmount, 0);


  const totalPrestige = companyPrestige + vineyardPrestige;

  // Load vineyards and group vineyard events by vineyard
  const vineyards = await loadVineyards();
  const vineyardEvents = eventBreakdown.filter(event => event.category === 'vineyard');
  
  const vineyardData = vineyards.map(vineyard => {
    // Find events for this vineyard (by source_id starting with vineyard.id)
    const vineyardEventList = vineyardEvents.filter(event => {
      // Get the original event from the database to access sourceId
      const originalEvent = events.find(e => e.id === event.id);
      return originalEvent?.source_id?.startsWith(vineyard.id);
    });
    
    const vineyardPrestigeTotal = vineyardEventList.reduce((sum, event) => sum + event.currentAmount, 0);
    
    return {
      id: vineyard.id,
      name: vineyard.name,
      prestige: vineyardPrestigeTotal,
      events: vineyardEventList.map(event => ({
        id: event.id,
        type: event.type,
        description: event.description,
        originalAmount: event.originalAmount,
        currentAmount: event.currentAmount,
        decayRate: event.decayRate
      }))
    };
  }).filter(vineyard => vineyard.events.length > 0); // Only include vineyards with events

  // Persist the current vineyard prestige total back to vineyard records for quick UI access
  try {
    for (const v of vineyardData) {
      const dbVine = vineyards.find(x => x.id === v.id);
      if (dbVine && (dbVine.vineyardPrestige ?? 0) !== v.prestige) {
        await saveVineyard({ ...dbVine, vineyardPrestige: v.prestige });
      }
    }
  } catch (e) {
    console.warn('Failed to persist vineyard prestige snapshot:', e);
  }

  return {
    totalPrestige: Math.max(1, totalPrestige), // Minimum 1 prestige
    companyPrestige: Math.max(1, companyPrestige), // Company base minimum
    vineyardPrestige: Math.max(0, vineyardPrestige), // Vineyard can be 0
    eventBreakdown: eventBreakdown.filter(event => event.currentAmount > 0),
    vineyards: vineyardData
  };
}

/**
 * Update or create base prestige events (company value)
 */
export async function updateBasePrestigeEvent(
  type: 'company_value' | 'vineyard' | 'vineyard_base' | 'vineyard_age' | 'vineyard_land' | 'vineyard_region',
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
 * Add prestige event for a vineyard-specific wine sale
 * Uses vineyard prestige as multiplier for the sale value
 */
export async function addVineyardSalePrestigeEvent(
  saleValue: number,
  customerName: string,
  wineName: string,
  vineyardId: string,
  vineyardPrestigeFactor: number
): Promise<void> {
  // Base prestige amount multiplied by vineyard quality factor
  const basePrestigeAmount = saleValue / 10000;
  const prestigeAmount = basePrestigeAmount * vineyardPrestigeFactor;
  const description = `Vineyard sale to ${customerName}: ${wineName} (${vineyardPrestigeFactor.toFixed(2)}x factor)`;
  
  const { error } = await supabase
    .from('prestige_events')
    .insert([{
      id: uuidv4(),
      type: 'vineyard_sale',
      amount: prestigeAmount,
      created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
      decay_rate: 0.95, // 5% weekly decay
      description,
      source_id: vineyardId,
      company_id: getCurrentCompanyId()
    }]);

  if (error) {
    console.error('Failed to create vineyard sale prestige event:', error);
  } else {
    triggerGameUpdate(); // Notify UI of prestige changes
  }
}

/**
 * Add prestige event for vineyard achievements (planting, harvesting)
 * Uses base vineyard prestige as multiplier to avoid circular dependencies
 */
export async function addVineyardAchievementPrestigeEvent(
  eventType: 'planting' | 'aging' | 'improvement' | 'harvest',
  vineyardId: string,
  baseVineyardPrestige: number,
  description?: string
): Promise<void> {
  const defaultDescription = `Planted ${eventType === 'planting' ? 'vines' : eventType === 'harvest' ? 'harvested' : eventType}`;
  
  // Use base vineyard prestige as multiplier (no circular dependency)
  const prestigeAmount = baseVineyardPrestige * 0.1; // 10% of base prestige
  
  const { error } = await supabase
    .from('prestige_events')
    .insert([{
      id: uuidv4(),
      type: 'vineyard_achievement',
      amount: prestigeAmount,
      created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
      decay_rate: 0.90, // 10% weekly decay (slower than sales)
      description: description || defaultDescription,
      source_id: vineyardId,
      company_id: getCurrentCompanyId()
    }]);

  if (error) {
    console.error('Failed to create vineyard achievement prestige event:', error);
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
  
  // Create base vineyard prestige events
  await createBaseVineyardPrestigeEvents();
}

/**
 * Calculate vineyard prestige from events (replaces the old calculation-based system)
 */
export async function calculateVineyardPrestigeFromEvents(vineyardId: string): Promise<number> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('amount, type')
    .eq('company_id', getCurrentCompanyId())
    .eq('source_id', vineyardId)
    .in('type', ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region']);

  if (error) {
    console.error('Failed to load vineyard prestige events:', error);
    return 0.1; // Fallback minimal prestige
  }

  const events = data || [];
  
  // Sum all vineyard-specific prestige events
  const totalVineyardPrestige = events.reduce((sum, event) => sum + event.amount, 0);
  
  // Convert to prestige factor (0.1 minimum, no upper limit)
  return Math.max(0.1, totalVineyardPrestige);
}

/**
 * Get vineyard prestige breakdown by vineyard
 */
export async function getVineyardPrestigeBreakdown(): Promise<{
  [vineyardId: string]: {
    totalPrestige: number;
    events: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
  };
}> {
  const { data, error } = await supabase
    .from('prestige_events')
    .select('source_id, amount, type, description')
    .eq('company_id', getCurrentCompanyId())
    .in('type', ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region'])
    .not('source_id', 'is', null);

  if (error) {
    console.error('Failed to load vineyard prestige breakdown:', error);
    return {};
  }

  const breakdown: { [vineyardId: string]: any } = {};
  
  for (const event of data || []) {
    const vineyardId = event.source_id!;
    
    if (!breakdown[vineyardId]) {
      breakdown[vineyardId] = {
        totalPrestige: 0,
        events: []
      };
    }
    
    breakdown[vineyardId].totalPrestige += event.amount;
    breakdown[vineyardId].events.push({
      type: event.type,
      amount: event.amount,
      description: event.description
    });
  }
  
  return breakdown;
}

/**
 * Create base vineyard prestige events (non-decaying)
 * Creates 4 separate base events for each vineyard factor
 */
export async function createBaseVineyardPrestigeEvents(): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    
    for (const vineyard of vineyards) {
      await createVineyardFactorPrestigeEvents(vineyard);
    }
  } catch (error) {
    console.error('Failed to create base vineyard prestige events:', error);
  }
}

/**
 * Create the 4 base prestige events for a single vineyard
 */
export async function createVineyardFactorPrestigeEvents(vineyard: any): Promise<void> {
  try {
    // 1. Vine Age Prestige (using calculateAsymmetricalMultiplier)
    const ageFactor = vineyardAgePrestigeModifier(vineyard.vineAge || 0);
    const agePrestige = calculateAsymmetricalMultiplier(ageFactor);
    
    await updateBasePrestigeEvent(
      'vineyard_age',
      `${vineyard.id}_age`,
      agePrestige,
      `Vine Age: ${vineyard.name} (${vineyard.vineAge || 0} years) - ageModifier(${vineyard.vineAge || 0}) = ${ageFactor.toFixed(2)} → ${agePrestige.toFixed(2)}`
    );

    // 2. Land Value Prestige (using vineyardTotalValue like company money)
    const landValuePrestige = Math.log((vineyard.vineyardTotalValue || 50000) / 1000000 + 1) * 2; // Same formula as company value
    
    await updateBasePrestigeEvent(
      'vineyard_land',
      `${vineyard.id}_land`,
      landValuePrestige,
      `Land Value: ${vineyard.name} (€${(vineyard.vineyardTotalValue || 50000).toLocaleString()}) - log(€${(vineyard.vineyardTotalValue || 50000).toLocaleString()}/1M+1)×2 = ${landValuePrestige.toFixed(2)}`
    );


    // 4. Grape Suitability (0-1 index, use as modifier for other factors)
    const grapeSuitability = calculateGrapeSuitabilityContribution(vineyard.grape, vineyard.region, vineyard.country);
    
    // Apply grape suitability as modifier to age and land value AFTER asymmetrical multiplier
    const modifiedAgePrestige = agePrestige * grapeSuitability;
    const modifiedLandPrestige = landValuePrestige * grapeSuitability;
    
    // Calculate land value per hectare for display
    const landValuePerHectare = (vineyard.landValue || 0) * 1000; // Convert to per hectare
    const hectares = vineyard.hectares || 1;
    
    // Update age and land events with grape suitability modifier
    await updateBasePrestigeEvent(
      'vineyard_age',
      `${vineyard.id}_age`,
      modifiedAgePrestige,
      `Vine Age (${vineyard.vineAge || 0} years, ${(grapeSuitability * 100).toFixed(0)}% suitability)`
    );
    
      await updateBasePrestigeEvent(
      'vineyard_land',
      `${vineyard.id}_land`,
      modifiedLandPrestige,
      `Land Value (€${landValuePerHectare.toLocaleString()}/ha × ${hectares.toFixed(2)}ha, ${(grapeSuitability * 100).toFixed(0)}% suitability)`
    );

  } catch (error) {
    console.error('Failed to create vineyard factor prestige events:', error);
  }
}

/**
 * Update base vineyard prestige events when vineyard properties change
 */
export async function updateBaseVineyardPrestigeEvent(vineyardId: string): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === vineyardId);
    
    if (!vineyard) {
      console.warn(`Vineyard ${vineyardId} not found for prestige update`);
      return;
    }
    
    // Update all 4 factor prestige events
    await createVineyardFactorPrestigeEvents(vineyard);
  } catch (error) {
    console.error('Failed to update base vineyard prestige event:', error);
  }
}

/**
 * Get base vineyard prestige amount for a specific vineyard (sum of all 4 factors)
 */
export async function getBaseVineyardPrestige(vineyardId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('prestige_events')
      .select('amount, type')
      .eq('company_id', getCurrentCompanyId())
      .in('type', ['vineyard_age', 'vineyard_land', 'vineyard_region'])
      .or(`source_id.eq.${vineyardId}_age,source_id.eq.${vineyardId}_land,source_id.eq.${vineyardId}_region`);

    if (error || !data || data.length === 0) {
      console.warn(`No base vineyard prestige found for vineyard ${vineyardId}`);
      return 1.0; // Fallback to minimum base prestige
    }

    // Sum all 4 factor prestige amounts
    const totalPrestige = data.reduce((sum, event) => sum + (event.amount || 0), 0);
    return Math.max(1.0, totalPrestige); // Ensure minimum of 1.0
  } catch (error) {
    console.error('Failed to get base vineyard prestige:', error);
    return 1.0; // Fallback to minimum base prestige
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

