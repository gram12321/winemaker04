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
        vine_yield: vineyard.vineYield || 0.02 // Default to 0.02 if not set
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
      vineYield: row.vine_yield ?? 0.02 // Default to 0.02 if not set (will be 0.02 for existing records)
    }));
  } catch (error) {
    return [];
  }
};
