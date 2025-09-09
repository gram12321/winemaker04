// Database operations for game state persistence
import { supabase } from './supabase';
import { GameState } from './types';

// Table name for game state
const GAME_STATE_TABLE = 'game_states';

export interface GameStateRecord {
  id: string;
  player_name: string;
  game_state: GameState;
  created_at: string;
  updated_at: string;
}

// Save game state to Supabase
export const saveGameState = async (gameState: GameState, playerId: string = 'default'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(GAME_STATE_TABLE)
      .upsert({
        id: playerId,
        player_name: 'Player',
        game_state: gameState,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    // Don't throw error - allow game to continue even if save fails
  }
};

// Load game state from Supabase
export const loadGameState = async (playerId: string = 'default'): Promise<GameState | null> => {
  try {
    const { data, error } = await supabase
      .from(GAME_STATE_TABLE)
      .select('game_state')
      .eq('id', playerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - this is normal for new games
        return null;
      }
      throw error;
    }

    return data.game_state as GameState;
  } catch (error) {
    return null; // Return null so game can start with default state
  }
};

// Delete game state (for reset functionality)
export const deleteGameState = async (playerId: string = 'default'): Promise<void> => {
  try {
    const { error } = await supabase
      .from(GAME_STATE_TABLE)
      .delete()
      .eq('id', playerId);

    if (error) {
      throw error;
    }
  } catch (error) {
    // Silently fail - allow game to continue
  }
};
