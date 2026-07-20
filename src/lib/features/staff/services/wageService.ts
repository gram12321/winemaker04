import type { Staff } from '@/lib/types/types';
import { NotificationCategory } from '@/lib/types/types';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT } from '@/lib/constants/staffConstants';
import { WEEKS_PER_SEASON } from '@/lib/constants/timeConstants';
import { formatNumber } from '@/lib/utils/utils';
import { notificationService } from '@/lib/services/core/notificationService';

export async function processSeasonalWages(staff: Staff[], skipNotification = false): Promise<string | null> {
  try {
    if (staff.length === 0) return null;
    const totalWages = staff.reduce((sum, member) => sum + (member.wage * WEEKS_PER_SEASON), 0);
    if (totalWages === 0) return null;

    const { getGameState } = await import('@/lib/services/core/gameState');
    const gameState = getGameState();
    const currentMoney = gameState.money || 0;
    const season = gameState.season || 'Spring';
    if (currentMoney < totalWages && !skipNotification) {
      await notificationService.addMessage(
        `Insufficient funds for staff wages! Need ${formatNumber(totalWages, { currency: true, decimals: 2 })}, have ${formatNumber(currentMoney, { currency: true, decimals: 2 })}`,
        'staff.wages.processSeasonal',
        'Insufficient Funds',
        NotificationCategory.FINANCE_AND_STAFF,
      );
    }

    const { addTransaction } = await import('@/lib/services/finance/financeService');
    await addTransaction(-totalWages, `${season} wages for ${staff.length} staff member${staff.length > 1 ? 's' : ''}`, TRANSACTION_CATEGORIES.STAFF_WAGES, true);
    const message = `Paid ${formatNumber(totalWages, { currency: true, decimals: 0 })} in ${season} wages to ${staff.length} staff member${staff.length > 1 ? 's' : ''}`;
    if (skipNotification) return message;

    await notificationService.addMessage(message, 'staff.wages', 'Staff Wages Paid', NotificationCategory.STAFF_MANAGEMENT);
    return null;
  } catch (error) {
    console.error('Error processing seasonal wages:', error);
    return null;
  }
}

export async function processYearlyFounderDistributions(staff: Staff[], previousYear: number): Promise<void> {
  try {
    const founders = staff.filter(member => member.isFounder);
    if (founders.length === 0) return;

    const { addTransaction, calculateFinancialData } = await import('@/lib/services/finance/financeService');
    const yearlyNetProfit = (await calculateFinancialData('year', { year: previousYear })).netIncome;
    if (yearlyNetProfit <= 0) return;

    const amount = Math.round(yearlyNetProfit * (FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT / 100));
    for (const founder of founders) {
      await addTransaction(-amount, `Founder Return ${previousYear}: ${founder.name} (${FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT}% of net profit)`, TRANSACTION_CATEGORIES.FOUNDER_RETURN, false);
    }
    const grandTotal = amount * founders.length;
    await notificationService.addMessage(
      `Founder Returns paid for ${previousYear}: ${founders.length} founder${founders.length > 1 ? 's' : ''} received a combined ${formatNumber(grandTotal, { currency: true, decimals: 0 })} (${FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT}% each of ${formatNumber(yearlyNetProfit, { currency: true, decimals: 0 })} net profit).`,
      'staff.founderDistributions',
      'Founder Returns',
      NotificationCategory.FINANCE_AND_STAFF,
    );
  } catch (error) {
    console.error('Error processing yearly founder distributions:', error);
  }
}
