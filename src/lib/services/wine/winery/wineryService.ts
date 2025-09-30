// WineryService. Holds Validations and helpers for @winery.tsx
import { WineBatch, WorkCategory } from '../../../types/types';
import { isFermentationActionAvailable } from './fermentationManager';
import { getGameState } from '../../core/gameState';

// ===== Helper Functions =====

// Check if action is available for a batch
export function isActionAvailable(batch: WineBatch, action: 'crush' | 'ferment' | 'bottle'): boolean {
  switch (action) {
    case 'crush':
      if (batch.state !== 'grapes') return false;
      // Block if there's an active crushing activity targeting this vineyard
      const state = getGameState();
      const activities = state.activities || [];
      const hasActiveCrushingForVineyard = activities.some(a => 
        a.category === WorkCategory.CRUSHING && 
        a.status === 'active' && 
        a.targetId === batch.vineyardId
      );
      return !hasActiveCrushingForVineyard;
    case 'ferment':
    case 'bottle':
      return isFermentationActionAvailable(batch, action);
    default:
      return false;
  }
}

// Get display status for batch (used in @winery.tsx)
export function getBatchStatus(batch: WineBatch): string {
  switch (batch.state) {
    case 'grapes':
      return 'Grapes ready for crushing';
    case 'must_ready':
      return 'Must ready for fermentation';
    case 'must_fermenting':
      return 'Currently fermenting';
    case 'bottled':
      return `Completed - ${batch.quantity} bottles`;
    default:
      return 'Processing';
  }
}

// Get next available action for batch (used in @winery.tsx)  
export function getNextAction(batch: WineBatch): string | null {
  if (isActionAvailable(batch, 'crush')) return 'crush';
  if (isActionAvailable(batch, 'ferment')) return 'ferment';
  if (isActionAvailable(batch, 'bottle')) return 'bottle';
  return null;
}
