import { createElement, lazy, Suspense } from 'react';
import type { LeaderboardFeature } from './featureTypes';
import { leaderboardService } from './services/leaderboardService';
import { LeaderboardSummary } from './ui/LeaderboardSummary';

const LeaderboardsPage = lazy(() => import('./ui/LeaderboardsPage').then((module) => ({ default: module.LeaderboardsPage })));

export const leaderboardsFeature: LeaderboardFeature = {
  record: {
    company: (input) => leaderboardService.submitCompanyHighscores(input.companyId, input.companyName, input.gameWeek, input.gameSeason, input.gameYear, input.foundedYear, input.companyValue, input.startingValue),
    wine: (companyId, companyName, week, season, year, wine) => leaderboardService.submitWineHighscores(companyId, companyName, week, season, year, wine),
    vineyard: (companyId, companyName, week, season, year, vineyard) => leaderboardService.submitVineyardProductivityHighscore(companyId, companyName, week, season, year, vineyard),
  },
  views: {
    list: (scoreType, limit) => leaderboardService.getHighscores(scoreType, limit),
    rankings: (companyId) => leaderboardService.getCompanyRankings(companyId),
    context: (companyId, scoreType, window) => leaderboardService.getCompanyHighscoreContext(companyId, scoreType, window),
    scoreTypeName: (scoreType) => leaderboardService.getScoreTypeName(scoreType),
    scoreUnit: (scoreType) => leaderboardService.getScoreUnit(scoreType),
  },
  maintenance: { clear: (scoreType) => leaderboardService.clearHighscores(scoreType) },
  ui: {
    renderPage: (input) => createElement(Suspense, { fallback: createElement('div', { className: 'p-6 text-muted-foreground' }, 'Loading leaderboards...') }, createElement(LeaderboardsPage, input)),
    renderSummary: (input) => createElement(LeaderboardSummary, input),
  },
};
