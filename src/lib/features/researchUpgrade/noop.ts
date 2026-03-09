import type { ResearchUpgradeFeature } from './featureTypes';

export const noResearchUpgradeFeature: ResearchUpgradeFeature = {
  ui: {
    getFinanceTabs: () => []
  },

  workflow: {
    async startResearch() {
      return null;
    },

    async completeResearch() {}
  },

  unlocks: {
    async isUnlocked() {
      return false;
    },

    async getUnlockedItems() {
      return [];
    },

    getRequiredResearch() {
      return null;
    },

    getLockedMessage(_type, value) {
      return `${String(value)} is locked.`;
    }
  },

  setup: {
    async grantResearchUnlock() {},
    async grantStartingGrapeUnlock() {}
  },

  admin: {
    async grantAllResearch() {
      return {
        success: true,
        unlocked: 0,
        alreadyUnlocked: 0
      };
    },

    async removeAllResearch() {
      return {
        success: true,
        removed: 0
      };
    }
  }
};
