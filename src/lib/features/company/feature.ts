import { createElement, lazy, Suspense } from 'react';
import type { CompanyFeature } from './featureTypes';
import {
  createCompanyRecord,
  getCompanyRecord,
  getCompanyRecordByName,
  getCompanyRecordStats,
  getSingleCompanyStats,
  listCompanyRecords,
  listCompanyRecordsForOwner,
  removeCompanyRecord,
  updateCompanyRecord,
} from './services/companyRecordService';

const CompanyGateway = lazy(() => import('./ui/CompanyGateway').then(({ CompanyGateway: Gateway }) => ({ default: Gateway })));

export const companyFeature: CompanyFeature = {
  records: {
    create: createCompanyRecord,
    get: getCompanyRecord,
    getByName: getCompanyRecordByName,
    listForOwner: listCompanyRecordsForOwner,
    listAll: listCompanyRecords,
    update: updateCompanyRecord,
    remove: removeCompanyRecord,
    getStatsForOwner: getCompanyRecordStats,
    getStatsForCompany: async (company) => getSingleCompanyStats(company),
  },
  ui: {
    renderGateway: (input) => createElement(Suspense, { fallback: null }, createElement(CompanyGateway, input)),
  },
};
