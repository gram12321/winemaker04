import { WineBatch, Activity } from '@/lib/types/types';
import { calculateTotalWork, WorkFactor } from './workCalculator';
import { TASK_RATES, INITIAL_WORK } from '@/lib/constants/activityConstants';
import { WorkCategory } from '@/lib/services/activity';
import { getCrushingMethodInfo, CrushingOptions, modifyCrushingCharacteristics } from '@/lib/services/wine/characteristics/crushingCharacteristics';
import { updateWineBatch } from '@/lib/database/activities/inventoryDB';
import { loadWineBatches } from '@/lib/database/activities/inventoryDB';
import { addTransaction } from '@/lib/services';
import { processEventTrigger } from '@/lib/services/wine/features/featureService';

/**
 * Calculate work required for crushing wine batches
 */
export function calculateCrushingWork(
  batch: WineBatch,
  options: CrushingOptions
): { totalWork: number; factors: WorkFactor[]; cost: number } {
  
  // Convert kg to tons for work calculation
  const tons = batch.quantity / 1000;
  
  const category = WorkCategory.CRUSHING;
  const rate = TASK_RATES[category];
  const initialWork = INITIAL_WORK[category];
  
  // Get method information
  const methodInfo = getCrushingMethodInfo();
  const methodData = methodInfo[options.method];
  
  // Calculate base work modifiers
  const workModifiers: number[] = [];
  
  // Method work modifier
  const methodModifier = methodData.workMultiplier - 1; // Convert to modifier
  if (methodModifier !== 0) {
    workModifiers.push(methodModifier);
  }
  
  // Destemming adds work
  if (options.destemming) {
    workModifiers.push(0.2); // 20% more work
  }
  
  // Cold soak adds preparation work
  if (options.coldSoak) {
    workModifiers.push(0.15); // 15% more work
  }
  
  // Calculate total work
  const totalWork = calculateTotalWork(tons, {
    rate,
    initialWork,
    workModifiers
  });
  
  // Calculate cost
  const cost = methodData.costPenalty;
  
  // Build factors for display
  const factors: WorkFactor[] = [
    { label: 'Grape Quantity', value: batch.quantity, unit: 'kg', isPrimary: true },
    { label: 'Processing Volume', value: tons, unit: 'tons', isPrimary: true },
    { label: 'Base Crushing Rate', value: rate, unit: 'tons/week' },
    { label: 'Initial Setup Work', value: initialWork, unit: 'work units' }
  ];
  
  // Add method factor
  factors.push({
    label: 'Crushing Method',
    value: options.method,
    modifier: methodModifier !== 0 ? methodModifier : undefined,
    modifierLabel: methodModifier > 0 ? 'more work' : methodModifier < 0 ? 'less work' : undefined
  });
  
  // Add optional process factors
  if (options.destemming) {
    factors.push({
      label: 'Destemming Process',
      value: 'Enabled',
      modifier: 0.2,
      modifierLabel: 'stem removal'
    });
  }
  
  if (options.coldSoak) {
    factors.push({
      label: 'Cold Soak Preparation',
      value: 'Enabled',
      modifier: 0.15,
      modifierLabel: 'pre-fermentation soak'
    });
  }
  
  // Add cost if applicable
  if (cost > 0) {
    factors.push({
      label: 'Equipment/Maintenance Cost',
      value: cost,
      unit: '€',
      isPrimary: false
    });
  }
  
  return { totalWork, factors, cost };
}

/**
 * Validate if crushing is possible for a batch
 */
export function validateCrushingBatch(batch: WineBatch): { valid: boolean; reason?: string } {
  if (batch.state !== 'grapes') {
    return { valid: false, reason: 'Batch must be in grapes stage for crushing' };
  }
  
  if (batch.quantity <= 0) {
    return { valid: false, reason: 'Batch must have grapes to crush' };
  }

  return { valid: true };
}

/**
 * Complete crushing activity - update batch characteristics and stage
 */
export async function completeCrushing(activity: Activity): Promise<void> {
  try {
    const { batchId, crushingOptions, cost } = activity.params;
    
    if (!batchId || !crushingOptions) {
      console.error('Missing crushing parameters');
      return;
    }

    // Get the current batch
    const batches = await loadWineBatches();
    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      console.error(`Wine batch ${batchId} not found`);
      return;
    }

    // Apply crushing effects to characteristics and get breakdown
    const { 
      characteristics: modifiedCharacteristics, 
      breakdown: crushingBreakdown,
      yieldMultiplier,
      qualityPenalty
    } = modifyCrushingCharacteristics({
      baseCharacteristics: batch.characteristics,
      ...crushingOptions as CrushingOptions
    });

    // Apply yield multiplier to batch quantity
    const finalQuantity = Math.round(batch.quantity * yieldMultiplier);
    
    // Apply direct quality penalty (if any)
    const finalQuality = Math.max(0, Math.min(1, batch.grapeQuality + qualityPenalty));

    // Note: Special features were removed for this iteration

    // Combine existing breakdown with new crushing breakdown
    const combinedBreakdown = {
      effects: [
        ...(batch.breakdown?.effects || []),
        ...crushingBreakdown.effects
      ]
    };

    // Process crushing event triggers (e.g., green flavor, oxidation from fragile grapes)
    const updatedBatch = { ...batch, characteristics: modifiedCharacteristics, breakdown: combinedBreakdown, grapeQuality: finalQuality };
    const batchWithEventFeatures = await processEventTrigger(
      updatedBatch,
      'crushing',
      { options: crushingOptions, batch: updatedBatch }  // Pass context with options and batch for event triggers
    );

    // Update the batch: change state to 'must_ready' and apply new characteristics, breakdown, features, quantity, and grapeQuality
    await updateWineBatch(batchId, {
      state: 'must_ready',
      characteristics: modifiedCharacteristics,
      breakdown: combinedBreakdown,
      features: batchWithEventFeatures.features,
      quantity: finalQuantity,
      grapeQuality: finalQuality
    });

    // Deduct costs if any
    if (cost && cost > 0) {
      await addTransaction(
        -cost, // Negative for expense
        `Crushing equipment/maintenance costs for ${crushingOptions.method}`,
        'processing'
      );
    }

  } catch (error) {
    console.error('Error completing crushing activity:', error);
  }
}
