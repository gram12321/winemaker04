// Centralized game state and logic (time/season only)
import { GameState } from './types';
import { saveGameState as persistGameState, loadGameState as loadGameStateFromDB } from './database/database';
import { GAME_INITIALIZATION } from './constants';
import { calculateCurrentPrestige, initializeBasePrestigeEvents, updateBasePrestigeEvent } from './database/prestigeService';

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
  const oldMoney = gameState.money;
  gameState = { ...gameState, ...updates };
  
  // Update base prestige events if money changed
  if (updates.money !== undefined && updates.money !== oldMoney) {
    updateCompanyValuePrestige(updates.money);
  }
  
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

let prestigeCache: { value: number; timestamp: number } | null = null;
const PRESTIGE_CACHE_TTL = 5000; // 5 seconds cache

// Get current prestige (with caching for performance)
export async function getCurrentPrestige(): Promise<number> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (prestigeCache && (now - prestigeCache.timestamp) < PRESTIGE_CACHE_TTL) {
    return prestigeCache.value;
  }
  
  try {
    const { totalPrestige } = await calculateCurrentPrestige();
    
    // Update cache
    prestigeCache = {
      value: totalPrestige,
      timestamp: now
    };
    
    // Update game state with calculated prestige
    gameState.prestige = totalPrestige;
    
    return totalPrestige;
  } catch (error) {
    console.error('Failed to calculate prestige:', error);
    return gameState.prestige || GAME_INITIALIZATION.STARTING_PRESTIGE; // Fallback to cached value
  }
}

// Update company value prestige event
async function updateCompanyValuePrestige(money: number): Promise<void> {
  try {
    const companyValuePrestige = money / 10000000; // Same formula as old system
    await updateBasePrestigeEvent(
      'company_value',
      'company_money',
      companyValuePrestige,
      `Company value: €${money.toLocaleString()}`
    );
    
    // Clear prestige cache when base prestige changes
    prestigeCache = null;
  } catch (error) {
    console.error('Failed to update company value prestige:', error);
  }
}

// Initialize prestige system
export async function initializePrestigeSystem(): Promise<void> {
  try {
    await initializeBasePrestigeEvents();
    
    // Get initial prestige calculation
    await getCurrentPrestige();
    
  } catch (error) {
    console.error('Failed to initialize prestige system:', error);
  }
}

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
    
    // Initialize prestige system after loading game state
    await initializePrestigeSystem();
  } catch (error) {
    // Silently fail - use default state
  }
};
