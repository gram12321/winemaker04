// Database operations for separate tables
import { supabase } from './supabase';
import { Vineyard, WineBatch, GameState, Season } from './types';

// Table names
const VINEYARDS_TABLE = 'vineyards';
const WINE_BATCHES_TABLE = 'wine_batches';
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
        created_week: vineyard.createdAt.week,
        created_season: vineyard.createdAt.season,
        created_year: vineyard.createdAt.year,
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
        week: row.created_week || 1,
        season: (row.created_season || 'Spring') as Season,
        year: row.created_year || 2024
      }
    }));
  } catch (error) {
    return [];
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


// ===== WINE BATCH OPERATIONS =====

export const saveWineBatch = async (batch: WineBatch, playerId: string = 'default'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .upsert({
        id: batch.id,
        player_id: playerId,
        vineyard_id: batch.vineyardId,
        vineyard_name: batch.vineyardName,
        grape_variety: batch.grape,
        quantity: batch.quantity,
        stage: batch.stage,
        process: batch.process,
        fermentation_progress: batch.fermentationProgress || 0,
        harvest_week: batch.harvestDate.week,
        harvest_season: batch.harvestDate.season,
        harvest_year: batch.harvestDate.year,
        created_week: batch.createdAt.week,
        created_season: batch.createdAt.season,
        created_year: batch.createdAt.year,
        completed_week: batch.completedAt?.week,
        completed_season: batch.completedAt?.season,
        completed_year: batch.completedAt?.year,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    // Silently fail - allow game to continue
  }
};

export const loadWineBatches = async (playerId: string = 'default'): Promise<WineBatch[]> => {
  try {
    const { data, error } = await supabase
      .from(WINE_BATCHES_TABLE)
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      vineyardId: row.vineyard_id,
      vineyardName: row.vineyard_name,
      grape: row.grape_variety,
      quantity: row.quantity,
      stage: row.stage,
      process: row.process,
      fermentationProgress: row.fermentation_progress || 0,
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
    }));
  } catch (error) {
    return [];
  }
};

