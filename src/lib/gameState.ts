// Centralized game state and logic
import { GameState, initialGameState } from './types';
import { saveGameState as persistGameState } from './database';

// Global game state
let gameState: GameState = { ...initialGameState };

// Game state management functions
export const getGameState = (): GameState => {
  return { ...gameState };
};

export const updateGameState = (updates: Partial<GameState>): void => {
  gameState = { ...gameState, ...updates };
  // Auto-save to database (fire and forget)
  persistGameState(gameState).catch(error => {
    console.warn('Failed to persist game state:', error);
  });
};

export const setGameState = (newGameState: GameState): void => {
  gameState = { ...newGameState };
};

export const resetGameState = (): void => {
  gameState = { ...initialGameState };
  // Auto-save reset state
  persistGameState(gameState).catch(error => {
    console.warn('Failed to persist reset game state:', error);
  });
};

// Time management functions
export const incrementWeek = (): GameState => {
  const currentState = getGameState();
  let { week, season, currentYear } = currentState;
  
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
