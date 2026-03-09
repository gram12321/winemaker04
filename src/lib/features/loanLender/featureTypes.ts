import type { ComponentType, ReactNode } from 'react';
import type { StartingLoanConfig } from '@/lib/constants/startingConditions';
import type { Activity } from '@/lib/types/types';

export interface LoanLenderFinanceTabRegistration {
  id: string;
  label: string;
  render: () => ReactNode;
  activeLabel: string;
}

export interface LoanLenderWinepediaTabRegistration {
  id: string;
  label: string;
  component: ComponentType;
}

export interface LoanLenderOverlayRegistration {
  id: string;
  render: () => ReactNode;
}

export interface LoanLenderUiHooks {
  getFinanceTabs(): LoanLenderFinanceTabRegistration[];
  getWinepediaTabs(): LoanLenderWinepediaTabRegistration[];
  getAppOverlays(): LoanLenderOverlayRegistration[];
}

export interface LoanLenderWorkflowHooks {
  completeLenderSearch(activity: Activity): Promise<void>;
  completeTakeLoan(activity: Activity): Promise<void>;
}

export interface LoanLenderSetupHooks {
  initializeLenders(companyId?: string): Promise<void>;
  applyStartingLoan(config: StartingLoanConfig): Promise<string>;
}

export interface LoanLenderMetricsHooks {
  calculateTotalOutstandingLoans(): Promise<number>;
}

export interface LoanLenderTickHooks {
  processSeasonalLoanPayments(): Promise<void>;
  enforceEmergencyQuickLoanIfNeeded(): Promise<void>;
  restructureForcedLoansIfNeeded(): Promise<void>;
}

export interface LoanLenderFeature {
  ui: LoanLenderUiHooks;
  workflow: LoanLenderWorkflowHooks;
  setup: LoanLenderSetupHooks;
  metrics: LoanLenderMetricsHooks;
  ticks: LoanLenderTickHooks;
}
