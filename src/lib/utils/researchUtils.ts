import { GrapeVariety } from '../types/types';
import { getUnlockedResearchIds } from '../database';
import { RESEARCH_PROJECTS } from '../constants/researchConstants';

/**
 * Get the research ID that unlocks a specific grape variety
 */
export function getGrapeUnlockResearchId(grape: GrapeVariety): string | null {
  const project = RESEARCH_PROJECTS.find(p => 
    p.unlocks?.some(unlock => unlock.type === 'grape' && unlock.value === grape)
  );
  return project?.id || null;
}


/**
 * Get all unlocked grape varieties for the current company
 */
export async function getUnlockedGrapes(companyId?: string): Promise<GrapeVariety[]> {
  const unlockedResearchIds = await getUnlockedResearchIds(companyId);
  const { GRAPE_VARIETIES } = await import('../types/types');
  
  const unlockedGrapes: GrapeVariety[] = [];
  
  for (const grape of GRAPE_VARIETIES) {
    const researchId = getGrapeUnlockResearchId(grape);
    
    // If no research unlocks this grape, it's available by default
    if (!researchId) {
      unlockedGrapes.push(grape);
    } else if (unlockedResearchIds.includes(researchId)) {
      unlockedGrapes.push(grape);
    }
  }
  
  return unlockedGrapes;
}


