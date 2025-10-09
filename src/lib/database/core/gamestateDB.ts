import { supabase } from './supabase';
import { GameState } from '../../types/types';
import { getCurrentCompanyId } from '../../utils/companyUtils';

const GAME_STATE_TABLE = 'game_state';

/**
 * Game State Database Operations
 * Pure CRUD operations for game state data persistence
 */

export const saveGameState = async (gameState: Partial<GameState>): Promise<void> => {
  try {
    const dataToSave = {
      id: getCurrentCompanyId(),
      player_name: 'Player',
      week: gameState.week,
      season: gameState.season,
      current_year: gameState.currentYear,
      money: gameState.money || 0,
      prestige: gameState.prestige
    };
    
    const { error } = await supabase
      .from(GAME_STATE_TABLE)
      .upsert(dataToSave);

    if (error) throw error;
  } catch (error) {
    // Silently fail
  }
};

export const loadGameState = async (): Promise<Partial<GameState> | null> => {
  try {
    const { data, error } = await supabase
      .from(GAME_STATE_TABLE)
      .select('*')
      .eq('id', getCurrentCompanyId());

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
