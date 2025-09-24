export { authService } from './user/authService';
export { companyService } from './user/companyService';
export { highscoreService } from './user/highscoreService';
export { userSettingsService } from './user/userSettingsService';
export { getGameState, updateGameState, getCurrentCompany, getCurrentPrestige, createNewCompany, clearPrestigeCache } from './gameState';
export { addTransaction, loadTransactions, calculateFinancialData } from './user/financeService';
export { fulfillWineOrder, rejectWineOrder, getPendingOrders } from './sales/salesService';
export { generateSophisticatedWineOrders } from './sales/salesOrderService';
export { initializeCustomers, getAllCustomers, getCountryCode } from './sales/createCustomer';
export { generateCustomer } from './sales/generateCustomer';
export { generateOrder } from './sales/generateOrder';
export { processGameTick } from './gameTick';
export { createVineyard, plantVineyard, harvestVineyard, getAllVineyards, purchaseVineyard } from './wine/vineyardService';
export { calculateVineyardYield, updateVineyardRipeness, updateVineyardAges } from './wine/vineyardManager';
export { GRAPE_VARIETIES } from '../types/types';
export { calculateLandValue, normalizeAltitude, normalizePrestige, normalizeAspect, getAspectRating, getAltitudeRating } from './wine/vineyardValueCalc';
export { getVineyardPrestigeBreakdown, calculateVineyardPrestigeFromEvents } from '../database/prestige';
export { getAllWineBatches, formatCompletedWineName } from './wine/wineBatchService';
export { crushGrapes, startFermentation, stopFermentation, bottleWine, progressFermentation, isActionAvailable, getBatchStatus } from './wine/wineryService';
export { recordBottledWine, loadWineLog, getVineyardWineHistory, calculateVineyardStats } from './wine/wineLogService';
export type { VineyardStats } from './wine/wineLogService';
export type { AuthUser } from './user/authService';
export type { Company, CompanyStats } from './user/companyService';
export type { HighscoreEntry, ScoreType } from './user/highscoreService';
export type { VineyardPurchaseOption } from './wine/landBuyingService';

// Work services
export * from './work';

// Activity services
export { initializeActivitySystem, createActivity, getAllActivities, getActivityById, cancelActivity, progressActivities, getActivityProgress } from './activityManager';
