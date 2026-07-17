import type { ReactElement } from 'react';
import type { Company } from '@/lib/database';

/** Public player representation. Database row naming stays inside the feature. */
export interface PlayerProfile {
  id: string;
  email?: string;
  name: string;
  avatar?: string;
  avatarColor?: string;
  cashBalance?: number;
  createdAt: Date;
  updatedAt: Date;
}
export type UserOperationResult = { success: boolean; error?: string };
export interface CompanyPreferences { toastNotifications: boolean; }

export interface PlayerCompanyStats {
  totalCompanies: number;
  totalGold: number;
  totalValue: number;
  avgWeeks: number;
}

export interface PlayerPortfolio {
  getCompaniesForPlayer(playerId: string): Promise<Company[]>;
  getStatsForPlayer(playerId: string): Promise<PlayerCompanyStats>;
  getStatsForCompany(company: Company): Promise<PlayerCompanyStats>;
}

export interface PlayerNotificationFilter {
  id: string;
  type: 'origin' | 'category';
  value: string;
  description?: string;
  blockFromHistory?: boolean;
  createdAt: string;
}

export interface PlayerNotificationFilters {
  getAll(): PlayerNotificationFilter[];
  remove(filterId: string): void;
  clear(): void;
  setHistoryBlocked(filterId: string, blocked: boolean): void;
}

export interface UserFeature {
  account: {
    getCurrentPlayer(): Promise<PlayerProfile | null>;
    observeCurrentPlayer(listener: (player: PlayerProfile | null) => void): Promise<() => void>;
    selectPlayer(player: PlayerProfile | null): Promise<void>;
    getPlayer(playerId: string): Promise<PlayerProfile | null>;
    createLocalPlayer(name: string): Promise<{ success: boolean; user?: PlayerProfile; error?: string }>;
    updateProfile(playerId: string, updates: Partial<Pick<PlayerProfile, 'name' | 'avatar' | 'avatarColor'>>): Promise<UserOperationResult>;
    deleteProfile(playerId: string): Promise<UserOperationResult>;
  };
  wallet: {
    getBalance(playerId: string): Promise<number>;
    applyChange(playerId: string, amount: number): Promise<{ success: boolean; newBalance?: number; error?: string }>;
    setBalance(playerId: string, amount: number): Promise<{ success: boolean; newBalance?: number; error?: string }>;
  };
  preferences: {
    getForCompany(companyId: string): CompanyPreferences;
    setToastEnabled(companyId: string, enabled: boolean): void;
  };
  ui: {
    renderProfilePage(input: PlayerProfilePageInput): ReactElement;
    renderSettingsPage(input: PlayerSettingsPageInput): ReactElement;
  };
}

export interface PlayerProfilePageInput {
  currentCompany: Company | null;
  portfolio: PlayerPortfolio;
  onCompanySelected(company: Company): void;
  onBackToLogin(): void;
}

export interface PlayerSettingsPageInput {
  currentCompany: Company | null;
  notificationFilters: PlayerNotificationFilters;
  onBack?: () => void;
  onSignOut?: () => void;
}
