import { supabase } from '../core/supabase';
import { WineBatch, GrapeVariety, Season } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';
import { GRAPE_CONST } from '../../constants/grapeConstants';
import { buildGameDate } from '../dbMapperUtils';
import { parseWineAnchorsFromDb } from '../../services/wine/anchors/wineAnchorService';

const WINE_BATCHES_TABLE = 'wine_batches';

const ensureBatchNumber = async (batch: WineBatch): Promise<void> => {
  if (batch.batchNumber !== undefined) {
    return;
  }

  const companyId = getCurrentCompanyId();
  if (!companyId) {
    return;
  }

  const harvestYear = Math.round(batch.harvestStartDate.year);

  const { data, error } = await supabase
    .from(WINE_BATCHES_TABLE)
    .select('id')
    .eq('company_id', companyId)
    .eq('vineyard_id', batch.vineyardId)
    .eq('grape_variety', batch.grape)
    .eq('harvest_start_year', harvestYear)
    .order('harvest_start_week', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const existing = data || [];
  const nextNumber = existing.length + 1;

  batch.batchNumber = nextNumber;
  batch.batchGroupSize = nextNumber;

  if (existing.length === 0) {
    return;
  }

  const updatePromises = existing.map((row, index) =>
    supabase
      .from(WINE_BATCHES_TABLE)
      .update({
        batch_number: index + 1,
        batch_group_size: nextNumber
      })
      .eq('id', row.id)
      .eq('company_id', companyId)
  );

  await Promise.all(updatePromises);
};

/**
 * Inventory Database Operations
 * Pure CRUD operations for wine batch/inventory data persistence
 */

export const saveWineBatch = async (batch: WineBatch): Promise<void> => {
  try {
    await ensureBatchNumber(batch);

    const { error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .upsert({
        id: batch.id,
        company_id: getCurrentCompanyId(),
        vineyard_id: batch.vineyardId,
        vineyard_name: batch.vineyardName,
        grape_variety: batch.grape,
        quantity: Math.round(batch.quantity),
        volume_litres: batch.volumeLitres ?? null,
        storage_plan_id: batch.storagePlanId ?? null,
        state: batch.state,
        fermentation_progress: Math.round(batch.fermentationProgress || 0),
        fermentation_options: batch.fermentationOptions, 
        land_value_modifier_harvest_snapshot: batch.landValueModifierHarvestSnapshot,
        structure_index_harvest_snapshot: batch.structureIndexHarvestSnapshot,
        taste_quality_index_harvest_snapshot: batch.tasteQualityIndexHarvestSnapshot,
        land_value_modifier: batch.landValueModifier,
        taste_quality_index: batch.tasteQualityIndex,
        structure_index: batch.structureIndex,
        characteristics: batch.characteristics, 
        breakdown: batch.breakdown, 
        estimated_price: batch.estimatedPrice,
        asking_price: batch.askingPrice,
        grape_color: batch.grapeColor,
        natural_yield: batch.naturalYield,
        fragile: batch.fragile,
        prone_to_oxidation: batch.proneToOxidation,
        features: batch.features || [], // Store features as JSONB array
        origin_snapshot: batch.originSnapshot ?? null,
        wine_anchors: batch.wineAnchors,
        harvest_start_week: Math.round(batch.harvestStartDate.week),
        harvest_start_season: batch.harvestStartDate.season,
        harvest_start_year: Math.round(batch.harvestStartDate.year),
        batch_number: batch.batchNumber ?? null,
        batch_group_size: batch.batchGroupSize ?? null,
        harvest_end_week: Math.round(batch.harvestEndDate.week),
        harvest_end_season: batch.harvestEndDate.season,
        harvest_end_year: Math.round(batch.harvestEndDate.year),
        bottled_week: batch.bottledDate ? Math.round(batch.bottledDate.week) : null,
        bottled_season: batch.bottledDate?.season,
        bottled_year: batch.bottledDate ? Math.round(batch.bottledDate.year) : null,
        taste_quality_index_bottling_snapshot: batch.tasteQualityIndexBottlingSnapshot ?? null,
        land_value_modifier_bottling_snapshot: batch.landValueModifierBottlingSnapshot ?? null,
        structure_index_bottling_snapshot: batch.structureIndexBottlingSnapshot ?? null,
        wine_score_bottling_snapshot: batch.wineScoreBottlingSnapshot ?? null,
        aging_progress: Math.round(batch.agingProgress || 0)
      });

    if (error) throw error;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
};

export async function appendStorageBackedHarvestBatch(companyId: string, batch: WineBatch): Promise<boolean> {
  if (!batch.storagePlanId) return false;
  const { data, error } = await supabase.rpc('append_storage_backed_harvest_batch', {
    p_company_id: companyId,
    p_batch_id: batch.id,
    p_plan_id: batch.storagePlanId,
    p_quantity: batch.quantity,
    p_volume_litres: batch.volumeLitres,
    p_land_value_modifier_harvest_snapshot: batch.landValueModifierHarvestSnapshot,
    p_structure_index_harvest_snapshot: batch.structureIndexHarvestSnapshot,
    p_taste_quality_index_harvest_snapshot: batch.tasteQualityIndexHarvestSnapshot,
    p_land_value_modifier: batch.landValueModifier,
    p_taste_quality_index: batch.tasteQualityIndex,
    p_structure_index: batch.structureIndex,
    p_characteristics: batch.characteristics,
    p_breakdown: batch.breakdown,
    p_wine_anchors: batch.wineAnchors,
    p_estimated_price: batch.estimatedPrice,
    p_harvest_start_week: batch.harvestStartDate.week,
    p_harvest_start_season: batch.harvestStartDate.season,
    p_harvest_start_year: batch.harvestStartDate.year,
    p_harvest_end_week: batch.harvestEndDate.week,
    p_harvest_end_season: batch.harvestEndDate.season,
    p_harvest_end_year: batch.harvestEndDate.year,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function bottleStorageBackedWineBatch(input: {
  companyId: string;
  batchId: string;
  quantity: number;
  bottledWeek: number;
  bottledSeason: Season;
  bottledYear: number;
  tasteQualityIndexBottlingSnapshot: number;
  landValueModifierBottlingSnapshot: number;
  structureIndexBottlingSnapshot: number;
  wineScoreBottlingSnapshot: number;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('bottle_storage_backed_wine_batch', {
    p_company_id: input.companyId,
    p_batch_id: input.batchId,
    p_quantity: input.quantity,
    p_bottled_week: input.bottledWeek,
    p_bottled_season: input.bottledSeason,
    p_bottled_year: input.bottledYear,
    p_taste_quality_index_bottling_snapshot: input.tasteQualityIndexBottlingSnapshot,
    p_land_value_modifier_bottling_snapshot: input.landValueModifierBottlingSnapshot,
    p_structure_index_bottling_snapshot: input.structureIndexBottlingSnapshot,
    p_wine_score_bottling_snapshot: input.wineScoreBottlingSnapshot,
    p_released_year: input.bottledYear,
    p_released_season: input.bottledSeason,
    p_released_week: input.bottledWeek,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function sellStorageBackedWineBatch(input: {
  companyId: string;
  batchId: string;
  quantity: number;
  amount: number;
  description: string;
  category: string;
  week: number;
  season: Season;
  year: number;
}) {
  const { data, error } = await supabase.rpc('sell_storage_backed_wine_batch', {
    p_company_id: input.companyId,
    p_batch_id: input.batchId,
    p_quantity: input.quantity,
    p_amount: input.amount,
    p_description: input.description,
    p_category: input.category,
    p_week: input.week,
    p_season: input.season,
    p_year: input.year,
  });
  return { data, error };
}

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
      
      const landValueModifierHarvestSnapshot = row.land_value_modifier_harvest_snapshot ?? 0;
      const structureIndex = row.structure_index ?? 0;
      const structureIndexHarvestSnapshot = row.structure_index_harvest_snapshot ?? structureIndex;
      const tasteQualityIndex = row.taste_quality_index ?? 0.5;
      const landValueModifier = row.land_value_modifier ?? landValueModifierHarvestSnapshot;
      const tasteQualityIndexHarvestSnapshot = row.taste_quality_index_harvest_snapshot ?? tasteQualityIndex;
      
      return {
        id: row.id,
        vineyardId: row.vineyard_id,
        vineyardName: row.vineyard_name,
        grape: grapeVariety,
        quantity: row.quantity,
        volumeLitres: row.volume_litres ?? undefined,
        storagePlanId: row.storage_plan_id ?? undefined,
        state: row.state,
        fermentationProgress: row.fermentation_progress || 0,
        fermentationOptions: row.fermentation_options || undefined, // Load fermentation options
        landValueModifierHarvestSnapshot,
        structureIndexHarvestSnapshot,
        landValueModifier,
        tasteQualityIndex,
        tasteQualityIndexHarvestSnapshot,
        structureIndex,
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
        originSnapshot: row.origin_snapshot || undefined,
        wineAnchors: parseWineAnchorsFromDb(row.wine_anchors),
        harvestStartDate: buildGameDate(row.harvest_start_week, row.harvest_start_season, row.harvest_start_year)!,
        harvestEndDate: buildGameDate(row.harvest_end_week, row.harvest_end_season, row.harvest_end_year)!,
        bottledDate: buildGameDate(row.bottled_week, row.bottled_season, row.bottled_year),
        tasteQualityIndexBottlingSnapshot: row.taste_quality_index_bottling_snapshot ?? undefined,
        landValueModifierBottlingSnapshot: row.land_value_modifier_bottling_snapshot ?? undefined,
        structureIndexBottlingSnapshot: row.structure_index_bottling_snapshot ?? undefined,
        wineScoreBottlingSnapshot: row.wine_score_bottling_snapshot ?? undefined,
        
        agingProgress: row.aging_progress || 0,
        batchNumber: row.batch_number ?? undefined,
        batchGroupSize: row.batch_group_size ?? undefined
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
          volume_litres: updatedBatch.volumeLitres ?? null,
          storage_plan_id: updatedBatch.storagePlanId ?? null,
          state: updatedBatch.state,
          fermentation_progress: Math.round(updatedBatch.fermentationProgress || 0),
          fermentation_options: updatedBatch.fermentationOptions,
          land_value_modifier_harvest_snapshot: updatedBatch.landValueModifierHarvestSnapshot,
          structure_index_harvest_snapshot: updatedBatch.structureIndexHarvestSnapshot,
          taste_quality_index_harvest_snapshot: updatedBatch.tasteQualityIndexHarvestSnapshot,
          land_value_modifier: updatedBatch.landValueModifier,
          taste_quality_index: updatedBatch.tasteQualityIndex,
          structure_index: updatedBatch.structureIndex,
          characteristics: updatedBatch.characteristics,
          breakdown: updatedBatch.breakdown,
          estimated_price: updatedBatch.estimatedPrice,
          asking_price: updatedBatch.askingPrice,
          grape_color: updatedBatch.grapeColor,
          natural_yield: updatedBatch.naturalYield,
          fragile: updatedBatch.fragile,
          prone_to_oxidation: updatedBatch.proneToOxidation,
          features: updatedBatch.features || [],
          origin_snapshot: updatedBatch.originSnapshot ?? null,
          wine_anchors: updatedBatch.wineAnchors,
          harvest_start_week: Math.round(updatedBatch.harvestStartDate.week),
          harvest_start_season: updatedBatch.harvestStartDate.season,
          harvest_start_year: Math.round(updatedBatch.harvestStartDate.year),
          batch_number: updatedBatch.batchNumber ?? null,
          batch_group_size: updatedBatch.batchGroupSize ?? null,
          harvest_end_week: Math.round(updatedBatch.harvestEndDate.week),
          harvest_end_season: updatedBatch.harvestEndDate.season,
          harvest_end_year: Math.round(updatedBatch.harvestEndDate.year),
          bottled_week: updatedBatch.bottledDate ? Math.round(updatedBatch.bottledDate.week) : null,
          bottled_season: updatedBatch.bottledDate?.season,
          bottled_year: updatedBatch.bottledDate ? Math.round(updatedBatch.bottledDate.year) : null,
          taste_quality_index_bottling_snapshot: updatedBatch.tasteQualityIndexBottlingSnapshot ?? null,
          land_value_modifier_bottling_snapshot: updatedBatch.landValueModifierBottlingSnapshot ?? null,
          structure_index_bottling_snapshot: updatedBatch.structureIndexBottlingSnapshot ?? null,
          wine_score_bottling_snapshot: updatedBatch.wineScoreBottlingSnapshot ?? null,
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

export const deleteWineBatch = async (batchId: string): Promise<boolean> => {
  try {
    const companyId = getCurrentCompanyId();
    const { error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .delete()
      .eq('id', batchId)
      .eq('company_id', companyId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting wine batch:', error);
    return false;
  }
};

