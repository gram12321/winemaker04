// Wine filtering utilities - shared logic for common wine batch operations
import { WineBatch, Customer } from '../types';
import { calculateRelationshipBreakdown, formatRelationshipBreakdown } from '../database/relationshipBreakdownService';

/**
 * Filter wine batches to only bottled wines with quantity > 0
 * This is a common operation used across order generation and customer acquisition
 * 
 * @param batches - Array of wine batches to filter
 * @returns Array of bottled wines with inventory
 */
export function getAvailableBottledWines(batches: WineBatch[]): WineBatch[] {
  return batches.filter(batch => 
    batch.stage === 'bottled' && 
    batch.process === 'bottled' && 
    batch.quantity > 0
  );
}

/**
 * Load and format relationship breakdown for UI display
 * Handles the common pattern used in Sales.tsx and Winepedia.tsx
 */
export async function loadFormattedRelationshipBreakdown(customer: Customer): Promise<string> {
  try {
    const breakdown = await calculateRelationshipBreakdown(customer);
    return formatRelationshipBreakdown(breakdown);
  } catch (error) {
    console.error('Error loading relationship breakdown:', error);
    return 'Failed to load relationship breakdown';
  }
}
