import type { ResearchProject, UnlockType } from '@/lib/constants/researchConstants';
import { getResearchUpgradeFeature } from '../../index';

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
    return getResearchUpgradeFeature().unlocks.isUnlocked(type, value, companyId);
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
    return getResearchUpgradeFeature().unlocks.getUnlockedItems(type, companyId);
  }

  /**
   * Get the research project required to unlock a specific item
   * @param type - Type of unlock
   * @param value - Value to unlock
   * @returns Research project that unlocks this item, or null if no research required
   */
  getRequiredResearch(type: UnlockType, value: string | number): ResearchProject | null {
    return getResearchUpgradeFeature().unlocks.getRequiredResearch(type, value);
  }

  /**
   * Get user-friendly error message for a locked item
   * @param type - Type of unlock
   * @param value - Value that is locked
   * @returns User-friendly error message
   */
  getLockedMessage(type: UnlockType, value: string | number): string {
    return getResearchUpgradeFeature().unlocks.getLockedMessage(type, value);
  }
}

export const researchEnforcer = new ResearchEnforcerService();
export { ResearchEnforcerService };
