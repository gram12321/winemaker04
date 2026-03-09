import type { ResearchUpgradeFeature } from './featureTypes';
import { noResearchUpgradeFeature } from './noop';

let researchUpgradeFeature: ResearchUpgradeFeature = noResearchUpgradeFeature;

export function configureResearchUpgradeFeature(feature: ResearchUpgradeFeature): void {
  researchUpgradeFeature = feature;
}

export function getResearchUpgradeFeature(): ResearchUpgradeFeature {
  return researchUpgradeFeature;
}
