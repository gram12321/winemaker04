import type { ReactElement } from 'react';

/** The only information a host application needs to render the admin feature. */
export interface AdminPageProps {
  onBack: () => void;
  onNavigateToLogin: () => void;
}

/**
 * Host-facing Admin seam. Commands and Test Lab dependencies intentionally stay
 * inside the active implementation.
 */
export interface AdminFeature {
  isAvailable(): boolean;
  renderPage(props: AdminPageProps): ReactElement | null;
}
