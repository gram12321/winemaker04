export { authService } from './user/authService';
export { companyService } from './user/companyService';
export { highscoreService } from './user/highscoreService';
export { userSettingsService } from './user/userSettingsService';
export { 
  createStaff, 
  addStaff, 
  removeStaff, 
  getAllStaff, 
  getStaffById,
  initializeStaffSystem,
  createStartingStaff,
  generateRandomSkills,
  calculateWage,
  getRandomFirstName,
  getRandomLastName,
  getRandomNationality,
  processSeasonalWages,
  getTotalWeeklyWages,
  getTotalSeasonalWages,
  getTotalYearlyWages
} from './user/staffService';

// Staff search services
export {
  calculateSearchCost,
  calculateSearchWork,
  calculateHiringWorkRange,
  generateStaffCandidates,
  startStaffSearch,
  completeStaffSearch,
  startHiringProcess,
  completeHiringProcess,
  clearPendingCandidates
} from './user/staffSearchService';

export type {
  StaffSearchOptions,
  SearchWorkEstimate,
  HiringWorkEstimate
} from './user/staffSearchService';

// Team management services
export {
  getDefaultTeams,
  getTeamForCategory,
  createTeam,
  addTeam,
  removeTeam,
  updateTeam,
  getAllTeams,
  assignStaffToTeam,
  initializeTeamsSystem,
  resetTeamsToDefault
} from './user/teamService';
export { getGameState, updateGameState, getCurrentCompany, getCurrentPrestige, createNewCompany, clearPrestigeCache } from './core/gameState';
export { addTransaction, loadTransactions, calculateFinancialData } from './user/financeService';
export { fulfillWineOrder, rejectWineOrder, getPendingOrders } from './sales/salesService';
export { generateSophisticatedWineOrders } from './sales/salesOrderService';
export { initializeCustomers, getAllCustomers, getCountryCode } from './sales/createCustomer';

// Re-export utility functions from constants
export { getTaskTypeDisplayName, getWorkCategoryDisplayName, isDensityBased } from '@/lib/constants/activityConstants';
export { getStaffRoleDisplayName } from '@/lib/constants/staffConstants';
export { generateCustomer } from './sales/generateCustomer';
export { generateOrder } from './sales/generateOrder';
export { processGameTick } from './core/gameTick';
export { createVineyard, plantVineyard, getAllVineyards, purchaseVineyard } from './vineyard/vineyardService';
export { calculateVineyardYield, updateVineyardRipeness, updateVineyardAges } from './vineyard/vineyardManager';
export { GRAPE_VARIETIES } from '../types/types';
export { calculateLandValue, normalizeAltitude, normalizePrestige, normalizeAspect, getAspectRating, getAltitudeRating, getRegionalPriceRange } from './vineyard/vineyardValueCalc';
export { getVineyardPrestigeBreakdown, calculateVineyardPrestigeFromEvents } from './prestige/prestigeService';
export { getAllWineBatches, formatCompletedWineName, createWineBatchFromHarvest } from './wine/inventoryService';
export { startFermentationActivity, bottleWine, isFermentationActionAvailable, processWeeklyFermentation } from './wine/winery/fermentationManager';
export { isActionAvailable } from './wine/winery/wineryService';
export { getBatchStatus } from './wine/winery/wineryService';
export { startCrushingActivity, validateCrushingActivity } from './wine/winery/crushingManager';
export { recordBottledWine, loadWineLog, getVineyardWineHistory, calculateVineyardStats } from './user/wineLogService';
export type { VineyardStats } from './user/wineLogService';
export type { AuthUser } from './user/authService';
export type { Company, CompanyStats } from './user/companyService';
export type { HighscoreEntry, ScoreType } from './user/highscoreService';
export type { VineyardPurchaseOption } from './vineyard/vinyardBuyingService';
export * from './activity';
export { initializeActivitySystem, createActivity, getAllActivities, getActivityById, cancelActivity, progressActivities, getActivityProgress } from './activity/activitymanagers/activityManager';
