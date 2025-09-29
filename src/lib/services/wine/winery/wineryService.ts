// WineryService. Holds Validations and helpers for @winery.tsx
import { WineBatch } from '../../../types/types';
import { isFermentationActionAvailable } from './fermentationManager';

// ===== Helper Functions =====

// Check if action is available for a batch
export function isActionAvailable(batch: WineBatch, action: 'crush' | 'ferment' | 'stop' | 'bottle'): boolean {
  switch (action) {
    case 'crush':
      return batch.stage === 'grapes';
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
  if (batch.process === 'fermentation') {
    return `Fermenting (${batch.fermentationProgress || 0}%)`;
  }
  
  if (batch.process === 'bottled') {
    return `Completed - ${batch.quantity} bottles`;
  }
  
  const stageMap = {
    grapes: 'Grapes ready for crushing',
    must: batch.process === 'none' ? 'Must ready for fermentation' : 'Must processing',
    wine: batch.process === 'aging' ? 'Wine aging, ready for bottling' : 'Wine processing',
    bottled: `Bottled - ${batch.quantity} bottles`
  };
  
  return stageMap[batch.stage] || 'Processing';
}

// Get next available action for batch (used in @winery.tsx)  
export function getNextAction(batch: WineBatch): string | null {
  if (isActionAvailable(batch, 'crush')) return 'crush';
  if (isActionAvailable(batch, 'ferment')) return 'ferment';
  if (isActionAvailable(batch, 'stop')) return 'stop';
  if (isActionAvailable(batch, 'bottle')) return 'bottle';
  return null;
}
