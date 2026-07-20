import type { SpecializedRole, StaffSkills } from '@/lib/types/types';
import { getColorClass } from '@/lib/utils/utils';
import {
  BASE_WEEKLY_WAGE,
  DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM,
  SKILL_WAGE_MULTIPLIER,
  SPECIALIZED_ROLES,
} from '@/lib/constants/staffConstants';
import { WEEKS_PER_SEASON, WEEKS_PER_YEAR } from '@/lib/constants/timeConstants';
import { calculateEffectiveSkill } from './competencyService';

export function getDistinctSpecializationSkillGroupCount(specializedRoles: SpecializedRole[] = []): number {
  return new Set(specializedRoles).size;
}

export function calculateWage(skills: StaffSkills, specializedRoles: SpecializedRole[] = [], experience: Record<string, number> = {}): number {
  const averageSkill = (
    calculateEffectiveSkill(skills.field, experience['skill:field'] || 0) +
    calculateEffectiveSkill(skills.winery, experience['skill:winery'] || 0) +
    calculateEffectiveSkill(skills.financeAndStaff, experience['skill:financeAndStaff'] || 0) +
    calculateEffectiveSkill(skills.sales, experience['skill:sales'] || 0) +
    calculateEffectiveSkill(skills.administrationAndResearch, experience['skill:administrationAndResearch'] || 0) +
    calculateEffectiveSkill(skills.maintenance, experience['skill:maintenance'] || 0)
  ) / 6;
  return Math.round((BASE_WEEKLY_WAGE + (averageSkill * SKILL_WAGE_MULTIPLIER)) * Math.pow(
    1 + DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM,
    getDistinctSpecializationSkillGroupCount(specializedRoles),
  ));
}

function getMaxWage(): number {
  const groupCount = new Set(Object.values(SPECIALIZED_ROLES).map(role => role.skillBonus)).size;
  return (BASE_WEEKLY_WAGE + SKILL_WAGE_MULTIPLIER) * Math.pow(1 + DISTINCT_PRIMARY_SKILL_WAGE_PREMIUM, groupCount);
}

function normalizeWage(wage: number, maxWage = getMaxWage()): number {
  return Math.pow(wage / maxWage, 0.7);
}

export function getWageColorClass(wage: number, period: 'weekly' | 'seasonal' | 'annual' = 'weekly'): string {
  const scale = period === 'seasonal' ? WEEKS_PER_SEASON : period === 'annual' ? WEEKS_PER_YEAR : 1;
  return getColorClass(normalizeWage(wage, getMaxWage() * scale));
}

export function calculateTotalWeeklyWages(staff: { wage: number }[]): number {
  return staff.reduce((sum, member) => sum + member.wage, 0);
}

export function calculateTotalSeasonalWages(staff: { wage: number }[]): number {
  return calculateTotalWeeklyWages(staff) * WEEKS_PER_SEASON;
}

export function calculateTotalYearlyWages(staff: { wage: number }[]): number {
  return calculateTotalWeeklyWages(staff) * WEEKS_PER_YEAR;
}
