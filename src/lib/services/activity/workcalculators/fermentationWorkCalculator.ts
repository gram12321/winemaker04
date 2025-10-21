// Fermentation Work Calculator
// Calculates work required for starting fermentation and handles completion

import { WineBatch, Activity } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/services/activity';
import { getFermentationMethodInfo, getFermentationTemperatureInfo, FermentationOptions } from '@/lib/services/wine/characteristics/fermentationCharacteristics';
import { updateWineBatch } from '@/lib/database/activities/inventoryDB';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import { addTransaction } from '@/lib/services';
import { processEventTrigger } from '@/lib/services/wine/features/featureRiskService';

/**
 * Calculate work required for fermentation setup
 */
export function calculateFermentationWork(
  batch: WineBatch,
  options: FermentationOptions
): { totalWork: number; factors: WorkFactor[]; cost: number } {
  
  // Convert kg to tons for work calculation
  const tons = batch.quantity / 1000;
  
  const category = WorkCategory.FERMENTATION;
  const rate = TASK_RATES[category];
  const initialWork = INITIAL_WORK[category];
  
  // Get method and temperature information
  const methodInfo = getFermentationMethodInfo();
  const temperatureInfo = getFermentationTemperatureInfo();
  const methodData = methodInfo[options.method];
  const temperatureData = temperatureInfo[options.temperature];
  
  // Calculate base work modifiers
  const workModifiers: number[] = [];
  
  // Method work modifier
  const methodModifier = methodData.workMultiplier - 1; // Convert to modifier
  if (methodModifier !== 0) {
    workModifiers.push(methodModifier);
  }
  
  // Calculate total work
  const totalWork = calculateTotalWork(tons, {
    rate,
    initialWork,
    workModifiers
  });
  
  // Calculate total cost (method cost + temperature cost)
  const cost = methodData.costPenalty + temperatureData.costModifier;
  
  // Build factors for display
  const factors: WorkFactor[] = [
    { label: 'Must Quantity', value: batch.quantity, unit: 'kg', isPrimary: true },
    { label: 'Processing Volume', value: tons, unit: 'tons', isPrimary: true },
    { label: 'Base Fermentation Rate', value: rate, unit: 'tons/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];
  
  // Add method factor
  factors.push({
    label: 'Fermentation Method',
    value: options.method,
    modifier: methodModifier !== 0 ? methodModifier : undefined,
    modifierLabel: methodModifier > 0 ? 'setup complexity' : methodModifier < 0 ? 'simplified setup' : undefined
  });
  
  // Add temperature factor (informational)
  factors.push({
    label: 'Temperature Control',
    value: options.temperature,
    isPrimary: false
  });
  
  // Add costs if applicable
  if (methodData.costPenalty > 0) {
    factors.push({
      label: 'Method Equipment Cost',
      value: methodData.costPenalty,
      unit: '€',
      isPrimary: false
    });
  }
  
  if (temperatureData.costModifier > 0) {
    factors.push({
      label: 'Temperature Control Cost',
      value: temperatureData.costModifier,
      unit: '€',
      isPrimary: false
    });
  }
  
  return { totalWork, factors, cost };
}

/**
 * Validate if fermentation is possible for a batch
 */
export function validateFermentationBatch(batch: WineBatch): { valid: boolean; reason?: string } {
  if (batch.state !== 'must_ready') {
    return { valid: false, reason: 'Batch must be in must_ready stage for fermentation' };
  }
  
  if (batch.quantity <= 0) {
    return { valid: false, reason: 'Batch must have must to ferment' };
  }

  return { valid: true };
}

/**
 * Complete fermentation setup activity - update batch state to fermenting
 */
export async function completeFermentationSetup(activity: Activity): Promise<void> {
  try {
    const { batchId, fermentationOptions, cost } = activity.params;
    
    if (!batchId || !fermentationOptions) {
      console.error('Missing fermentation parameters');
      return;
    }

    // Get the current batch
    const batches = await loadWineBatches();
    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      console.error(`Wine batch ${batchId} not found`);
      return;
    }

    // Process fermentation event triggers (e.g., stuck fermentation risk)
    const updatedBatch = {
      ...batch,
      state: 'must_fermenting' as const,
      fermentationOptions: fermentationOptions as FermentationOptions
    };
    const batchWithEventFeatures = await processEventTrigger(
      updatedBatch,
      'fermentation',
      { options: fermentationOptions, batch: updatedBatch }  // Pass context with options and batch
    );

    // Update the batch: change state to 'must_fermenting', store fermentation options, and update features
    await updateWineBatch(batchId, {
      state: 'must_fermenting',
      fermentationOptions: fermentationOptions as FermentationOptions,
      features: batchWithEventFeatures.features
    });

    // Deduct costs if any
    if (cost && cost > 0) {
      await addTransaction(
        -cost, // Negative for expense
        `Fermentation setup costs for ${fermentationOptions.method} at ${fermentationOptions.temperature}`,
        'processing'
      );
    }

  } catch (error) {
    console.error('Error completing fermentation setup activity:', error);
  }
}
