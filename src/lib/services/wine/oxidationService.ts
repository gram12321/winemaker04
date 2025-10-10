import { WineBatch } from '../../types/types';
import { BASE_OXIDATION_RATE, OXIDATION_STATE_MULTIPLIERS, OXIDATION_WARNING_THRESHOLDS } from '../../constants/oxidationConstants';
import { loadWineBatches, updateWineBatch } from '../../database/activities/inventoryDB';
import { notificationService } from '../../../components/layout/NotificationCenter';

/**
 * Calculate weekly oxidation risk increase for a batch
 * Formula: BASE_RATE × proneToOxidation × stateMultiplier × (1 + currentOxidation)
 * 
 * @param batch - Wine batch to calculate for
 * @returns Risk increase amount (0-1 scale)
 */
export function calculateOxidationRiskIncrease(batch: WineBatch): number {
  // Get state multiplier for current batch state
  const stateMultiplier = OXIDATION_STATE_MULTIPLIERS[batch.state];
  
  // Calculate risk increase with compound effect (current risk accelerates growth)
  const riskIncrease = BASE_OXIDATION_RATE 
                      * batch.proneToOxidation 
                      * stateMultiplier 
                      * (1 + batch.oxidation);
  
  return riskIncrease;
}

/**
 * Check if a batch becomes oxidized this tick (random roll)
 * @param batch - Wine batch to check
 * @returns true if oxidation event occurs
 */
export function checkOxidationEvent(batch: WineBatch): boolean {
  // Already oxidized batches can't oxidize again
  if (batch.isOxidized) {
    return false;
  }
  
  // Roll the dice: random value between 0 and 1
  const roll = Math.random();
  
  // If roll is less than oxidation risk, oxidation occurs
  return roll < batch.oxidation;
}

/**
 * Process weekly oxidation for all wine batches
 * Called by game tick system
 * 
 * Returns array of batches that became oxidized this week
 */
export async function processWeeklyOxidation(): Promise<WineBatch[]> {
  try {
    const batches = await loadWineBatches();
    const oxidizedBatches: WineBatch[] = [];
    const riskWarnings: { batch: WineBatch; previousRisk: number; newRisk: number }[] = [];
    
    for (const batch of batches) {
      // Skip already oxidized batches
      if (batch.isOxidized) {
        continue;
      }
      
      // Store previous risk for notification comparison
      const previousRisk = batch.oxidation;
      
      // Step 1: Increase oxidation risk
      const riskIncrease = calculateOxidationRiskIncrease(batch);
      const newRisk = Math.min(1.0, batch.oxidation + riskIncrease);
      
      // Step 2: Check if oxidation event occurs
      const becomesOxidized = checkOxidationEvent(batch);
      
      // Step 3: Update batch
      await updateWineBatch(batch.id, {
        oxidation: newRisk,
        isOxidized: becomesOxidized
      });
      
      // Track oxidized batches for notifications
      if (becomesOxidized) {
        oxidizedBatches.push({ ...batch, oxidation: newRisk, isOxidized: true });
      }
      
      // Track risk threshold crossings for warnings
      if (!becomesOxidized && shouldWarnAboutRisk(previousRisk, newRisk)) {
        riskWarnings.push({ batch, previousRisk, newRisk });
      }
    }
    
    // Send notifications
    await sendOxidationNotifications(oxidizedBatches, riskWarnings);
    
    return oxidizedBatches;
  } catch (error) {
    console.error('Error processing weekly oxidation:', error);
    return [];
  }
}

/**
 * Determine if we should warn about risk level change
 */
function shouldWarnAboutRisk(previousRisk: number, newRisk: number): boolean {
  // Only warn if crossing specific thresholds
  const thresholds = [
    OXIDATION_WARNING_THRESHOLDS.LOW,
    OXIDATION_WARNING_THRESHOLDS.MODERATE,
    OXIDATION_WARNING_THRESHOLDS.HIGH,
    OXIDATION_WARNING_THRESHOLDS.CRITICAL
  ];
  
  // Check if we crossed any threshold
  for (const threshold of thresholds) {
    if (previousRisk < threshold && newRisk >= threshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Send notifications for oxidation events and warnings
 */
async function sendOxidationNotifications(
  oxidizedBatches: WineBatch[],
  riskWarnings: { batch: WineBatch; previousRisk: number; newRisk: number }[]
): Promise<void> {
  // Notify about oxidized batches
  for (const batch of oxidizedBatches) {
    await notificationService.addMessage(
      `Wine Oxidized! ${batch.vineyardName} ${batch.grape} (${batch.state}) became oxidized after reaching ${(batch.oxidation * 100).toFixed(1)}% risk.`,
      'wine.oxidized',
      'Wine Oxidized',
      'Wine Production'
    );
  }
  
  // Notify about risk warnings (batch up to 3 warnings max)
  const warningsToShow = riskWarnings.slice(0, 3);
  
  for (const { batch, newRisk } of warningsToShow) {
    const riskPercent = (newRisk * 100).toFixed(1);
    
    if (newRisk >= OXIDATION_WARNING_THRESHOLDS.CRITICAL) {
      await notificationService.addMessage(`Critical Oxidation Risk! ${batch.vineyardName} ${batch.grape} has ${riskPercent}% oxidation risk (${batch.state}). Process immediately!`, 'wine.oxidationRisk', 'Critical Oxidation Risk', 'Wine Production');
    } else if (newRisk >= OXIDATION_WARNING_THRESHOLDS.HIGH) {
      await notificationService.addMessage(`High Oxidation Risk: ${batch.vineyardName} ${batch.grape} has ${riskPercent}% oxidation risk (${batch.state}). Consider processing soon.`, 'wine.oxidationRisk', 'High Oxidation Risk', 'Wine Production');
    } else if (newRisk >= OXIDATION_WARNING_THRESHOLDS.MODERATE) {
      await notificationService.addMessage(`Moderate Oxidation Risk: ${batch.vineyardName} ${batch.grape} has ${riskPercent}% oxidation risk (${batch.state}).`, 'wine.oxidationRisk', 'Moderate Oxidation Risk', 'Wine Production');
    }
  }
  
  // If more warnings were suppressed, add a summary
  if (riskWarnings.length > 3) {
    await notificationService.addMessage(`Oxidation Warnings: ${riskWarnings.length - 3} more batches have increasing oxidation risk.`, 'wine.oxidationRisk', 'Oxidation Warnings', 'Wine Production');
  }
}

/**
 * Get current oxidation risk for a batch as a percentage string
 * Useful for UI display
 */
export function getOxidationRiskDisplay(batch: WineBatch): string {
  if (batch.isOxidized) {
    return 'Oxidized';
  }
  
  return `${(batch.oxidation * 100).toFixed(1)}% risk`;
}

/**
 * Calculate expected weeks until oxidation (statistical average)
 * This is approximate - actual oxidation is random
 */
export function calculateExpectedWeeksUntilOxidation(batch: WineBatch): number {
  if (batch.isOxidized) {
    return 0;
  }
  
  // Very rough estimate: 1 / risk gives average rolls until event
  // But risk is increasing, so this is just a rough guide
  if (batch.oxidation <= 0) {
    return Infinity;
  }
  
  return Math.ceil(1 / batch.oxidation);
}

