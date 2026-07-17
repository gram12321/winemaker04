import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerProfilePageInput } from '@/lib/features/user';

vi.mock('@/lib/features/user/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(() => null),
    onAuthStateChange: vi.fn(() => () => undefined),
    selectLocalPlayer: vi.fn(),
    getUserProfileById: vi.fn(async () => null),
    createLocalUserProfile: vi.fn(),
    updateUserProfileById: vi.fn(),
    deleteAccount: vi.fn(),
    deleteUserProfileById: vi.fn(),
  },
}));

vi.mock('@/lib/features/user/services/userBalanceService', () => ({
  getPlayerBalance: vi.fn(async () => 0),
  updatePlayerBalance: vi.fn(),
  setPlayerBalance: vi.fn(),
}));

const profileInput: PlayerProfilePageInput = {
  currentCompany: null,
  portfolio: {
    getCompaniesForPlayer: vi.fn(async () => []),
    getStatsForPlayer: vi.fn(async () => ({ totalCompanies: 0, totalGold: 0, totalValue: 0, avgWeeks: 0 })),
    getStatsForCompany: vi.fn(async () => ({ totalCompanies: 1, totalGold: 0, totalValue: 0, avgWeeks: 1 })),
  },
  onCompanySelected: vi.fn(),
  onBackToLogin: vi.fn(),
};

describe('userFeature', () => {
  it('exposes the account facade without requiring consumers to import internal services', async () => {
    const { userFeature } = await import('@/lib/features/user');

    expect(Object.keys(userFeature).sort()).toEqual(['account', 'preferences', 'ui', 'wallet']);
    expect(userFeature.account.getCurrentPlayer).toBeTypeOf('function');
    expect(userFeature.wallet.getBalance).toBeTypeOf('function');
    expect(userFeature.preferences.setToastEnabled).toBeTypeOf('function');
    expect(userFeature.ui.renderProfilePage).toBeTypeOf('function');
    expect(userFeature.ui.renderSettingsPage).toBeTypeOf('function');
  });

  it('contains lazy feature pages in a Suspense boundary', async () => {
    const { userFeature } = await import('@/lib/features/user');

    expect(userFeature.ui.renderProfilePage(profileInput).type).toBe(Suspense);
    expect(userFeature.ui.renderSettingsPage({
      currentCompany: null,
      notificationFilters: {
        getAll: vi.fn(() => []),
        remove: vi.fn(),
        clear: vi.fn(),
        setHistoryBlocked: vi.fn(),
      },
    }).type).toBe(Suspense);
  });
});
