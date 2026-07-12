import type { AdminFeature } from './featureTypes';

export const noAdminFeature: AdminFeature = {
  gate: {
    isAvailable() {
      return false;
    }
  },

  database: {
    async clearAllHighscores() {
      return { success: false };
    },
    async clearCompanyValueHighscores() {
      return { success: false };
    },
    async clearCompanyValuePerWeekHighscores() {
      return { success: false };
    },
    async clearAllCompanies() {},
    async clearAllUsers() {},
    async clearAllCompaniesAndUsers() {},
    async recreateCustomers() {},
    async clearAllAchievements() {},
    async fullDatabaseReset() {}
  },

  cheats: {
    async setGoldToCompany() {},
    async setPlayerBalance() {
      return { success: false };
    },
    async addPrestigeToCompany() {},
    async setGameDate() {},
    async grantAllResearch() {
      return { success: true, unlocked: 0, alreadyUnlocked: 0 };
    },
    async removeAllResearch() {
      return { success: true, removed: 0 };
    },
    async generateTestOrders() {
      return { totalOrdersCreated: 0, customersGenerated: 0 };
    },
    async generateTestContract() {
      return { success: false, message: 'Admin unavailable' };
    },
    async generateTestBottlePresaleContract() {
      return { success: false, message: 'Admin unavailable' };
    },
    async generateTestForwardPresaleContract() {
      return { success: false, message: 'Admin unavailable' };
    },
    async recreateBuyGrapeMarketOffers() {}
  },

  staff: {
    async setStaffXP() {
      return { success: false, error: 'Admin unavailable' };
    },
    async addStaffXP() {
      return { success: false, error: 'Admin unavailable' };
    }
  },

  ui: {
    renderPage() {
      return null;
    }
  }
};
