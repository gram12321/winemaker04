import React from 'react';
import { ResearchAdminInspector } from '@/lib/features/researchUpgrade/components/ResearchAdminInspector';
import { recreateBuyGrapeMarketOffers } from '@/lib/services';
import { authService } from '@/lib/services/user/authService';
import { getAllStaff } from '@/lib/services/user/staffService';
import { getAllActivities, completeActivityNow } from '@/lib/services/activity/activitymanagers/activityManager';
import { loadVineyards } from '@/lib/database/activities/vineyardDB';
import type { AdminFeature, AdminPageProps } from './featureTypes';
import type { AdminCheatOps, AdminDashboardDependencies, AdminDatabaseOps, AdminStaffOps, AdminTestLab } from './internalTypes';
import { AdminDashboard } from './components/AdminDashboard';
import {
  adminAddPrestigeToCompany,
  adminClearAllAchievements,
  adminClearAllCompanies,
  adminClearAllCompaniesAndUsers,
  adminClearAllHighscores,
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
  adminSetStaffXP,
  adminAddStaffXP
} from './services/adminService';
import { isDevAdminSurfaceAvailable } from './services/testLab/devAdminGate';
import { cleanupTestLabRun } from './services/testLab/testLabCleanupService';
import {
  createBottledWine,
  createFermentingBatch,
  createGrapeBatch,
  createHarvestReadyVineyard,
  createMustReadyBatch,
  createTestLabCompany
} from './services/testLab/testLabFixtureService';
import { createTestLabRunner } from './services/testLab/testLabRunner';
import { getTestLabScenarios } from './services/testLab/testLabScenarios';

const database: AdminDatabaseOps = {
  clearAllHighscores: adminClearAllHighscores,
  clearCompanyValueHighscores: adminClearCompanyValueHighscores,
  clearCompanyValuePerWeekHighscores: adminClearCompanyValuePerWeekHighscores,
  clearAllCompanies: adminClearAllCompanies,
  clearAllUsers: adminClearAllUsers,
  clearAllCompaniesAndUsers: adminClearAllCompaniesAndUsers,
  recreateCustomers: adminRecreateCustomers,
  clearAllAchievements: adminClearAllAchievements,
  fullDatabaseReset: adminFullDatabaseReset
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
  recreateBuyGrapeMarketOffers
};

const staff: AdminStaffOps = {
  setStaffXP: adminSetStaffXP,
  addStaffXP: adminAddStaffXP
};

const testLabOperations = { ...cheats, setStaffXP: staff.setStaffXP };
const testLab: AdminTestLab = {
  getScenarios: getTestLabScenarios,
  async loadDynamicOptions() {
    const [vineyards, staffMembers, activities] = await Promise.all([
      loadVineyards().catch(() => []),
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
    getCurrentUserId: () => authService.getCurrentUser()?.id ?? null
  })
};

const dashboard: AdminDashboardDependencies = {
  database,
  cheats,
  staff,
  testLab,
  renderResearchInspector: () => React.createElement(ResearchAdminInspector)
};

export const activeAdminFeature: AdminFeature = {
  isAvailable() {
    return isDevAdminSurfaceAvailable();
  },
  renderPage(props: AdminPageProps) {
    if (!isDevAdminSurfaceAvailable()) return null;
    return React.createElement(AdminDashboard, { ...props, ...dashboard });
  }
};
