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
  getRandomFirstName,
  getRandomLastName,
  getRandomNationality
} from './user/staffService';

// Wage services
export {
  calculateWage,
  getMaxWage,
  normalizeWage,
  getWageColorClass,
  getWageBadgeColorClasses,
  calculateTotalWeeklyWages,
  calculateTotalSeasonalWages,
  calculateTotalYearlyWages,
  formatWageWithColor,
  getWageStatistics,
  processSeasonalWages
} from './user/wageService';

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

// Land search services
export {
  calculateSearchCost as calculateLandSearchCost,
  calculateSearchWork as calculateLandSearchWork,
  generateVineyardSearchResults,
  startLandSearch,
  completeLandSearch,
  clearPendingLandSearchResults
} from './vineyard/landSearchService';

export type {
  LandSearchOptions,
  LandSearchEstimate
} from './vineyard/landSearchService';

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
  removeStaffFromTeam,
  initializeTeamsSystem,
  resetTeamsToDefault
} from './user/teamService';

// Achievement services
export {
  checkAndUnlockAchievement,
  checkAllAchievements,
  getAllAchievementsWithStatus,
  getAchievementStats
} from './user/achievementService';
export { getGameState, updateGameState, getCurrentCompany, getCurrentPrestige, createNewCompany, clearPrestigeCache } from './core/gameState';
export { addTransaction, loadTransactions, calculateFinancialData } from './user/financeService';
export { fulfillWineOrder, rejectWineOrder, getPendingOrders } from './sales/salesService';
export { generateSophisticatedWineOrders } from './sales/salesOrderService';
export { initializeCustomers, getAllCustomers } from './sales/createCustomer';

// Re-export utility functions from constants
export { getTaskTypeDisplayName, getWorkCategoryDisplayName, isDensityBased } from '@/lib/constants/activityConstants';
export { getStaffRoleDisplayName } from '@/lib/constants/staffConstants';
export { generateCustomer } from './sales/generateCustomer';
export { generateOrder } from './sales/generateOrder';
export { processGameTick } from './core/gameTick';
export { createVineyard, plantVineyard, initializePlanting, completePlanting, getAllVineyards, purchaseVineyard } from './vineyard/vineyardService';
export { calculateVineyardYield, updateVineyardRipeness, updateVineyardAges } from './vineyard/vineyardManager';
export { GRAPE_VARIETIES } from '../types/types';
export { calculateLandValue, normalizeAltitude, normalizePrestige, normalizeAspect, getAspectRating, getAltitudeRating, getRegionalPriceRange } from './vineyard/vineyardValueCalc';
export { getVineyardPrestigeBreakdown, calculateVineyardPrestigeFromEvents } from './prestige/prestigeService';
export { getAllWineBatches, formatCompletedWineName, createWineBatchFromHarvest } from './wine/winery/inventoryService';
export { startFermentationActivity, bottleWine, isFermentationActionAvailable, processWeeklyFermentation } from './wine/winery/fermentationManager';
export { getQualityBreakdown } from './wine/winescore/wineQualityCalculationService';
export type { QualityBreakdown } from './wine/winescore/wineQualityCalculationService';
export { isActionAvailable } from './wine/winery/wineryService';
export { getBatchStatus } from './wine/winery/wineryService';
export { startCrushingActivity, validateCrushingActivity } from './wine/winery/crushingManager';
export { calculateEffectiveQuality, calculateFeaturePriceMultiplier, getPresentFeaturesSorted, hasAnyFaults, getFeature, hasFeature } from './wine/features/featureEffectsService';
export { initializeBatchFeatures, processWeeklyFeatureRisks, processEventTrigger } from './wine/features/featureRiskService';
export * from './wine/features/featureDisplayService';
export * from './wine/features/agingService';
export { recordBottledWine, getVineyardWineHistory, calculateVineyardStats } from './user/wineLogService';
export type { VineyardStats } from './user/wineLogService';
export type { VineyardPurchaseOption } from './vineyard/landSearchService';
export * from './activity';
export { initializeActivitySystem, createActivity, getAllActivities, getActivityById, cancelActivity, progressActivities, getActivityProgress } from './activity/activitymanagers/activityManager';
