import type { Season } from '@/lib/types/types';

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

export interface AdminGate {
  /** True only in development on a loopback host (localhost / 127.0.0.1 / ::1). */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

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
}

export interface AdminCheatOps {
  setGoldToCompany(amount: number): Promise<void>;
  setPlayerBalance(
    amount: number,
    userIdOverride?: string
  ): Promise<{ success: boolean; message?: string; error?: string }>;
  addPrestigeToCompany(amount: number): Promise<void>;
  setGameDate(payload: { week: number; season: Season; year: number }): Promise<void>;
  grantAllResearch(): Promise<{ success: boolean; unlocked: number; alreadyUnlocked: number }>;
  removeAllResearch(): Promise<{ success: boolean; removed: number }>;
  generateTestOrders(): Promise<{ totalOrdersCreated: number; customersGenerated: number }>;
  generateTestContract(): Promise<{ success: boolean; message: string }>;
  generateTestBottlePresaleContract(): Promise<{ success: boolean; message: string }>;
  generateTestForwardPresaleContract(): Promise<{ success: boolean; message: string }>;
  /** Wraps buyGrapeMarketService — admin-only entry point. */
  recreateBuyGrapeMarketOffers(): Promise<void>;
}

export interface AdminStaffOps {
  setStaffXP(
    staffId: string,
    category: string,
    amount: number
  ): Promise<{ success: boolean; message?: string; error?: string }>;
  addStaffXP(
    staffId: string,
    category: string,
    amount: number
  ): Promise<{ success: boolean; message?: string; error?: string }>;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export interface AdminPageProps {
  onBack: () => void;
  onNavigateToLogin: () => void;
}

export interface AdminUI {
  /**
   * Returns the full admin page element, or null when the admin surface
   * is unavailable (production / non-loopback host).
   */
  renderPage(props: AdminPageProps): React.ReactElement | null;
}

// ---------------------------------------------------------------------------
// Feature
// ---------------------------------------------------------------------------

export interface AdminFeature {
  gate: AdminGate;
  database: AdminDatabaseOps;
  cheats: AdminCheatOps;
  staff: AdminStaffOps;
  ui: AdminUI;
}
