import type { LoanLenderFeature } from './featureTypes';

export const noLoanLenderFeature: LoanLenderFeature = {
  ui: {
    getFinanceTabs: () => [],
    getWinepediaTabs: () => [],
    getAppOverlays: () => []
  },

  workflow: {
    async completeLenderSearch() {},
    async completeTakeLoan() {}
  },

  setup: {
    async initializeLenders() {},
    async applyStartingLoan() {
      return '';
    }
  },

  metrics: {
    async calculateTotalOutstandingLoans() {
      return 0;
    }
  },

  ticks: {
    async processSeasonalLoanPayments() {},
    async enforceEmergencyQuickLoanIfNeeded() {},
    async restructureForcedLoansIfNeeded() {}
  }
};
