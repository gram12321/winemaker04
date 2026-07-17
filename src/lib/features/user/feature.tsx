import { createElement, lazy, Suspense, type ReactNode } from 'react';
import type { UserFeature } from './featureTypes';
import { getCompanyPreferences, setToastNotifications } from './services/companyPreferencesService';

const ProfilePage = lazy(() => import('./ui/ProfilePage').then((module) => ({ default: module.Profile })));
const SettingsPage = lazy(() => import('./ui/SettingsPage').then((module) => ({ default: module.Settings })));

function renderFeaturePage(page: ReactNode, label: string) {
  return createElement(
    Suspense,
    { fallback: createElement('div', { className: 'p-6 text-muted-foreground' }, `Loading ${label}...`) },
    page
  );
}

export const userFeature: UserFeature = {
  account: {
    async getCurrentPlayer() {
      const { authService } = await import('./services/authService');
      return authService.getCurrentUser();
    },
    async observeCurrentPlayer(listener) {
      const { authService } = await import('./services/authService');
      return authService.onAuthStateChange(listener);
    },
    async selectPlayer(player) {
      const { authService } = await import('./services/authService');
      authService.selectLocalPlayer(player);
    },
    async endSession() {
      const { authService } = await import('./services/authService');
      const result = await authService.signOut();
      // Local players do not have a Supabase session, so this is required in
      // addition to signOut to make logout meaningful for every player mode.
      authService.selectLocalPlayer(null);
      return result;
    },
    async getPlayer(playerId) {
      const { authService } = await import('./services/authService');
      return authService.getUserProfileById(playerId);
    },
    async createLocalPlayer(name) {
      const { authService } = await import('./services/authService');
      return authService.createLocalUserProfile(name);
    },
    async updateProfile(playerId, updates) {
      const { authService } = await import('./services/authService');
      return authService.updateUserProfileById(playerId, updates);
    },
    async deleteProfile(playerId) {
      const { authService } = await import('./services/authService');
      return authService.getCurrentUser()?.id === playerId
        ? authService.deleteAccount()
        : authService.deleteUserProfileById(playerId);
    },
  },
  wallet: {
    async getBalance(playerId) {
      const { getPlayerBalance } = await import('./services/userBalanceService');
      return getPlayerBalance(playerId);
    },
    async applyChange(playerId, amount) {
      const { updatePlayerBalance } = await import('./services/userBalanceService');
      return updatePlayerBalance(amount, playerId);
    },
    async setBalance(playerId, amount) {
      const { setPlayerBalance } = await import('./services/userBalanceService');
      return setPlayerBalance(amount, playerId);
    },
  },
  preferences: {
    getForCompany: getCompanyPreferences,
    setToastEnabled: setToastNotifications,
  },
  ui: {
    renderProfilePage: (input) => renderFeaturePage(createElement(ProfilePage, input), 'profile'),
    renderSettingsPage: (input) => renderFeaturePage(createElement(SettingsPage, input), 'settings'),
  },
};
