// Contract fulfillment service - handles contract fulfillment, rejection, and expiration
import { WineContract, WineBatch, ContractRequirement, GameDate, Vineyard } from '../../types/types';
import { getContractById, updateContractStatus, getPendingContracts, updateContractProgress } from '../../database/sales/contractDB';
import { getWineBatchById, saveWineBatch } from '../../database/activities/inventoryDB';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { addTransaction } from '../finance/financeService';
import { createRelationshipBoost } from './relationshipService';
import { getGameState, getCurrentPrestige } from '../core/gameState';
import { addSalePrestigeEvent } from '../prestige/prestigeService';
import { triggerGameUpdate, triggerTopicUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { formatCompletedWineName } from '../wine/winery/inventoryService';

// ===== CONTRACT VALIDATION =====

/**
 * Check if a wine batch meets all contract requirements
 */
export function validateWineAgainstContract(wine: WineBatch, contract: WineContract): {
  isValid: boolean;
  failedRequirements: string[];
} {
  const failedRequirements: string[] = [];
  
  for (const requirement of contract.requirements) {
    const validation = validateRequirement(wine, requirement);
    if (!validation.isValid) {
      failedRequirements.push(validation.reason);
    }
  }
  
  return {
    isValid: failedRequirements.length === 0,
    failedRequirements
  };
}

/**
 * Validate a single requirement
 */
function validateRequirement(wine: WineBatch, requirement: ContractRequirement): {
  isValid: boolean;
  reason: string;
} {
  const gameState = getGameState();
  const currentYear = gameState.currentYear || 2024;
  
  switch (requirement.type) {
    case 'quality':
      // Use grapeQuality from WineBatch (0-1 scale)
      const quality = wine.grapeQuality || 0;
      if (quality < requirement.value) {
        return {
          isValid: false,
          reason: `Quality ${(quality * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'vintage':
      // Use harvestStartDate.year for vintage (year grapes were harvested)
      const vintageYear = wine.harvestStartDate.year;
      const wineAge = currentYear - vintageYear;
      const minAge = requirement.params?.minAge || 0;
      if (wineAge < minAge) {
        return {
          isValid: false,
          reason: `Vintage ${vintageYear} (${wineAge} years old) < required ${minAge} years`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'balance':
      // Use balance from WineBatch (0-1 scale)
      const balance = wine.balance || 0;
      if (balance < requirement.value) {
        return {
          isValid: false,
          reason: `Balance ${(balance * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'landValue':
      // Need to fetch vineyard to get land value
      // For now, we'll use a placeholder - this will be resolved async in the UI
      // The validation will happen server-side when fulfilling
      return { isValid: true, reason: '' };
      
    case 'grape':
      if (requirement.params?.targetGrape && wine.grape !== requirement.params.targetGrape) {
        return {
          isValid: false,
          reason: `Grape ${wine.grape} != required ${requirement.params.targetGrape}`
        };
      }
      return { isValid: true, reason: '' };
      
    default:
      return { isValid: true, reason: '' };
  }
}

/**
 * Get all wine batches that match contract requirements
 */
export async function getEligibleWinesForContract(contract: WineContract): Promise<{
  wine: WineBatch;
  validation: ReturnType<typeof validateWineAgainstContract>;
}[]> {
  // Import here to avoid circular dependency
  const { loadWineBatches } = await import('../../database/activities/inventoryDB');
  
  const allBatches = await loadWineBatches();
  const bottledWines = allBatches.filter(b => b.state === 'bottled' && b.quantity > 0);
  
  // Validate each wine against contract and check land value requirement
  const eligibleWines: {
    wine: WineBatch;
    validation: ReturnType<typeof validateWineAgainstContract>;
  }[] = [];
  
  // Load all vineyards once for efficiency
  const allVineyards = await loadVineyards();
  
  for (const wine of bottledWines) {
    // Check land value requirement if present
    const landValueReq = contract.requirements.find(r => r.type === 'landValue');
    if (landValueReq && wine.vineyardId) {
      const vineyard = allVineyards.find((v: Vineyard) => v.id === wine.vineyardId);
      if (vineyard) {
        const normalizedLandValue = Math.min(1.0, vineyard.landValue / 10000); // Normalize to 0-1
        if (normalizedLandValue < landValueReq.value) {
          continue; // Skip this wine
        }
      }
    }
    
    const validation = validateWineAgainstContract(wine, contract);
    eligibleWines.push({ wine, validation });
  }
  
  return eligibleWines.filter(w => w.validation.isValid);
}

// ===== CONTRACT FULFILLMENT =====

/**
 * Fulfill a contract with selected wines
 */
export async function fulfillContract(
  contractId: string,
  selectedWines: Array<{ wineBatchId: string; quantity: number }>
): Promise<{
  success: boolean;
  message: string;
  revenue?: number;
}> {
  try {
    const contract = await getContractById(contractId);
    
    if (!contract) {
      return { success: false, message: 'Contract not found' };
    }
    
    if (contract.status !== 'pending') {
      return { success: false, message: 'Contract is not pending' };
    }
    
    // Validate total quantity
    const totalQuantity = selectedWines.reduce((sum, w) => sum + w.quantity, 0);
    if (totalQuantity < contract.requestedQuantity) {
      return {
        success: false,
        message: `Insufficient quantity: ${totalQuantity} < ${contract.requestedQuantity} required`
      };
    }
    
    // Validate each wine against contract requirements
    for (const selectedWine of selectedWines) {
      const wineBatch = await getWineBatchById(selectedWine.wineBatchId);
      if (!wineBatch) {
        return { success: false, message: `Wine batch ${selectedWine.wineBatchId} not found` };
      }
      
      if (wineBatch.quantity < selectedWine.quantity) {
        const wineName = formatCompletedWineName(wineBatch);
        return {
          success: false,
          message: `Insufficient inventory for ${wineName}: ${wineBatch.quantity} < ${selectedWine.quantity}`
        };
      }
      
      const validation = validateWineAgainstContract(wineBatch, contract);
      if (!validation.isValid) {
        const wineName = formatCompletedWineName(wineBatch);
        return {
          success: false,
          message: `Wine ${wineName} does not meet requirements: ${validation.failedRequirements.join(', ')}`
        };
      }
    }
    
    // All validations passed - process fulfillment
    const fulfilledBatchIds: string[] = [];
    
    // Deduct inventory
    for (const selectedWine of selectedWines) {
      const wineBatch = await getWineBatchById(selectedWine.wineBatchId);
      if (!wineBatch) continue;
      
      const updatedBatch: WineBatch = {
        ...wineBatch,
        quantity: wineBatch.quantity - selectedWine.quantity
      };
      
      await saveWineBatch(updatedBatch);
      fulfilledBatchIds.push(selectedWine.wineBatchId);
    }
    
    // Calculate revenue
    const revenue = Math.round(contract.offeredPrice * contract.requestedQuantity * 100) / 100;
    
    // Add transaction
    await addTransaction(
      revenue,
      `Contract fulfilled: ${contract.customerName} - ${contract.requestedQuantity} bottles`,
      'Wine Sales',
      false
    );
    
    // Create relationship boost
    const currentPrestige = await getCurrentPrestige();
    await createRelationshipBoost(
      contract.customerId,
      revenue,
      currentPrestige,
      `Contract fulfilled: ${contract.requestedQuantity} bottles`
    );
    
    // Add prestige event
    await addSalePrestigeEvent(
      revenue,
      contract.customerName,
      `Contract (${contract.requestedQuantity} bottles)`,
      contract.requestedQuantity
    );
    
    // Update contract status
    const gameState = getGameState();
    const fulfilledWeek = gameState.week || 1;
    const fulfilledSeason = gameState.season || 'Spring';
    const fulfilledYear = gameState.currentYear || 2024;
    
    // Handle multi-year contracts
    if (contract.terms && contract.terms.deliveriesCompleted < contract.terms.totalDeliveries - 1) {
      // Update progress for multi-year contract
      const updatedTerms = {
        ...contract.terms,
        deliveriesCompleted: contract.terms.deliveriesCompleted + 1
      };
      await updateContractProgress(contractId, updatedTerms);
      
      // Keep contract pending for next delivery
      await notificationService.addMessage(
        `Contract delivery completed for ${contract.customerName}. ${updatedTerms.totalDeliveries - updatedTerms.deliveriesCompleted} deliveries remaining.`,
        'contractService.fulfillContract',
        'Contract Progress',
        NotificationCategory.SALES_ORDERS
      );
    } else {
      // Complete the contract
      await updateContractStatus(contractId, 'fulfilled', {
        fulfilledWeek,
        fulfilledSeason,
        fulfilledYear,
        fulfilledWineBatchIds: fulfilledBatchIds
      });
      
      await notificationService.addMessage(
        `Contract fulfilled for ${contract.customerName}: €${revenue.toFixed(2)}`,
        'contractService.fulfillContract',
        'Contract Fulfilled',
        NotificationCategory.SALES_ORDERS
      );
    }
    
    triggerGameUpdate();
    triggerTopicUpdate('contracts');
    
    return {
      success: true,
      message: 'Contract fulfilled successfully',
      revenue
    };
  } catch (error) {
    console.error('Error fulfilling contract:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reject a contract
 */
export async function rejectContract(contractId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const contract = await getContractById(contractId);
    
    if (!contract) {
      return { success: false, message: 'Contract not found' };
    }
    
    if (contract.status !== 'pending') {
      return { success: false, message: 'Contract is not pending' };
    }
    
    // Update contract status
    const gameState = getGameState();
    const rejectedWeek = gameState.week || 1;
    const rejectedSeason = gameState.season || 'Spring';
    const rejectedYear = gameState.currentYear || 2024;
    
    await updateContractStatus(contractId, 'rejected', { 
      rejectedWeek,
      rejectedSeason,
      rejectedYear
    });
    
    // Apply relationship penalty (smaller than order rejection)
    const relationshipPenalty = -5; // Small penalty for contract rejection
    await createRelationshipBoost(
      contract.customerId,
      relationshipPenalty,
      0,
      `Contract rejected`
    );
    
    await notificationService.addMessage(
      `Contract rejected from ${contract.customerName}`,
      'contractService.rejectContract',
      'Contract Rejected',
      NotificationCategory.SALES_ORDERS
    );
    
    triggerGameUpdate();
    triggerTopicUpdate('contracts');
    
    return { success: true, message: 'Contract rejected' };
  } catch (error) {
    console.error('Error rejecting contract:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Expire old contracts
 * Called by game tick system
 */
export async function expireOldContracts(): Promise<number> {
  try {
    const pendingContracts = await getPendingContracts();
    const gameState = getGameState();
    const currentDate: GameDate = {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    };
    
    let expiredCount = 0;
    
    for (const contract of pendingContracts) {
      const contractExpires: GameDate = {
        week: contract.expiresWeek,
        season: contract.expiresSeason,
        year: contract.expiresYear
      };
      
      if (isDateAfter(currentDate, contractExpires)) {
        await updateContractStatus(contract.id, 'expired');
        
        // Apply small relationship penalty
        await createRelationshipBoost(
          contract.customerId,
          -3,
          0,
          'Contract expired (not accepted)'
        );
        
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      await notificationService.addMessage(
        `${expiredCount} contract${expiredCount > 1 ? 's' : ''} expired`,
        'contractService.expireOldContracts',
        'Contracts Expired',
        NotificationCategory.SALES_ORDERS
      );
      
      triggerGameUpdate();
      triggerTopicUpdate('contracts');
    }
    
    return expiredCount;
  } catch (error) {
    console.error('Error expiring contracts:', error);
    return 0;
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Check if date1 is after date2
 */
function isDateAfter(date1: GameDate, date2: GameDate): boolean {
  if (date1.year > date2.year) return true;
  if (date1.year < date2.year) return false;
  
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
  const season1Index = seasons.indexOf(date1.season);
  const season2Index = seasons.indexOf(date2.season);
  
  if (season1Index > season2Index) return true;
  if (season1Index < season2Index) return false;
  
  return date1.week > date2.week;
}
