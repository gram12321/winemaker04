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
        quality: batch.quality,
        balance: batch.balance,
        characteristics: batch.characteristics, // Store as JSON
        breakdown: batch.breakdown, // Store breakdown as JSON
        final_price: batch.finalPrice,
        asking_price: batch.askingPrice,
        harvest_week: Math.round(batch.harvestDate.week),
        harvest_season: batch.harvestDate.season,
        harvest_year: Math.round(batch.harvestDate.year),
        created_week: Math.round(batch.createdAt.week),
        created_season: batch.createdAt.season,
        created_year: Math.round(batch.createdAt.year),
        completed_week: batch.completedAt ? Math.round(batch.completedAt.week) : null,
        completed_season: batch.completedAt?.season,
        completed_year: batch.completedAt ? Math.round(batch.completedAt.year) : null,
        updated_at: new Date().toISOString()
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
      .order('created_at', { ascending: true });

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
        finalPrice: row.final_price || 10.50,
        askingPrice: row.asking_price, // Will default to undefined if not set
        grapeColor: grapeData.grapeColor,
        naturalYield: grapeData.naturalYield,
        fragile: grapeData.fragile,
        proneToOxidation: grapeData.proneToOxidation,
        harvestDate: {
          week: row.harvest_week || 1,
          season: (row.harvest_season || 'Spring') as Season,
          year: row.harvest_year || 2024
        },
        createdAt: {
          week: row.created_week || 1,
          season: (row.created_season || 'Spring') as Season,
          year: row.created_year || 2024
        },
        completedAt: row.completed_week ? {
          week: row.completed_week,
          season: row.completed_season as Season,
          year: row.completed_year
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
