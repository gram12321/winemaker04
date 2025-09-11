// Centralized game state and logic (time/season only)
import { GameState } from './types';
import { saveGameState as persistGameState, loadGameState as loadGameStateFromDB } from './database';
import { GAME_INITIALIZATION } from './constants';

// Global game state (time/season, company, and financial data)
let gameState: Partial<GameState> = {
  week: GAME_INITIALIZATION.STARTING_WEEK,
  season: GAME_INITIALIZATION.STARTING_SEASON,
  currentYear: GAME_INITIALIZATION.STARTING_YEAR,
  companyName: GAME_INITIALIZATION.DEFAULT_COMPANY_NAME,
  foundedYear: GAME_INITIALIZATION.STARTING_YEAR,
  money: 0, // Start with 0 money - initial capital will be added through transaction
  prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
};

// Game state management functions
export const getGameState = (): Partial<GameState> => {
  return { ...gameState };
};

export const updateGameState = (updates: Partial<GameState>): void => {
  gameState = { ...gameState, ...updates };
  // Auto-save to database (fire and forget)
  persistGameState(gameState).catch(() => {
    // Silently fail - allow game to continue
  });
};

export const setGameState = (newGameState: Partial<GameState>): void => {
  gameState = { ...newGameState };
};

export const resetGameState = (): void => {
  gameState = {
    week: GAME_INITIALIZATION.STARTING_WEEK,
    season: GAME_INITIALIZATION.STARTING_SEASON,
    currentYear: GAME_INITIALIZATION.STARTING_YEAR,
    companyName: GAME_INITIALIZATION.DEFAULT_COMPANY_NAME,
    foundedYear: GAME_INITIALIZATION.STARTING_YEAR,
    money: 0, // Start with 0 money - initial capital will be added through transaction
    prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
  };
  // Auto-save reset state
  persistGameState(gameState).catch(() => {
    // Silently fail - allow game to continue
  });
};

// Load game state from database
export const loadGameState = async (): Promise<void> => {
  try {
    const savedState = await loadGameStateFromDB();
    if (savedState) {
      gameState = savedState;
    } else {
      // If no saved state, create initial record in database
      await persistGameState(gameState);
    }
  } catch (error) {
    // Silently fail - use default state
  }
};
