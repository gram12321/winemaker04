// Core services
export * from './core/gameState';
export * from './core/notificationService';
export * from './core/gameTick';
export * from './core/startingConditionsService';

// User services
export * from './user/authService';
export * from './user/companyService';
export * from './user/highscoreService';
export * from './user/userSettingsService';
export * from './user/staffService';
export * from './user/teamService';
export * from './user/achievementService';
export * from './user/wineLogService';

// Finance services
export * from './finance/creditRatingService';
export * from './finance/economyService';
export * from './finance/financeService';
export * from './finance/lenderService';
export * from './finance/loanService';
export * from './finance/wageService';
// Share services - explicit exports to avoid naming conflicts
export {
  adjustSharePriceIncrementally,
  initializeSharePriceDeterministically,
  applyImmediateShareStructureAdjustment,
  getCurrentSharePrice,
  calculateSharePrice,
  getSharePriceBreakdown,
  calculateMarketCap,
  updateMarketValue,
  getMarketValue
} from './finance/shares/sharePriceService';

export {
  getShareMetrics,
  getShareholderBreakdown,
  getHistoricalShareMetrics
} from './finance/shares/shareMetricsService';

export {
  issueStock,
  buyBackStock,
  updateDividendRate,
  payDividends,
  calculateDividendPayment,
  areDividendsDue
} from './finance/shares/shareOperationsService';

export {
  calculateMarketCap as calcMarketCap,
  calculateExpectedImprovementRates,
  getImprovementMultipliers,
  calculateFixedAssetRatio,
  calculateTrendDelta,
  calculateImprovementMultiplier,
  calculateMarketCapRequirement
} from './finance/shares/shareCalculations';

export {
  calculateGracePeriods,
  calculateProfitabilityImprovements,
  calculateTrendBasedImprovements,
  calculateMetricDeltas
} from './finance/shares/sharePriceAdjustmentHelpers';

export {
  getCurrentMetricValues,
  getPreviousMetricValues48WeeksAgo,
  getCurrent48WeekValues,
  calculateAnchorFactorDetails,
  formatMultiplierBreakdownForDisplay
} from './finance/shares/sharePriceBreakdownHelpers';

// Admin services
export * from './admin/adminService';

// Vineyard services
export * from './vineyard/vineyardService';
export * from './vineyard/vineyardManager';
export * from './vineyard/clearingManager';
export * from './vineyard/vineyardValueCalc';

// Land search services
export * from './vineyard/landSearchService';

// Wine services
export * from './wine/winery/inventoryService';
export * from './wine/winery/fermentationManager';
export * from './wine/winery/wineryService';
export * from './wine/winery/crushingManager';
export * from './wine/winescore/grapeQualityCalculation';
export * from './wine/winescore/wineScoreCalculation';
export * from './wine/features/featureService';
export * from './wine/features/agingService';
export * from './wine/features/grapeDifficulty';

// Sales services
export * from './sales/salesService';
export * from './sales/salesOrderService';
export * from './sales/createCustomer';
export * from './sales/generateCustomer';
export * from './sales/generateOrder';
export * from './sales/relationshipService';
export * from './sales/contractGenerationService';
export * from './sales/contractService';
export * from './sales/expirationService';

// Prestige services
export * from './prestige/prestigeService';

// Activity system
export * from './activity';

// Constants
export * from '@/lib/constants';
