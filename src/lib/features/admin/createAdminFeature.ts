import React from 'react';
import type { AdminFeature } from './featureTypes';
import type { AdminDashboardDependencies } from './internalTypes';
import { AdminDashboard } from './components/AdminDashboard';

export interface AdminFeatureDependencies {
  isAvailable: () => boolean;
  dashboard: AdminDashboardDependencies;
}

/**
 * Constructs the Admin module from host-provided adapters. Winemaker forks can
 * replace the adapter assembly in active.ts without expanding the public seam.
 */
export function createAdminFeature({ isAvailable, dashboard }: AdminFeatureDependencies): AdminFeature {
  return {
    isAvailable,
    renderPage(props) {
      if (!isAvailable()) return null;
      return React.createElement(AdminDashboard, { ...props, ...dashboard });
    }
  };
}
