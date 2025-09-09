// Centralized game state and logic (time/season only)
import { GameState } from './types';
import { saveGameState as persistGameState, loadGameState as loadGameStateFromDB } from './database';

// Global game state (time/season and financial data)
let gameState: Partial<GameState> = {
  week: 1,
  season: 'Spring',
  currentYear: 2024,
  money: 10000000, // €10M starting capital
  prestige: 1
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
    week: 1,
    season: 'Spring',
    currentYear: 2024,
    money: 10000000,
    prestige: 1
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

// Time management functions
export const incrementWeek = (): Partial<GameState> => {
  const currentState = getGameState();
  let { week = 1, season = 'Spring', currentYear = 2024 } = currentState;
  
  // Increment week
  week += 1;
  
  // Check if season changes (every 12 weeks)
  if (week > 12) {
    week = 1;
    const currentSeasonIndex = ['Spring', 'Summer', 'Fall', 'Winter'].indexOf(season);
    const nextSeasonIndex = (currentSeasonIndex + 1) % 4;
    season = ['Spring', 'Summer', 'Fall', 'Winter'][nextSeasonIndex] as 'Spring' | 'Summer' | 'Fall' | 'Winter';
    
    // If we're back to Spring, increment year
    if (season === 'Spring') {
      currentYear += 1;
    }
  }
  
  updateGameState({ week, season, currentYear });
  return getGameState();
};
