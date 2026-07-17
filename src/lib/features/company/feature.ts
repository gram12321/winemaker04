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
};
