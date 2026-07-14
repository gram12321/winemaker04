import { lazy } from 'react';
import type { StartingLoanConfig } from '@/lib/constants/startingConditions';
import type { LoanLenderFeature } from './featureTypes';
import { completeLenderSearch } from './services/activity/activitymanagers/lenderSearchManager';
import { completeTakeLoan } from './services/activity/activitymanagers/takeLoanManager';
import { getAllLenders, initializeLenders } from './services/finance/lenderService';
import {
  applyForLoan,
  calculateTotalOutstandingLoans,
  enforceEmergencyQuickLoanIfNeeded,
  processSeasonalLoanPayments,
  restructureForcedLoansIfNeeded
} from './services/finance/loanService';
import { DEFAULT_ACTIVE_LOAN_PORTFOLIO, loadActiveLoanPortfolio } from './services/finance/loanViewService';

const LoansView = lazy(() => import('./ui/LoansView').then(module => ({ default: module.LoansView })));
const LoanWarningModalDisplay = lazy(() => import('./ui/LoanWarningModalDisplay').then(module => ({ default: module.LoanWarningModalDisplay })));
const LendersTab = lazy(() => import('./ui/LendersTab').then(module => ({ default: module.LendersTab })));
const LenderSearchResultsDisplay = lazy(() => import('./ui/LenderSearchResultsDisplay').then(module => ({ default: module.LenderSearchResultsDisplay })));

async function applyStartingLoan(config: StartingLoanConfig): Promise<string> {
  const lenders = await getAllLenders();
  if (lenders.length === 0) {
    throw new Error('No lenders available for starting loan');
  }

  const lender = lenders.find((entry) => entry.type === config.lenderType && !entry.blacklisted);
  if (!lender) {
    throw new Error(`No ${config.lenderType} lenders available for starting loan`);
  }

  return applyForLoan(
    lender.id,
    config.principal,
    config.durationSeasons,
    lender,
    {
      loanCategory: 'standard',
      skipAdministrationPenalty: config.skipAdministrationPenalty ?? true,
      skipTransactions: true,
      overrideBaseRate: config.interestRate,
      overrideEffectiveRate: config.interestRate,
      skipLimitCheck: true
    }
  );
}

export const loanLenderFeature: LoanLenderFeature = {
  ui: {
    getFinanceTabs() {
      return [
        {
          id: 'loans',
          label: 'Loans',
          activeLabel: 'Loans',
          render: () => <LoansView />
        }
      ];
    },

    getWinepediaTabs() {
      return [
        {
          id: 'lenders',
          label: 'Lenders',
          component: LendersTab
        }
      ];
    },

    getAppOverlays() {
      return [
        {
          id: 'loan-warning',
          render: () => <LoanWarningModalDisplay />
        },
        {
          id: 'lender-search-results',
          render: () => <LenderSearchResultsDisplay />
        }
      ];
    }
  },

  workflow: {
    completeLenderSearch,
    completeTakeLoan
  },

  setup: {
    initializeLenders,
    applyStartingLoan
  },

  metrics: {
    calculateTotalOutstandingLoans,
    loadActivePortfolio: loadActiveLoanPortfolio,
    defaultActivePortfolio: DEFAULT_ACTIVE_LOAN_PORTFOLIO
  },

  ticks: {
    processSeasonalLoanPayments,
    enforceEmergencyQuickLoanIfNeeded,
    restructureForcedLoansIfNeeded
  }
};
