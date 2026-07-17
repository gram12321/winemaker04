import { GAME_INITIALIZATION } from '@/lib/constants/constants';
import { WEEKS_PER_YEAR } from '@/lib/constants/timeConstants';
import {
  checkCompanyNameExists,
  deleteCompany,
  getAllCompanies,
  getCompanyById,
  getCompanyByName,
  getCompanyStats,
  getUserCompanies,
  insertCompany,
  updateCompany,
  type Company as DatabaseCompany,
  type CompanyData,
} from '@/lib/database';
import type {
  CompanyCreateInput,
  CompanyCreateResult,
  CompanyOperationResult,
  CompanyRecord,
  CompanyStats,
  CompanyUpdateInput,
} from '../featureTypes';

function toCompanyRecord(company: DatabaseCompany): CompanyRecord {
  return {
    id: company.id,
    name: company.name,
    ownerId: company.userId,
    foundedYear: company.foundedYear,
    currentWeek: company.currentWeek,
    currentSeason: company.currentSeason,
    currentYear: company.currentYear,
    money: company.money,
    prestige: company.prestige,
    startingCountry: company.startingCountry,
    lastPlayed: company.lastPlayed,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export async function createCompanyRecord(input: CompanyCreateInput): Promise<CompanyCreateResult> {
  try {
    if (await checkCompanyNameExists(input.name)) {
      return { success: false, error: 'Company name already exists' };
    }

    const data: CompanyData = {
      name: input.name,
      user_id: input.ownerId ?? null,
      founded_year: 2024,
      current_week: 1,
      current_season: 'Spring',
      current_year: 2024,
      money: 0,
      prestige: GAME_INITIALIZATION.STARTING_PRESTIGE,
    };
    const result = await insertCompany(data);
    if (!result.success) return { success: false, error: result.error };

    const company = await getCompanyById(result.data.id);
    return { success: true, company: company ? toCompanyRecord(company) : undefined };
  } catch (error) {
    console.error('Error creating company:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getCompanyRecord(companyId: string): Promise<CompanyRecord | null> {
  const company = await getCompanyById(companyId);
  return company ? toCompanyRecord(company) : null;
}

export async function getCompanyRecordByName(name: string): Promise<CompanyRecord | null> {
  const company = await getCompanyByName(name);
  return company ? toCompanyRecord(company) : null;
}

export async function listCompanyRecordsForOwner(ownerId: string): Promise<CompanyRecord[]> {
  return (await getUserCompanies(ownerId)).map(toCompanyRecord);
}

export async function listCompanyRecords(limit = 50): Promise<CompanyRecord[]> {
  return (await getAllCompanies(limit)).map(toCompanyRecord);
}

export async function updateCompanyRecord(companyId: string, updates: CompanyUpdateInput): Promise<CompanyOperationResult> {
  const data: Record<string, unknown> = {};
  if (updates.currentWeek !== undefined) data.current_week = updates.currentWeek;
  if (updates.currentSeason !== undefined) data.current_season = updates.currentSeason;
  if (updates.currentYear !== undefined) data.current_year = updates.currentYear;
  if (updates.money !== undefined) data.money = updates.money;
  if (updates.prestige !== undefined) data.prestige = updates.prestige;
  if (updates.startingCountry !== undefined) data.starting_country = updates.startingCountry;
  return Object.keys(data).length === 0 ? { success: true } : updateCompany(companyId, data);
}

export const removeCompanyRecord = (companyId: string) => deleteCompany(companyId);

export async function getCompanyRecordStats(ownerId: string): Promise<CompanyStats> {
  try {
    const companies = await getCompanyStats(ownerId);
    if (!companies.length) return { totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 };
    const totalGold = companies.reduce((total, company) => total + company.money, 0);
    const totalWeeks = companies.reduce(
      (total, company) => total + Math.max(1, (company.current_year - 2024) * WEEKS_PER_YEAR + company.current_week),
      0,
    );
    return {
      totalCompanies: companies.length,
      totalGold,
      totalValue: totalGold,
      avgWeeks: Math.round(totalWeeks / companies.length),
    };
  } catch (error) {
    console.error('Error getting company stats:', error);
    return { totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 };
  }
}

export function getSingleCompanyStats(company: CompanyRecord): CompanyStats {
  return {
    totalCompanies: 1,
    totalGold: company.money,
    totalValue: company.money,
    avgWeeks: Math.max(1, (company.currentYear - company.foundedYear) * WEEKS_PER_YEAR + company.currentWeek),
  };
}
