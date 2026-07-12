import type { AdminFeature } from './featureTypes';
import { noAdminFeature } from './noop';

export type { AdminFeature, AdminPageProps } from './featureTypes';

let adminFeature: AdminFeature = noAdminFeature;

export function configureAdminFeature(feature: AdminFeature): void {
  adminFeature = feature;
}

export function getAdminFeature(): AdminFeature {
  return adminFeature;
}
