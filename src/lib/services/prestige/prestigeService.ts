import { getGameState } from '../core/gameState';
import { loadVineyards, saveVineyard } from '../../database/activities/vineyardDB';
import { calculateGrapeSuitabilityContribution } from '../vineyard/vineyardValueCalc';
import { vineyardAgePrestigeModifier, calculateAsymmetricalMultiplier, squashNormalizeTail } from '../../utils/calculator';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { calculateAbsoluteWeeks, formatCurrency, formatNumber } from '../../utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { upsertPrestigeEventBySource, insertPrestigeEvent, listPrestigeEvents, listPrestigeEventsForUI } from '../../database/customers/prestigeEventsDB';
import { getMaxLandValue } from '../wine/winescore/grapeQualityCalculation';
import type { PrestigeEvent, Vineyard, WineBatch, WineOrder } from '../../types/types';
import { calculateNetWorth } from '../finance/financeService';
import type { FeatureConfig } from '../../types/wineFeatures';
import { calculateSalePrestigeWithAssets, calculateVineyardSalePrestige, calculateFeatureSalePrestigeWithReputation, calculateVineyardManifestationPrestige, calculateCompanyManifestationPrestige } from './prestigeCalculator';

// Internal calculation output for creating prestige events
type VineyardPrestigeFactors = {
  maxLandValue: number;
  landValuePerHectare: number;
  ageBase01: number;
  landBase01: number;
  ageWithSuitability01: number;
  landWithSuitability01: number;
  ageScaled: number;
  landScaledPerHa: number;
  landSizeFactor: number;
  landScaled: number;
  density: number;
  densityModifier: number;
};

export async function initializeBasePrestigeEvents(): Promise<void> {
  const maxLandValue = getMaxLandValue();

  // Calculate net worth using centralized function
  const netWorth = await calculateNetWorth();

  const companyValuePrestige = Math.log((netWorth || 0) / maxLandValue + 1);
  
  await updateBasePrestigeEvent(
    'company_finance',
    'company_net_worth',
    companyValuePrestige,
    {
      companyNetWorth: netWorth,
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

/**
 * Calculate density prestige modifier
 * Lower density = higher prestige (premium approach)
 * Progressive system: 1.5x bonus at 1500, 0.5x penalty at 15000
 * @param density - Vine density (vines/hectare)
 * @returns Prestige multiplier (0.5 to 1.5)
 */
function calculateDensityPrestigeModifier(density: number): number {
  if (!density || density <= 0) return 1.0; // No vines = neutral
  
  const minDensity = 1500;  // Max bonus at this density
  const maxDensity = 15000; // Max penalty at this density
  
  // Clamp density to reasonable range
  const clampedDensity = Math.max(minDensity, Math.min(maxDensity, density));
  
  // Linear progression from 1.5 (max bonus) at 1500 to 0.5 (max penalty) at 15000
  // Formula: modifier = 1.5 - (density - 1500) / (15000 - 1500) * 1.0
  const modifier = 1.5 - ((clampedDensity - minDensity) / (maxDensity - minDensity)) * 1.0;
  
  return Math.max(0.5, Math.min(1.5, modifier));
}

export function computeVineyardPrestigeFactors(vineyard: Vineyard): VineyardPrestigeFactors {
  const grapeSuitability = calculateGrapeSuitabilityContribution(
    vineyard.grape as any,
    vineyard.region,
    vineyard.country
  );

  const ageBase01 = vineyardAgePrestigeModifier(vineyard.vineAge || 0);
  const ageWithSuitability01 = ageBase01 * grapeSuitability;
  const ageScaledRaw = Math.max(0, calculateAsymmetricalMultiplier(ageWithSuitability01) - 1);
  
  // Apply density modifier to age prestige (lower density = higher prestige)
  const densityModifier = calculateDensityPrestigeModifier(vineyard.density || 0);
  const ageScaled = ageScaledRaw * densityModifier;

  const maxLandValue = getMaxLandValue();
  // Normalize per-hectare value against max per-hectare benchmark using vineyard.landValue directly (€/ha)
  // Land base logarithm (can exceed 1 in very high-value regions by design)
  const landBase01 = Math.log((vineyard.landValue) / Math.max(1, maxLandValue) + 1);
  let landWithSuitability01 = squashNormalizeTail(landBase01 * grapeSuitability);
  // Apply asym multiplier on per-hectare signal, then multiply by size factor (√hectares)
  const landScaledPerHa = Math.max(0, calculateAsymmetricalMultiplier(landWithSuitability01) - 1);
  const landSizeFactor = Math.sqrt(vineyard.hectares || 0);
  const landScaledRaw = landScaledPerHa * landSizeFactor;
  
  // Apply density modifier to land prestige (lower density = higher prestige)
  const landScaled = landScaledRaw * densityModifier;

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
    density: vineyard.density || 0,
    densityModifier,
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
    eventBreakdown: eventBreakdown.filter(event => Math.abs(event.currentAmount ?? event.amount) >= 0.01),
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
  type: 'company_finance' | 'vineyard' | 'vineyard_base' | 'vineyard_age' | 'vineyard_land' | 'vineyard_region' | 'cellar_collection',
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

export async function updateCompanyValuePrestige(_money: number): Promise<void> {
  try {
    const maxLandValue = getMaxLandValue();

    // Calculate net worth using centralized function
    const netWorth = await calculateNetWorth();

    const companyValuePrestige = Math.log((netWorth || 0) / maxLandValue + 1);
    await updateBasePrestigeEvent(
      'company_finance',
      'company_net_worth',
      companyValuePrestige,
      {
        companyNetWorth: netWorth,
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
          density: factors.density,
          densityModifier: factors.densityModifier,
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
          density: factors.density,
          densityModifier: factors.densityModifier,
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

/**
 * Update cellar collection prestige based on aged wine inventory
 * 
 * Calculates prestige from wines aged 5+ years (non-oxidized)
 * Uses gentle power function for age scaling with diminishing returns
 * 
 * Called on weekly tick to maintain up-to-date prestige
 * Permanent event (decay_rate: 0) that gets recalculated
 */
export async function updateCellarCollectionPrestige(): Promise<void> {
  try {
    const { loadWineBatches } = await import('../../database/activities/inventoryDB');
    const allBatches = await loadWineBatches();
    
    // Filter aged wines (5+ years, bottled, not oxidized)
    const agedWines = allBatches.filter(batch => {
      const ageInYears = (batch.agingProgress || 0) / 52;
      if (ageInYears < 5) return false;  // Must be 5+ years
      if (batch.state !== 'bottled') return false;  // Must be in cellar
      
      // Check for oxidation feature
      const oxidationFeature = batch.features?.find(f => f.id === 'oxidation');
      if (oxidationFeature?.isPresent) return false;  // Exclude oxidized wines (x0 multiplier)
      
      return true;
    });
    
    if (agedWines.length === 0) {
      // No aged wines - set prestige to 0
      await updateBasePrestigeEvent(
        'cellar_collection',
        'aged_wine_inventory',
        0,
        { totalBottles: 0, totalValue: 0, vintageCount: 0, averageAge: 0, oldestAge: 0 }
      );
      return;
    }
    
    // Calculate prestige with gentle power function for age
    let totalPrestige = 0;
    
    for (const batch of agedWines) {
      const ageInYears = (batch.agingProgress || 0) / 52;
      const bottleCount = batch.quantity;
      const bottleValue = batch.estimatedPrice;
      
      // Gentle power function: sqrt(age - 4) * 0.1
      // This gives ~0.1 at year 5, ~0.2 at year 8, ~0.5 at year 29, ~1.0 at year 104
      // Much gentler scaling suitable for wines up to 100 years
      const ageFactor = Math.sqrt(ageInYears - 4) * 0.1;
      
      // Volume and value contribute logarithmically
      const volumeFactor = Math.log(bottleCount + 1);
      const valueFactor = Math.log(bottleValue * 10 + 1);
      
      const batchPrestige = ageFactor * volumeFactor * valueFactor * 0.01;
      totalPrestige += batchPrestige;
    }
    
    // Apply diminishing returns to total
    const finalPrestige = Math.sqrt(totalPrestige);
    
    // Calculate metadata
    const totalBottles = agedWines.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = agedWines.reduce((sum, b) => sum + (b.quantity * b.estimatedPrice), 0);
    const vintageCount = agedWines.length;
    const averageAge = agedWines.reduce((sum, b) => sum + (b.agingProgress || 0), 0) / agedWines.length / 52;
    const oldestAge = Math.max(...agedWines.map(b => (b.agingProgress || 0) / 52));
    
    // Update permanent prestige event
    await updateBasePrestigeEvent(
      'cellar_collection',
      'aged_wine_inventory',
      finalPrestige,
      {
        totalBottles,
        totalValue,
        vintageCount,
        averageAge,
        oldestAge
      }
    );
    
  } catch (error) {
    console.error('Failed to update cellar collection prestige:', error);
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

/**
 * Consolidated wine feature event for UI display
 */
export interface ConsolidatedWineFeatureEvent {
  vineyardId: string;
  vineyardName: string;
  grape: string;
  vintage: number;
  features: Array<{
    featureId: string;
    featureName: string;
    featureType: string;
    level: 'company' | 'vineyard';
    eventType: 'manifestation' | 'sale';
    totalAmount: number;
    totalOriginalAmount: number;
    eventCount: number;
    decayRate: number;
    recentEvents: PrestigeEvent[];
  }>;
  totalAmount: number;
  totalOriginalAmount: number;
}

/**
 * Consolidate wine feature events by wine/vineyard instead of event type
 * Groups events by vineyard + grape + vintage combination
 */
export function consolidateWineFeatureEvents(events: PrestigeEvent[]): ConsolidatedWineFeatureEvent[] {
  const wineFeatureEvents = events.filter(e => e.type === 'wine_feature');
  
  // Group by vineyard + grape + vintage combination
  const wineGroups = new Map<string, PrestigeEvent[]>();
  
  for (const event of wineFeatureEvents) {
    const metadata: any = event.metadata ?? {};
    
    // Use proper fields from metadata (no string parsing needed!)
    const vineyardName = metadata.vineyardName || 'Unknown Vineyard';
    const grape = metadata.grape || 'Unknown Grape';
    const vintage = metadata.vintage || 0;
    
    const key = `${vineyardName}_${grape}_${vintage}`;
    
    if (!wineGroups.has(key)) {
      wineGroups.set(key, []);
    }
    wineGroups.get(key)!.push(event);
  }
  
  // Convert groups to consolidated events
  const consolidated: ConsolidatedWineFeatureEvent[] = [];
  
  for (const [, wineEvents] of wineGroups) {
    if (wineEvents.length === 0) continue;
    
    const firstEvent = wineEvents[0];
    const metadata: any = firstEvent.metadata ?? {};
    
    // Group features within this wine
    const featureGroups = new Map<string, PrestigeEvent[]>();
    
    for (const event of wineEvents) {
      const eventMetadata: any = event.metadata ?? {};
      const featureKey = `${eventMetadata.featureId || 'unknown'}_${eventMetadata.level || 'unknown'}_${eventMetadata.eventType || 'unknown'}`;
      
      if (!featureGroups.has(featureKey)) {
        featureGroups.set(featureKey, []);
      }
      featureGroups.get(featureKey)!.push(event);
    }
    
    // Convert feature groups to feature summaries
    const features = [];
    for (const [, featureEvents] of featureGroups) {
      const featureFirstEvent = featureEvents[0];
      const featureMetadata: any = featureFirstEvent.metadata ?? {};
      
      const totalAmount = featureEvents.reduce((sum, e) => sum + (e.currentAmount ?? e.amount), 0);
      const totalOriginalAmount = featureEvents.reduce((sum, e) => sum + (e.originalAmount ?? e.amount), 0);
      
      features.push({
        featureId: featureMetadata.featureId || 'unknown',
        featureName: featureMetadata.featureName || 'Unknown Feature',
        featureType: featureMetadata.featureType || 'unknown',
        level: featureMetadata.level || 'company',
        eventType: featureMetadata.eventType || 'unknown',
        totalAmount,
        totalOriginalAmount,
        eventCount: featureEvents.length,
        decayRate: featureFirstEvent.decayRate,
        recentEvents: featureEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      });
    }
    
    // Calculate wine totals
    const wineTotalAmount = wineEvents.reduce((sum, e) => sum + (e.currentAmount ?? e.amount), 0);
    const wineTotalOriginalAmount = wineEvents.reduce((sum, e) => sum + (e.originalAmount ?? e.amount), 0);
    
    // Use proper fields from metadata (no string parsing needed!)
    consolidated.push({
      vineyardId: metadata.vineyardId || 'unknown',
      vineyardName: metadata.vineyardName || 'Unknown Vineyard',
      grape: metadata.grape || 'Unknown Grape',
      vintage: metadata.vintage || 0,
      features,
      totalAmount: wineTotalAmount,
      totalOriginalAmount: wineTotalOriginalAmount
    });
  }
  
  // Sort by total amount (highest first)
  return consolidated.sort((a, b) => b.totalAmount - a.totalAmount);
}

export function getEventDisplayData(event: PrestigeEvent): {
  title: string;
  titleBase: string;
  amountText?: string;
  calc?: string;
  displayInfo?: string;
  calculationData?: {
    type: 'company_value' | 'vineyard_land' | 'vineyard_age' | 'wine_feature';
    [key: string]: any;
  };
} {
  if (event.metadata) {
    const metadata: any = (event as any).metadata?.payload ?? (event as any).metadata ?? {};
    
    if (event.type === 'vineyard_age' && metadata.vineyardName && metadata.vineAge !== undefined) {
      const ageBase = Number(metadata.ageBase01 ?? 0);
      const ageSuitAdj = Number(metadata.ageWithSuitability01 ?? 0);
      const densityMod = Number(metadata.densityModifier ?? 1);
      return {
        title: `Vine Age: ${metadata.vineyardName} (${metadata.vineAge} years)`,
        titleBase: 'Vine Age',
        amountText: `(${metadata.vineAge} years)`,
        calculationData: {
          type: 'vineyard_age',
          vineyardName: metadata.vineyardName,
          vineAge: metadata.vineAge,
          ageBase: ageBase,
          grapeSuitability: ageSuitAdj,
          densityModifier: densityMod,
          density: metadata.density,
          finalPrestige: event.amount
        },
        displayInfo: metadata.density !== undefined 
          ? `Density: ${formatNumber(Number(metadata.density) || 0, { decimals: 0 })} vines/ha (modifier ×${formatNumber(densityMod, { decimals: 2, forceDecimals: true })})`
          : undefined,
      };
    }
    
    if (event.type === 'vineyard_land' && metadata.vineyardName && (metadata.totalValue !== undefined || metadata.landValuePerHectare !== undefined)) {
      const lvh = formatCurrency(Number(metadata.landValuePerHectare ?? 0));
      const basePerHa = Number(metadata.landBase01 ?? 0);
      const suitAdj = Number(metadata.landWithSuitability01 ?? 0);
      const perHaAsym = Number(metadata.landScaledPerHa ?? 0);
      const sizeFactor = Number(metadata.landSizeFactor ?? 0);
      const densityMod = Number(metadata.densityModifier ?? 1);
      const totalValue = Number(metadata.totalValue ?? ((Number(metadata.landValuePerHectare ?? 0)) * (Number(metadata.hectares ?? 0))));
      return {
        title: `Land Value: ${metadata.vineyardName} (${lvh}/ha)`,
        titleBase: 'Land Value',
        amountText: `(Total ${formatCurrency(totalValue)})`,
        calculationData: {
          type: 'vineyard_land',
          vineyardName: metadata.vineyardName,
          landValuePerHa: basePerHa,
          hectares: metadata.hectares,
          density: metadata.density,
          densityModifier: densityMod,
          suitability: suitAdj,
          sizeFactor: sizeFactor,
          asymScaling: perHaAsym,
          finalPrestige: event.amount
        },
        displayInfo: `${lvh}/ha × ${formatNumber(Number(metadata.hectares ?? 0), { decimals: 2, forceDecimals: true })} ha • Density: ${formatNumber(Number(metadata.density ?? 0), { decimals: 0 })} vines/ha (modifier ×${formatNumber(densityMod, { decimals: 2, forceDecimals: true })})`,
      };
    }
    
    if (event.type === 'sale' && metadata.customerName && metadata.wineName) {
      return {
        title: `Sale to ${metadata.customerName}: ${metadata.wineName}`,
        titleBase: `Sale to ${metadata.customerName}`,
        amountText: metadata.wineName,
      };
    }

    if (event.type === 'company_finance' && metadata.companyNetWorth !== undefined) {
      return {
        title: `Company Value: €${metadata.companyNetWorth.toLocaleString()}`,
        titleBase: 'Company Value',
        amountText: `€${metadata.companyNetWorth.toLocaleString()}`,
        calculationData: {
          type: 'company_value',
          companyValue: metadata.companyNetWorth,
          maxLandValue: metadata.maxLandValue,
          baseValue: metadata.prestigeBase01,
          finalPrestige: event.amount
        },
      };
    }
    
    if (event.type === 'cellar_collection') {
      const totalBottles = metadata.totalBottles || 0;
      const vintageCount = metadata.vintageCount || 0;
      const averageAge = metadata.averageAge || 0;
      const oldestAge = metadata.oldestAge || 0;
      const totalValue = metadata.totalValue || 0;
      
      return {
        title: `Cellar Collection: ${vintageCount} aged vintage${vintageCount !== 1 ? 's' : ''} (${totalBottles} bottles)`,
        titleBase: 'Cellar Collection',
        amountText: `${vintageCount} vintage${vintageCount !== 1 ? 's' : ''}, avg ${averageAge.toFixed(1)} years`,
        displayInfo: `Total: ${totalBottles} bottles • Value: €${totalValue.toLocaleString()} • Avg Age: ${averageAge.toFixed(1)} years • Oldest: ${oldestAge.toFixed(1)} years`,
      };
    }

    if (event.type === 'achievement' && metadata.achievementName) {
      return {
        title: `${metadata.achievementIcon} ${metadata.achievementName}`,
        titleBase: 'Achievement',
        amountText: `${metadata.achievementIcon} ${metadata.achievementName}`,
        displayInfo: `Category: ${metadata.achievementCategory} | Skill Level: ${metadata.achievementLevel || 'Unknown'} | Unlocked: ${metadata.unlockedAt ? new Date(metadata.unlockedAt).toLocaleDateString() : 'Unknown'}`
      };
    }

    if (event.type === 'vineyard_achievement' && metadata.achievementName) {
      return {
        title: `${metadata.achievementIcon} ${metadata.achievementName}`,
        titleBase: 'Vineyard Achievement',
        amountText: `${metadata.achievementIcon} ${metadata.achievementName}`,
        displayInfo: `Category: ${metadata.achievementCategory} | Skill Level: ${metadata.achievementLevel || 'Unknown'} | Unlocked: ${metadata.unlockedAt ? new Date(metadata.unlockedAt).toLocaleDateString() : 'Unknown'}`
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
      calculationData: {
        type: 'wine_feature',
        featureName: featureName,
        wineName: wineName,
        eventType: eventType,
        level: level,
        baseAmount: metadata.calculatedAmount,
        finalPrestige: event.amount
      }
    };
  }


  // Handle company finance events (including loan defaults)
  if (event.type === 'company_finance' && event.metadata) {
    const metadata: any = event.metadata;
    const reason = metadata.reason || 'Financial Event';
    const lenderName = metadata.lenderName || '';
    
    if (reason === 'Loan Default') {
      return {
        title: `Loan Default: ${lenderName}`,
        titleBase: 'Loan Default',
        amountText: `${event.amount.toFixed(2)} prestige`,
        displayInfo: metadata.loanAmount 
          ? `Loan: ${metadata.loanAmount.toLocaleString()} | Missed Payment: ${metadata.missedPaymentAmount?.toLocaleString() || 'N/A'}`
          : undefined
      };
    }
    
    return {
      title: reason,
      titleBase: 'Financial Event',
      amountText: `${event.amount.toFixed(2)} prestige`,
    };
  }

  // Handle other event types with fallback display
  if (['contract', 'penalty', 'vineyard_sale', 'vineyard_base', 'vineyard_achievement'].includes(event.type)) {
    return {
      title: event.description || event.type,
      titleBase: event.type,
      amountText: `${event.amount >= 0 ? '+' : ''}${event.amount.toFixed(2)} prestige`,
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
        
      case 'dynamic':
        // Dynamic calculations vary by event type
        if (eventType === 'sale' && eventContext.order) {
          return isCompany
            ? calculateFeatureSalePrestigeWithReputation(
                levelConfig.baseAmount,
                eventContext.order.totalValue || 0,
                eventContext.order.requestedQuantity || 0,
                eventContext.currentCompanyPrestige || 1,
                levelConfig.scalingFactors,
                levelConfig.maxImpact
              )
            : levelConfig.baseAmount;
        } else if (eventType === 'manifestation') {
          if (isCompany) {
            return calculateCompanyManifestationPrestige(
              levelConfig.baseAmount,
              batch.quantity,
              batch.grapeQuality,
              eventContext.currentCompanyPrestige || 1,
              levelConfig.scalingFactors,
              levelConfig.maxImpact
            );
          } else {
            return calculateVineyardManifestationPrestige(
              levelConfig.baseAmount,
              batch.quantity,
              batch.grapeQuality,
              eventContext.vineyard?.vineyardPrestige || 1,
              levelConfig.scalingFactors,
              levelConfig.maxImpact
            );
          }
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
        featureType: config.behavior,
        vineyardId: batch.vineyardId,
        vineyardName: batch.vineyardName,
        grape: batch.grape,
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
        featureType: config.behavior,
        vineyardId: batch.vineyardId,
        vineyardName: batch.vineyardName,
        grape: batch.grape,
        wineName: `${batch.grape}`,
        vintage: batch.harvestStartDate.year,
        batchSize: batch.quantity,
        grapeQuality: batch.grapeQuality,
        vineyardPrestige: eventContext.vineyard?.vineyardPrestige,
        calculatedAmount: amount,
        customerName: eventContext.customerName,
        saleVolume: eventContext.order?.requestedQuantity,
        saleValue: eventContext.order?.totalValue,
        eventType
      }
    });
  }
  
  triggerGameUpdate();
}
