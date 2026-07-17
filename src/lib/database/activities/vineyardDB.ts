import { supabase } from '../core/supabase';
import { Vineyard } from '../../types/types';
import { getCompanyQuery, getCurrentCompanyId } from '../../utils/companyUtils';

const VINEYARDS_TABLE = 'vineyards';

const numberOrDefault = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toVineyardRow = (
  vineyard: Vineyard,
  companyId: string | null,
  options: { roundHectares?: boolean; updatedAt?: string } = {},
) => ({
  id: vineyard.id,
  company_id: companyId,
  name: vineyard.name,
  country: vineyard.country,
  region: vineyard.region,
  hectares: options.roundHectares
    ? vineyard.hectares ? Number(Number(vineyard.hectares).toFixed(2)) : 0
    : vineyard.hectares,
  grape_variety: vineyard.grape,
  vine_age: vineyard.vineAge,
  soil: vineyard.soil,
  altitude: vineyard.altitude,
  aspect: vineyard.aspect,
  density: vineyard.density,
  vineyard_health: numberOrDefault(vineyard.vineyardHealth, 1.0),
  land_value: vineyard.landValue,
  vineyard_total_value: vineyard.vineyardTotalValue,
  status: vineyard.status,
  ripeness: numberOrDefault(vineyard.ripeness, 0),
  vineyard_prestige: vineyard.vineyardPrestige,
  vine_yield: numberOrDefault(vineyard.vineYield, 0.02),
  overgrowth: vineyard.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 },
  planting_health_bonus: numberOrDefault(vineyard.plantingHealthBonus, 0),
  health_trend: vineyard.healthTrend ? JSON.stringify(vineyard.healthTrend) : null,
  pending_features: vineyard.pendingFeatures ? JSON.stringify(vineyard.pendingFeatures) : null,
  ...(options.updatedAt === undefined ? {} : { updated_at: options.updatedAt }),
});

/**
 * Vineyard Database Operations
 * Pure CRUD operations for vineyard data persistence
 */

export const saveVineyard = async (vineyard: Vineyard): Promise<void> => {
  try {
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .upsert(toVineyardRow(vineyard, getCurrentCompanyId(), { roundHectares: true }));

    if (error) throw error;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
};

export interface StartingVineyardInsert {
  companyId: string;
  name: string;
  country: string;
  region: string;
  hectares: number;
  soil: string[];
  altitude: number;
  aspect: Vineyard['aspect'];
  density: number;
  status: Vineyard['status'];
  grape: Vineyard['grape'];
  vineAge: Vineyard['vineAge'];
  ripeness: number;
  vineYield: number;
  vineyardHealth: number;
  vineyardPrestige: number;
  landValue: number;
  vineyardTotalValue: number;
}

export const createStartingVineyard = async (input: StartingVineyardInsert): Promise<void> => {
  try {
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .insert({
        company_id: input.companyId,
        name: input.name,
        country: input.country,
        region: input.region,
        hectares: input.hectares,
        soil: input.soil,
        altitude: input.altitude,
        aspect: input.aspect,
        density: input.density,
        status: input.status,
        grape_variety: input.grape,
        vine_age: input.vineAge,
        ripeness: input.ripeness,
        vine_yield: input.vineYield,
        vineyard_health: input.vineyardHealth,
        vineyard_prestige: input.vineyardPrestige,
        land_value: input.landValue,
        vineyard_total_value: input.vineyardTotalValue,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error('Create starting vineyard failed:', error);
    throw error;
  }
};

export const loadVineyards = async (companyId?: string): Promise<Vineyard[]> => {
  try {
    const { data, error } = await getCompanyQuery(VINEYARDS_TABLE, companyId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      country: row.country,
      region: row.region,
      hectares: row.hectares ? Number(Number(row.hectares).toFixed(2)) : 0,
      grape: row.grape_variety,
      vineAge: row.vine_age,
      soil: row.soil,
      altitude: row.altitude,
      aspect: row.aspect,
      density: row.density ?? 0,
      vineyardHealth: numberOrDefault(row.vineyard_health, 1.0), // Default to perfect health
      landValue: row.land_value || 50000,
      vineyardTotalValue: row.vineyard_total_value || (row.hectares * (row.land_value || 50000)),
      status: row.status,
      ripeness: numberOrDefault(row.ripeness, 0), // Default to 0 ripeness
      vineyardPrestige: row.vineyard_prestige || 0,
      vineYield: numberOrDefault(row.vine_yield, 0.02), // Default to 0.02 if not set (will be 0.02 for existing records)
      overgrowth: row.overgrowth || { vegetation: 0, debris: 0, uproot: 0, replant: 0 }, // Track overgrowth for each task type
      plantingHealthBonus: numberOrDefault(row.planting_health_bonus, 0), // Default to 0 (no gradual improvement)
      healthTrend: row.health_trend ? JSON.parse(row.health_trend) : undefined, // Parse health trend from JSON
      pendingFeatures: row.pending_features ? JSON.parse(row.pending_features) : undefined // Parse pending features from JSON
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
    
    const upsertData = vineyards.map(vineyard => toVineyardRow(vineyard, companyId, {
      updatedAt: new Date().toISOString(),
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
