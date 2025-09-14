// Company utility functions to reduce code duplication
import { getCurrentCompany } from '../services/gameState';
import { GAME_INITIALIZATION } from '../constants';

// Use the constant from game initialization
export const DEFAULT_COMPANY_ID = GAME_INITIALIZATION.DEFAULT_COMPANY_ID;

/**
 * Get current company ID with fallback
 * Centralizes the extremely common pattern of getCurrentCompany()?.id || fallback
 */
export function getCurrentCompanyId(): string {
  const currentCompany = getCurrentCompany();
  return currentCompany?.id || DEFAULT_COMPANY_ID;
}
