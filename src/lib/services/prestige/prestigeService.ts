// Prestige service - handles prestige business logic
import { getGameState } from '../core/gameState';
import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';
import { calculateGrapeSuitabilityContribution } from '../vineyard/vineyardValueCalc';
import { vineyardAgePrestigeModifier, calculateAsymmetricalMultiplier, squashNormalizeTail } from '../../utils/calculator';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks } from '../../utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { upsertPrestigeEventBySource, insertPrestigeEvent, listPrestigeEvents, listPrestigeEventsForUI } from '../../database/customers/prestigeEventsDB';
import { getMaxLandValue } from '../wine/wineQualityCalculationService';
import type { PrestigeEvent, Vineyard, WineBatch, WineOrder } from '../../types/types';
import type { FeatureConfig } from '../../types/wineFeatures';
import { 
  calculateSalePrestigeWithAssets, 
  calculateVineyardSalePrestige,
  calculateFeatureSalePrestigeWithReputation,
  calculateVineyardManifestationPrestige
} from './prestigeCalculator';

// Internal calculation output for creating prestige events
type VineyardPrestigeFactors = {
  maxLandValue: number;
  landValuePerHectare: number;
  ageBase01: number;
  landBase01: number;
  ageWithSuitability01: number;
  landWithSuitability01: number;
  ageScaled: number;
  // Prestige from land per hectare before size multiplier
  landScaledPerHa: number;
  // Size multiplier applied to land prestige (hectares squared as requested)
  landSizeFactor: number;
  // Final land prestige after applying size multiplier
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
  const ageWithSuitability01 = ageBase01 * grapeSuitability;
  const ageScaled = Math.max(0, calculateAsymmetricalMultiplier(ageWithSuitability01) - 1);

  const maxLandValue = getMaxLandValue();
  // Normalize per-hectare value against max per-hectare benchmark using vineyard.landValue directly (€/ha)
  // Land base logarithm (can exceed 1 in very high-value regions by design)
  const landBase01 = Math.log((vineyard.landValue) / Math.max(1, maxLandValue) + 1);
  let landWithSuitability01 = squashNormalizeTail(landBase01 * grapeSuitability);
  // Apply asym multiplier on per-hectare signal, then multiply by size factor (√hectares)
  const landScaledPerHa = Math.max(0, calculateAsymmetricalMultiplier(landWithSuitability01) - 1);
  const landSizeFactor = Math.sqrt(vineyard.hectares || 0);
  const landScaled = landScaledPerHa * landSizeFactor;

  return {
    maxLandValue,
    landValuePerHectare: vineyard.landValue || 0,
    ageBase01,
    landBase01,
    ageWithSuitability01,
    landWithSuitability01,
    landScaledPerHa,
    landSizeFactor,
    ageScaled,
    landScaled,
  };
}

// Bounded 0-1 prestige factor (and full breakdown) derived from permanent components + decaying events (no DB access)
export function BoundedVineyardPrestigeFactor(v: Vineyard): {
  suitability: number;
  ageBase01: number;
  ageWithSuitability01: number;
  ageScaled: number;
  landBase01: number;
  landWithSuitability01: number;
  landPerHa: number;
  sqrtHectares: number;
  sizeFactor: number;
  landScaled: number;
  permanentRaw: number;
  decayingComponent: number;
  combinedRaw: number;
  boundedFactor: number;
} {
  const suitability = v.grape
    ? calculateGrapeSuitabilityContribution(v.grape as any, v.region, v.country)
    : 0;

  const ageBase01 = vineyardAgePrestigeModifier(v.vineAge || 0);
  const ageWithSuitability01 = ageBase01 * suitability;
  const ageScaledRaw = Math.max(0, calculateAsymmetricalMultiplier(Math.min(0.98, ageWithSuitability01)) - 1);
  const ageScaled = squashNormalizeTail(ageScaledRaw / 120, 0.90, 0.985, 10);

  const maxValue = getMaxLandValue();
  const landBase01 = Math.log((v.landValue || 0) / Math.max(1, maxValue) + 1);
  const landWithSuitability01 = squashNormalizeTail(landBase01 * suitability);
  const landPerHaRaw = Math.max(0, calculateAsymmetricalMultiplier(landWithSuitability01) - 1);
  const landPerHa = squashNormalizeTail(landPerHaRaw / 120, 0.90, 0.985, 10);

  const hectares = Math.max(0, v.hectares || 0);
  const sqrtHectares = Math.sqrt(hectares);
  const sizeFactor = sqrtHectares <= Math.sqrt(5)
    ? sqrtHectares
    : (Math.sqrt(5) + 0.3 * (sqrtHectares - Math.sqrt(5)));

  const landScaledRaw = landPerHa * sizeFactor;
  const landScaled = landScaledRaw;
  const permanentRaw = ageScaled + landScaled;
  const currentTotal = v.vineyardPrestige || 0;
  const decayingComponent = Math.max(0, currentTotal - permanentRaw);
  const combinedRaw = permanentRaw + decayingComponent;
  // Since general prestige is now normalized at creation, just cap at 0.99 for quality usage
  const boundedFactor = Math.max(0, Math.min(combinedRaw, 0.99));

  return {
    suitability,
    ageBase01,
    ageWithSuitability01,
    ageScaled,
    landBase01,
    landWithSuitability01,
    landPerHa,
    sqrtHectares,
    sizeFactor,
    landScaled,
    permanentRaw,
    decayingComponent,
    combinedRaw,
    boundedFactor,
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
  
  const vineyardEventTypes = ['vineyard_sale', 'vineyard_base', 'vineyard_achievement', 'vineyard_age', 'vineyard_land', 'wine_feature'];
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
        type: 'vineyard_age',
        payload: {
          vineyardName: vineyard.name,
          vineyardId: vineyard.id,
          vineAge: vineyard.vineAge || 0,
          ageBase01: factors.ageBase01,
          ageWithSuitability01: factors.ageWithSuitability01,
        }
      } as any
    );

    await updateBasePrestigeEvent(
      'vineyard_land',
      `${vineyard.id}_land`,
      factors.landScaled,
      {
        type: 'vineyard_land',
        payload: {
          vineyardName: vineyard.name,
          vineyardId: vineyard.id,
          totalValue: vineyard.vineyardTotalValue,
          landValuePerHectare: factors.landValuePerHectare,
          hectares: vineyard.hectares,
          maxLandValue: factors.maxLandValue,
          landBase01: factors.landBase01,
          landWithSuitability01: factors.landWithSuitability01,
          landScaledPerHa: factors.landScaledPerHa,
          landSizeFactor: factors.landSizeFactor,
        }
      } as any
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
  wineName: string,
  saleVolume?: number
): Promise<void> {
  const gameState = getGameState();
  const companyAssets = gameState.money || 0;
  const baseAmount = saleValue / 10000;  // Base calculation
  
  // Calculate dynamic prestige based on company ASSETS (business size)
  const prestigeAmount = calculateSalePrestigeWithAssets(
    baseAmount,
    saleValue,
    saleVolume || 0,
    companyAssets
  );
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'sale',
    amount_base: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!),
    decay_rate: 0.95,
    source_id: null,
    payload: {
      customerName,
      wineName,
      saleValue,
      saleVolume,
      companyAssets,
      calculatedAmount: prestigeAmount
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
  
  // Calculate dynamic prestige using vineyard prestige multiplier
  const prestigeAmount = calculateVineyardSalePrestige(
    basePrestigeAmount,
    vineyardPrestigeFactor
  );
  
  await insertPrestigeEvent({
    id: uuidv4(),
    type: 'vineyard_sale',
    amount_base: prestigeAmount,
    created_game_week: calculateAbsoluteWeeks(getGameState().week!, getGameState().season!, getGameState().currentYear!),
    decay_rate: 0.95,
    source_id: vineyardId,
    payload: {
      customerName,
      wineName,
      saleValue,
      vineyardPrestigeFactor,
      calculatedAmount: prestigeAmount
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
      event: eventType,
      vineyardId,
      vineyardName: '',
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

export function getEventDisplayData(event: PrestigeEvent): {
  title: string;
  titleBase: string;
  amountText?: string;
  calc?: string;
  displayInfo?: string;
} {
  if (event.metadata) {
    const metadata: any = (event as any).metadata?.payload ?? (event as any).metadata ?? {};
    
    if (event.type === 'vineyard_age' && metadata.vineyardName && metadata.vineAge !== undefined) {
      return {
        title: `Vine Age: ${metadata.vineyardName} (${metadata.vineAge} years)`,
        titleBase: 'Vine Age',
        amountText: `(${metadata.vineAge} years)`,
        calc: `base=${metadata.ageBase01?.toFixed(2)} × suitability → scaled=(asym(${metadata.ageWithSuitability01?.toFixed(2)})−1)=${event.amount.toFixed(2)}`,
      };
    }
    
    if (event.type === 'vineyard_land' && metadata.vineyardName && (metadata.totalValue !== undefined || metadata.landValuePerHectare !== undefined)) {
      return {
        title: `Land Value: ${metadata.vineyardName} (€${(metadata.totalValue ?? 0).toLocaleString()})`,
        titleBase: 'Land Value',
        amountText: `(€${(metadata.totalValue ?? (metadata.landValuePerHectare ?? 0) * (metadata.hectares ?? 0)).toLocaleString()})`,
        calc: `base_per_ha=log(€${(metadata.landValuePerHectare ?? 0).toLocaleString()}/€${metadata.maxLandValue?.toLocaleString()}+1)=${metadata.landBase01?.toFixed(2)} → per_ha=(asym(${metadata.landWithSuitability01?.toFixed(2)})−1)=${metadata.landScaledPerHa?.toFixed(2)} → size=sqrt(hectares)=${metadata.landSizeFactor?.toFixed?.(2) ?? String(metadata.landSizeFactor)} → scaled=per_ha×size=${event.amount.toFixed(2)}`,
        displayInfo: `€${metadata.landValuePerHectare?.toLocaleString()}/ha × ${metadata.hectares?.toFixed(2)}ha (size factor: √ha = ${(metadata.landSizeFactor ?? 0).toLocaleString()})`,
      };
    }
    
    if (event.type === 'sale' && metadata.customerName && metadata.wineName) {
      return {
        title: `Sale to ${metadata.customerName}: ${metadata.wineName}`,
        titleBase: `Sale to ${metadata.customerName}`,
        amountText: metadata.wineName,
      };
    }

    if (event.type === 'company_value' && metadata.companyMoney !== undefined) {
      return {
        title: `Company Value: €${metadata.companyMoney.toLocaleString()}`,
        titleBase: 'Company Value',
        amountText: `€${metadata.companyMoney.toLocaleString()}`,
        calc: `base=log(€${metadata.companyMoney.toLocaleString()}/€${metadata.maxLandValue?.toLocaleString()}+1)=${metadata.prestigeBase01?.toFixed(2)} → scaled=${event.amount.toFixed(2)}`,
      };
    }
  }

  // Handle wine feature events
  if (event.type === 'wine_feature' && event.metadata) {
    const metadata: any = event.metadata;
    const featureName = metadata.featureName || 'Unknown Feature';
    const wineName = metadata.wineName || 'Unknown Wine';
    const eventType = metadata.eventType || 'unknown';
    const level = metadata.level || 'unknown';
    
    let title = '';
    let amountText = '';
    
    if (eventType === 'manifestation') {
      title = `${featureName} Manifestation: ${wineName}`;
      amountText = `${featureName} fault detected`;
    } else if (eventType === 'sale') {
      title = `Sale of ${featureName} Wine: ${wineName}`;
      amountText = `Sold wine with ${featureName.toLowerCase()}`;
    } else {
      title = `${featureName} Event: ${wineName}`;
      amountText = `${featureName} event`;
    }
    
    return {
      title,
      titleBase: `${featureName} (${level})`,
      amountText,
      calc: `Base: ${metadata.calculatedAmount?.toFixed(4)} | Event: ${eventType} | Level: ${level}`
    };
  }

  // Handle other event types with fallback display
  if (['contract', 'penalty', 'vineyard_sale', 'vineyard_base', 'vineyard_achievement'].includes(event.type)) {
    return {
      title: event.description || event.type,
      titleBase: event.type,
      amountText: `+${event.amount.toFixed(2)} prestige`,
    };
  }

  throw new Error(`Event ${event.id} (${event.type}) missing required metadata`);
}

// ===== FEATURE PRESTIGE EVENTS =====
// Consolidated from featurePrestigeService.ts

/**
 * Context for prestige calculations
 * Provides all data needed for dynamic prestige amount calculations
 */
export interface PrestigeEventContext {
  customerName?: string;
  order?: WineOrder;
  vineyard?: Vineyard;
  currentCompanyPrestige?: number;
}

/**
 * Add prestige event when a feature manifests or wine with feature is sold
 * Consolidated feature prestige handling - no wrapper layers
 * 
 * @param batch - Wine batch with the feature
 * @param config - Feature configuration
 * @param eventType - 'manifestation' or 'sale'
 * @param context - Context for dynamic calculations (order, vineyard, prestige)
 */
export async function addFeaturePrestigeEvent(
  batch: WineBatch,
  config: FeatureConfig,
  eventType: 'manifestation' | 'sale',
  context?: PrestigeEventContext
): Promise<void> {
  const prestigeConfig = eventType === 'manifestation'
    ? config.effects.prestige?.onManifestation
    : config.effects.prestige?.onSale;
  
  if (!prestigeConfig) return;
  
  const gameState = getGameState();
  const currentWeek = calculateAbsoluteWeeks(gameState.week!, gameState.season!, gameState.currentYear!);
  const eventContext = context || {};
  
  // Helper to calculate prestige amount based on config
  const calculateAmount = (
    levelConfig: typeof prestigeConfig.company | typeof prestigeConfig.vineyard,
    isCompany: boolean
  ): number => {
    if (!levelConfig) return 0;
    
    switch (levelConfig.calculation) {
      case 'fixed':
        return levelConfig.baseAmount;
        
      case 'dynamic_sale':
        if (eventType === 'sale' && eventContext.order) {
          return isCompany
            ? calculateFeatureSalePrestigeWithReputation(
                levelConfig.baseAmount,
                eventContext.order.totalValue || 0,
                eventContext.order.requestedQuantity || 0,
                eventContext.currentCompanyPrestige || 1,
                levelConfig.scalingFactors
              )
            : levelConfig.baseAmount;
        }
        return levelConfig.baseAmount;
        
      case 'dynamic_manifestation':
        if (eventType === 'manifestation' && !isCompany) {
          return calculateVineyardManifestationPrestige(
            levelConfig.baseAmount,
            batch.quantity,
            batch.quality,
            eventContext.vineyard?.vineyardPrestige || 1,
            levelConfig.scalingFactors
          );
        }
        return levelConfig.baseAmount;
        
      default:
        return levelConfig.baseAmount;
    }
  };
  
  // Create company prestige event
  if (prestigeConfig.company) {
    const amount = calculateAmount(prestigeConfig.company, true);
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'wine_feature' as any,
      amount_base: amount,
      created_game_week: currentWeek,
      decay_rate: prestigeConfig.company.decayRate,
      source_id: null,
      payload: {
        level: 'company',
        featureId: config.id,
        featureName: config.name,
        featureType: config.type,
        wineName: `${batch.vineyardName} ${batch.grape}`,
        vintage: batch.harvestStartDate.year,
        customerName: eventContext.customerName,
        saleVolume: eventContext.order?.requestedQuantity,
        saleValue: eventContext.order?.totalValue,
        companyPrestige: eventContext.currentCompanyPrestige,
        calculatedAmount: amount,
        eventType
      }
    });
  }
  
  // Create vineyard prestige event
  if (prestigeConfig.vineyard) {
    const amount = calculateAmount(prestigeConfig.vineyard, false);
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'wine_feature' as any,
      amount_base: amount,
      created_game_week: currentWeek,
      decay_rate: prestigeConfig.vineyard.decayRate,
      source_id: batch.vineyardId,
      payload: {
        level: 'vineyard',
        featureId: config.id,
        featureName: config.name,
        featureType: config.type,
        vineyardName: batch.vineyardName,
        wineName: `${batch.grape}`,
        vintage: batch.harvestStartDate.year,
        batchSize: batch.quantity,
        wineQuality: batch.quality,
        vineyardPrestige: eventContext.vineyard?.vineyardPrestige,
        calculatedAmount: amount,
        customerName: eventContext.customerName,
        eventType
      }
    });
  }
  
  triggerGameUpdate();
}
