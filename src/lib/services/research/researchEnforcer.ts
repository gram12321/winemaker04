import { UnlockType, ResearchProject, RESEARCH_PROJECTS } from '@/lib/constants/researchConstants';
import { getUnlockedResearchIds } from '@/lib/database/core/researchUnlocksDB';
import { getCurrentCompanyId } from '@/lib/utils/companyUtils';

/**
 * Research Enforcer Service
 * Singleton service for checking research unlocks
 */
class ResearchEnforcerService {
  /**
   * Check if a specific unlock is available for a company
   * @param type - Type of unlock (e.g., 'grape', 'contract_type')
   * @param value - Value to check (e.g., 'Pinot Noir', 'premium')
   * @param companyId - Optional company ID (defaults to current company)
   * @returns true if unlocked, false otherwise
   */
  async isUnlocked(
    type: UnlockType,
    value: string | number,
    companyId?: string
  ): Promise<boolean> {
    const targetCompanyId = companyId || getCurrentCompanyId();
    if (!targetCompanyId) return false;

    const unlockedResearchIds = await getUnlockedResearchIds(targetCompanyId);
    const unlockedSet = new Set(unlockedResearchIds);

    const valueKey = String(value);

    for (const project of RESEARCH_PROJECTS) {
      if (!unlockedSet.has(project.id)) continue;
      if (!project.unlocks) continue;

      for (const unlock of project.unlocks) {
        if (unlock.type === type && String(unlock.value) === valueKey) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all unlocked items of a specific type
   * @param type - Type of unlock
   * @param companyId - Optional company ID (defaults to current company)
   * @returns Array of unlocked values (as strings)
   */
  async getUnlockedItems(
    type: UnlockType,
    companyId?: string
  ): Promise<string[]> {
    const targetCompanyId = companyId || getCurrentCompanyId();
    if (!targetCompanyId) return [];

    const unlockedResearchIds = await getUnlockedResearchIds(targetCompanyId);
    const unlockedSet = new Set(unlockedResearchIds);

    const unlockedValues = new Set<string>();

    for (const project of RESEARCH_PROJECTS) {
      if (!unlockedSet.has(project.id)) continue;
      if (!project.unlocks) continue;

      for (const unlock of project.unlocks) {
        if (unlock.type === type) {
          unlockedValues.add(String(unlock.value));
        }
      }
    }

    return Array.from(unlockedValues);
  }

  /**
   * Get the research project required to unlock a specific item
   * @param type - Type of unlock
   * @param value - Value to unlock
   * @returns Research project that unlocks this item, or null if no research required
   */
  getRequiredResearch(type: UnlockType, value: string | number): ResearchProject | null {
    const valueKey = String(value);

    for (const project of RESEARCH_PROJECTS) {
      if (!project.unlocks) continue;

      for (const unlock of project.unlocks) {
        if (unlock.type === type && String(unlock.value) === valueKey) {
          return project;
        }
      }
    }

    return null;
  }

  /**
   * Get user-friendly error message for a locked item
   * @param type - Type of unlock
   * @param value - Value that is locked
   * @returns User-friendly error message
   */
  getLockedMessage(type: UnlockType, value: string | number): string {
    const project = this.getRequiredResearch(type, value);
    const displayName = String(value);

    if (project) {
      return `${displayName} is locked. Complete research: "${project.title}" to unlock it.`;
    }

    const typeLabels: Record<UnlockType, string> = {
      grape: 'grape variety',
      vineyard_size: 'vineyard size',
      fermentation_technology: 'fermentation technology',
      staff_limit: 'staff limit',
      building_type: 'building type',
      wine_feature: 'wine feature',
      contract_type: 'contract type'
    };

    return `${displayName} ${typeLabels[type] || 'item'} is locked. Complete the required research to unlock it.`;
  }
}

export const researchEnforcer = new ResearchEnforcerService();
export { ResearchEnforcerService };
