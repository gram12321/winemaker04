import { supabase } from './supabase';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { WineLogEntry, GrapeVariety, Season } from '../../types/types';

const WINE_LOG_TABLE = 'wine_log';

/**
 * Wine Log Database Operations
 * Pure CRUD operations for wine production log data persistence
 */

export interface WineLogData {
  id: string;
  company_id: string;
  vineyard_id: string;
  vineyard_name: string;
  grape_variety: string;
  vintage: number;
  quantity: number;
  quality: number;
  balance: number;
  characteristics: any;
  estimated_price: number;
  harvest_week: number;
  harvest_season: string;
  harvest_year: number;
  bottled_week: number;
  bottled_season: string;
  bottled_year: number;
}

/**
 * Map database row to WineLogEntry (uses WineLogEntry from types.ts)
 */
function mapWineLogFromDB(row: any): WineLogEntry {
  return {
    id: row.id,
    vineyardId: row.vineyard_id,
    vineyardName: row.vineyard_name,
    grape: row.grape_variety as GrapeVariety,
    vintage: row.vintage,
    quantity: row.quantity,
    quality: row.quality,
    balance: row.balance,
    characteristics: row.characteristics,
    estimatedPrice: row.estimated_price,
    harvestDate: {
      week: row.harvest_week,
      season: row.harvest_season as Season,
      year: row.harvest_year
    },
    bottledDate: {
      week: row.bottled_week,
      season: row.bottled_season as Season,
      year: row.bottled_year
    }
  };
}

export const insertWineLogEntry = async (wineLogData: WineLogData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from(WINE_LOG_TABLE)
      .insert(wineLogData);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error inserting wine log entry:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const loadWineLog = async (): Promise<WineLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from(WINE_LOG_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .order('bottled_year', { ascending: false })
      .order('bottled_season', { ascending: false })
      .order('bottled_week', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapWineLogFromDB);
  } catch (error) {
    console.error('Error loading wine log:', error);
    return [];
  }
};

export const loadWineLogByVineyard = async (vineyardId: string): Promise<WineLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from(WINE_LOG_TABLE)
      .select('*')
      .eq('company_id', getCurrentCompanyId())
      .eq('vineyard_id', vineyardId)
      .order('bottled_year', { ascending: false })
      .order('bottled_season', { ascending: false })
      .order('bottled_week', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapWineLogFromDB);
  } catch (error) {
    console.error('Error loading wine log by vineyard:', error);
    return [];
  }
};

