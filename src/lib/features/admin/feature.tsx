import React from 'react';
import {
  completeActivityNow,
  getAllActivities,
  getAllStaff,
  getStoredVineyards,
  recreateBuyGrapeMarketOffers,
  recreateStorageVesselMarketOffers
} from '@/lib/services';
import { userFeature } from '@/lib/features/user';
import { researchUpgradeAdminIntegration } from '@/lib/features/researchUpgrade/adminIntegration';
import type { AdminFeature } from './featureTypes';
import type { AdminCheatOps, AdminDashboardDependencies, AdminDatabaseOps, AdminTestLab } from './internalTypes';
import { AdminDashboard } from './components/AdminDashboard';
import {
  adminAddPrestigeToCompany,
  adminClearAllAchievements,
  adminClearAllCompanies,
  adminClearAllCompaniesAndUsers,
  adminClearAllHighscores,
  adminClearGlobalMarket,
  adminClearGlobalMarketGoods,
  adminClearAllUsers,
  adminClearCompanyValueHighscores,
  adminClearCompanyValuePerWeekHighscores,
  adminFullDatabaseReset,
  adminGenerateTestBottlePresaleContract,
  adminGenerateTestContract,
  adminGenerateTestForwardPresaleContract,
  adminGenerateTestOrders,
  adminGrantAllResearch,
  adminRecreateCustomers,
  adminRemoveAllResearch,
  adminSetGameDate,
  adminSetGoldToCompany,
  adminSetPlayerBalance,
  adminSetStaffXP
} from './services/adminService';
import { isDevSurfaceAvailable } from '@/lib/utils';
import { cleanupTestLabRun } from './services/testLab/testLabCleanupService';
import {
  createBottledWine,
  createFermentingBatch,
  createGrapeBatch,
  createHarvestReadyVineyard,
  createMustReadyBatch,
  createTestLabCompany
} from './services/testLab/testLabFixtureService';
import { createTestLabRunner, type AutomatedTestRunResult } from './services/testLab/testLabRunner';
import { getTestLabScenarios } from './services/testLab/testLabScenarios';

const runAutomatedTests = async (target?: string): Promise<AutomatedTestRunResult> => {
  const response = await fetch('/api/test-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target ? { target } : {})
  });
  const data = await response.json() as Omit<AutomatedTestRunResult, 'ok'>;
  return { ...data, ok: response.ok };
};

const database: AdminDatabaseOps = {
  clearAllHighscores: adminClearAllHighscores,
  clearCompanyValueHighscores: adminClearCompanyValueHighscores,
  clearCompanyValuePerWeekHighscores: adminClearCompanyValuePerWeekHighscores,
  clearAllCompanies: adminClearAllCompanies,
  clearAllUsers: adminClearAllUsers,
  clearAllCompaniesAndUsers: adminClearAllCompaniesAndUsers,
  recreateCustomers: adminRecreateCustomers,
  clearAllAchievements: adminClearAllAchievements,
  fullDatabaseReset: adminFullDatabaseReset,
  clearGlobalMarket: adminClearGlobalMarket,
  clearGlobalMarketGoods: adminClearGlobalMarketGoods,
};

const cheats: AdminCheatOps = {
  setGoldToCompany: adminSetGoldToCompany,
  setPlayerBalance: adminSetPlayerBalance,
  addPrestigeToCompany: adminAddPrestigeToCompany,
  setGameDate: adminSetGameDate,
  grantAllResearch: adminGrantAllResearch,
  removeAllResearch: adminRemoveAllResearch,
  generateTestOrders: adminGenerateTestOrders,
  generateTestContract: adminGenerateTestContract,
  generateTestBottlePresaleContract: adminGenerateTestBottlePresaleContract,
  generateTestForwardPresaleContract: adminGenerateTestForwardPresaleContract,
  recreateBuyGrapeMarketOffers,
  recreateStorageVesselMarketOffers
};

const testLabOperations = { ...cheats, setStaffXP: adminSetStaffXP };
const testLab: AdminTestLab = {
  getScenarios: getTestLabScenarios,
  async loadDynamicOptions() {
    const [vineyards, staffMembers, activities] = await Promise.all([
      getStoredVineyards().catch(() => []),
      getAllStaff().catch(() => []),
      getAllActivities().catch(() => [])
    ]);
    return { vineyards, staff: staffMembers, activities };
  },
  runScenario: createTestLabRunner({
    operations: testLabOperations,
    cleanupTestLabRun,
    createTestLabCompany,
    createHarvestReadyVineyard,
    createGrapeBatch,
    createMustReadyBatch,
    createFermentingBatch,
    createBottledWine,
    completeActivityNow,
    getCurrentUserId: async () => (await userFeature.account.getCurrentPlayer())?.id ?? null,
    runAutomatedTests
  })
};

const dashboard: AdminDashboardDependencies = {
  database,
  cheats,
  testLab,
  renderResearchInspector: () => researchUpgradeAdminIntegration.renderInspector()
};

export const adminFeature: AdminFeature = {
  isAvailable: isDevSurfaceAvailable,
  renderPage(props) {
    if (!isDevSurfaceAvailable()) return null;
    return React.createElement(AdminDashboard, { ...props, ...dashboard });
  }
};
