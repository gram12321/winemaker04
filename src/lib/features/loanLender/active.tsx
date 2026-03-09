import { useEffect, useState } from 'react';
import { useGameState } from '@/hooks';
import { isModalMinimized } from '@/lib/utils';
import type { StartingLoanConfig } from '@/lib/constants/startingConditions';
import type { LoanLenderFeature } from './featureTypes';
import { LoansView } from './ui/LoansView';
import { LoanWarningModalDisplay } from './ui/LoanWarningModalDisplay';
import { LendersTab } from './ui/LendersTab';
import { LenderSearchResultsModal } from './ui/LenderSearchResultsModal';
import { completeLenderSearch, clearPendingLenderSearchResults } from './services/activity/activitymanagers/lenderSearchManager';
import { completeTakeLoan } from './services/activity/activitymanagers/takeLoanManager';
import { getAllLenders, initializeLenders } from './services/finance/lenderService';
import {
  applyForLoan,
  calculateTotalOutstandingLoans,
  enforceEmergencyQuickLoanIfNeeded,
  processSeasonalLoanPayments,
  restructureForcedLoansIfNeeded
} from './services/finance/loanService';

function LenderSearchResultsDisplay() {
  const gameState = useGameState();
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (gameState.pendingLenderSearchResults?.offers?.length) {
      setShowResults(true);
      return;
    }

    setShowResults(false);
  }, [gameState.pendingLenderSearchResults]);

  const handleClose = () => {
    setShowResults(false);
    clearPendingLenderSearchResults();
  };

  if (!gameState.pendingLenderSearchResults?.offers?.length) {
    return null;
  }

  return (
    <LenderSearchResultsModal
      isOpen={showResults && !isModalMinimized('lender')}
      onClose={handleClose}
      offers={gameState.pendingLenderSearchResults.offers}
    />
  );
}

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

export const activeLoanLenderFeature: LoanLenderFeature = {
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
    calculateTotalOutstandingLoans
  },

  ticks: {
    processSeasonalLoanPayments,
    enforceEmergencyQuickLoanIfNeeded,
    restructureForcedLoansIfNeeded
  }
};
