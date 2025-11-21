import { Activity, NotificationCategory, WorkCategory } from '@/lib/types/types';
import { notificationService, addTransaction } from '@/lib/services';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';

/**
 * Complete a research activity
 * Grants a reward (placeholder: +1000 money)
 */
export async function completeResearch(activity: Activity): Promise<void> {
      // Placeholder reward: +1000 money
      const rewardAmount = 1000;

      await addTransaction(
            rewardAmount,
            `Research Grant: ${activity.title}`,
            TRANSACTION_CATEGORIES.RESEARCH, // Using RESEARCH as income category for research grants
            false
      );

      notificationService.addMessage(
            `Research completed: ${activity.title}. Received €${rewardAmount} grant.`,
            'research.complete',
            'Research Complete',
            NotificationCategory.ADMINISTRATION_AND_RESEARCH // Using ADMINISTRATION_AND_RESEARCH category
      );
}
