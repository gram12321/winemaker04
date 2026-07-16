// Wage Service
// Centralized wage calculation, normalization, and color coding utilities

import { Staff, StaffSkills, SpecializedRole } from '@/lib/types/types';
import { getColorClass, getBadgeColorClasses, formatNumber } from '@/lib/utils/utils';
import { BASE_WEEKLY_WAGE, DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM, SKILL_WAGE_MULTIPLIER, FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT, SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';
import { WEEKS_PER_SEASON, WEEKS_PER_YEAR } from '@/lib/constants/timeConstants';
import { getGameState } from '../core/gameState';
import { addTransaction, calculateFinancialData } from './financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';
import { calculateEffectiveSkill } from '@/lib/services/user/staffSkillService';

// ===== WAGE CALCULATION =====

/**
 * Calculate weekly wage based on effective primary skills and innate career roles.
 * @param skills Staff skills object
 * @returns Weekly wage in euros
 */
export function getDistinctSpecializationSkillGroupCount(specializedRoles: SpecializedRole[] = []): number {
  return new Set(specializedRoles).size;
}

export function calculateWage(
  skills: StaffSkills,
  specializedRoles: SpecializedRole[] = [],
  experience: Record<string, number> = {},
): number {
  // Calculate average skill
  const avgSkill = (
    calculateEffectiveSkill(skills.field, experience['skill:field'] || 0) +
    calculateEffectiveSkill(skills.winery, experience['skill:winery'] || 0) +
    calculateEffectiveSkill(skills.financeAndStaff, experience['skill:financeAndStaff'] || 0) +
    calculateEffectiveSkill(skills.sales, experience['skill:sales'] || 0) +
    calculateEffectiveSkill(skills.administrationAndResearch, experience['skill:administrationAndResearch'] || 0) +
    calculateEffectiveSkill(skills.maintenance, experience['skill:maintenance'] || 0)
  ) / 6;

  const specializationBonus = Math.pow(
    1 + DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM,
    getDistinctSpecializationSkillGroupCount(specializedRoles)
  );

  // Calculate weekly wage
  const weeklyWage = (BASE_WEEKLY_WAGE + (avgSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;

  return Math.round(weeklyWage);
}

// ===== WAGE NORMALIZATION =====

/**
 * Calculate theoretical maximum wage for normalization
 * Based on max skill level (1.0) and every represented career-role skill group.
 * Formula: (BASE_WEEKLY_WAGE + maxSkill * SKILL_WAGE_MULTIPLIER) * maxSpecializationBonus
 */
export function getMaxWage(): number {
  const maxSkill = 1.0;
  const maxSpecializationSkillGroups = new Set(Object.values(SPECIALIZED_ROLES).map(role => role.skillBonus)).size;
  const specializationBonus = Math.pow(1 + DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM, maxSpecializationSkillGroups);

  return (BASE_WEEKLY_WAGE + maxSkill * SKILL_WAGE_MULTIPLIER) * specializationBonus;
}

/**
 * Normalize wage to 0-1 scale for color coding
 * Uses exponential scaling to better distribute color ranges
 * @param wage The wage amount
 * @param maxWage Optional maximum wage (defaults to calculated max)
 * @returns Normalized value 0-1
 */
export function normalizeWage(wage: number, maxWage?: number): number {
  const max = maxWage || getMaxWage();
  const normalized = wage / max;

  // Apply exponential scaling for better color distribution
  // Maps 0-maxWage to 0-1 with exponential curve
  return Math.pow(normalized, 0.7); // 0.7 gives good distribution
}

// ===== WAGE COLOR CODING =====

/**
 * Get color class for wage based on normalized value
 * @param wage The wage amount
 * @param period Optional period to normalize against ('weekly', 'seasonal', 'annual')
 * @returns CSS color class
 */
export function getWageColorClass(wage: number, period: 'weekly' | 'seasonal' | 'annual' = 'weekly'): string {
  const weeklyMaxWage = getMaxWage();
  let maxWage = weeklyMaxWage;

  // Adjust maximum wage based on period to ensure consistent coloring
  switch (period) {
    case 'seasonal':
      maxWage = weeklyMaxWage * WEEKS_PER_SEASON;
      break;
    case 'annual':
      maxWage = weeklyMaxWage * WEEKS_PER_YEAR;
      break;
    case 'weekly':
    default:
      maxWage = weeklyMaxWage;
      break;
  }

  const normalized = normalizeWage(wage, maxWage);
  return getColorClass(normalized);
}

/**
 * Get badge color classes for wage
 * @param wage The wage amount
 * @returns Object with text and background color classes
 */
export function getWageBadgeColorClasses(wage: number): { text: string; bg: string } {
  const normalized = normalizeWage(wage);
  return getBadgeColorClasses(normalized);
}

// ===== WAGE AGGREGATION =====

/**
 * Calculate total weekly wage expense for all staff
 * @param staff Array of staff members
 * @returns Total weekly wages
 */
export function calculateTotalWeeklyWages(staff: { wage: number }[]): number {
  return staff.reduce((sum, member) => sum + member.wage, 0);
}

/**
 * Calculate total seasonal wage expense (12 weeks per season)
 * @param staff Array of staff members
 * @returns Total seasonal wages
 */
export function calculateTotalSeasonalWages(staff: { wage: number }[]): number {
  return calculateTotalWeeklyWages(staff) * WEEKS_PER_SEASON;
}

/**
 * Calculate total yearly wage expense (4 seasons)
 * @param staff Array of staff members
 * @returns Total yearly wages
 */
export function calculateTotalYearlyWages(staff: { wage: number }[]): number {
  return calculateTotalSeasonalWages(staff) * 4;
}

// ===== WAGE FORMATTING =====

/**
 * Format wage with appropriate color coding
 * @param wage The wage amount
 * @param period Period suffix (e.g., '/wk', '/season')
 * @param wagePeriod The wage period for color normalization ('weekly', 'seasonal', 'annual')
 * @returns Object with formatted text and color class
 */
export function formatWageWithColor(wage: number, period: string = '', wagePeriod: 'weekly' | 'seasonal' | 'annual' = 'weekly'): { text: string; colorClass: string } {
  return {
    text: `${formatNumber(wage, { currency: true, decimals: 0 })}${period}`,
    colorClass: getWageColorClass(wage, wagePeriod)
  };
}

/**
 * Get wage statistics for a staff array
 * @param staff Array of staff members
 * @returns Wage statistics object
 */
export function getWageStatistics(staff: { wage: number }[]): {
  totalWeekly: number;
  totalSeasonal: number;
  totalYearly: number;
  averageWeekly: number;
  minWeekly: number;
  maxWeekly: number;
  count: number;
} {
  if (staff.length === 0) {
    return {
      totalWeekly: 0,
      totalSeasonal: 0,
      totalYearly: 0,
      averageWeekly: 0,
      minWeekly: 0,
      maxWeekly: 0,
      count: 0
    };
  }

  const wages = staff.map(member => member.wage);
  const totalWeekly = calculateTotalWeeklyWages(staff);

  return {
    totalWeekly,
    totalSeasonal: calculateTotalSeasonalWages(staff),
    totalYearly: calculateTotalYearlyWages(staff),
    averageWeekly: Math.round(totalWeekly / staff.length),
    minWeekly: Math.min(...wages),
    maxWeekly: Math.max(...wages),
    count: staff.length
  };
}

// ===== WAGE PROCESSING =====

/**
 * Process seasonal wage payments for all staff
 * Called at the start of each season (week 1) from the game tick system
 * @param staff Array of staff members to pay wages for
 * @param skipNotification If true, returns notification text instead of sending it
 * @returns Notification message text if wages were paid (and skipNotification is true), null otherwise
 */
export async function processSeasonalWages(staff: Staff[], skipNotification: boolean = false): Promise<string | null> {
  try {
    if (staff.length === 0) {
      return null; // No staff to pay
    }

    // Calculate total seasonal wages (12 weeks per season)
    const totalWages = staff.reduce((sum, member) => sum + (member.wage * WEEKS_PER_SEASON), 0);

    if (totalWages === 0) {
      return null; // No wages to pay
    }

    // Check if we have enough money
    const gameState = getGameState();
    const currentMoney = gameState.money || 0;
    const season = gameState.season || 'Spring';

    if (currentMoney < totalWages) {
      const insufficientFundsMessage = `Insufficient funds for staff wages! Need ${formatNumber(totalWages, { currency: true, decimals: 2 })}, have ${formatNumber(currentMoney, { currency: true, decimals: 2 })}`;

      if (!skipNotification) {
        await notificationService.addMessage(
          insufficientFundsMessage,
          'wageService.processSeasonalWages',
          'Insufficient Funds',
          NotificationCategory.FINANCE_AND_STAFF
        );
      }
      // Still process the transaction to show negative balance
    }

    // Create transaction for wage payment (negative amount = expense)
    await addTransaction(
      -totalWages,
      `${season} wages for ${staff.length} staff member${staff.length > 1 ? 's' : ''}`,
      TRANSACTION_CATEGORIES.STAFF_WAGES,
      true // recurring transaction
    );

    // Prepare notification about wage payment
    const message = `Paid ${formatNumber(totalWages, { currency: true, decimals: 0 })} in ${season} wages to ${staff.length} staff member${staff.length > 1 ? 's' : ''}`;

    if (skipNotification) {
      return message;
    } else {
      await notificationService.addMessage(
        message,
        'staff.wages',
        'Staff Wages Paid',
        NotificationCategory.STAFF_MANAGEMENT
      );
      return null;
    }

  } catch (error) {
    console.error('Error processing seasonal wages:', error);
    return null;
  }
}

// ===== FOUNDER PROFIT-SHARE =====

/**
 * Process yearly Founder Return distributions.
 * Called at the start of each new year (Spring week 1) for the year that just ended.
 * Each active founder receives FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT % of yearly net profit.
 * No payout occurs when profit is zero or negative.
 */
export async function processYearlyFounderDistributions(
  staff: Staff[],
  previousYear: number
): Promise<void> {
  try {
    const founders = staff.filter(s => s.isFounder === true);
    if (founders.length === 0) return;

    // Calculate net profit for the year that just ended
    const financialData = await calculateFinancialData('year', { year: previousYear });
    const yearlyNetProfit = financialData.netIncome; // income - expenses (P&L, excludes capital flows)

    if (yearlyNetProfit <= 0) {
      // Lean year — founders receive nothing (by design)
      return;
    }

    const sharePercent = FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT / 100;
    const totalPaid: number[] = [];
    for (const founder of founders) {
      const amount = Math.round(yearlyNetProfit * sharePercent);
      await addTransaction(
        -amount,
        `Founder Return ${previousYear}: ${founder.name} (${FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT}% of net profit)`,
        TRANSACTION_CATEGORIES.FOUNDER_RETURN,
        false
      );
      totalPaid.push(amount);
    }

    const grandTotal = totalPaid.reduce((sum, v) => sum + v, 0);

    await notificationService.addMessage(
      `Founder Returns paid for ${previousYear}: ${founders.length} founder${founders.length > 1 ? 's' : ''} received a combined ${formatNumber(grandTotal, { currency: true, decimals: 0 })} (${FOUNDER_PROFIT_SHARE_PER_FOUNDER_PERCENT}% each of ${formatNumber(yearlyNetProfit, { currency: true, decimals: 0 })} net profit).`,
      'wageService.founderDistributions',
      'Founder Returns',
      NotificationCategory.FINANCE_AND_STAFF
    );
  } catch (error) {
    console.error('Error processing yearly founder distributions:', error);
  }
}
