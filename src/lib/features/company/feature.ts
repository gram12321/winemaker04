import { createElement, lazy, Suspense } from 'react';
import type { CompanyFeature } from './featureTypes';
import { FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION } from '@/lib/constants/startingConditions';
import {
  createCompanyRecord,
  getCompanyRecord,
  getCompanyRecordStats,
  getSingleCompanyStats,
  listCompanyRecords,
  listCompanyRecordsForOwner,
  removeCompanyRecord,
  updateCompanyRecord,
} from './services/companyRecordService';
import { generateVineyardPreview } from './services/startingConditionsPreviewService';
import { notifyActivated, registerActivationHook } from './services/companyLifecycle';

const CompanyGateway = lazy(() => import('./ui/CompanyGateway').then(({ CompanyGateway: Gateway }) => ({ default: Gateway })));

export const companyFeature: CompanyFeature = {
  records: {
    create: createCompanyRecord,
    get: getCompanyRecord,
    listForOwner: listCompanyRecordsForOwner,
    listAll: listCompanyRecords,
    update: updateCompanyRecord,
    remove: removeCompanyRecord,
    getStatsForOwner: getCompanyRecordStats,
    getStatsForCompany: async (company) => getSingleCompanyStats(company),
  },
  setup: {
    firstCompanyPlayerCashContribution: FIRST_COMPANY_PLAYER_CASH_CONTRIBUTION,
    generateVineyardPreview,
    applyStartingConditions: (...args) => import('./services/startingConditionsService')
      .then(({ applyStartingConditions }) => applyStartingConditions(...args)),
  },
  lifecycle: {
    registerActivationHook,
    notifyActivated,
  },
  ui: {
    renderGateway: (input) => createElement(Suspense, { fallback: null }, createElement(CompanyGateway, input)),
  },
};
