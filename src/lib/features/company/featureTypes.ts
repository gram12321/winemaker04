import type { ReactElement } from 'react';
import type { Season } from '@/lib/types/types';

/**
 * Stable company representation exposed to other features and the app host.
 * Database row names deliberately do not cross this boundary.
 */
export interface CompanyRecord {
  id: string;
  name: string;
  /** Undefined is a supported anonymous-company mode. */
  ownerId?: string;
  foundedYear: number;
  currentWeek: number;
  currentSeason: Season;
  currentYear: number;
  money: number;
  prestige: number;
  startingCountry?: string;
  lastPlayed: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
export type CompanyCreateResult = CompanyOperationResult & { company?: CompanyRecord };

/** Host callbacks keep account creation and game-session activation outside this feature. */
export interface CompanyGatewayInput {
  companies: CompanyRecord[];
  unownedCompanies: CompanyRecord[];
  showUnownedCompanies: boolean;
  currentOwnerId?: string;
  isLoading?: boolean;
  onCompanySelected(company: CompanyRecord): void;
  onCompanyCreated(input: { name: string; createPlayerName?: string }): Promise<CompanyCreateResult>;
  onCompanyDeleted(companyId: string): Promise<CompanyOperationResult>;
}

export interface CompanyFeature {
  records: {
    create(input: CompanyCreateInput): Promise<CompanyCreateResult>;
    get(companyId: string): Promise<CompanyRecord | null>;
    getByName(name: string): Promise<CompanyRecord | null>;
    listForOwner(ownerId: string): Promise<CompanyRecord[]>;
    listAll(limit?: number): Promise<CompanyRecord[]>;
    update(companyId: string, updates: CompanyUpdateInput): Promise<CompanyOperationResult>;
    remove(companyId: string): Promise<CompanyOperationResult>;
    getStatsForOwner(ownerId: string): Promise<CompanyStats>;
    getStatsForCompany(company: CompanyRecord): Promise<CompanyStats>;
  };
  ui: {
    renderGateway(input: CompanyGatewayInput): ReactElement;
  };
}
