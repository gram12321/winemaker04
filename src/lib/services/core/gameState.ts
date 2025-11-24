// Enhanced game state service that integrates with the new company system
import { GameState } from '../../types/types';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { CREDIT_RATING } from '../../constants/loanConstants';
import { calculateCurrentPrestige, initializeBasePrestigeEvents, updateCompanyValuePrestige } from '../prestige/prestigeService';
import { companyService } from '../user/companyService';
import { Company, loadGameState, saveGameState } from '@/lib/database';
import { initializeStartingCapital } from '../finance/financeService';
import { initializeStaffSystem } from '../user/staffService';
import { initializeTeamsSystem } from '../user/teamService';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { initializeEconomyPhase } from '../finance/economyService';

// Current active company and game state
let currentCompany: Company | null = null;
let gameState: Partial<GameState> = {
  week: GAME_INITIALIZATION.STARTING_WEEK,
  season: GAME_INITIALIZATION.STARTING_SEASON,
  currentYear: GAME_INITIALIZATION.STARTING_YEAR,
  companyName: '',
  foundedYear: GAME_INITIALIZATION.STARTING_YEAR,
  money: 0,
  prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
  creditRating: CREDIT_RATING.DEFAULT_RATING,
  economyPhase: 'Stable'
};

// Persistence key
const LAST_COMPANY_ID_KEY = 'lastCompanyId';

function setLastCompanyId(companyId: string): void {
  try {
    localStorage.setItem(LAST_COMPANY_ID_KEY, companyId);
  } catch (error) {
    // no-op
  }
}

function clearLastCompanyId(): void {
  try {
    localStorage.removeItem(LAST_COMPANY_ID_KEY);
  } catch (error) {
    // no-op
  }
}

let prestigeCache: { value: number; timestamp: number } | null = null;
const PRESTIGE_CACHE_TTL = 5000; // 5 seconds cache

// Game state management functions
export const getGameState = (): Partial<GameState> => {
  return { ...gameState };
};

export const getCurrentCompany = (): Company | null => {
  return currentCompany;
};

export const updateGameState = async (updates: Partial<GameState>): Promise<void> => {
  const oldMoney = gameState.money;
  gameState = { ...gameState, ...updates };
  
  // Update base prestige events if money changed
  if (updates.money !== undefined && updates.money !== oldMoney) {
    await updateCompanyValuePrestige(updates.money);
    prestigeCache = null; // clear cached total after base prestige changes
  }
  
  // Update company in database if we have an active company
  if (currentCompany) {
    const companyUpdates: any = {};
    
    if (updates.week !== undefined) companyUpdates.currentWeek = updates.week;
    if (updates.season !== undefined) companyUpdates.currentSeason = updates.season;
    if (updates.currentYear !== undefined) companyUpdates.currentYear = updates.currentYear;
    if (updates.money !== undefined) companyUpdates.money = updates.money;
    if (updates.prestige !== undefined) companyUpdates.prestige = updates.prestige;
    
    if (Object.keys(companyUpdates).length > 0) {
      try {
        await companyService.updateCompany(currentCompany.id, companyUpdates);
        
        // Update our local company object
        currentCompany = { ...currentCompany, ...companyUpdates };
        

      } catch (error) {
        console.error('Failed to update company in database:', error);
        // Continue with local state even if database update fails
      }
    }
  }

  // Persist economyPhase to game_state table if it changed
  if (updates.economyPhase !== undefined) {
    try {
      await saveGameState({
        week: gameState.week,
        season: gameState.season,
        currentYear: gameState.currentYear,
        money: gameState.money,
        prestige: gameState.prestige,
        economyPhase: updates.economyPhase
      });
    } catch (error) {
      console.error('Failed to save economy phase to game_state:', error);
      // Continue even if persistence fails
    }
  }

  // Notify subscribers that game state changed (debounced globally)
  try {
    triggerGameUpdate();
  } catch (e) {
    // no-op
  }
};

export const setActiveCompany = async (company: Company): Promise<void> => {
  // Check if this is the same company that's already active
  if (currentCompany && currentCompany.id === company.id) {
    return;
  }
  
  currentCompany = company;
  
  // Persist only the lastCompanyId for autologin
  setLastCompanyId(company.id);
  
  // Load persisted game state (including economy phase) for this company
  let persisted = null as Partial<GameState> | null;
  try {
    persisted = await loadGameState();
  } catch {}
  
  // If no persisted state, initialize once with defaults and set economyPhase to Stable
  let ensuredEconomyPhase = persisted?.economyPhase;
  if (!ensuredEconomyPhase) {
    ensuredEconomyPhase = initializeEconomyPhase();
    try {
      await saveGameState({
        week: company.currentWeek,
        season: company.currentSeason,
        currentYear: company.currentYear,
        money: company.money,
        prestige: company.prestige,
        economyPhase: ensuredEconomyPhase
      });
    } catch {}
  }

  // Update local game state to match company and DB (no fallback defaults here)
  gameState = {
    week: company.currentWeek,
    season: company.currentSeason,
    currentYear: company.currentYear,
    companyName: company.name,
    foundedYear: company.foundedYear,
    money: company.money,
    prestige: company.prestige,
    economyPhase: ensuredEconomyPhase
  };
  
  // Initialize prestige system for this company
  try {
    await initializePrestigeSystem();
    // Ensure company value prestige is updated with current money
    await updateCompanyValuePrestige(company.money);
    prestigeCache = null;
  } catch (error) {
    console.error('Failed to initialize prestige system:', error);
  }
  
  // Initialize staff system for this company
  try {
    await initializeStaffSystem();
  } catch (error) {
    console.error('Failed to initialize staff system:', error);
  }
  
  // Initialize teams system for this company
  try {
    await initializeTeamsSystem();
  } catch (error) {
    console.error('Failed to initialize teams system:', error);
  }
  
  // Initialize starting capital in finance system for this company
  try {
    await initializeStartingCapital(company.id);
    
    // After starting capital is initialized, ensure game state reflects the updated money
    // This is critical for UI synchronization
    const updatedGameState = getGameState();
    
    if (updatedGameState.money !== company.money) {
      // The starting capital was added, update our local company object to match
      currentCompany = { ...currentCompany, money: updatedGameState.money! };
    }
  } catch (error) {
    console.error('Failed to initialize starting capital:', error);
  }
  
  // Trigger a final game update to ensure all components are synchronized
  triggerGameUpdate();
  

};

export const createNewCompany = async (companyName: string, associateWithUser: boolean = false, userName?: string, userId?: string): Promise<Company | null> => {
  try {
    const result = await companyService.createCompany({
      name: companyName,
      associateWithUser,
      userName,
      userId
    });
    
    if (result.success && result.company) {
      await setActiveCompany(result.company);
      
      // Initialize teams system for new companies first
      try {
        await initializeTeamsSystem();
      } catch (error) {
        console.error('Error initializing teams system:', error);
      }
      
      // Create starting staff for new companies (after teams are initialized)
      try {
        // Starting staff are now managed via starting conditions.
      } catch (error) {
        console.error('Error initializing staff system for new company:', error);
      }

      return result.company;
    } else {
      console.error(result.error || 'Failed to create company');
      return null;
    }
  } catch (error) {
    console.error('Error creating company:', error);
    return null;
  }
};

export const resetGameState = (): void => {
  currentCompany = null;

  gameState = {
    week: GAME_INITIALIZATION.STARTING_WEEK,
    season: GAME_INITIALIZATION.STARTING_SEASON,
    currentYear: GAME_INITIALIZATION.STARTING_YEAR,
    companyName: '',
    foundedYear: GAME_INITIALIZATION.STARTING_YEAR,
    money: 0,
    prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
  };
  prestigeCache = null;
  
  // Clear the lastCompanyId to prevent autologin
  clearLastCompanyId();
};

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
    return gameState.prestige || GAME_INITIALIZATION.STARTING_PRESTIGE;
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


// Clear prestige cache (for admin functions)
export const clearPrestigeCache = (): void => {
  prestigeCache = null;
};

// Export clearLastCompanyId for explicit logout handling
export const clearLastCompanyIdForLogout = (): void => {
  clearLastCompanyId();
};