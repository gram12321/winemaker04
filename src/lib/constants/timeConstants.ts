import type { Season } from '@/lib/types/types';

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

export type SeasonName = typeof SEASONS[number];

export const SEASON_ORDER: ReadonlyArray<Season> = SEASONS;

export const WEEKS_PER_SEASON = 12;

export const SEASONS_PER_YEAR = SEASONS.length;

export const WEEKS_PER_YEAR = WEEKS_PER_SEASON * SEASONS_PER_YEAR;

