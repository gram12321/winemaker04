import { createElement, lazy, Suspense } from 'react';
import type { WineLogFeature } from './featureTypes';

const WineLogPage = lazy(() => import('./ui/WineLogPage').then(({ WineLog }) => ({ default: WineLog })));

export const wineLogFeature: WineLogFeature = {
  records: {
    async recordBottledWine(batch) {
      const { recordBottledWine } = await import('./services/wineLogService');
      return recordBottledWine(batch);
    },
    async getVineyardHistory(vineyardId, companyId) {
      const { getVineyardWineHistory } = await import('./services/wineLogService');
      return getVineyardWineHistory(vineyardId, companyId);
    },
    async getProductionSummary(companyId) {
      const { getWineProductionSummary } = await import('./services/wineLogService');
      return getWineProductionSummary(companyId);
    },
  },
  ui: {
    renderPage: ({ currentCompany }) => createElement(
      Suspense,
      { fallback: createElement('div', { className: 'p-6 text-muted-foreground' }, 'Loading wine log...') },
      createElement(WineLogPage, { currentCompany }),
    ),
  },
};
