// Enhanced game state service that integrates with the new company system
import { GameState } from '../types';
import { GAME_INITIALIZATION } from '../constants';
import { calculateCurrentPrestige, initializeBasePrestigeEvents, updateBasePrestigeEvent } from '../database/prestigeService';
import { companyService, Company } from './user/companyService';
import { highscoreService } from './user/highscoreService';
import { calculateFinancialData, initializeStartingCapital } from './user/financeService';
import { notificationService } from '@/components/layout/NotificationCenter';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';

// Current active company and game state
let currentCompany: Company | null = null;
let gameState: Partial<GameState> = {
  week: GAME_INITIALIZATION.STARTING_WEEK,
  season: GAME_INITIALIZATION.STARTING_SEASON,
  currentYear: GAME_INITIALIZATION.STARTING_YEAR,
  companyName: '',
  foundedYear: GAME_INITIALIZATION.STARTING_YEAR,
  money: 0,
  prestige: GAME_INITIALIZATION.STARTING_PRESTIGE
};

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
        
        // Submit highscores if significant changes
        if (updates.money !== undefined || updates.prestige !== undefined) {
          await submitHighscores();
        }
      } catch (error) {
        console.error('Failed to update company in database:', error);
        // Continue with local state even if database update fails
      }
    }
  }
};

export const setActiveCompany = async (company: Company): Promise<void> => {
  // Check if this is the same company that's already active
  if (currentCompany && currentCompany.id === company.id) {
    return;
  }
  
  currentCompany = company;
  
  // Update local game state to match company
  gameState = {
    week: company.currentWeek,
    season: company.currentSeason,
    currentYear: company.currentYear,
    companyName: company.name,
    foundedYear: company.foundedYear,
    money: company.money,
    prestige: company.prestige
  };
  
  // Initialize prestige system for this company
  try {
    await initializePrestigeSystem();
    
    // Ensure company value prestige is updated with current money
    await updateCompanyValuePrestige(company.money);
  } catch (error) {
    console.error('Failed to initialize prestige system:', error);
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
  
  notificationService.info(`Switched to company: ${company.name}`);
};

export const createNewCompany = async (companyName: string, associateWithUser: boolean = false, userName?: string): Promise<Company | null> => {
  try {
    const result = await companyService.createCompany({
      name: companyName,
      associateWithUser,
      userName
    });
    
    if (result.success && result.company) {
      await setActiveCompany(result.company);
      
      notificationService.success(`Company "${companyName}" created successfully!`);
      return result.company;
    } else {
      notificationService.error(result.error || 'Failed to create company');
      return null;
    }
  } catch (error) {
    console.error('Error creating company:', error);
    notificationService.error('An unexpected error occurred');
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

// Submit highscores for current company
async function submitHighscores(): Promise<void> {
  if (!currentCompany || !gameState.money) return;
  
  try {
    // Calculate company value using finance service
    const financialData = await calculateFinancialData('year');
    const companyValue = financialData.totalAssets;
    
    // Calculate per-week metrics
    const weeksElapsed = Math.max(1, (gameState.currentYear! - currentCompany.foundedYear) * 52 + gameState.week!);
    const startingValue = 60000; // Estimated starting company value
    
    const companyValuePerWeek = Math.max(0, companyValue - startingValue) / weeksElapsed;
    
    await highscoreService.submitAllCompanyScores(
      currentCompany.id,
      currentCompany.name,
      gameState.week!,
      gameState.season!,
      gameState.currentYear!,
      {
        companyValue,
        companyValuePerWeek
      }
    );
  } catch (error) {
    console.error('Failed to submit highscores:', error);
  }
}

// Force highscore submission (for manual triggers)
export const forceSubmitHighscores = async (): Promise<void> => {
  await submitHighscores();
};

// Clear prestige cache (for admin functions)
export const clearPrestigeCache = (): void => {
  prestigeCache = null;
};