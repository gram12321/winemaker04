import type { ReactElement } from 'react';
import type { Season } from '@/lib/types/types';
import type { HighscoreEntry, ScoreType } from '@/lib/database';
import type { LeaderboardSummaryProps } from './ui/LeaderboardSummary';

export type LeaderboardResult = { success: boolean; error?: string };
export interface LeaderboardPageInput { currentCompanyId?: string; onBack?: () => void; }
export interface LeaderboardFeature {
  record: {
    company(input: { companyId: string; companyName: string; gameWeek: number; gameSeason: Season; gameYear: number; foundedYear: number; companyValue: number; startingValue?: number }): Promise<LeaderboardResult>;
    wine(companyId: string, companyName: string, week: number, season: Season, year: number, wine: Parameters<import('./services/leaderboardService').LeaderboardService['submitWineHighscores']>[5]): Promise<LeaderboardResult>;
    vineyard(companyId: string, companyName: string, week: number, season: Season, year: number, vineyard: Parameters<import('./services/leaderboardService').LeaderboardService['submitVineyardProductivityHighscore']>[5]): Promise<LeaderboardResult>;
  };
  views: {
    list(scoreType: ScoreType, limit?: number): Promise<HighscoreEntry[]>;
    rankings(companyId: string): ReturnType<import('./services/leaderboardService').LeaderboardService['getCompanyRankings']>;
    context(companyId: string, scoreType: ScoreType, window?: number): ReturnType<import('./services/leaderboardService').LeaderboardService['getCompanyHighscoreContext']>;
    scoreTypeName(scoreType: ScoreType): string;
    scoreUnit(scoreType: ScoreType): string;
  };
  maintenance: { clear(scoreType?: ScoreType): Promise<LeaderboardResult>; };
  ui: { renderPage(input: LeaderboardPageInput): ReactElement; renderSummary(input: LeaderboardSummaryProps): ReactElement; };
}
