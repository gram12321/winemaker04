import { ACHIEVEMENT_CHECK_INTERVAL_WEEKS } from '@/lib/constants';
import { calculateAbsoluteWeeks, getCurrentCompanyId } from '@/lib/utils';
import { getGameState } from '@/lib/services/core/gameState';
import { checkAllAchievements } from './achievementService';

const lastCheckWeekByCompany = new Map<string, number>();
const companiesWithCheckInFlight = new Set<string>();

export function shouldRunAchievementCheck(companyId: string, absoluteWeek: number): boolean {
  const lastCheckWeek = lastCheckWeekByCompany.get(companyId);
  if (lastCheckWeek === undefined || absoluteWeek < lastCheckWeek) return true;

  return absoluteWeek - lastCheckWeek >= ACHIEVEMENT_CHECK_INTERVAL_WEEKS;
}

export function recordAchievementCheck(companyId: string, absoluteWeek: number): void {
  lastCheckWeekByCompany.set(companyId, absoluteWeek);
}

export async function checkAchievementsAfterWeekAdvance(): Promise<void> {
  const companyId = getCurrentCompanyId();
  const gameState = getGameState();
  const absoluteWeek = calculateAbsoluteWeeks(
    gameState.week!,
    gameState.season!,
    gameState.currentYear!
  );

  if (shouldRunAchievementCheck(companyId, absoluteWeek) && !companiesWithCheckInFlight.has(companyId)) {
    companiesWithCheckInFlight.add(companyId);
    try {
    await checkAllAchievements();
      recordAchievementCheck(companyId, absoluteWeek);
    } finally {
      companiesWithCheckInFlight.delete(companyId);
    }
  }
}

export function resetAchievementTickScheduleForTests(): void {
  lastCheckWeekByCompany.clear();
  companiesWithCheckInFlight.clear();
}
