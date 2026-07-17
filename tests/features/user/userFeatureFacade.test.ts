import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/features/user/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(() => null),
    onAuthStateChange: vi.fn(() => () => undefined),
    selectLocalPlayer: vi.fn(),
    getUserProfileById: vi.fn(async () => null),
  },
}));

vi.mock('@/lib/features/user/services/userBalanceService', () => ({
  getPlayerBalance: vi.fn(async () => 0),
}));

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
});
