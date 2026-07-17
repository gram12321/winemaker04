import type { Season } from '@/lib/types/types';
import type { Company } from '@/lib/database';

export interface CompanyCreateInput {
  name: string;
  /** Omit to create a supported anonymous company. */
  ownerId?: string;
}

export interface CompanyUpdateInput {
  currentWeek?: number;
  currentSeason?: Season;
  currentYear?: number;
  money?: number;
  prestige?: number;
  startingCountry?: string;
}

export interface CompanyStats {
  totalCompanies: number;
  totalGold: number;
  totalValue: number;
  avgWeeks: number;
}

export type CompanyOperationResult = { success: boolean; error?: string };
export type CompanyCreateResult = CompanyOperationResult & { company?: Company };

export interface CompanyFeature {
  records: {
    create(input: CompanyCreateInput): Promise<CompanyCreateResult>;
    get(companyId: string): Promise<Company | null>;
    getByName(name: string): Promise<Company | null>;
    listForOwner(ownerId: string): Promise<Company[]>;
    listAll(limit?: number): Promise<Company[]>;
    update(companyId: string, updates: CompanyUpdateInput): Promise<CompanyOperationResult>;
    remove(companyId: string): Promise<CompanyOperationResult>;
    getStatsForOwner(ownerId?: string): Promise<CompanyStats>;
    getStatsForCompany(company: Company): Promise<CompanyStats>;
  };
}
