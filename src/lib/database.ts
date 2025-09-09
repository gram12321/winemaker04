// Database operations for separate tables
import { supabase } from './supabase';
import { Vineyard, InventoryItem, GameState } from './types';

// Table names
const VINEYARDS_TABLE = 'vineyards';
const INVENTORY_TABLE = 'inventory_items';
const GAME_STATE_TABLE = 'game_state';

// ===== VINEYARD OPERATIONS =====

export const saveVineyard = async (vineyard: Vineyard, playerId: string = 'default'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .upsert({
        id: vineyard.id,
        player_id: playerId,
        name: vineyard.name,
        country: vineyard.country,
        region: vineyard.region,
        acres: vineyard.acres,
        grape_variety: vineyard.grape,
        is_planted: vineyard.isPlanted,
        status: vineyard.status,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - allow game to continue
  }
};

export const loadVineyards = async (playerId: string = 'default'): Promise<Vineyard[]> => {
  try {
    const { data, error } = await supabase
      .from(VINEYARDS_TABLE)
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      country: row.country,
      region: row.region,
      acres: row.acres,
      grape: row.grape_variety,
      isPlanted: row.is_planted,
      status: row.status,
      createdAt: {
        week: 1,
        season: 'Spring' as const,
        year: 2024
      }
    }));
  } catch (error) {
    return [];
  }
};

export const deleteVineyard = async (vineyardId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from(VINEYARDS_TABLE)
      .delete()
      .eq('id', vineyardId);

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

// ===== INVENTORY OPERATIONS =====

export const saveInventoryItem = async (item: InventoryItem, playerId: string = 'default'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(INVENTORY_TABLE)
      .upsert({
        id: item.id,
        player_id: playerId,
        grape_variety: item.grape,
        quantity: item.quantity,
        vineyard_name: item.vineyardName,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

export const loadInventoryItems = async (playerId: string = 'default'): Promise<InventoryItem[]> => {
  try {
    const { data, error } = await supabase
      .from(INVENTORY_TABLE)
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      grape: row.grape_variety,
      quantity: row.quantity,
      vineyardName: row.vineyard_name
    }));
  } catch (error) {
    return [];
  }
};

export const deleteInventoryItem = async (itemId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from(INVENTORY_TABLE)
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

// ===== GAME STATE OPERATIONS =====

export const saveGameState = async (gameState: Partial<GameState>, playerId: string = 'default'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(GAME_STATE_TABLE)
      .upsert({
        id: playerId,
        player_name: 'Player',
        week: gameState.week,
        season: gameState.season,
        current_year: gameState.currentYear,
        money: gameState.money,
        prestige: gameState.prestige,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

export const loadGameState = async (playerId: string = 'default'): Promise<Partial<GameState> | null> => {
  try {
    const { data, error } = await supabase
      .from(GAME_STATE_TABLE)
      .select('*')
      .eq('id', playerId);

    if (error) {
      throw error;
    }

    // If no record found, return null
    if (!data || data.length === 0) {
      return null;
    }

    const record = data[0];
    return {
      week: record.week,
      season: record.season,
      currentYear: record.current_year,
      money: record.money,
      prestige: record.prestige
    };
  } catch (error) {
    return null;
  }
};

