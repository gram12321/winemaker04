// Contract fulfillment service - handles contract fulfillment, rejection, and expiration
import { WineContract, WineBatch, ContractRequirement, GameDate, Vineyard } from '../../types/types';
import { getContractById, updateContractStatus, getPendingContracts, updateContractProgress } from '../../database/sales/contractDB';
import { getWineBatchById, saveWineBatch } from '../../database/activities/inventoryDB';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { addTransaction } from '../finance/financeService';
import { createRelationshipBoost } from './relationshipService';
import { getGameState, getCurrentPrestige } from '../core/gameState';
import { addSalePrestigeEvent, addFeaturePrestigeEvent } from '../prestige/prestigeService';
import { triggerGameUpdate, triggerTopicUpdate } from '../../../hooks/useGameUpdates';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { formatCompletedWineName } from '../wine/winery/inventoryService';
import { getTasteQualityIndex } from '../wine/winescore/wineScoreCalculation';
import { formatNumber } from '../../utils/utils';
import { getAllFeatureConfigs } from '../../constants/wineFeatures/commonFeaturesUtil';

// ===== CONTRACT VALIDATION =====

/**
 * Check if a wine batch meets all contract requirements
 */
export async function validateWineAgainstContract(wine: WineBatch, contract: WineContract): Promise<{
  isValid: boolean;
  failedRequirements: string[];
}> {
  const failedRequirements: string[] = [];
  
  for (const requirement of contract.requirements) {
    const validation = await validateRequirement(wine, requirement);
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
async function validateRequirement(wine: WineBatch, requirement: ContractRequirement): Promise<{
  isValid: boolean;
  reason: string;
}> {
  const gameState = getGameState();
  const currentYear = gameState.currentYear || 2024;
  
  switch (requirement.type) {
    case 'tasteQuality':
      const tasteQuality = getTasteQualityIndex(wine);
      if (tasteQuality < requirement.value) {
        return {
          isValid: false,
          reason: `Taste Quality ${(tasteQuality * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'minimumVintage':
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
      
    case 'specificVintage':
      // Must match exact vintage year
      const wineVintageYear = wine.harvestStartDate.year;
      const targetYear = requirement.params?.targetYear || requirement.value;
      if (wineVintageYear !== targetYear) {
        return {
          isValid: false,
          reason: `Vintage ${wineVintageYear} != required ${targetYear}`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'structureIndex':
      const structureIndex = wine.structureIndex || 0;
      if (structureIndex < requirement.value) {
        return {
          isValid: false,
          reason: `Structure index ${(structureIndex * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'landValue':
      // Check absolute land value per hectare
      if (!wine.vineyardId) {
        return { isValid: false, reason: 'Wine has no vineyard data' };
      }
      const vineyardsForLandValue = await loadVineyards();
      const vineyardForLandValue = vineyardsForLandValue.find((v: Vineyard) => v.id === wine.vineyardId);
      if (!vineyardForLandValue) {
        return { isValid: false, reason: 'Vineyard not found' };
      }
      // requirement.value is in euros per hectare (e.g., 10000 = €10,000/ha)
      if (vineyardForLandValue.landValue < requirement.value) {
        return {
          isValid: false,
          reason: `Land Value ${formatNumber(vineyardForLandValue.landValue, { currency: true, decimals: 0 })}/ha < required ${formatNumber(requirement.value, { currency: true, decimals: 0 })}/ha`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'grape':
      if (requirement.params?.targetGrape && wine.grape !== requirement.params.targetGrape) {
        return {
          isValid: false,
          reason: `Grape ${wine.grape} != required ${requirement.params.targetGrape}`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'grapeColor':
      if (requirement.params?.targetGrapeColor && wine.grapeColor !== requirement.params.targetGrapeColor) {
        return {
          isValid: false,
          reason: `Color ${wine.grapeColor} != required ${requirement.params.targetGrapeColor}`
        };
      }
      return { isValid: true, reason: '' };

    case 'country':
      if (!wine.vineyardId) {
        return { isValid: false, reason: 'Wine has no vineyard data' };
      }
      const vineyardsForCountry = await loadVineyards();
      const vineyardForCountry = vineyardsForCountry.find((v: Vineyard) => v.id === wine.vineyardId);
      if (!vineyardForCountry) {
        return { isValid: false, reason: 'Vineyard not found' };
      }
      if (requirement.params?.targetCountry && vineyardForCountry.country !== requirement.params.targetCountry) {
        return {
          isValid: false,
          reason: `Country ${vineyardForCountry.country} != required ${requirement.params.targetCountry}`
        };
      }
      return { isValid: true, reason: '' };

    case 'region':
      if (!wine.vineyardId) {
        return { isValid: false, reason: 'Wine has no vineyard data' };
      }
      const vineyardsForRegion = await loadVineyards();
      const vineyardForRegion = vineyardsForRegion.find((v: Vineyard) => v.id === wine.vineyardId);
      if (!vineyardForRegion) {
        return { isValid: false, reason: 'Vineyard not found' };
      }
      if (requirement.params?.targetCountry && vineyardForRegion.country !== requirement.params.targetCountry) {
        return {
          isValid: false,
          reason: `Country ${vineyardForRegion.country} != required ${requirement.params.targetCountry}`
        };
      }
      if (requirement.params?.targetRegion && vineyardForRegion.region !== requirement.params.targetRegion) {
        return {
          isValid: false,
          reason: `Region ${vineyardForRegion.region} != required ${requirement.params.targetRegion}`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'altitude':
      // Fetch vineyard to get altitude and normalize it
      if (!wine.vineyardId) {
        return { isValid: false, reason: 'Wine has no vineyard data' };
      }
      const vineyardsForAltitude = await loadVineyards();
      const vineyardForAltitude = vineyardsForAltitude.find((v: Vineyard) => v.id === wine.vineyardId);
      if (!vineyardForAltitude) {
        return { isValid: false, reason: 'Vineyard not found' };
      }
      const { getAltitudeRating } = await import('../../services/vineyard/vineyardValueCalc');
      const normalizedAltitude = getAltitudeRating(vineyardForAltitude.country, vineyardForAltitude.region, vineyardForAltitude.altitude);
      if (normalizedAltitude < requirement.value) {
        return {
          isValid: false,
          reason: `Altitude ${(normalizedAltitude * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'aspect':
      // Fetch vineyard to get aspect and normalize it
      if (!wine.vineyardId) {
        return { isValid: false, reason: 'Wine has no vineyard data' };
      }
      const vineyardsForAspect = await loadVineyards();
      const vineyardForAspect = vineyardsForAspect.find((v: Vineyard) => v.id === wine.vineyardId);
      if (!vineyardForAspect) {
        return { isValid: false, reason: 'Vineyard not found' };
      }
      const { getAspectRating } = await import('../../services/vineyard/vineyardValueCalc');
      const normalizedAspect = getAspectRating(vineyardForAspect.country, vineyardForAspect.region, vineyardForAspect.aspect);
      if (normalizedAspect < requirement.value) {
        return {
          isValid: false,
          reason: `Aspect ${(normalizedAspect * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'characteristicMin':
      // Minimum characteristic requirement (e.g., "Sweetness ≥ 60%")
      if (!wine.characteristics || !requirement.params?.targetCharacteristic) {
        return { isValid: false, reason: 'Wine has no characteristics data' };
      }
      const minCharValue = wine.characteristics[requirement.params.targetCharacteristic];
      if (minCharValue < requirement.value) {
        return {
          isValid: false,
          reason: `${requirement.params.targetCharacteristic} ${(minCharValue * 100).toFixed(0)}% < required ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'characteristicMax':
      // Maximum characteristic requirement (e.g., "Tannins ≤ 40%")
      if (!wine.characteristics || !requirement.params?.targetCharacteristic) {
        return { isValid: false, reason: 'Wine has no characteristics data' };
      }
      const maxCharValue = wine.characteristics[requirement.params.targetCharacteristic];
      if (maxCharValue > requirement.value) {
        return {
          isValid: false,
          reason: `${requirement.params.targetCharacteristic} ${(maxCharValue * 100).toFixed(0)}% > allowed ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    case 'characteristicDeviation':
      // Characteristic deviation requirement (max distance from ideal)
      if (!wine.characteristics || !requirement.params?.targetCharacteristic) {
        return { isValid: false, reason: 'Wine has no characteristics data' };
      }
      // Get the wine's characteristic value
      const charValue = wine.characteristics[requirement.params.targetCharacteristic];
      // Assume ideal is 0.5 (middle of range) - distance from ideal
      const idealValue = 0.5;
      const distance = Math.abs(charValue - idealValue);
      if (distance > requirement.value) {
        return {
          isValid: false,
          reason: `${requirement.params.targetCharacteristic} distance ${(distance * 100).toFixed(0)}% > allowed ${(requirement.value * 100).toFixed(0)}%`
        };
      }
      return { isValid: true, reason: '' };
      
    default:
      return { isValid: false, reason: `Unknown contract requirement: ${requirement.type}` };
  }
}

/**
 * Get all wine batches that match contract requirements
 */
export async function getEligibleWinesForContract(contract: WineContract): Promise<{
  wine: WineBatch;
  validation: Awaited<ReturnType<typeof validateWineAgainstContract>>;
}[]> {
  // Import here to avoid circular dependency
  const { loadWineBatches } = await import('../../database/activities/inventoryDB');
  
  const allBatches = await loadWineBatches();
  const bottledWines = allBatches.filter(b => b.state === 'bottled' && b.quantity > 0);
  
  // Validate each wine against contract and check land value requirement
  const eligibleWines: {
    wine: WineBatch;
    validation: Awaited<ReturnType<typeof validateWineAgainstContract>>;
  }[] = [];
  
  // Validate all wines against contract requirements
  for (const wine of bottledWines) {
    const validation = await validateWineAgainstContract(wine, contract);
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
      
      const validation = await validateWineAgainstContract(wineBatch, contract);
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
    const fulfilledWines: Array<{ wineBatch: WineBatch; quantity: number; value: number }> = [];
    
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
      fulfilledWines.push({
        wineBatch,
        quantity: selectedWine.quantity,
        value: Math.round(contract.offeredPrice * selectedWine.quantity * 100) / 100
      });
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

    try {
      await addContractFeaturePrestigeEvents(contract, fulfilledWines, currentPrestige);
    } catch (error) {
      console.error('Failed to create contract feature prestige events:', error);
    }
    
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
        `Contract fulfilled for ${contract.customerName}: ${formatNumber(revenue, { currency: true, decimals: 2 })}`,
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

async function addContractFeaturePrestigeEvents(
  contract: WineContract,
  fulfilledWines: Array<{ wineBatch: WineBatch; quantity: number; value: number }>,
  currentCompanyPrestige: number
): Promise<void> {
  const configs = getAllFeatureConfigs();
  const vineyards = await loadVineyards();

  for (const fulfilledWine of fulfilledWines) {
    const presentFeatures = (fulfilledWine.wineBatch.features || []).filter(feature => feature.isPresent);
    if (presentFeatures.length === 0) {
      continue;
    }

    const vineyard = vineyards.find(v => v.id === fulfilledWine.wineBatch.vineyardId);
    const wineName = formatCompletedWineName(fulfilledWine.wineBatch);
    const orderContext = {
      id: `contract_${contract.id}_${fulfilledWine.wineBatch.id}`,
      customerId: contract.customerId,
      customerName: contract.customerName,
      wineBatchId: fulfilledWine.wineBatch.id,
      wineName,
      requestedQuantity: fulfilledWine.quantity,
      offeredPrice: contract.offeredPrice,
      totalValue: fulfilledWine.value,
      fulfillableQuantity: fulfilledWine.quantity,
      fulfillableValue: fulfilledWine.value,
      status: 'fulfilled'
    } as any;

    for (const feature of presentFeatures) {
      const config = configs.find(candidate => candidate.id === feature.id);
      if (!config?.effects.prestige?.onSale) {
        continue;
      }

      await addFeaturePrestigeEvent(fulfilledWine.wineBatch, config, 'sale', {
        customerName: contract.customerName,
        order: orderContext,
        vineyard,
        currentCompanyPrestige
      });
    }
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
