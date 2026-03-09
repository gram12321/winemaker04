import type { ComponentType, ReactNode } from 'react';
import type { BaseConstraintInfo } from '@/lib/types/constraintTypes';

export interface BoardShareTickContext {
  week: number;
  season: string;
  year: number;
}

export interface BoardShareTickHooks {
  onWeekAdvanced(context: BoardShareTickContext): Promise<void>;
  onSeasonStart(context: BoardShareTickContext): Promise<void>;
  onYearStart(context: BoardShareTickContext): Promise<void>;
}

export interface VineyardPurchaseConstraintInput {
  currentMoney: number;
  purchaseAmount: number;
  totalAssets: number;
  fixedAssets: number;
  currentAssets: number;
  expensesPerSeason: number;
  profitMargin: number;
}

export interface VineyardPurchaseConstraintResult {
  allowed: boolean;
  errorMessage?: string;
}

export interface StaffHiringConstraintInput {
  candidateName: string;
}

export interface StaffHiringConstraintResult {
  allowed: boolean;
  errorMessage?: string;
}

export interface VineyardPurchaseConstraintInfo extends BaseConstraintInfo {
  maxAmount: number;
  hardLimit: number;
  boardLimit: number | null;
  currentBalance: number;
}

export interface BoardShareConstraintHooks {
  checkVineyardPurchase(input: VineyardPurchaseConstraintInput): Promise<VineyardPurchaseConstraintResult>;
  checkStaffHiring(input: StaffHiringConstraintInput): Promise<StaffHiringConstraintResult>;
  getVineyardPurchaseConstraintInfo(): Promise<VineyardPurchaseConstraintInfo>;
}

export interface CompanyCreationOwnershipInput {
  fixedPlayerInvestment: number;
  outsideInvestment: number;
}

export interface CompanyCreationOwnershipOutput {
  totalShares: number;
  outstandingShares: number;
  playerShares: number;
  initialOwnershipPct: number;
}

export interface StartingOwnershipInput {
  playerCashContribution: number;
  familyContribution: number;
  outsideInvestment: number;
}

export interface StartingOwnershipOutput {
  totalContributions: number;
  playerOwnershipPct: number;
  totalShares: number;
  outstandingShares: number;
  playerShares: number;
  familyShares: number;
  outsideShares: number;
}

export interface BoardShareStartingHooks {
  getCompanyCreationOwnership(input: CompanyCreationOwnershipInput): CompanyCreationOwnershipOutput;
  getStartingOwnership(input: StartingOwnershipInput): StartingOwnershipOutput;
}

export interface FinanceTabRegistration {
  id: string;
  label: string;
  render: () => ReactNode;
  activeLabel: string;
}

export interface WinepediaTabRegistration {
  id: string;
  label: string;
  component: ComponentType;
}

export interface BoardShareUiHooks {
  getFinanceTabs(): FinanceTabRegistration[];
  getWinepediaTabs(): WinepediaTabRegistration[];
  registerAppEventListeners?(handlers: {
    navigateToWinepedia: () => void;
  }): () => void;
}

export interface BoardShareFeature {
  ticks: BoardShareTickHooks;
  constraints: BoardShareConstraintHooks;
  starting: BoardShareStartingHooks;
  ui: BoardShareUiHooks;
}

export type BoardShareRuntimeFeature = Pick<BoardShareFeature, 'ticks' | 'constraints' | 'starting'>;
