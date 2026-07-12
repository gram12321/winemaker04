import type { AdminFeature } from './featureTypes';

export const noAdminFeature: AdminFeature = {
  isAvailable() {
    return false;
  },
  renderPage() {
    return null;
  }
};
