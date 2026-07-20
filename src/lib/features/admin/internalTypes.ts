import type { ReactElement } from 'react';
import type { Activity, Season, Staff, Vineyard } from '@/lib/types/types';
import type {
  TestLabRunRequest,
  TestLabScenarioDefinition,
  TestLabScenarioResult
} from './services/testLab/types';

export interface AdminDatabaseOps {
  clearAllHighscores(): Promise<{ success: boolean; message?: string }>;
  clearCompanyValueHighscores(): Promise<{ success: boolean; message?: string }>;
  clearCompanyValuePerWeekHighscores(): Promise<{ success: boolean; message?: string }>;
  clearAllCompanies(): Promise<void>;
  clearAllUsers(): Promise<void>;
  clearAllCompaniesAndUsers(): Promise<void>;
  recreateCustomers(): Promise<void>;
  clearAllAchievements(): Promise<void>;
  fullDatabaseReset(): Promise<void>;
  clearGlobalMarket(): Promise<void>;
  clearGlobalMarketGoods(goods: 'grapes' | 'storage_vessels'): Promise<void>;
}

export interface AdminCheatOps {
  setGoldToCompany(amount: number): Promise<void>;
  setPlayerBalance(amount: number, userIdOverride?: string): Promise<{ success: boolean; message?: string; error?: string }>;
  addPrestigeToCompany(amount: number): Promise<void>;
  setGameDate(payload: { week: number; season: Season; year: number }): Promise<void>;
  grantAllResearch(): Promise<{ success: boolean; unlocked: number; alreadyUnlocked: number }>;
  removeAllResearch(): Promise<{ success: boolean; removed: number }>;
  generateTestOrders(): Promise<{ totalOrdersCreated: number; customersGenerated: number }>;
  generateTestContract(): Promise<{ success: boolean; message: string }>;
  generateTestBottlePresaleContract(): Promise<{ success: boolean; message: string }>;
  generateTestForwardPresaleContract(): Promise<{ success: boolean; message: string }>;
  recreateBuyGrapeMarketOffers(): Promise<void>;
  recreateStorageVesselMarketOffers(): Promise<void>;
}

export interface AdminStaffXpOps {
  setStaffXP(staffId: string, category: string, amount: number): Promise<{ success: boolean; message?: string; error?: string }>;
}

export type AdminTestLabOperations = AdminCheatOps & AdminStaffXpOps;

export interface AdminTestLabDynamicOptions {
  vineyards: Vineyard[];
  staff: Staff[];
  activities: Activity[];
}

export interface AdminTestLab {
  getScenarios(): TestLabScenarioDefinition[];
  loadDynamicOptions(): Promise<AdminTestLabDynamicOptions>;
  runScenario(request: TestLabRunRequest): Promise<TestLabScenarioResult>;
}

export interface AdminDashboardDependencies {
  database: AdminDatabaseOps;
  cheats: AdminCheatOps;
  testLab: AdminTestLab;
  renderResearchInspector: () => ReactElement;
}
