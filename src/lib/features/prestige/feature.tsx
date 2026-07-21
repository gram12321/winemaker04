import { createElement, lazy, Suspense } from 'react';
import type { PrestigeFeature } from './featureTypes';
import {
  BoundedVineyardPrestigeFactor,
  addContractOutcomePrestigeEvent,
  addFeaturePrestigeEvent,
  addResearchPrestigeEvent,
  addSalePrestigeEvent,
  addVineyardAchievementPrestigeEvent,
  addVineyardSalePrestigeEvent,
  calculateCurrentPrestige,
  calculateVineyardPrestigeFromEvents,
  createBaseVineyardPrestigeEvents,
  getBaseVineyardPrestige,
  getEventDisplayData,
  getVineyardPrestigeBreakdown,
  initializeBasePrestigeEvents,
  recordAchievementPrestige,
  recordAdminPrestigeAdjustment,
  recordBookkeepingPrestigePenalty,
  recordFinancePrestigePenalty,
  recordStartingConditionPrestige,
  recordVineyardAchievementPrestige,
  updateBaseVineyardPrestigeEvent,
  updateCellarCollectionPrestige,
  updateCompanyValuePrestige,
} from './services/prestigeService';
import { decayPrestigeEventsOneWeek } from './services/prestigeDecayService';

const PrestigeModal = lazy(() => import('./ui/PrestigeModal'));

export const prestigeFeature: PrestigeFeature = {
  lifecycle: {
    initialize: initializeBasePrestigeEvents,
    initializeVineyards: createBaseVineyardPrestigeEvents,
    updateCompanyValue: updateCompanyValuePrestige,
    updateVineyard: updateBaseVineyardPrestigeEvent,
    updateCellarCollection: updateCellarCollectionPrestige,
    decayOneWeek: decayPrestigeEventsOneWeek,
  },
  reads: {
    calculateCurrent: calculateCurrentPrestige,
    calculateVineyard: calculateVineyardPrestigeFromEvents,
    getBaseVineyard: getBaseVineyardPrestige,
    getBreakdown: getVineyardPrestigeBreakdown,
    getEventDisplayData,
  },
  events: {
    addSale: addSalePrestigeEvent,
    addContractOutcome: addContractOutcomePrestigeEvent,
    addVineyardSale: addVineyardSalePrestigeEvent,
    addVineyardAchievement: addVineyardAchievementPrestigeEvent,
    addFeature: addFeaturePrestigeEvent,
    addResearch: addResearchPrestigeEvent,
    recordFinancePenalty: recordFinancePrestigePenalty,
    recordAchievement: recordAchievementPrestige,
    recordVineyardAchievement: recordVineyardAchievementPrestige,
    recordStartingCondition: recordStartingConditionPrestige,
    recordBookkeepingPenalty: recordBookkeepingPrestigePenalty,
    recordAdminAdjustment: recordAdminPrestigeAdjustment,
  },
  calculations: {
    boundedVineyardFactor: BoundedVineyardPrestigeFactor,
  },
  ui: {
    renderModal: (input) => createElement(
      Suspense,
      { fallback: createElement('div', { className: 'p-4 text-muted-foreground' }, 'Loading prestige...') },
      createElement(PrestigeModal, input),
    ),
  },
};
