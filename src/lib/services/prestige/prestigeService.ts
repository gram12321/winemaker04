// Prestige service - handles prestige business logic
import { getGameState } from '../core/gameState';
import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';
import { calculateGrapeSuitabilityContribution } from '../vineyard/vineyardValueCalc';
import { vineyardAgePrestigeModifier, calculateAsymmetricalMultiplier } from '../../utils/calculator';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks } from '../../utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { upsertPrestigeEventBySource, insertPrestigeEvent, listPrestigeEvents, listPrestigeEventsForUI } from '../../database/customers/prestigeEventsDB';
import { getMaxLandValue } from '../sales/wineValueIndexCalculationService';
import type { PrestigeEvent, Vineyard, VineyardPrestigeFactors } from '../../types/types';

// ============================================================================
// INITIALIZATION & SETUP FUNCTIONS
// ============================================================================

/**
 * Initialize base prestige events from current game state
 */
export async function initializeBasePrestigeEvents(): Promise<void> {
  const gameState = getGameState();
  
  // Create company value prestige event with logarithmic scaling for diminishing returns
  const maxLandValue = getMaxLandValue();
  const companyValuePrestige = Math.log((gameState.money || 0) / maxLandValue + 1);
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
 * Create base vineyard prestige events (non-decaying)
 * Creates 2 base events for each vineyard: vine age and land value
 * Both are modified by grape suitability
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

// ============================================================================
// CALCULATION & COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Compute derived prestige factors for a vineyard
 * Returns 0-1 bases, 0-1 with suitability, and scaled event amounts (>=0)
 */
export function computeVineyardPrestigeFactors(vineyard: Vineyard): VineyardPrestigeFactors {
  const grapeSuitability = calculateGrapeSuitabilityContribution(
    vineyard.grape as any,
    vineyard.region,
    vineyard.country
  );

  // Age → base01
  const ageBase01 = vineyardAgePrestigeModifier(vineyard.vineAge || 0);
  const ageWithSuitability01 = Math.max(0, Math.min(1, ageBase01 * grapeSuitability));
  const ageScaled = Math.max(0, calculateAsymmetricalMultiplier(Math.min(0.99, ageWithSuitability01)) - 1);

  // Land value uses total vineyard value for prestige (asset prestige)
  const maxLandValue = getMaxLandValue();
  const landValuePerHectare = (vineyard.landValue || 0) * 1000; // Convert to per hectare
  const landBase01 = Math.log((vineyard.vineyardTotalValue) / Math.max(1, maxLandValue) + 1);
  const landWithSuitability01 = Math.max(0, Math.min(1, landBase01 * grapeSuitability));
  const landScaled = Math.max(0, calculateAsymmetricalMultiplier(Math.min(0.99, landWithSuitability01)) - 1);

  return {
    maxLandValue,
    landValuePerHectare,
    ageBase01,
    landBase01,
    ageWithSuitability01,
    landWithSuitability01,
    ageScaled,
    landScaled,
  };
}

/**
 * Calculate current prestige from all events with decay
 * Now includes separate breakdown for company and vineyard prestige
 */
export async function calculateCurrentPrestige(): Promise<{
  totalPrestige: number;
  companyPrestige: number;
  vineyardPrestige: number;
  eventBreakdown: PrestigeEvent[];
  vineyards: Array<{
    id: string;
    name: string;
    prestige: number;
    events: PrestigeEvent[];
  }>;
}> {
  const events = await listPrestigeEventsForUI();
  if (!events) {
    return { totalPrestige: 1, companyPrestige: 1, vineyardPrestige: 0, eventBreakdown: [], vineyards: [] };
  }
  
  // No real-time decay here. Amounts are assumed to have been decayed on weekly ticks.
  const eventBreakdown = events.map(event => {
    const isVineyardEvent = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land'].includes(event.type);
    
    return {
      ...event,
      category: isVineyardEvent ? 'vineyard' as const : 'company' as const
    };
  });

  const companyPrestige = eventBreakdown
    .filter(event => event.category === 'company')
    .reduce((sum, event) => sum + (event.currentAmount ?? event.amount), 0);
    
  const vineyardPrestige = eventBreakdown
    .filter(event => event.category === 'vineyard')
    .reduce((sum, event) => sum + (event.currentAmount ?? event.amount), 0);


  const totalPrestige = companyPrestige + vineyardPrestige;

  // Load vineyards and group vineyard events by vineyard
  const vineyards = await loadVineyards();
  const vineyardEvents = eventBreakdown.filter(event => event.category === 'vineyard');
  
  const vineyardData = vineyards.map(vineyard => {
    // Find events for this vineyard (by source_id starting with vineyard.id)
    const vineyardEventList = vineyardEvents.filter(event => {
      return event.sourceId?.startsWith(vineyard.id);
    });
    
    const vineyardPrestigeTotal = vineyardEventList.reduce((sum, event) => sum + (event.currentAmount ?? event.amount), 0);
    
    return {
      id: vineyard.id,
      name: vineyard.name,
      prestige: vineyardPrestigeTotal,
      events: vineyardEventList
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
    eventBreakdown: eventBreakdown.filter(event => (event.currentAmount ?? event.amount) > 0),
    vineyards: vineyardData
  };
}

/**
 * Calculate vineyard prestige from events
 */
export async function calculateVineyardPrestigeFromEvents(vineyardId: string): Promise<number> {
  try {
    const events = await listPrestigeEvents();
    const vineyardEvents = events.filter(event => 
      event.source_id === vineyardId &&
      ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region'].includes(event.type)
    );
    
    // Sum all vineyard-specific prestige events
    const totalVineyardPrestige = vineyardEvents.reduce((sum: number, event: any) => sum + (event.amount || 0), 0);
    
    // Convert to prestige factor (0.1 minimum, no upper limit)
    return Math.max(0.1, totalVineyardPrestige);
  } catch (error) {
    console.error('Failed to load vineyard prestige events:', error);
    return 0.1; // Fallback minimal prestige
  }
}

/**
 * Get base vineyard prestige amount for a specific vineyard (sum of both factors: vine age and land value)
 */
export async function getBaseVineyardPrestige(vineyardId: string): Promise<number> {
  const events = await listPrestigeEvents();
  const baseEvents = events.filter(event => 
    event.type === 'vineyard_age' || event.type === 'vineyard_land'
  ).filter(event => 
    event.source_id === `${vineyardId}_age` || 
    event.source_id === `${vineyardId}_land`
  );

  if (baseEvents.length === 0) {
    throw new Error(`No base vineyard prestige found for vineyard ${vineyardId}`);
  }

  // Sum both prestige factors (vine age and land value)
  const totalPrestige = baseEvents.reduce((sum: number, event: any) => sum + (event.amount || 0), 0);
  return totalPrestige;
}

// ============================================================================
// EVENT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Update or create base prestige events (company value)
 */
export async function updateBasePrestigeEvent(
  type: 'company_value' | 'vineyard' | 'vineyard_base' | 'vineyard_age' | 'vineyard_land' | 'vineyard_region',
  sourceId: string,
  newAmount: number,
  description: string,
  metadata?: PrestigeEvent['metadata']
): Promise<void> {
  const isVineyardEvent = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land'].includes(type);
  
  // Try to find existing event for this source
  await upsertPrestigeEventBySource(type, sourceId, {
    amount: newAmount,
    description,
    timestamp: Date.now(),
    created_game_week: (() => { const gs = getGameState(); return calculateAbsoluteWeeks(gs.week!, gs.season!, gs.currentYear!); })(),
    decay_rate: 0,
    metadata,
    // New UI fields
    original_amount: newAmount,
    current_amount: newAmount,
    category: isVineyardEvent ? 'vineyard' : 'company',
  });
  triggerGameUpdate();
}

/**
 * Update or create the base company value prestige event based on current money.
 */
export async function updateCompanyValuePrestige(money: number): Promise<void> {
  try {
    const maxLandValue = getMaxLandValue();
    const companyValuePrestige = Math.log((money || 0) / maxLandValue + 1);
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
 * Create the 2 base prestige events for a single vineyard
 * 1. Vine Age Prestige (modified by grape suitability)
 * 2. Land Value Prestige (modified by grape suitability)
 * Note: Regional prestige, aspect, and altitude are already included in land value calculation
 */
export async function createVineyardFactorPrestigeEvents(vineyard: any): Promise<void> {
  try {
    const factors = computeVineyardPrestigeFactors(vineyard);

    await updateBasePrestigeEvent(
      'vineyard_age',
      `${vineyard.id}_age`,
      factors.ageScaled,
      `Vine Age: ${vineyard.name} (${vineyard.vineAge || 0} years) — base=${factors.ageBase01.toFixed(2)} × suitability → scaled=(asym(${factors.ageWithSuitability01.toFixed(2)})−1)=${factors.ageScaled.toFixed(2)}`,
      {
        vineyardName: vineyard.name,
        vineyardId: vineyard.id,
        vineAge: vineyard.vineAge || 0,
        ageBase01: factors.ageBase01,
        ageWithSuitability01: factors.ageWithSuitability01,
      }
    );

    // 2) Land Value — derived via compute helper
    const hectares = vineyard.hectares;

    await updateBasePrestigeEvent(
      'vineyard_land',
      `${vineyard.id}_land`,
      factors.landScaled,
      `Land Value: ${vineyard.name} (€${(vineyard.vineyardTotalValue).toLocaleString()}) — base=log(€${(vineyard.vineyardTotalValue ).toLocaleString()}/${factors.maxLandValue.toLocaleString()}+1)=${factors.landBase01.toFixed(2)} → scaled=(asym(${factors.landWithSuitability01.toFixed(2)})−1)=${factors.landScaled.toFixed(2)} | display: €${factors.landValuePerHectare.toLocaleString()}/ha × ${hectares.toFixed(2)}ha`,
      {
        vineyardName: vineyard.name,
        vineyardId: vineyard.id,
        totalValue: vineyard.vineyardTotalValue,
        landValuePerHectare: factors.landValuePerHectare,
        hectares: hectares,
        maxLandValue: factors.maxLandValue,
        landBase01: factors.landBase01,
        landWithSuitability01: factors.landWithSuitability01,
      }
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
    
    // Update both prestige events (vine age and land value)
    await createVineyardFactorPrestigeEvents(vineyard);
  } catch (error) {
    console.error('Failed to update base vineyard prestige event:', error);
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
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'sale',
    amount: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.95,
    description,
    source_id: null,
    // New UI fields
    original_amount: prestigeAmount,
    current_amount: prestigeAmount,
    category: 'company',
    metadata: {
      customerName,
      wineName,
      saleValue,
    },
  });

  triggerGameUpdate();
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
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'vineyard_sale',
    amount: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.95,
    description,
    source_id: vineyardId,
    // New UI fields
    original_amount: prestigeAmount,
    current_amount: prestigeAmount,
    category: 'vineyard',
    metadata: {
      customerName,
      wineName,
      saleValue,
      vineyardPrestigeFactor,
    },
  });

  triggerGameUpdate();
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
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'vineyard_achievement',
    amount: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.90,
    description: description || defaultDescription,
    source_id: vineyardId,
  });
  triggerGameUpdate();
}

// ============================================================================
// DATA RETRIEVAL & BREAKDOWN FUNCTIONS
// ============================================================================

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
      decayRate: number;
      originalAmount: number;
      currentAmount: number;
    }>;
  };
}> {
  try {
    const events = await listPrestigeEvents();
    const vineyardEvents = events.filter(event => 
      event.source_id !== null &&
      ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region'].includes(event.type)
    );

    const breakdown: { [vineyardId: string]: any } = {};
    
    for (const event of vineyardEvents) {
      // Extract vineyard ID from source_id (handles both direct vineyard IDs and suffixed ones like "vineyardId_age")
      let vineyardId = event.source_id!;
      if (vineyardId.includes('_')) {
        vineyardId = vineyardId.split('_')[0];
      }
      
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
        description: event.description,
        decayRate: event.decay_rate,
        originalAmount: event.amount,
        currentAmount: event.amount
      });
    }
    
    return breakdown;
  } catch (error) {
    console.error('Failed to load vineyard prestige breakdown:', error);
    return {};
  }
}

/**
 * Get structured event display data for UI
 * Replaces the need for parseEventDescription by providing structured data
 */
export function getEventDisplayData(event: PrestigeEvent): {
  title: string;
  titleBase: string;
  amountText?: string;
  calc?: string;
  displayInfo?: string;
} {
  // Use structured metadata if available
  if (event.metadata) {
    const { metadata } = event;
    
    if (event.type === 'vineyard_age' && metadata.vineyardName && metadata.vineAge !== undefined) {
      return {
        title: `Vine Age: ${metadata.vineyardName} (${metadata.vineAge} years)`,
        titleBase: `Vine Age: ${metadata.vineyardName}`,
        amountText: `(${metadata.vineAge} years)`,
        calc: `base=${metadata.ageBase01?.toFixed(2)} × suitability → scaled=(asym(${metadata.ageWithSuitability01?.toFixed(2)})−1)=${event.amount.toFixed(2)}`,
      };
    }
    
    if (event.type === 'vineyard_land' && metadata.vineyardName && metadata.totalValue !== undefined) {
      return {
        title: `Land Value: ${metadata.vineyardName} (€${metadata.totalValue.toLocaleString()})`,
        titleBase: `Land Value: ${metadata.vineyardName}`,
        amountText: `(€${metadata.totalValue.toLocaleString()})`,
        calc: `base=log(€${metadata.totalValue.toLocaleString()}/${metadata.maxLandValue?.toLocaleString()}+1)=${metadata.landBase01?.toFixed(2)} → scaled=(asym(${metadata.landWithSuitability01?.toFixed(2)})−1)=${event.amount.toFixed(2)}`,
        displayInfo: `€${metadata.landValuePerHectare?.toLocaleString()}/ha × ${metadata.hectares?.toFixed(2)}ha`,
      };
    }
    
    if (event.type === 'sale' && metadata.customerName && metadata.wineName) {
      return {
        title: `Sale to ${metadata.customerName}: ${metadata.wineName}`,
        titleBase: `Sale to ${metadata.customerName}`,
        amountText: metadata.wineName,
      };
    }
  }

  // No fallback - all events should have metadata
  throw new Error(`Event ${event.id} (${event.type}) missing required metadata`);
}
