import React from 'react';
import type { AdminFeature, AdminPageProps } from './featureTypes';
import { isDevAdminSurfaceAvailable } from './services/testLab/devAdminGate';
import { AdminDashboard } from './components/AdminDashboard';
import {
  adminClearAllHighscores,
  adminClearCompanyValueHighscores,
  adminClearCompanyValuePerWeekHighscores,
  adminClearAllCompanies,
  adminClearAllUsers,
  adminClearAllCompaniesAndUsers,
  adminRecreateCustomers,
  adminClearAllAchievements,
  adminFullDatabaseReset,
  adminSetGoldToCompany,
  adminSetPlayerBalance,
  adminAddPrestigeToCompany,
  adminSetGameDate,
  adminGrantAllResearch,
  adminRemoveAllResearch,
  adminGenerateTestOrders,
  adminGenerateTestContract,
  adminGenerateTestBottlePresaleContract,
  adminGenerateTestForwardPresaleContract,
  adminSetStaffXP,
  adminAddStaffXP
} from './services/adminService';
import { recreateBuyGrapeMarketOffers } from '@/lib/services';

export const activeAdminFeature: AdminFeature = {
  gate: {
    isAvailable() {
      return isDevAdminSurfaceAvailable();
    }
  },

  database: {
    clearAllHighscores: adminClearAllHighscores,
    clearCompanyValueHighscores: adminClearCompanyValueHighscores,
    clearCompanyValuePerWeekHighscores: adminClearCompanyValuePerWeekHighscores,
    clearAllCompanies: adminClearAllCompanies,
    clearAllUsers: adminClearAllUsers,
    clearAllCompaniesAndUsers: adminClearAllCompaniesAndUsers,
    recreateCustomers: adminRecreateCustomers,
    clearAllAchievements: adminClearAllAchievements,
    fullDatabaseReset: adminFullDatabaseReset
  },

  cheats: {
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
    recreateBuyGrapeMarketOffers: recreateBuyGrapeMarketOffers
  },

  staff: {
    setStaffXP: adminSetStaffXP,
    addStaffXP: adminAddStaffXP
  },

  ui: {
    renderPage(props: AdminPageProps) {
      if (!isDevAdminSurfaceAvailable()) return null;
      return React.createElement(AdminDashboard, props);
    }
  }
};
