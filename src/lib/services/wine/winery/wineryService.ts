// WineryService. Holds Validations and helpers for @winery.tsx
import { WineBatch } from '../../../types/types';
import { isFermentationActionAvailable } from './fermentationManager';

// ===== Helper Functions =====

// Check if action is available for a batch
export function isActionAvailable(batch: WineBatch, action: 'crush' | 'ferment' | 'stop' | 'bottle'): boolean {
  switch (action) {
    case 'crush':
      return batch.state === 'grapes';
    case 'ferment':
    case 'stop':
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
      return `Fermenting (${batch.fermentationProgress || 0}%)`;
    case 'wine_aging':
      return 'Wine aging, ready for bottling';
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
  if (isActionAvailable(batch, 'stop')) return 'stop';
  if (isActionAvailable(batch, 'bottle')) return 'bottle';
  return null;
}
