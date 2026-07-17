import { createElement, lazy, Suspense } from 'react';
import type { LeaderboardFeature } from './featureTypes';
import { leaderboardService } from './services/leaderboardService';
import { LeaderboardSummary } from './ui/LeaderboardSummary';

const LeaderboardsPage = lazy(() => import('./ui/LeaderboardsPage').then((module) => ({ default: module.LeaderboardsPage })));

export const leaderboardsFeature: LeaderboardFeature = {
  record: {
    company: (input) => leaderboardService.submitCompanyHighscores(input),
    wine: (input) => leaderboardService.submitWineHighscores(input),
    vineyard: (input) => leaderboardService.submitVineyardProductivityHighscore(input),
  },
  views: {
    list: (scoreType, limit) => leaderboardService.getHighscores(scoreType, limit),
    rankings: (companyId) => leaderboardService.getCompanyRankings(companyId),
    context: (companyId, scoreType, window) => leaderboardService.getCompanyHighscoreContext(companyId, scoreType, window),
    kindName: (kind) => leaderboardService.getScoreTypeName(kind),
    kindUnit: (kind) => leaderboardService.getScoreUnit(kind),
  },
  maintenance: { clear: (scoreType) => leaderboardService.clearHighscores(scoreType) },
  ui: {
    renderPage: (input) => createElement(Suspense, { fallback: createElement('div', { className: 'p-6 text-muted-foreground' }, 'Loading leaderboards...') }, createElement(LeaderboardsPage, input)),
    renderSummary: (input) => createElement(LeaderboardSummary, input),
  },
};
