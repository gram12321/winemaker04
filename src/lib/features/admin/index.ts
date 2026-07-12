import type { AdminFeature } from './featureTypes';
import { noAdminFeature } from './noop';

let adminFeature: AdminFeature = noAdminFeature;

export function configureAdminFeature(feature: AdminFeature): void {
  adminFeature = feature;
}

export function getAdminFeature(): AdminFeature {
  return adminFeature;
}
