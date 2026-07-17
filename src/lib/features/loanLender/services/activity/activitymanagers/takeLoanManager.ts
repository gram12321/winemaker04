import { Activity, WorkCategory, NotificationCategory, LoanOffer, LoanApplicationPayload } from '@/lib/types/types';
import { createActivity } from '@/lib/services/activity/activitymanagers/activityManager';
import { notificationService } from '@/lib/services/core/notificationService';
import { applyForLoan } from '@/lib/features/loanLender/services/finance/loanService';
import { formatNumber } from '@/lib/utils';
import { getGameState } from '@/lib/services/core/gameState';
import { buildLoanApplicationPayload } from '@/lib/features/loanLender/services/finance/loanQuoteService';

/**
 * Start a take loan activity
 */
export async function startTakeLoan(offer: LoanOffer, isAdjusted: boolean = false, adjustedAmount?: number, adjustedDurationSeasons?: number): Promise<string | null> {
  try {
    // Use adjusted parameters if provided, otherwise use original offer values
    const amount = adjustedAmount ?? offer.principalAmount;
    const duration = adjustedDurationSeasons ?? offer.durationSeasons;

    const gameState = getGameState();
    const application = buildLoanApplicationPayload(
      offer,
      amount,
      duration,
      gameState.creditRating ?? 0.5,
      gameState.economyPhase ?? 'Stable',
    );
    const { totalWork } = application;

    // Create the take loan activity
    const title = 'Processing Loan';

    const activityId = await createActivity({
      category: WorkCategory.TAKE_LOAN,
      title,
      totalWork,
      activityDetails: `Amount: ${formatNumber(amount, { currency: true, decimals: 2 })}, ${Math.round(duration / 4)} years${isAdjusted ? ' (adjusted)' : ''}`,
      params: {
        application: {
          offer: application.offer,
          originalOffer: offer,
          adjustedAmount: amount,
          adjustedDurationSeasons: duration,
          totalWork
        } satisfies LoanApplicationPayload,
        isAdjusted,
      },
      isCancellable: true
    });

    return activityId;
  } catch (error) {
    console.error('Error starting take loan:', error);
    return null;
  }
}

/**
 * Complete take loan activity
 * Actually apply for the loan
 */
export async function completeTakeLoan(activity: Activity): Promise<void> {
  try {
    const application = activity.params.application as LoanApplicationPayload | undefined;
    const offer = application?.offer ?? activity.params.offer as LoanOffer;

    if (!offer) {
      console.error('No loan offer found in activity params');
      return;
    }

    // Apply for the loan
    await applyForLoan(
      offer.lender.id,
      offer.principalAmount,
      offer.durationSeasons,
      offer.lender,
      {
        skipLimitCheck: true,
        overrideBaseRate: offer.lender.baseInterestRate,
        overrideEffectiveRate: offer.effectiveInterestRate,
        overrideSeasonalPayment: offer.seasonalPayment,
        overrideOriginationFee: offer.originationFee,
      }
    );

    await notificationService.addMessage(
      `Loan from ${offer.lender.name} successfully processed! ${formatNumber(offer.principalAmount, { currency: true, decimals: 2 })} added to your account.`,
      'takeLoanManager.completeTakeLoan',
      'Loan Processed',
      NotificationCategory.FINANCE_AND_STAFF
    );
  } catch (error) {
    console.error('Error completing take loan:', error);
    await notificationService.addMessage(
      `Failed to process loan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'takeLoanManager.completeTakeLoan',
      'Loan Processing Failed',
      NotificationCategory.FINANCE_AND_STAFF
    );
  }
}
