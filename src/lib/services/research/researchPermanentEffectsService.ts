import { RESEARCH_PROJECTS, type ResearchPermanentEffect } from '@/lib/constants/researchConstants';
import { getUnlockedResearchIds } from '@/lib/database/core/researchUnlocksDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

export interface ResearchPermanentEffectEntry {
  projectId: string;
  projectTitle: string;
  description: string;
  kind: ResearchPermanentEffect['kind'];
}

export interface ResearchPermanentEffectsSummary {
  vineyardHealthDecayMultiplier: number;
  activeEffects: ResearchPermanentEffectEntry[];
}

function applyPermanentEffect(
  current: ResearchPermanentEffectsSummary,
  effect: ResearchPermanentEffect
): ResearchPermanentEffectsSummary {
  switch (effect.kind) {
    case 'vineyard_health_decay_multiplier': {
      // Multiplicative stacking allows independent effects to compose predictably.
      const multiplier = Number.isFinite(effect.multiplier) ? effect.multiplier : 1;
      return {
        ...current,
        vineyardHealthDecayMultiplier: Math.max(0.1, current.vineyardHealthDecayMultiplier * multiplier)
      };
    }
    default:
      return current;
  }
}

export async function getResearchPermanentEffects(companyId?: string): Promise<ResearchPermanentEffectsSummary> {
  const targetCompanyId = companyId || getCurrentCompanyId();
  const completedResearchIds = new Set(await getUnlockedResearchIds(targetCompanyId || undefined));

  let summary: ResearchPermanentEffectsSummary = {
    vineyardHealthDecayMultiplier: 1,
    activeEffects: []
  };

  for (const project of RESEARCH_PROJECTS) {
    if (!completedResearchIds.has(project.id)) continue;
    if (!project.permanentEffects?.length) continue;

    for (const effect of project.permanentEffects) {
      summary = applyPermanentEffect(summary, effect);
      summary.activeEffects.push({
        projectId: project.id,
        projectTitle: project.title,
        description: effect.description || 'Permanent research effect',
        kind: effect.kind
      });
    }
  }

  return summary;
}
