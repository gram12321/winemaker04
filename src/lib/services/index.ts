// Barrel export for services to reduce import duplication

// Core services
export { authService } from './authService';
export { companyService } from './companyService';
export { highscoreService } from './highscoreService';
export { userSettingsService } from './userSettingsService';

// Game state exports
export { getGameState, updateGameState, getCurrentCompany, getCurrentPrestige, createNewCompany, clearPrestigeCache } from './gameState';

// Finance exports
export { addTransaction, loadTransactions, calculateFinancialData } from './financeService';

// Sales exports
export { fulfillWineOrder, rejectWineOrder, getPendingOrders } from './salesService';
export { generateSophisticatedWineOrders } from './sales/salesOrderService';
export { initializeCustomers, getAllCustomers, getCountryCode } from './sales/createCustomer';
export { generateCustomer } from './sales/generateCustomer';
export { generateOrder } from './sales/generateOrder';

// Game tick exports
export { processGameTick } from './gameTick';

// Vineyard exports
export { createVineyard, plantVineyard, harvestVineyard, growVineyard, resetVineyard, getAllVineyards, GRAPE_VARIETIES } from './vineyardService';

// Wine batch exports
export { getAllWineBatches, formatCompletedWineName } from './wineBatchService';

// Winery exports
export { crushGrapes, startFermentation, stopFermentation, bottleWine, progressFermentation, isActionAvailable, getBatchStatus } from './wineryService';

// Type exports
export type { AuthUser } from './authService';
export type { Company, CompanyStats } from './companyService';
export type { HighscoreEntry, ScoreType } from './highscoreService';
