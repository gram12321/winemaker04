import { type ResearchPermanentEffectsSummary } from './researchPermanentEffectsService';

export interface ResearchViewSummary {
  hasEffects: boolean;
  healthDecayReductionPercent: number;
  researchSkillBoostPercent: number;
}

export function getResearchViewSummary(activeBonuses: ResearchPermanentEffectsSummary): ResearchViewSummary {
  const hasEffects = activeBonuses.activeEffects.length > 0;
  const healthDecayReductionPercent = Math.max(0, (1 - activeBonuses.vineyardHealthDecayMultiplier) * 100);
  const researchSkillBoostPercent = Math.max(0, (activeBonuses.researchSkillMultiplier - 1) * 100);

  return {
    hasEffects,
    healthDecayReductionPercent,
    researchSkillBoostPercent,
  };
}
