import type { GameDate } from '../shared/coreTypes';

export interface Transaction {
  id: string;
  date: GameDate;
  amount: number;
  description: string;
  category: string;
  recurring: boolean;
  money: number;
  created_at?: string;
}

export type EconomyPhase = 'Crash' | 'Recession' | 'Stable' | 'Expansion' | 'Boom';

export type LenderType = 'Bank' | 'Investment Fund' | 'Private Lender' | 'QuickLoan';

export interface Lender {
  id: string;
  name: string;
  type: LenderType;
  riskTolerance: number;
  flexibility: number;
  marketPresence: number;
  baseInterestRate: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  minDurationSeasons: number;
  maxDurationSeasons: number;
  originationFee: {
    basePercent: number;
    minFee: number;
    maxFee: number;
    creditRatingModifier: number;
    durationModifier: number;
  };
  blacklisted?: boolean;
}

export type LoanCategory = 'standard' | 'emergency' | 'restructured';

export interface Loan {
  id: string;
  lenderId: string;
  lenderName: string;
  lenderType: LenderType;
  principalAmount: number;
  baseInterestRate: number;
  economyPhaseAtCreation: EconomyPhase;
  effectiveInterestRate: number;
  originationFee: number;
  remainingBalance: number;
  seasonalPayment: number;
  seasonsRemaining: number;
  totalSeasons: number;
  startDate: GameDate;
  nextPaymentDue: GameDate;
  missedPayments: number;
  status: 'active' | 'paid_off' | 'defaulted';
  isForced?: boolean;
  loanCategory?: LoanCategory;
}

export interface LenderSearchOptions {
  numberOfOffers: number;
  lenderTypes: LenderType[];
  loanAmountRange: [number, number];
  durationRange: [number, number];
  searchCost: number;
  searchWork: number;
}

export interface LoanOffer {
  id: string;
  lender: Lender;
  principalAmount: number;
  durationSeasons: number;
  effectiveInterestRate: number;
  seasonalPayment: number;
  originationFee: number;
  totalInterest: number;
  totalExpenses: number;
  isAvailable: boolean;
  unavailableReason?: string;
}

export interface PendingLoanWarningDecision {
  type: 'forcedLoanRestructure';
  offerId: string;
}

export interface ForcedLoanRestructureStep {
  order: number;
  type: 'cellar' | 'vineyard';
  description: string;
  valueRecovered: number;
  saleProceeds: number;
}

export interface ForcedLoanRestructureOffer {
  id: string;
  createdAt: string;
  forcedLoanIds: string[];
  totalForcedBalance: number;
  maxSeizureValue: number;
  steps: ForcedLoanRestructureStep[];
  estimatedCellarLots: Array<{
    label: string;
    proceeds: number;
    valueRecovered: number;
  }>;
  estimatedVineyards: Array<{
    id: string;
    name: string;
    valueRecovered: number;
    saleProceeds: number;
  }>;
  consolidatedPrincipalEstimate: number;
  lender?: {
    id: string | null;
    name: string;
    type: LenderType;
    effectiveRate: number;
    durationSeasons: number;
    originationFeeEstimate: number;
    isEmergencyOverride: boolean;
  } | null;
  prestigePenalty: number;
  summaryLines: string[];
}

export interface PendingLoanWarning {
  loanId: string;
  lenderName: string;
  missedPayments: number;
  severity: 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  details: string;
  decision?: PendingLoanWarningDecision;
  penalties: {
    lateFee?: number;
    interestRateIncrease?: number;
    balancePenalty?: number;
    creditRatingLoss?: number;
    prestigeLoss?: number;
    bookkeepingWork?: number;
    vineyardsSeized?: number;
    vineyardNames?: string[];
  };
}
