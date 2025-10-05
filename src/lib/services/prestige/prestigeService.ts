// Prestige service - handles prestige business logic
import { getGameState } from '../core/gameState';
import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';
import { calculateGrapeSuitabilityContribution } from '../vineyard/vineyardValueCalc';
import { vineyardAgePrestigeModifier, calculateAsymmetricalMultiplier } from '../../utils/calculator';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks } from '../../utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { upsertPrestigeEventBySource, insertPrestigeEvent, listPrestigeEvents, listPrestigeEventsForUI } from '../../database/customers/prestigeEventsDB';
import { getMaxLandValue } from '../wine/wineQualityCalculationService';
import type { PrestigeEvent, Vineyard } from '../../types/types';

// Internal calculation output for creating prestige events
type VineyardPrestigeFactors = {
  maxLandValue: number;
  landValuePerHectare: number;
  ageBase01: number;
  landBase01: number;
  ageWithSuitability01: number;
  landWithSuitability01: number;
  ageScaled: number;
  landScaled: number;
};

export async function initializeBasePrestigeEvents(): Promise<void> {
  const gameState = getGameState();
  const maxLandValue = getMaxLandValue();
  const companyValuePrestige = Math.log((gameState.money || 0) / maxLandValue + 1);
  
  await updateBasePrestigeEvent(
    'company_value',
    'company_money',
    companyValuePrestige,
    {
      label: 'Company Value',
      companyMoney: gameState.money || 0,
      maxLandValue: maxLandValue,
      prestigeBase01: companyValuePrestige,
    }
  );
  
  await createBaseVineyardPrestigeEvents();
}

export async function createBaseVineyardPrestigeEvents(): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    await Promise.all(vineyards.map(vineyard => createVineyardFactorPrestigeEvents(vineyard)));
  } catch (error) {
    console.error('Failed to create base vineyard prestige events:', error);
  }
}

export function computeVineyardPrestigeFactors(vineyard: Vineyard): VineyardPrestigeFactors {
  const grapeSuitability = calculateGrapeSuitabilityContribution(
    vineyard.grape as any,
    vineyard.region,
    vineyard.country
  );

  const ageBase01 = vineyardAgePrestigeModifier(vineyard.vineAge || 0);
  const ageWithSuitability01 = Math.max(0, Math.min(1, ageBase01 * grapeSuitability));
  const ageScaled = Math.max(0, calculateAsymmetricalMultiplier(Math.min(0.99, ageWithSuitability01)) - 1);

  const maxLandValue = getMaxLandValue();
  const landValuePerHectare = (vineyard.landValue || 0) * 1000;
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
  
  const vineyardEventTypes = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land'];
  const eventBreakdown = events.map(event => ({
    ...event,
    category: vineyardEventTypes.includes(event.type) ? 'vineyard' as const : 'company' as const
  }));

  const companyPrestige = eventBreakdown
    .filter(event => event.category === 'company')
    .reduce((sum, event) => sum + (event.currentAmount ?? event.amount), 0);
    
  const vineyardPrestige = eventBreakdown
    .filter(event => event.category === 'vineyard')
    .reduce((sum, event) => sum + (event.currentAmount ?? event.amount), 0);

  const totalPrestige = companyPrestige + vineyardPrestige;

  const vineyards = await loadVineyards();
  const vineyardEvents = eventBreakdown.filter(event => event.category === 'vineyard');
  
  const vineyardData = vineyards.map(vineyard => {
    const vineyardEventList = vineyardEvents.filter(event => 
      event.sourceId?.startsWith(vineyard.id)
    );
    
    const vineyardPrestigeTotal = vineyardEventList.reduce((sum, event) => 
      sum + (event.currentAmount ?? event.amount), 0
    );
    
    return {
      id: vineyard.id,
      name: vineyard.name,
      prestige: vineyardPrestigeTotal,
      events: vineyardEventList
    };
  }).filter(vineyard => vineyard.events.length > 0);

  // Persist vineyard prestige back to database
  try {
    await Promise.all(vineyardData.map(async (v) => {
      const dbVine = vineyards.find(x => x.id === v.id);
      if (dbVine && (dbVine.vineyardPrestige ?? 0) !== v.prestige) {
        await saveVineyard({ ...dbVine, vineyardPrestige: v.prestige });
      }
    }));
  } catch (e) {
    console.warn('Failed to persist vineyard prestige snapshot:', e);
  }

  return {
    totalPrestige: Math.max(1, totalPrestige),
    companyPrestige: Math.max(1, companyPrestige),
    vineyardPrestige: Math.max(0, vineyardPrestige),
    eventBreakdown: eventBreakdown.filter(event => (event.currentAmount ?? event.amount) > 0),
    vineyards: vineyardData
  };
}

export async function calculateVineyardPrestigeFromEvents(vineyardId: string): Promise<number> {
  try {
    const events = await listPrestigeEvents();
    const vineyardEventTypes = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region'];
    const vineyardEvents = events.filter(event => 
      event.source_id === vineyardId && vineyardEventTypes.includes(event.type)
    );
    
    const totalVineyardPrestige = vineyardEvents.reduce((sum: number, event: any) => sum + (event.amount || 0), 0);
    return Math.max(0.1, totalVineyardPrestige);
  } catch (error) {
    console.error('Failed to load vineyard prestige events:', error);
    return 0.1;
  }
}

export async function getBaseVineyardPrestige(vineyardId: string): Promise<number> {
  const events = await listPrestigeEvents();
  const baseEvents = events.filter(event => 
    (event.type === 'vineyard_age' || event.type === 'vineyard_land') &&
    (event.source_id === `${vineyardId}_age` || event.source_id === `${vineyardId}_land`)
  );

  if (baseEvents.length === 0) {
    throw new Error(`No base vineyard prestige found for vineyard ${vineyardId}`);
  }

  return baseEvents.reduce((sum: number, event: any) => sum + (event.amount || 0), 0);
}

export async function updateBasePrestigeEvent(
  type: 'company_value' | 'vineyard' | 'vineyard_base' | 'vineyard_age' | 'vineyard_land' | 'vineyard_region',
  sourceId: string,
  newAmount: number,
  metadata?: PrestigeEvent['metadata']
): Promise<void> {
  await upsertPrestigeEventBySource(type, sourceId, {
    amount_base: newAmount,
    created_game_week: (() => { const gs = getGameState(); return calculateAbsoluteWeeks(gs.week!, gs.season!, gs.currentYear!); })(),
    decay_rate: 0,
    payload: metadata,
  });
  triggerGameUpdate();
}

export async function updateCompanyValuePrestige(money: number): Promise<void> {
  try {
    const maxLandValue = getMaxLandValue();
    const companyValuePrestige = Math.log((money || 0) / maxLandValue + 1);
    await updateBasePrestigeEvent(
      'company_value',
      'company_money',
      companyValuePrestige,
      {
        label: 'Company Value',
        companyMoney: money,
        maxLandValue: maxLandValue,
        prestigeBase01: companyValuePrestige,
      }
    );
  } catch (error) {
    console.error('Failed to update company value prestige:', error);
  }
}

export async function createVineyardFactorPrestigeEvents(vineyard: any): Promise<void> {
  try {
    const factors = computeVineyardPrestigeFactors(vineyard);

    await updateBasePrestigeEvent(
      'vineyard_age',
      `${vineyard.id}_age`,
      factors.ageScaled,
      {
        label: 'Vine Age',
        vineyardName: vineyard.name,
        vineyardId: vineyard.id,
        vineAge: vineyard.vineAge || 0,
        ageBase01: factors.ageBase01,
        ageWithSuitability01: factors.ageWithSuitability01,
      }
    );

    await updateBasePrestigeEvent(
      'vineyard_land',
      `${vineyard.id}_land`,
      factors.landScaled,
      {
        label: 'Land Value',
        vineyardName: vineyard.name,
        vineyardId: vineyard.id,
        totalValue: vineyard.vineyardTotalValue,
        landValuePerHectare: factors.landValuePerHectare,
        hectares: vineyard.hectares,
        maxLandValue: factors.maxLandValue,
        landBase01: factors.landBase01,
        landWithSuitability01: factors.landWithSuitability01,
      }
    );

  } catch (error) {
    console.error('Failed to create vineyard factor prestige events:', error);
  }
}

export async function updateBaseVineyardPrestigeEvent(vineyardId: string): Promise<void> {
  try {
    const vineyards = await loadVineyards();
    const vineyard = vineyards.find(v => v.id === vineyardId);
    
    if (!vineyard) {
      console.warn(`Vineyard ${vineyardId} not found for prestige update`);
      return;
    }
    
    await createVineyardFactorPrestigeEvents(vineyard);
  } catch (error) {
    console.error('Failed to update base vineyard prestige event:', error);
  }
}

export async function addSalePrestigeEvent(
  saleValue: number,
  customerName: string,
  wineName: string
): Promise<void> {
  const prestigeAmount = saleValue / 10000;
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'sale',
    amount_base: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.95,
    source_id: null,
    payload: {
      label: 'Sale',
      customerName,
      wineName,
      saleValue,
    },
  });

  triggerGameUpdate();
}

export async function addVineyardSalePrestigeEvent(
  saleValue: number,
  customerName: string,
  wineName: string,
  vineyardId: string,
  vineyardPrestigeFactor: number
): Promise<void> {
  const basePrestigeAmount = saleValue / 10000;
  const prestigeAmount = basePrestigeAmount * vineyardPrestigeFactor;
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'vineyard_sale',
    amount_base: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.95,
    source_id: vineyardId,
    payload: {
      label: 'Vineyard Sale',
      vineyardId,
      vineyardName: '', // Will be filled by the service
      customerName,
      wineName,
      saleValue,
      vineyardPrestigeFactor,
    },
  });

  triggerGameUpdate();
}

export async function addVineyardAchievementPrestigeEvent(
  eventType: 'planting' | 'aging' | 'improvement' | 'harvest',
  vineyardId: string,
  baseVineyardPrestige: number
): Promise<void> {
  const prestigeAmount = baseVineyardPrestige * 0.1;
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'vineyard_achievement',
    amount_base: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.90,
    source_id: vineyardId,
    payload: {
      label: 'Vineyard Achievement',
      vineyardId,
      vineyardName: '', // Will be filled by the service
      event: eventType,
    },
  });
  triggerGameUpdate();
}

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
      metadata?: PrestigeEvent['metadata'];
    }>;
  };
}> {
  try {
    const events = await listPrestigeEvents();
    const vineyardEventTypes = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'vineyard_region'];
    const vineyardEvents = events.filter(event => 
      event.source_id !== null && vineyardEventTypes.includes(event.type)
    );

    const breakdown: { [vineyardId: string]: any } = {};
    
    for (const event of vineyardEvents) {
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
      
      breakdown[vineyardId].totalPrestige += event.amount_base;
      breakdown[vineyardId].events.push({
        type: event.type,
        amount: event.amount_base,
        description: event.description || '',
        decayRate: event.decay_rate,
        originalAmount: event.amount_base,
        currentAmount: event.amount_base,
        metadata: event.payload
      });
    }
    
    return breakdown;
  } catch (error) {
    console.error('Failed to load vineyard prestige breakdown:', error);
    return {};
  }
}

