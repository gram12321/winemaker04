// Wage Service
// Centralized wage calculation, normalization, and color coding utilities

import { Staff, StaffSkills } from '@/lib/types/types';
import { getColorClass, getBadgeColorClasses, formatNumber } from '@/lib/utils/utils';
import { BASE_WEEKLY_WAGE, SKILL_WAGE_MULTIPLIER } from '@/lib/constants/staffConstants';
import { getGameState } from '../core/gameState';
import { addTransaction } from './financeService';
import { TRANSACTION_CATEGORIES } from '@/lib/constants/financeConstants';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';

// ===== WAGE CALCULATION =====

/**
 * Calculate weekly wage based on skills and specializations
 * @param skills Staff skills object
 * @param specializations Array of specialization keys
 * @returns Weekly wage in euros
 */
export function calculateWage(skills: StaffSkills, specializations: string[] = []): number {
  // Calculate average skill
  const avgSkill = (
    skills.field +
    skills.winery +
    skills.administration +
    skills.sales +
    skills.maintenance
  ) / 5;
  
  // Add bonus for specialized roles (30% per specialization, multiplicative)
  const specializationBonus = specializations.length > 0 ? 
    Math.pow(1.3, specializations.length) : 1;
  
  // Calculate weekly wage
  const weeklyWage = (BASE_WEEKLY_WAGE + (avgSkill * SKILL_WAGE_MULTIPLIER)) * specializationBonus;
  
  return Math.round(weeklyWage);
}

// ===== WAGE NORMALIZATION =====

/**
 * Calculate theoretical maximum wage for normalization
 * Based on max skill level (1.0) and max specializations (5)
 * Formula: (BASE_WEEKLY_WAGE + maxSkill * SKILL_WAGE_MULTIPLIER) * maxSpecializationBonus
 */
export function getMaxWage(): number {
  const maxSkill = 1.0;
  const maxSpecializations = 5;
  const specializationBonus = Math.pow(1.3, maxSpecializations); // 30% per specialization
  
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
      maxWage = weeklyMaxWage * 12; // 12 weeks per season
      break;
    case 'annual':
      maxWage = weeklyMaxWage * 48; // 48 weeks per year
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
  return calculateTotalWeeklyWages(staff) * 12;
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
    text: `€${wage.toLocaleString()}${period}`,
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
 */
export async function processSeasonalWages(staff: Staff[]): Promise<void> {
  try {
    if (staff.length === 0) {
      return; // No staff to pay
    }
    
    // Calculate total seasonal wages (12 weeks per season)
    const totalWages = staff.reduce((sum, member) => sum + (member.wage * 12), 0);
    
    if (totalWages === 0) {
      return; // No wages to pay
    }
    
    // Check if we have enough money
    const gameState = getGameState();
    const currentMoney = gameState.money || 0;
    const season = gameState.season || 'Spring';
    
    if (currentMoney < totalWages) {
      await notificationService.addMessage(
        `Insufficient funds for staff wages! Need €${totalWages.toFixed(2)}, have €${currentMoney.toFixed(2)}`,
        'wageService.processSeasonalWages',
        'Insufficient Funds',
        NotificationCategory.FINANCE
      );
      // Still process the transaction to show negative balance
    }
    
    // Create transaction for wage payment (negative amount = expense)
    await addTransaction(
      -totalWages,
      `${season} wages for ${staff.length} staff member${staff.length > 1 ? 's' : ''}`,
      TRANSACTION_CATEGORIES.STAFF_WAGES,
      true // recurring transaction
    );
    
    // Notify about wage payment
    await notificationService.addMessage(
      `Paid €${formatNumber(totalWages)} in ${season} wages to ${staff.length} staff member${staff.length > 1 ? 's' : ''}`,
      'staff.wages',
      'Staff Wages Paid',
      NotificationCategory.STAFF_MANAGEMENT
    );
    
  } catch (error) {
    console.error('Error processing seasonal wages:', error);
  }
}
