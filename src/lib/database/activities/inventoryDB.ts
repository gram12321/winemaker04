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
        fermentation_options: batch.fermentationOptions, // Store fermentation options as JSON
        quality: batch.quality,
        balance: batch.balance,
        characteristics: batch.characteristics, // Store as JSON
        breakdown: batch.breakdown, // Store breakdown as JSON
        estimated_price: batch.estimatedPrice,
        asking_price: batch.askingPrice,
        grape_color: batch.grapeColor,
        natural_yield: batch.naturalYield,
        fragile: batch.fragile,
        prone_to_oxidation: batch.proneToOxidation,
        oxidation: batch.oxidation,
        is_oxidized: batch.isOxidized,
        harvest_start_week: Math.round(batch.harvestStartDate.week),
        harvest_start_season: batch.harvestStartDate.season,
        harvest_start_year: Math.round(batch.harvestStartDate.year),
        harvest_end_week: Math.round(batch.harvestEndDate.week),
        harvest_end_season: batch.harvestEndDate.season,
        harvest_end_year: Math.round(batch.harvestEndDate.year),
        bottled_week: batch.bottledDate ? Math.round(batch.bottledDate.week) : null,
        bottled_season: batch.bottledDate?.season,
        bottled_year: batch.bottledDate ? Math.round(batch.bottledDate.year) : null
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
      
      return {
        id: row.id,
        vineyardId: row.vineyard_id,
        vineyardName: row.vineyard_name,
        grape: grapeVariety,
        quantity: row.quantity,
        state: row.state,
        fermentationProgress: row.fermentation_progress || 0,
        fermentationOptions: row.fermentation_options || undefined, // Load fermentation options
        quality: row.quality || 0.7,
        balance: row.balance || 0.6,
        characteristics: row.characteristics || {
          acidity: 0.5,
          aroma: 0.5,
          body: 0.5,
          spice: 0.5,
          sweetness: 0.5,
          tannins: 0.5
        }, // Default characteristics if not set
        breakdown: row.breakdown || undefined, // Load breakdown data
        estimatedPrice: row.estimated_price || 10.50,
        askingPrice: row.asking_price, // Will default to undefined if not set
        grapeColor: row.grape_color || grapeData.grapeColor,
        naturalYield: row.natural_yield || grapeData.naturalYield,
        fragile: row.fragile || grapeData.fragile,
        proneToOxidation: row.prone_to_oxidation || grapeData.proneToOxidation,
        oxidation: row.oxidation ?? 0, // Default to 0 risk for existing batches
        isOxidized: row.is_oxidized ?? false, // Default to not oxidized
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
        } : undefined
      };
    });
  } catch (error) {
    return [];
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
