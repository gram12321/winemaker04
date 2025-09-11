// Wine filtering utilities - shared logic for common wine batch operations
import { WineBatch } from '../types';

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
