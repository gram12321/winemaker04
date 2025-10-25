import { supabase } from '../core/supabase';
import { Vineyard } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';

const VINEYARDS_TABLE = 'vineyards';

/**
 * Vineyard Database Operations
 * Pure CRUD operations for vineyard data persistence
 */

export const saveVineyard = async (vineyard: Vineyard): Promise<void> => {
  try {
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .upsert({
        id: vineyard.id,
        company_id: getCurrentCompanyId(),
        name: vineyard.name,
        country: vineyard.country,
        region: vineyard.region,
        hectares: vineyard.hectares,
        grape_variety: vineyard.grape,
        vine_age: vineyard.vineAge,
        soil: vineyard.soil, // Store as JSON array
        altitude: vineyard.altitude,
        aspect: vineyard.aspect,
        density: vineyard.density,
        vineyard_health: vineyard.vineyardHealth || 1.0,
        land_value: vineyard.landValue,
        vineyard_total_value: vineyard.vineyardTotalValue,
        status: vineyard.status,
        ripeness: vineyard.ripeness || 0,
        vineyard_prestige: vineyard.vineyardPrestige,
        vine_yield: vineyard.vineYield || 0.02, // Default to 0.02 if not set
        overgrowth: vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 }, // Track overgrowth for each task type
        planting_health_bonus: vineyard.plantingHealthBonus || 0, // Default to 0 (no gradual improvement)
        health_trend: vineyard.healthTrend ? JSON.stringify(vineyard.healthTrend) : null // Store health trend as JSON
      });

    if (error) throw error;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
};

export const loadVineyards = async (): Promise<Vineyard[]> => {
  try {
    const { data, error } = await getCompanyQuery(VINEYARDS_TABLE)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      country: row.country,
      region: row.region,
      hectares: row.hectares,
      grape: row.grape_variety,
      vineAge: row.vine_age,
      soil: row.soil,
      altitude: row.altitude,
      aspect: row.aspect,
      density: row.density ?? 0,
      vineyardHealth: row.vineyard_health ?? 1.0, // Default to perfect health
      landValue: row.land_value || 50000,
      vineyardTotalValue: row.vineyard_total_value || (row.hectares * (row.land_value || 50000)),
      status: row.status,
      ripeness: row.ripeness ?? 0, // Default to 0 ripeness
      vineyardPrestige: row.vineyard_prestige || 0,
      vineYield: row.vine_yield ?? 0.02, // Default to 0.02 if not set (will be 0.02 for existing records)
      overgrowth: row.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 }, // Track overgrowth for each task type
      plantingHealthBonus: row.planting_health_bonus ?? 0, // Default to 0 (no gradual improvement)
      healthTrend: row.health_trend ? JSON.parse(row.health_trend) : undefined // Parse health trend from JSON
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Bulk update multiple vineyards in a single database operation
 * OPTIMIZATION: Reduces N individual database calls to 1 bulk operation
 */
export const bulkUpdateVineyards = async (vineyards: Vineyard[]): Promise<void> => {
  if (vineyards.length === 0) return;
  
  try {
    const companyId = getCurrentCompanyId();
    
    const upsertData = vineyards.map(vineyard => ({
      id: vineyard.id,
      company_id: companyId,
      name: vineyard.name,
      country: vineyard.country,
      region: vineyard.region,
      hectares: vineyard.hectares,
      grape_variety: vineyard.grape,
      vine_age: vineyard.vineAge,
      soil: vineyard.soil,
      altitude: vineyard.altitude,
      aspect: vineyard.aspect,
      density: vineyard.density,
      vineyard_health: vineyard.vineyardHealth || 1.0,
      land_value: vineyard.landValue,
      vineyard_total_value: vineyard.vineyardTotalValue,
      status: vineyard.status,
      ripeness: vineyard.ripeness || 0,
      vineyard_prestige: vineyard.vineyardPrestige,
      vine_yield: vineyard.vineYield || 0.02,
      overgrowth: vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
      planting_health_bonus: vineyard.plantingHealthBonus || 0,
      health_trend: vineyard.healthTrend ? JSON.stringify(vineyard.healthTrend) : null,
      updated_at: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .upsert(upsertData);
    
    if (error) throw error;
  } catch (error) {
    console.error('Bulk update vineyards failed:', error);
    throw error;
  }
};

/**
 * Delete vineyards by IDs
 * Used for loan default vineyard seizure
 */
export const deleteVineyards = async (vineyardIds: string[]): Promise<void> => {
  if (vineyardIds.length === 0) return;
  
  try {
    const companyId = getCurrentCompanyId();
    
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .delete()
      .eq('company_id', companyId)
      .in('id', vineyardIds);
    
    if (error) throw error;
  } catch (error) {
    console.error('Delete vineyards failed:', error);
    throw error;
  }
};