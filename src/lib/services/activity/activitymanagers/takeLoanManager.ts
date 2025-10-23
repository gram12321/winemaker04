import { Activity, WorkCategory, NotificationCategory, LoanOffer } from '@/lib/types/types';
import { createActivity } from './activityManager';
import { notificationService } from '@/lib/services';
import { calculateTakeLoanWork } from '../workcalculators/takeLoanWorkCalculator';
import { applyForLoan } from '../../finance/loanService';

/**
 * Start a take loan activity
 */
export async function startTakeLoan(offer: LoanOffer, isAdjusted: boolean = false): Promise<string | null> {
  try {
    const { totalWork } = calculateTakeLoanWork(isAdjusted);
    
    // Create the take loan activity
    const title = `Processing Loan from ${offer.lender.name}`;
    
    const activityId = await createActivity({
      category: WorkCategory.TAKE_LOAN,
      title,
      totalWork,
      activityDetails: `Amount: €${offer.principalAmount.toFixed(2)}, ${Math.round(offer.durationSeasons / 4)} years${isAdjusted ? ' (adjusted)' : ''}`,
      params: {
        offer,
        isAdjusted
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
    const offer = activity.params.offer as LoanOffer;
    
    if (!offer) {
      console.error('No loan offer found in activity params');
      return;
    }
    
    // Apply for the loan
    await applyForLoan(
      offer.lender.id,
      offer.principalAmount,
      offer.durationSeasons,
      offer.lender
    );
    
    await notificationService.addMessage(
      `Loan from ${offer.lender.name} successfully processed! €${offer.principalAmount.toFixed(2)} added to your account.`,
      'takeLoanManager.completeTakeLoan',
      'Loan Processed',
      NotificationCategory.FINANCE
    );
  } catch (error) {
    console.error('Error completing take loan:', error);
    await notificationService.addMessage(
      `Failed to process loan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'takeLoanManager.completeTakeLoan',
      'Loan Processing Failed',
      NotificationCategory.FINANCE
    );
  }
}

