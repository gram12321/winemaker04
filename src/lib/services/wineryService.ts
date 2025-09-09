// Winery operations service for wine production
import { WineBatch } from '../types';
import { updateWineBatch, getAllWineBatches } from './wineBatchService';
import { getGameState } from '../gameState';

// ===== WINERY ACTIONS =====

// Crushing: Convert grapes to must
export async function crushGrapes(batchId: string): Promise<boolean> {
  const batches = await getAllWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.stage !== 'grapes') {
    return false;
  }

  return await updateWineBatch(batchId, {
    stage: 'must'
    // process stays 'none'
  });
}

// Start Fermentation: Begin fermentation process
export async function startFermentation(batchId: string): Promise<boolean> {
  const batches = await getAllWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.stage !== 'must' || batch.process !== 'none') {
    return false;
  }

  return await updateWineBatch(batchId, {
    process: 'fermentation',
    fermentationProgress: 0
  });
}

// Stop Fermentation: Complete fermentation and move to aging
export async function stopFermentation(batchId: string): Promise<boolean> {
  const batches = await getAllWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.process !== 'fermentation') {
    return false;
  }

  return await updateWineBatch(batchId, {
    stage: 'wine',
    process: 'aging',
    fermentationProgress: 100
  });
}

// Bottling: Complete wine production
export async function bottleWine(batchId: string): Promise<boolean> {
  const batches = await getAllWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.process !== 'aging') {
    return false;
  }

  const gameState = getGameState();
  
  return await updateWineBatch(batchId, {
    stage: 'bottled',
    process: 'bottled',
    quantity: Math.floor(batch.quantity / 1.5), // Convert kg to bottles (1.5kg per bottle)
    completedAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    }
  });
}

// Progress Fermentation: Simulate fermentation progress over time
export async function progressFermentation(batchId: string, progressIncrement: number = 10): Promise<boolean> {
  const batches = await getAllWineBatches();
  const batch = batches.find(b => b.id === batchId);
  
  if (!batch || batch.process !== 'fermentation') {
    return false;
  }

  const newProgress = Math.min(100, (batch.fermentationProgress || 0) + progressIncrement);
  
  // Auto-complete fermentation at 100%
  if (newProgress >= 100) {
    return await stopFermentation(batchId);
  }

  return await updateWineBatch(batchId, {
    fermentationProgress: newProgress
  });
}

// ===== HELPER FUNCTIONS =====

// Check if action is available for a batch
export function isActionAvailable(batch: WineBatch, action: 'crush' | 'ferment' | 'stop' | 'bottle'): boolean {
  switch (action) {
    case 'crush':
      return batch.stage === 'grapes';
    case 'ferment':
      return batch.stage === 'must' && batch.process === 'none';
    case 'stop':
      return batch.process === 'fermentation' && (batch.fermentationProgress || 0) > 0;
    case 'bottle':
      return batch.process === 'aging';
    default:
      return false;
  }
}

// Get display status for batch
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

// Get next available action for batch
export function getNextAction(batch: WineBatch): string | null {
  if (isActionAvailable(batch, 'crush')) return 'crush';
  if (isActionAvailable(batch, 'ferment')) return 'ferment';
  if (isActionAvailable(batch, 'stop')) return 'stop';
  if (isActionAvailable(batch, 'bottle')) return 'bottle';
  return null;
}
