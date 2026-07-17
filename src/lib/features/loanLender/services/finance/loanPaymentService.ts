import type { Loan } from '@/lib/types/types';
import { NotificationCategory } from '@/lib/types/types';
import { LOAN_EXTRA_PAYMENT, ADMINISTRATION_LOAN_PENALTIES } from '@/lib/constants/loanConstants';
import { TRANSACTION_CATEGORIES } from '@/lib/constants';
import { getGameState, updateGameState } from '@/lib/services/core/gameState';
import { addTransaction } from '@/lib/services/finance/financeService';
import { loadActiveLoans, updateLoan, clearLoanWarning } from '@/lib/database/core/loansDB';
import { notificationService } from '@/lib/services/core/notificationService';
import { triggerGameUpdate } from '@/hooks/useGameUpdates';
import { getCurrentCreditRating } from './loanService';
import { estimatePrepaymentPenalty } from './loanCalculations';
import { formatNumber } from '@/lib/utils';

async function addLoanAdministrationBurden(units: number): Promise<void> {
  if (units <= 0) return;
  const gameState = getGameState();
  await updateGameState({
    ...gameState,
    loanPenaltyWork: (gameState.loanPenaltyWork || 0) + units,
  });
}

export async function calculateTotalOutstandingLoans(companyId?: string): Promise<number> {
  const activeLoans = await loadActiveLoans(companyId);
  return activeLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
}

export async function repayLoanInFull(loanId: string): Promise<void> {
  const activeLoans = await loadActiveLoans();
  const loan = activeLoans.find((entry) => entry.id === loanId);
  if (!loan) throw new Error('Loan not found');

  const availableMoney = getGameState().money || 0;
  const prepaymentPenalty = estimatePrepaymentPenalty(loan);
  const totalPayoffCost = loan.remainingBalance + prepaymentPenalty;

  if (availableMoney < totalPayoffCost) {
    const shortfall = totalPayoffCost - availableMoney;
    await notificationService.addMessage(
      [`Unable to repay loan from ${loan.lenderName}.`, `You are short by ${formatNumber(shortfall, { currency: true })}.`, 'Add funds or wait for additional income before attempting a full payoff.'].join(' '),
      'loan.earlyPayoffInsufficientFunds',
      'Insufficient Balance',
      NotificationCategory.FINANCE_AND_STAFF,
    );
    return;
  }

  await addTransaction(-loan.remainingBalance, `Early loan payoff to ${loan.lenderName}`, TRANSACTION_CATEGORIES.LOAN_PAYMENT, false);
  if (prepaymentPenalty > 0) {
    await addTransaction(-prepaymentPenalty, `Early payoff indemnity for ${loan.lenderName}`, TRANSACTION_CATEGORIES.LOAN_PREPAYMENT_FEE, false);
  }
  await updateLoan(loanId, { remainingBalance: 0, seasonsRemaining: 0, status: 'paid_off' });
  await getCurrentCreditRating();
  await notificationService.addMessage(
    [`Loan from ${loan.lenderName} paid off early!`, prepaymentPenalty > 0 ? `Prepayment indemnity charged: ${formatNumber(prepaymentPenalty, { currency: true })}.` : '', 'Credit rating improved.'].filter(Boolean).join(' '),
    'loan.earlyPayoff',
    'Loan Update',
    NotificationCategory.FINANCE_AND_STAFF,
  );
  await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_FULL_REPAYMENT);
  triggerGameUpdate();
}

export async function makeExtraLoanPayment(loanId: string): Promise<void> {
  const activeLoans = await loadActiveLoans();
  const loan = activeLoans.find((entry) => entry.id === loanId);
  if (!loan) throw new Error('Loan not found');
  if (loan.status !== 'active') throw new Error('Only active loans accept extra payments');

  const seasonalPayment = Math.round(loan.seasonalPayment);
  const administrationFee = Math.max(
    Math.round(loan.seasonalPayment * LOAN_EXTRA_PAYMENT.ADMIN_FEE_RATE),
    LOAN_EXTRA_PAYMENT.MIN_ADMIN_FEE,
  );
  const totalPayment = seasonalPayment + administrationFee;
  if ((getGameState().money || 0) < totalPayment) throw new Error('Insufficient funds to apply extra payment');

  await addTransaction(-seasonalPayment, `Extra payment to ${loan.lenderName}`, TRANSACTION_CATEGORIES.LOAN_PAYMENT, false);
  await addTransaction(-administrationFee, `Administration fee for extra payment to ${loan.lenderName}`, TRANSACTION_CATEGORIES.LOAN_EXTRA_PAYMENT_FEE, false);

  const newBalance = Math.max(0, loan.remainingBalance - seasonalPayment);
  const updateData: Partial<Loan> = { remainingBalance: newBalance, missedPayments: 0 };
  if (loan.seasonsRemaining > 0) updateData.seasonsRemaining = Math.max(0, loan.seasonsRemaining - 1);
  if (newBalance <= 0) {
    updateData.status = 'paid_off';
    updateData.seasonsRemaining = 0;
  }
  await updateLoan(loan.id, updateData);
  await clearLoanWarning(loan.id);
  await getCurrentCreditRating();
  await notificationService.addMessage(
    `Extra payment of ${formatNumber(totalPayment, { currency: true })} applied to ${loan.lenderName}. Loan warnings cleared.`,
    'loan.extraPayment',
    'Loan Extra Payment',
    NotificationCategory.FINANCE_AND_STAFF,
  );
  await addLoanAdministrationBurden(ADMINISTRATION_LOAN_PENALTIES.LOAN_EXTRA_PAYMENT);
  triggerGameUpdate();
}
