import { createElement, lazy } from 'react';
import type { UserFeature } from './featureTypes';
import { getCompanyPreferences, setToastNotifications } from './services/companyPreferencesService';

const ProfilePage = lazy(() => import('./ui/ProfilePage').then((module) => ({ default: module.Profile })));
const SettingsPage = lazy(() => import('./ui/SettingsPage').then((module) => ({ default: module.Settings })));

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
    renderProfilePage: (input) => createElement(ProfilePage, input),
    renderSettingsPage: (input) => createElement(SettingsPage, input),
  },
};
