// Enhanced game state service that integrates with the new company system
import { GameState, Season } from '../../types/types';
import { GAME_INITIALIZATION } from '../../constants/constants';
import { SEASON_ORDER, WEEKS_PER_SEASON } from '@/lib/constants';
import { CREDIT_RATING } from '../../constants/loanConstants';
import { calculateCurrentPrestige, initializeBasePrestigeEvents, updateCompanyValuePrestige } from '../prestige/prestigeService';
import { companyFeature } from '@/lib/features/company';
import { notifyCompanyActivated } from './companyLifecycle';
import { Company, loadGameState, saveGameState } from '@/lib/database';
import { staffFeature } from '@/lib/features/staff';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { initializeEconomyPhase } from '../finance/economyService';
import { resolveSeasonalWeatherForecast, resolveWeatherWeek } from '@/lib/features/weather';

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
  economyPhase: 'Stable',
  weatherForecastPattern: 'Stable',
  weatherForecastConfidence: 'Medium',
  weatherState: 'Clear',
  weatherIntensity: 'Mild',
  nextWeekForecastState: 'Clear',
  nextWeekForecastIntensity: 'Mild',
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

export function getNextTickDate(state: Partial<GameState>): { week: number; season: Season; year: number } {
  const currentWeek = state.week || GAME_INITIALIZATION.STARTING_WEEK;
  const currentSeason = (state.season || GAME_INITIALIZATION.STARTING_SEASON) as Season;
  const currentYear = state.currentYear || GAME_INITIALIZATION.STARTING_YEAR;

  const incrementedWeek = currentWeek + 1;
  if (incrementedWeek <= WEEKS_PER_SEASON) {
    return {
      week: incrementedWeek,
      season: currentSeason,
      year: currentYear,
    };
  }

  const currentSeasonIndex = SEASON_ORDER.indexOf(currentSeason);
  const safeSeasonIndex = currentSeasonIndex >= 0 ? currentSeasonIndex : 0;
  const nextSeason = SEASON_ORDER[(safeSeasonIndex + 1) % SEASON_ORDER.length] as Season;

  return {
    week: GAME_INITIALIZATION.STARTING_WEEK,
    season: nextSeason,
    year: nextSeason === 'Spring' ? currentYear + 1 : currentYear,
  };
}

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
        await companyFeature.records.update(currentCompany.id, companyUpdates);
        
        // Update our local company object
        currentCompany = { ...currentCompany, ...companyUpdates };
        

      } catch (error) {
        console.error('Failed to update company in database:', error);
        // Continue with local state even if database update fails
      }
    }
  }

  // Persist state owned by game_state, including the resolved weather facts.
  if (
    updates.economyPhase !== undefined ||
    updates.weatherForecastPattern !== undefined ||
    updates.weatherForecastConfidence !== undefined ||
    updates.weatherState !== undefined ||
    updates.weatherIntensity !== undefined ||
    updates.nextWeekForecastState !== undefined ||
    updates.nextWeekForecastIntensity !== undefined
  ) {
    try {
      await saveGameState({
        week: gameState.week,
        season: gameState.season,
        currentYear: gameState.currentYear,
        money: gameState.money,
        prestige: gameState.prestige,
        economyPhase: gameState.economyPhase,
        weatherForecastPattern: gameState.weatherForecastPattern,
        weatherForecastConfidence: gameState.weatherForecastConfidence,
        weatherState: gameState.weatherState,
        weatherIntensity: gameState.weatherIntensity,
        nextWeekForecastState: gameState.nextWeekForecastState,
        nextWeekForecastIntensity: gameState.nextWeekForecastIntensity,
      });
    } catch (error) {
      console.error('Failed to save game state to game_state:', error);
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

/**
 * Apply a balance already committed by a database transaction without writing
 * that value back over a potentially newer balance.
 */
let persistedMoneyVersion = 0;

export const syncPersistedMoney = async (money: number, moneyVersion?: number): Promise<void> => {
  if (moneyVersion !== undefined && moneyVersion < persistedMoneyVersion) return;
  if (moneyVersion !== undefined) persistedMoneyVersion = moneyVersion;
  const oldMoney = gameState.money;
  gameState = { ...gameState, money };
  if (currentCompany) currentCompany = { ...currentCompany, money };

  if (money !== oldMoney) {
    try {
      await updateCompanyValuePrestige(money);
    } catch (error) {
      console.error('Failed to update company-value prestige:', error);
    }
    prestigeCache = null;
  }
};

export const setActiveCompany = async (company: Company): Promise<void> => {
  // Check if this is the same company that's already active
  if (currentCompany && currentCompany.id === company.id) {
    return;
  }
  
  persistedMoneyVersion = 0;
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
  const initialSeason = company.currentSeason;
  const initialYear = company.currentYear;
  const initialWeek = company.currentWeek;
  const seasonalForecast = persisted?.weatherForecastPattern && persisted.weatherForecastConfidence
    ? { pattern: persisted.weatherForecastPattern, confidence: persisted.weatherForecastConfidence }
    : resolveSeasonalWeatherForecast(company.id, initialYear, initialSeason);
  const hasPersistedWeather = Boolean(
    persisted?.weatherState && persisted.weatherIntensity &&
    persisted.nextWeekForecastState && persisted.nextWeekForecastIntensity,
  );
  const weatherContext = hasPersistedWeather
    ? {
        state: persisted!.weatherState!,
        intensity: persisted!.weatherIntensity!,
        forecast: {
          state: persisted!.nextWeekForecastState!,
          intensity: persisted!.nextWeekForecastIntensity!,
          confidence: seasonalForecast.confidence,
        },
      }
    : resolveWeatherWeek({
        companyId: company.id,
        date: { year: initialYear, season: initialSeason, week: initialWeek },
        seasonalPattern: seasonalForecast.pattern,
        forecastConfidence: seasonalForecast.confidence,
      });

  gameState = {
    week: company.currentWeek,
    season: company.currentSeason,
    currentYear: company.currentYear,
    companyName: company.name,
    foundedYear: company.foundedYear,
    money: company.money,
    prestige: company.prestige,
    economyPhase: ensuredEconomyPhase,
    weatherForecastPattern: seasonalForecast.pattern,
    weatherForecastConfidence: seasonalForecast.confidence,
    weatherState: weatherContext.state,
    weatherIntensity: weatherContext.intensity,
    nextWeekForecastState: weatherContext.forecast.state,
    nextWeekForecastIntensity: weatherContext.forecast.intensity,
  };

  // Company-scoped presentation and finance caches are reset through their
  // public lifecycle hooks after the active company is established.
  await notifyCompanyActivated(company.id);

  if (!hasPersistedWeather || !persisted?.weatherForecastPattern || !persisted.weatherForecastConfidence) {
    await saveGameState(gameState);
  }
  
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
    await staffFeature.setup.initialize();
  } catch (error) {
    console.error('Failed to initialize staff system:', error);
  }
  
  // Initialize teams system for this company
  
  // Trigger a final game update to ensure all components are synchronized
  triggerGameUpdate();
  

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
    prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
    weatherForecastPattern: 'Stable',
    weatherForecastConfidence: 'Medium',
    weatherState: 'Clear',
    weatherIntensity: 'Mild',
    nextWeekForecastState: 'Clear',
    nextWeekForecastIntensity: 'Mild',
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
