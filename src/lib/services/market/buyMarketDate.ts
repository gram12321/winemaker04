import { SEASONS, WEEKS_PER_SEASON } from '@/lib/constants/timeConstants';

export interface BuyMarketGameDate { year: number; season: string; week: number; }

export function toBuyMarketAbsoluteWeek(date: BuyMarketGameDate): number {
  const seasonIndex = Math.max(0, SEASONS.indexOf(date.season as typeof SEASONS[number]));
  return (date.year * SEASONS.length * WEEKS_PER_SEASON) + (seasonIndex * WEEKS_PER_SEASON) + Math.max(0, date.week - 1);
}

export function isBuyMarketDateReached(current: BuyMarketGameDate, target: BuyMarketGameDate): boolean {
  return toBuyMarketAbsoluteWeek(current) >= toBuyMarketAbsoluteWeek(target);
}

export function addBuyMarketWeeks(date: BuyMarketGameDate, weeks: number): BuyMarketGameDate {
  const total = toBuyMarketAbsoluteWeek(date) + Math.max(0, weeks);
  const weeksPerYear = SEASONS.length * WEEKS_PER_SEASON;
  const year = Math.floor(total / weeksPerYear);
  const withinYear = total % weeksPerYear;
  const seasonIndex = Math.floor(withinYear / WEEKS_PER_SEASON);
  return { year, season: SEASONS[seasonIndex], week: (withinYear % WEEKS_PER_SEASON) + 1 };
}

export function isBuyMarketDateInWindow(current: BuyMarketGameDate, starts: BuyMarketGameDate, endsExclusive: BuyMarketGameDate): boolean {
  return isBuyMarketDateReached(current, starts) && !isBuyMarketDateReached(current, endsExclusive);
}
