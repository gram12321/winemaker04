import { acknowledgeLoanWarning, getFirstUnacknowledgedLoanWarning, loadActiveLoans } from '@/lib/database/core/loansDB';
import { getGameState } from '@/lib/services/core/gameState';
import type { Lender, Loan, PendingLoanWarning } from '@/lib/types/types';
import { calculateCreditRating, type CreditRatingBreakdown } from './creditRatingService';
import { calculateLenderAvailability, getAllLenders, getAvailableLenders } from './lenderService';

export interface LoanAvailabilityBreakdownRow extends Lender {
  availability: ReturnType<typeof calculateLenderAvailability>;
}

export interface LoansDashboardData {
  loans: Loan[];
  creditRatingBreakdown: CreditRatingBreakdown | null;
  comprehensiveCreditRating: number;
  availableLenders: Lender[];
  lenderAvailabilityBreakdown: LoanAvailabilityBreakdownRow[];
}

export interface ActiveLoanPortfolio {
  loans: Loan[];
  totalOutstandingLoans: number;
}

export const DEFAULT_LOANS_DASHBOARD_DATA: LoansDashboardData = {
  loans: [],
  creditRatingBreakdown: null,
  comprehensiveCreditRating: 0.5,
  availableLenders: [],
  lenderAvailabilityBreakdown: [],
};

export const DEFAULT_ACTIVE_LOAN_PORTFOLIO: ActiveLoanPortfolio = {
  loans: [],
  totalOutstandingLoans: 0,
};

function buildLenderAvailabilityBreakdown(
  lenders: Lender[],
  creditRatingPercent: number,
  companyPrestige: number
): LoanAvailabilityBreakdownRow[] {
  return lenders.map((lender) => ({
    ...lender,
    availability: calculateLenderAvailability(lender, creditRatingPercent, companyPrestige),
  }));
}

export async function loadActiveLoanPortfolio(): Promise<ActiveLoanPortfolio> {
  try {
    const loans = await loadActiveLoans();
    return {
      loans,
      totalOutstandingLoans: loans.reduce((sum, loan) => sum + loan.remainingBalance, 0),
    };
  } catch (error) {
    console.error('Error loading active loan portfolio:', error);
    return DEFAULT_ACTIVE_LOAN_PORTFOLIO;
  }
}

export async function loadLoansDashboardData(): Promise<LoansDashboardData> {
  const gameState = getGameState();

  try {
    const creditRatingBreakdown = await calculateCreditRating();
    const loans = await loadActiveLoans();
    const comprehensiveCreditRating = creditRatingBreakdown.finalRating;
    const companyPrestige = gameState.prestige || 0;
    const allLenders = await getAllLenders();
    const availableLenders = await getAvailableLenders(comprehensiveCreditRating * 100, companyPrestige);

    return {
      loans,
      creditRatingBreakdown,
      comprehensiveCreditRating,
      availableLenders,
      lenderAvailabilityBreakdown: buildLenderAvailabilityBreakdown(
        allLenders,
        comprehensiveCreditRating * 100,
        companyPrestige
      ),
    };
  } catch (error) {
    console.error('Error loading loans dashboard data:', error);

    const loans = await loadActiveLoans().catch(() => []);
    const comprehensiveCreditRating = gameState.creditRating || 0.5;
    const companyPrestige = gameState.prestige || 0;
    const allLenders = await getAllLenders();
    const availableLenders = await getAvailableLenders(comprehensiveCreditRating * 100, companyPrestige);

    return {
      loans,
      creditRatingBreakdown: null,
      comprehensiveCreditRating,
      availableLenders,
      lenderAvailabilityBreakdown: buildLenderAvailabilityBreakdown(
        allLenders,
        comprehensiveCreditRating * 100,
        companyPrestige
      ),
    };
  }
}

export async function loadNextLoanWarning(): Promise<PendingLoanWarning | null> {
  try {
    return await getFirstUnacknowledgedLoanWarning();
  } catch (error) {
    console.error('Error loading pending loan warning:', error);
    return null;
  }
}

export async function acknowledgePendingLoanWarning(loanId: string): Promise<void> {
  await acknowledgeLoanWarning(loanId);
}
