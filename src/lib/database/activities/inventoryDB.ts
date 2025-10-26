import { supabase } from '../core/supabase';
import { WineBatch, GrapeVariety, Season } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';
import { GRAPE_CONST } from '../../constants/grapeConstants';

const WINE_BATCHES_TABLE = 'wine_batches';

/**
 * Inventory Database Operations
 * Pure CRUD operations for wine batch/inventory data persistence
 */

export const saveWineBatch = async (batch: WineBatch): Promise<void> => {
  try {
    const { error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .upsert({
        id: batch.id,
        company_id: getCurrentCompanyId(),
        vineyard_id: batch.vineyardId,
        vineyard_name: batch.vineyardName,
        grape_variety: batch.grape,
        quantity: Math.round(batch.quantity),
        state: batch.state,
        fermentation_progress: Math.round(batch.fermentationProgress || 0),
        fermentation_options: batch.fermentationOptions, 
        grape_quality: batch.grapeQuality,
        balance: batch.balance,
        characteristics: batch.characteristics, 
        breakdown: batch.breakdown, 
        estimated_price: batch.estimatedPrice,
        asking_price: batch.askingPrice,
        grape_color: batch.grapeColor,
        natural_yield: batch.naturalYield,
        fragile: batch.fragile,
        prone_to_oxidation: batch.proneToOxidation,
        features: batch.features || [], // Store features as JSONB array
        harvest_start_week: Math.round(batch.harvestStartDate.week),
        harvest_start_season: batch.harvestStartDate.season,
        harvest_start_year: Math.round(batch.harvestStartDate.year),
        harvest_end_week: Math.round(batch.harvestEndDate.week),
        harvest_end_season: batch.harvestEndDate.season,
        harvest_end_year: Math.round(batch.harvestEndDate.year),
        bottled_week: batch.bottledDate ? Math.round(batch.bottledDate.week) : null,
        bottled_season: batch.bottledDate?.season,
        bottled_year: batch.bottledDate ? Math.round(batch.bottledDate.year) : null,
        aging_progress: Math.round(batch.agingProgress || 0)
      });

    if (error) throw error;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
};

export const loadWineBatches = async (): Promise<WineBatch[]> => {
  try {
    const { data, error } = await getCompanyQuery(WINE_BATCHES_TABLE)
      .order('harvest_start_year', { ascending: true })
      .order('harvest_start_season', { ascending: true })
      .order('harvest_start_week', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => {
      const grapeVariety = row.grape_variety as GrapeVariety;
      const grapeData = GRAPE_CONST[grapeVariety] || GRAPE_CONST['Chardonnay']; // Fallback to Chardonnay
      
      const grapeQuality = row.grape_quality;
      const balance = row.balance;
      
      return {
        id: row.id,
        vineyardId: row.vineyard_id,
        vineyardName: row.vineyard_name,
        grape: grapeVariety,
        quantity: row.quantity,
        state: row.state,
        fermentationProgress: row.fermentation_progress || 0,
        fermentationOptions: row.fermentation_options || undefined, // Load fermentation options
        bornGrapeQuality: grapeQuality, // Original grape quality at harvest
        bornBalance: balance, // Original balance at harvest
        grapeQuality: grapeQuality,
        balance: balance,
        characteristics: row.characteristics || {
          acidity: 0.5,
          aroma: 0.5,
          body: 0.5,
          spice: 0.5,
          sweetness: 0.5,
          tannins: 0.5
        }, // Default characteristics if not set
        breakdown: row.breakdown || undefined, // Load breakdown data
        estimatedPrice: row.estimated_price,
        askingPrice: row.asking_price, 
        grapeColor: row.grape_color || grapeData.grapeColor,
        naturalYield: row.natural_yield || grapeData.naturalYield,
        fragile: row.fragile || grapeData.fragile,
        proneToOxidation: row.prone_to_oxidation || grapeData.proneToOxidation,
        features: row.features || [], 
        harvestStartDate: {
          week: row.harvest_start_week,
          season: row.harvest_start_season as Season,
          year: row.harvest_start_year
        },
        harvestEndDate: {
          week: row.harvest_end_week,
          season: row.harvest_end_season as Season,
          year: row.harvest_end_year
        },

        bottledDate: row.bottled_week ? {
          week: row.bottled_week,
          season: row.bottled_season as Season,
          year: row.bottled_year
        } : undefined,
        
        agingProgress: row.aging_progress || 0
      };
    });
  } catch (error) {
    return [];
  }
};

export const getWineBatchById = async (batchId: string): Promise<WineBatch | null> => {
  try {
    const batches = await loadWineBatches();
    return batches.find(b => b.id === batchId) || null;
  } catch (error) {
    console.error('Error getting wine batch by ID:', error);
    return null;
  }
};

export const updateWineBatch = async (batchId: string, updates: Partial<WineBatch>): Promise<boolean> => {
  try {
    const batches = await loadWineBatches();
    const batch = batches.find(b => b.id === batchId);
    
    if (!batch) {
      return false;
    }

    const updatedBatch: WineBatch = {
      ...batch,
      ...updates
    };

    await saveWineBatch(updatedBatch);
    return true;
  } catch (error) {
    console.error('Error updating wine batch:', error);
    return false;
  }
};

/**
 * Bulk update wine batches - optimized for performance
 * Updates multiple batches in a single database operation
 */
export const bulkUpdateWineBatches = async (updates: Array<{ id: string; updates: Partial<WineBatch> }>): Promise<void> => {
  if (updates.length === 0) return;

  try {
    // Load all batches once
    const batches = await loadWineBatches();
    const batchMap = new Map(batches.map(b => [b.id, b]));

    // Prepare upsert data
    const upsertData = updates
      .map(({ id, updates: partialUpdates }) => {
        const batch = batchMap.get(id);
        if (!batch) return null;

        const updatedBatch = { ...batch, ...partialUpdates };
        
        return {
          id: updatedBatch.id,
          company_id: getCurrentCompanyId(),
          vineyard_id: updatedBatch.vineyardId,
          vineyard_name: updatedBatch.vineyardName,
          grape_variety: updatedBatch.grape,
          quantity: Math.round(updatedBatch.quantity),
          state: updatedBatch.state,
          fermentation_progress: Math.round(updatedBatch.fermentationProgress || 0),
          fermentation_options: updatedBatch.fermentationOptions,
          grape_quality: updatedBatch.grapeQuality,
          balance: updatedBatch.balance,
          characteristics: updatedBatch.characteristics,
          breakdown: updatedBatch.breakdown,
          estimated_price: updatedBatch.estimatedPrice,
          asking_price: updatedBatch.askingPrice,
          grape_color: updatedBatch.grapeColor,
          natural_yield: updatedBatch.naturalYield,
          fragile: updatedBatch.fragile,
          prone_to_oxidation: updatedBatch.proneToOxidation,
          features: updatedBatch.features || [],
          harvest_start_week: Math.round(updatedBatch.harvestStartDate.week),
          harvest_start_season: updatedBatch.harvestStartDate.season,
          harvest_start_year: Math.round(updatedBatch.harvestStartDate.year),
          harvest_end_week: Math.round(updatedBatch.harvestEndDate.week),
          harvest_end_season: updatedBatch.harvestEndDate.season,
          harvest_end_year: Math.round(updatedBatch.harvestEndDate.year),
          bottled_week: updatedBatch.bottledDate ? Math.round(updatedBatch.bottledDate.week) : null,
          bottled_season: updatedBatch.bottledDate?.season,
          bottled_year: updatedBatch.bottledDate ? Math.round(updatedBatch.bottledDate.year) : null,
          aging_progress: Math.round(updatedBatch.agingProgress || 0)
        };
      })
      .filter(Boolean);

    // Single bulk upsert operation
    const { error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .upsert(upsertData);

    if (error) throw error;
  } catch (error) {
    console.error('Bulk update wine batches failed:', error);
    throw error;
  }
};