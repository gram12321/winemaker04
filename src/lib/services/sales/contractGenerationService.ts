// Contract generation service - creates requirement-based contracts from customers
import { WineContract, ContractRequirement, ContractRequirementType, Customer, CustomerType, GameDate } from '../../types/types';
import { getAllCustomers } from './createCustomer';
import { saveWineContract, getPendingContracts } from '../../database/sales/contractDB';
import { getGameState, getCurrentPrestige } from '../core/gameState';
import { getCurrentCompanyId } from '../../utils/companyUtils';
import { calculateAsymmetricalScaler01, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { calculateExpiration } from './expirationService';
import { v4 as uuidv4 } from 'uuid';
import {
  CONTRACT_CONFIG,
  CUSTOMER_CONTRACT_REQUIREMENTS,
  CUSTOMER_REQUIREMENT_PREFERENCES,
  CONTRACT_BASE_QUANTITIES,
  CONTRACT_MIN_QUANTITIES,
  AVAILABLE_GRAPES,
  AVAILABLE_GRAPE_COLORS,
  CONTRACT_PRICING,
  MULTI_YEAR_CONFIG,
  COMPLEXITY_THRESHOLDS,
  CUSTOMER_MAX_WINE_AGE
} from '../../constants/contractConstants';

// ===== REQUIREMENT DIFFICULTY SYSTEM =====

/**
 * Difficulty tiers for requirements
 * Easy: Common requirements that most wines can meet
 * Medium: Moderate requirements requiring some effort
 * Hard: Difficult requirements requiring careful winemaking
 * Expert: Very difficult requirements for top-tier wines
 */
type RequirementDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Calculate difficulty score for a requirement
 * Returns 0-1 scale where higher = more difficult
 */
function calculateRequirementDifficulty(requirement: ContractRequirement): {
  difficulty: RequirementDifficulty;
  score: number;
} {
  let score = 0;
  let difficulty: RequirementDifficulty = 'easy';
  
  switch (requirement.type) {
    case 'quality':
      // Quality thresholds: <50% easy, 50-70% medium, 70-85% hard, >85% expert
      if (requirement.value < 0.5) {
        difficulty = 'easy';
        score = requirement.value * 0.4; // 0-0.2
      } else if (requirement.value < 0.7) {
        difficulty = 'medium';
        score = 0.2 + (requirement.value - 0.5) * 1.0; // 0.2-0.4
      } else if (requirement.value < 0.85) {
        difficulty = 'hard';
        score = 0.4 + (requirement.value - 0.7) * 2.0; // 0.4-0.7
      } else {
        difficulty = 'expert';
        score = 0.7 + (requirement.value - 0.85) * 2.0; // 0.7-1.0
      }
      break;
      
    case 'minimumVintage':
      // Age thresholds: <3y easy, 3-7y medium, 7-12y hard, >12y expert
      const age = requirement.value;
      if (age < 3) {
        difficulty = 'easy';
        score = age / 15; // 0-0.2
      } else if (age < 7) {
        difficulty = 'medium';
        score = 0.2 + (age - 3) / 10; // 0.2-0.4
      } else if (age < 12) {
        difficulty = 'hard';
        score = 0.4 + (age - 7) / 10; // 0.4-0.9
      } else {
        difficulty = 'expert';
        score = 0.9 + Math.min((age - 12) / 20, 0.1); // 0.9-1.0
      }
      break;
      
    case 'specificVintage':
      // Specific vintage year is hard difficulty (must match exactly)
      difficulty = 'hard';
      score = 0.6;
      break;
      
    case 'balance':
      // Balance thresholds: <60% easy, 60-75% medium, 75-85% hard, >85% expert
      if (requirement.value < 0.6) {
        difficulty = 'easy';
        score = requirement.value * 0.33; // 0-0.2
      } else if (requirement.value < 0.75) {
        difficulty = 'medium';
        score = 0.2 + (requirement.value - 0.6) * 1.33; // 0.2-0.4
      } else if (requirement.value < 0.85) {
        difficulty = 'hard';
        score = 0.4 + (requirement.value - 0.75) * 3.0; // 0.4-0.7
      } else {
        difficulty = 'expert';
        score = 0.7 + (requirement.value - 0.85) * 2.0; // 0.7-1.0
      }
      break;
      
    case 'landValue':
      // Land value thresholds: <0.4 easy, 0.4-0.6 medium, 0.6-0.8 hard, >0.8 expert
      if (requirement.value < 0.4) {
        difficulty = 'easy';
        score = requirement.value * 0.5; // 0-0.2
      } else if (requirement.value < 0.6) {
        difficulty = 'medium';
        score = 0.2 + (requirement.value - 0.4) * 1.0; // 0.2-0.4
      } else if (requirement.value < 0.8) {
        difficulty = 'hard';
        score = 0.4 + (requirement.value - 0.6) * 1.5; // 0.4-0.7
      } else {
        difficulty = 'expert';
        score = 0.7 + (requirement.value - 0.8) * 1.5; // 0.7-1.0
      }
      break;
      
    case 'grape':
      // Specific grape requirement is moderately difficult
      difficulty = 'medium';
      score = 0.3;
      break;
      
    case 'grapeColor':
      // Grape color requirement is easy (red/white split)
      difficulty = 'easy';
      score = 0.2;
      break;
      
    default:
      difficulty = 'easy';
      score = 0.1;
  }
  
  return { difficulty, score: Math.min(1, Math.max(0, score)) };
}

// ===== HELPER FUNCTIONS =====

/**
 * Check if a customer is eligible for contracts and calculate their contract chance
 * Uses asymmetrical scaling for relationship (0-100) and prestige normalization
 */
function calculateCustomerContractChance(
  customer: Customer,
  prestige: number
): {
  isEligible: boolean;
  contractChance: number;
  blockReason?: string;
} {
  const requirements = CUSTOMER_CONTRACT_REQUIREMENTS[customer.customerType];
  const relationship = customer.relationship || 0;
  
  // Check minimum thresholds
  if (relationship < requirements.minRelationship) {
    return {
      isEligible: false,
      contractChance: 0,
      blockReason: `Relationship too low (${relationship.toFixed(1)} < ${requirements.minRelationship})`
    };
  }
  
  if (prestige < requirements.minPrestige) {
    return {
      isEligible: false,
      contractChance: 0,
      blockReason: `Prestige too low (${prestige.toFixed(1)} < ${requirements.minPrestige})`
    };
  }
  
  // Calculate relationship score using asymmetrical scaler (0-100 → 0-1)
  // This gives a nice curve where low relationships have low chance, high relationships have high chance
  const relationshipNormalized = relationship / 100; // 0-1 scale
  const relationshipScore = calculateAsymmetricalScaler01(relationshipNormalized);
  
  // Calculate prestige score using prestige normalizer (0-2000 → 0-1)
  const prestigeScore = NormalizeScrewed1000To01WithTail(prestige);
  
  // Weighted combination based on customer type
  const weightedScore = 
    (relationshipScore * requirements.relationshipWeight) + 
    (prestigeScore * requirements.prestigeWeight);
  
  // Normalize by total weight to get 0-1 range
  const totalWeight = requirements.relationshipWeight + requirements.prestigeWeight;
  const finalScore = weightedScore / totalWeight;
  
  // Contract chance scales from 0% to 100% based on final score
  const contractChance = finalScore;
  
  return {
    isEligible: true,
    contractChance,
    blockReason: undefined
  };
}

/**
 * Get all eligible customers with their contract chances
 */
async function getEligibleCustomersWithChances(prestige: number): Promise<Array<{
  customer: Customer;
  chance: number;
}>> {
  const allCustomers = await getAllCustomers();
  const eligible: Array<{ customer: Customer; chance: number }> = [];
  
  for (const customer of allCustomers) {
    if (!customer.activeCustomer) continue;
    
    const result = calculateCustomerContractChance(customer, prestige);
    if (result.isEligible && result.contractChance > 0) {
      eligible.push({
        customer,
        chance: result.contractChance
      });
    }
  }
  
  return eligible;
}

// ===== CONTRACT GENERATION =====

/**
 * Generate contracts from eligible customers
 * Called periodically by game tick system
 */
export async function generateContracts(): Promise<{
  contractsGenerated: number;
  chanceInfo: {
    baseChance: number;
    prestigeBonus: number;
    finalChance: number;
    randomRoll: number;
    wasGenerated: boolean;
    pendingContracts: number;
    maxPending: number;
    eligibleCustomers: number;
    totalCustomers: number;
    currentPrestige: number;
    avgCustomerChance: number;
  };
}> {
  try {
    // Check if we're at max pending contracts
    const pendingContracts = await getPendingContracts();
    const allCustomers = await getAllCustomers();
    const prestige = await getCurrentPrestige();
    
    // Removed debug logging
    
    if (pendingContracts.length >= CONTRACT_CONFIG.maxPendingContracts) {
  // Removed debug logging
      return {
        contractsGenerated: 0,
        chanceInfo: {
          baseChance: CONTRACT_CONFIG.baseGenerationChance,
          prestigeBonus: 0,
          finalChance: 0,
          randomRoll: 0,
          wasGenerated: false,
          pendingContracts: pendingContracts.length,
          maxPending: CONTRACT_CONFIG.maxPendingContracts,
          eligibleCustomers: 0,
          totalCustomers: allCustomers.length,
          currentPrestige: prestige,
          avgCustomerChance: 0
        }
      };
    }

    // Get eligible customers with their individual contract chances
    const eligibleWithChances = await getEligibleCustomersWithChances(prestige);

    // Calculate average customer chance for UI display
    const avgCustomerChance = eligibleWithChances.length > 0
      ? eligibleWithChances.reduce((sum, e) => sum + e.chance, 0) / eligibleWithChances.length
      : 0;



    if (eligibleWithChances.length === 0) {

      return {
        contractsGenerated: 0,
        chanceInfo: {
          baseChance: CONTRACT_CONFIG.baseGenerationChance,
          prestigeBonus: 0,
          finalChance: 0,
          randomRoll: 0,
          wasGenerated: false,
          pendingContracts: pendingContracts.length,
          maxPending: CONTRACT_CONFIG.maxPendingContracts,
          eligibleCustomers: 0,
          totalCustomers: allCustomers.length,
          currentPrestige: prestige,
          avgCustomerChance: 0
        }
      };
    }

    // Roll for each eligible customer using their individual chance
    // Each customer has: baseChance × their individual modifier
    let contractGenerated = false;
    let selectedCustomer: Customer | null = null;
    let selectedChance = 0;
    
    for (const { customer, chance } of eligibleWithChances) {
      // Customer's final chance = base chance × their modifier (relationship/prestige score)
      const customerFinalChance = CONTRACT_CONFIG.baseGenerationChance * chance;
      const roll = Math.random();
      
      if (roll <= customerFinalChance) {
        // This customer wants to offer a contract!
        selectedCustomer = customer;
        selectedChance = customerFinalChance;
        contractGenerated = true;
        
        // Removed debug logging
        
        break; // Only generate one contract per tick
      }
    }
    
    if (!contractGenerated || !selectedCustomer) {
      // Removed debug logging
      
      return {
        contractsGenerated: 0,
        chanceInfo: {
          baseChance: CONTRACT_CONFIG.baseGenerationChance,
          prestigeBonus: 0,
          finalChance: CONTRACT_CONFIG.baseGenerationChance * avgCustomerChance,
          randomRoll: 0,
          wasGenerated: false,
          pendingContracts: pendingContracts.length,
          maxPending: CONTRACT_CONFIG.maxPendingContracts,
          eligibleCustomers: eligibleWithChances.length,
          totalCustomers: allCustomers.length,
          currentPrestige: prestige,
          avgCustomerChance
        }
      };
    }

    // Generate contract for selected customer
    const contract = await generateContractForCustomer(selectedCustomer);
    await saveWineContract(contract);

    // Removed debug logging

    return {
      contractsGenerated: 1,
      chanceInfo: {
        baseChance: CONTRACT_CONFIG.baseGenerationChance,
        prestigeBonus: 0,
        finalChance: selectedChance,
        randomRoll: 0,
        wasGenerated: true,
        pendingContracts: pendingContracts.length,
        maxPending: CONTRACT_CONFIG.maxPendingContracts,
        eligibleCustomers: eligibleWithChances.length,
        totalCustomers: allCustomers.length,
        currentPrestige: prestige,
        avgCustomerChance
      }
    };
  } catch (error) {
    console.error('Error generating contracts:', error);
    return {
      contractsGenerated: 0,
      chanceInfo: {
        baseChance: 0,
        prestigeBonus: 0,
        finalChance: 0,
        randomRoll: 0,
        wasGenerated: false,
        pendingContracts: 0,
        maxPending: CONTRACT_CONFIG.maxPendingContracts,
        eligibleCustomers: 0,
        totalCustomers: 0,
        currentPrestige: 0,
        avgCustomerChance: 0
      }
    };
  }
}

/**
 * Get contract generation chance info without actually generating (for UI display)
 */
export async function getContractGenerationChance(): Promise<{
  baseChance: number;
  finalChance: number;
  pendingContracts: number;
  maxPending: number;
  eligibleCustomers: number;
  totalCustomers: number;
  currentPrestige: number;
  avgCustomerChance: number;
  isBlocked: boolean;
  blockReason?: string;
  customerTypeBreakdown: Record<CustomerType, { eligible: number; total: number; avgChance: number }>;
}> {
  try {
    const pendingContracts = await getPendingContracts();
    const allCustomers = await getAllCustomers();
    const prestige = await getCurrentPrestige();
    
    const eligibleWithChances = await getEligibleCustomersWithChances(prestige);
    
    // Calculate average customer chance
    const avgCustomerChance = eligibleWithChances.length > 0
      ? eligibleWithChances.reduce((sum, e) => sum + e.chance, 0) / eligibleWithChances.length
      : 0;
    
    // Calculate breakdown by customer type
    const customerTypeBreakdown: Record<CustomerType, { eligible: number; total: number; avgChance: number }> = {
      'Restaurant': { eligible: 0, total: 0, avgChance: 0 },
      'Wine Shop': { eligible: 0, total: 0, avgChance: 0 },
      'Private Collector': { eligible: 0, total: 0, avgChance: 0 },
      'Chain Store': { eligible: 0, total: 0, avgChance: 0 }
    };
    
    for (const customer of allCustomers) {
      if (!customer.activeCustomer) continue;
      customerTypeBreakdown[customer.customerType].total++;
    }
    
    for (const { customer, chance } of eligibleWithChances) {
      customerTypeBreakdown[customer.customerType].eligible++;
      customerTypeBreakdown[customer.customerType].avgChance += chance;
    }
    
    // Calculate averages
    for (const type of Object.keys(customerTypeBreakdown) as CustomerType[]) {
      const breakdown = customerTypeBreakdown[type];
      if (breakdown.eligible > 0) {
        breakdown.avgChance /= breakdown.eligible;
      }
    }
    
    let isBlocked = false;
    let blockReason: string | undefined;
    
    if (pendingContracts.length >= CONTRACT_CONFIG.maxPendingContracts) {
      isBlocked = true;
      blockReason = `Max pending contracts (${CONTRACT_CONFIG.maxPendingContracts}) reached`;
    } else if (eligibleWithChances.length === 0) {
      isBlocked = true;
      blockReason = 'No eligible customers (check relationship/prestige requirements)';
    }
    
    return {
      baseChance: CONTRACT_CONFIG.baseGenerationChance,
      finalChance: isBlocked ? 0 : CONTRACT_CONFIG.baseGenerationChance,
      pendingContracts: pendingContracts.length,
      maxPending: CONTRACT_CONFIG.maxPendingContracts,
      eligibleCustomers: eligibleWithChances.length,
      totalCustomers: allCustomers.filter(c => c.activeCustomer).length,
      currentPrestige: prestige,
      avgCustomerChance,
      isBlocked,
      blockReason,
      customerTypeBreakdown
    };
  } catch (error) {
    console.error('Error getting contract generation chance:', error);
    return {
      baseChance: 0,
      finalChance: 0,
      pendingContracts: 0,
      maxPending: CONTRACT_CONFIG.maxPendingContracts,
      eligibleCustomers: 0,
      totalCustomers: 0,
      currentPrestige: 0,
      avgCustomerChance: 0,
      isBlocked: true,
      blockReason: 'Error loading contract chance',
      customerTypeBreakdown: {
        'Restaurant': { eligible: 0, total: 0, avgChance: 0 },
        'Wine Shop': { eligible: 0, total: 0, avgChance: 0 },
        'Private Collector': { eligible: 0, total: 0, avgChance: 0 },
        'Chain Store': { eligible: 0, total: 0, avgChance: 0 }
      }
    };
  }
}

/**
 * Generate a contract for a specific customer
 */
/**
 * Generate a contract for a specific customer
 * Used by admin tools to force contract generation
 * @param customer Customer to generate contract for
 * @returns Generated contract (not saved to database)
 */
export async function generateContractForCustomer(customer: Customer): Promise<WineContract> {
  const gameState = getGameState();
  const currentDate: GameDate = {
    week: gameState.week || 1,
    season: gameState.season || 'Spring',
    year: gameState.currentYear || 2024
  };
  
  // Generate requirements based on customer type (now async)
  const requirements = await generateRequirements(customer);
  
  // Calculate contract pricing based on requirements
  const { pricePerBottle, quantity } = await calculateContractPricing(customer, requirements);
  
  // Calculate expiration date using shared service (considers customer type and relationship)
  const expiresAt = calculateExpiration(currentDate, customer.customerType, customer.relationship || 0);
  
  // Determine if this is a multi-year contract (from constants)
  const terms = (customer.relationship || 0) > MULTI_YEAR_CONFIG.minRelationshipForMultiYear && Math.random() < MULTI_YEAR_CONFIG.chanceForMultiYear
    ? generateMultiYearTerms()
    : undefined;
  
  // Apply multi-year premium (from constants)
  let finalPricePerBottle = pricePerBottle;
  if (terms) {
    const multiYearPremium = 1 + ((terms.durationYears - 1) * CONTRACT_PRICING.multiYearPremiumPerYear);
    finalPricePerBottle = Math.round(pricePerBottle * multiYearPremium * 100) / 100;
  }
  
  const contract: WineContract = {
    id: uuidv4(),
    companyId: getCurrentCompanyId(),
    customerId: customer.id,
    customerName: customer.name,
    customerCountry: customer.country,
    customerType: customer.customerType,
    requirements,
    requestedQuantity: quantity,
    offeredPrice: finalPricePerBottle,
    totalValue: Math.round(finalPricePerBottle * quantity * 100) / 100,
    status: 'pending',
    createdWeek: currentDate.week,
    createdSeason: currentDate.season,
    createdYear: currentDate.year,
    expiresWeek: expiresAt.week,
    expiresSeason: expiresAt.season,
    expiresYear: expiresAt.year,
    terms,
    relationshipAtCreation: customer.relationship || 0
  };
  
  return contract;
}

/**
 * Determine how many requirements and their difficulty based on relationship/prestige
 */
async function calculateRequirementComplexity(customer: Customer): Promise<{
  minRequirements: number;
  maxRequirements: number;
  targetDifficultyScore: number; // 0-1 scale, average difficulty target
}> {
  const relationship = customer.relationship || 0;
  const prestige = await getCurrentPrestige();
  
  // Normalize relationship (0-100) using asymmetrical scaler
  // This gives better curve: low relationships stay low, high relationships get good boost
  const relationshipNormalized = calculateAsymmetricalScaler01(relationship / 100);
  
  // Normalize prestige (0-2000) using screwed tail function
  // This handles the full prestige range properly with diminishing returns at high values
  const prestigeNormalized = NormalizeScrewed1000To01WithTail(prestige);
  
  // Combined score: weight relationship more heavily (70/30 split)
  const combinedScore = relationshipNormalized * 0.7 + prestigeNormalized * 0.3;
  
  // Use complexity thresholds from constants
  let minReq = COMPLEXITY_THRESHOLDS.low.requirements.min;
  let maxReq = COMPLEXITY_THRESHOLDS.low.requirements.max;
  let targetDifficulty = COMPLEXITY_THRESHOLDS.low.targetDifficulty;
  
  if (combinedScore < COMPLEXITY_THRESHOLDS.low.maxScore) {
    minReq = COMPLEXITY_THRESHOLDS.low.requirements.min;
    maxReq = COMPLEXITY_THRESHOLDS.low.requirements.max;
    targetDifficulty = COMPLEXITY_THRESHOLDS.low.targetDifficulty;
  } else if (combinedScore < COMPLEXITY_THRESHOLDS.medium.maxScore) {
    minReq = COMPLEXITY_THRESHOLDS.medium.requirements.min;
    maxReq = COMPLEXITY_THRESHOLDS.medium.requirements.max;
    targetDifficulty = COMPLEXITY_THRESHOLDS.medium.targetDifficulty;
  } else if (combinedScore < COMPLEXITY_THRESHOLDS.high.maxScore) {
    minReq = COMPLEXITY_THRESHOLDS.high.requirements.min;
    maxReq = COMPLEXITY_THRESHOLDS.high.requirements.max;
    targetDifficulty = COMPLEXITY_THRESHOLDS.high.targetDifficulty;
  } else {
    minReq = COMPLEXITY_THRESHOLDS.expert.requirements.min;
    maxReq = COMPLEXITY_THRESHOLDS.expert.requirements.max;
    targetDifficulty = COMPLEXITY_THRESHOLDS.expert.targetDifficulty;
  }
  
  return { minRequirements: minReq, maxRequirements: maxReq, targetDifficultyScore: targetDifficulty };
}

/**
 * Generate requirements for a contract based on customer type and complexity
 */
async function generateRequirements(customer: Customer): Promise<ContractRequirement[]> {
  const requirements: ContractRequirement[] = [];
  const complexity = await calculateRequirementComplexity(customer);
  
  // Determine actual number of requirements
  const numRequirements = Math.floor(
    Math.random() * (complexity.maxRequirements - complexity.minRequirements + 1)
  ) + complexity.minRequirements;
  
  // Available requirement types by customer preference (imported from constants)
  const availableTypes = [...CUSTOMER_REQUIREMENT_PREFERENCES[customer.customerType]];
  
  // Generate requirements targeting the difficulty score
  for (let i = 0; i < numRequirements; i++) {
    if (availableTypes.length === 0) break;
    
    // Pick a random type
    const typeIndex = Math.floor(Math.random() * availableTypes.length);
    const reqType = availableTypes[typeIndex];
    availableTypes.splice(typeIndex, 1); // Remove to avoid duplicates
    
    // Generate requirement with target difficulty
    const requirement = generateRequirementWithDifficulty(reqType, complexity.targetDifficultyScore, customer);
    requirements.push(requirement);
  }
  
  // Ensure at least one requirement
  if (requirements.length === 0) {
    requirements.push(generateQualityRequirement(customer, 0.3)); // Easy fallback
  }
  
  return requirements;
}

/**
 * Generate a requirement of specific type with target difficulty
 */
function generateRequirementWithDifficulty(
  type: ContractRequirementType,
  targetDifficulty: number,
  customer: Customer
): ContractRequirement {
  const variance = 0.15; // ±15% variance from target
  const actualDifficulty = Math.max(0, Math.min(1, targetDifficulty + (Math.random() * variance * 2 - variance)));
  
  switch (type) {
    case 'quality':
      return generateQualityRequirement(customer, actualDifficulty);
    case 'minimumVintage':
      return generateMinimumVintageRequirement(customer, actualDifficulty);
    case 'specificVintage':
      return generateSpecificVintageRequirement(customer);
    case 'balance':
      return generateBalanceRequirement(customer, actualDifficulty);
    case 'landValue':
      return generateLandValueRequirement(customer, actualDifficulty);
    case 'grape':
      return generateGrapeRequirement(customer);
    case 'grapeColor':
      return generateGrapeColorRequirement(customer);
    default:
      return generateQualityRequirement(customer, actualDifficulty);
  }
}

/**
 * Generate quality requirement with target difficulty
 * difficulty: 0-1 scale (0=easy, 1=expert)
 */
function generateQualityRequirement(_customer: Customer, targetDifficulty: number = 0.3): ContractRequirement {
  // Map difficulty to quality thresholds
  // 0.0-0.2 = 30-50% quality (easy)
  // 0.2-0.4 = 50-70% quality (medium)
  // 0.4-0.7 = 70-85% quality (hard)
  // 0.7-1.0 = 85-95% quality (expert)
  
  let minQuality = 0.3;
  if (targetDifficulty < 0.2) {
    minQuality = 0.3 + targetDifficulty * 1.0; // 30-50%
  } else if (targetDifficulty < 0.4) {
    minQuality = 0.5 + (targetDifficulty - 0.2) * 1.0; // 50-70%
  } else if (targetDifficulty < 0.7) {
    minQuality = 0.7 + (targetDifficulty - 0.4) * 0.5; // 70-85%
  } else {
    minQuality = 0.85 + (targetDifficulty - 0.7) * 0.33; // 85-95%
  }
  
  // Add small variance
  const variance = Math.random() * 0.05 - 0.025;
  minQuality = Math.max(0.2, Math.min(0.95, minQuality + variance));
  
  return {
    type: 'quality',
    value: Math.round(minQuality * 100) / 100
  };
}

/**
 * Generate minimum vintage requirement with target difficulty
 */
function generateMinimumVintageRequirement(customer: Customer, targetDifficulty: number = 0.3): ContractRequirement {
  // Map difficulty to age requirements
  // 0.0-0.2 = 0-3 years (easy)
  // 0.2-0.4 = 3-7 years (medium)
  // 0.4-0.7 = 7-12 years (hard)
  // 0.7-1.0 = 12-20 years (expert)
  
  let minAge = 0;
  if (targetDifficulty < 0.2) {
    minAge = Math.floor(targetDifficulty * 15); // 0-3 years
  } else if (targetDifficulty < 0.4) {
    minAge = 3 + Math.floor((targetDifficulty - 0.2) * 20); // 3-7 years
  } else if (targetDifficulty < 0.7) {
    minAge = 7 + Math.floor((targetDifficulty - 0.4) * 16.67); // 7-12 years
  } else {
    minAge = 12 + Math.floor((targetDifficulty - 0.7) * 26.67); // 12-20 years
  }
  
  // Customer type affects acceptable range (imported from constants)
  minAge = Math.min(minAge, CUSTOMER_MAX_WINE_AGE[customer.customerType]);
  
  return {
    type: 'minimumVintage',
    value: minAge,
    params: {
      minAge
    }
  };
}

/**
 * Generate specific vintage requirement (must match exact year)
 */
function generateSpecificVintageRequirement(customer: Customer): ContractRequirement {
  // Generate a vintage year within acceptable range for customer type
  const maxAge = CUSTOMER_MAX_WINE_AGE[customer.customerType];
  const minAge = 2; // Minimum 2 years old for specific vintage requests
  
  // Pick a random age within the range
  const targetAge = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
  
  // Calculate target year (current year - age)
  const gameState = getGameState();
  const currentYear = gameState.currentYear || 2024;
  const targetYear = currentYear - targetAge;
  
  return {
    type: 'specificVintage',
    value: targetYear, // Store the year as value
    params: {
      targetYear
    }
  };
}

/**
 * Generate balance requirement with target difficulty
 */
function generateBalanceRequirement(_customer: Customer, targetDifficulty: number = 0.3): ContractRequirement {
  // Map difficulty to balance thresholds
  // 0.0-0.2 = 40-60% balance (easy)
  // 0.2-0.4 = 60-75% balance (medium)
  // 0.4-0.7 = 75-85% balance (hard)
  // 0.7-1.0 = 85-95% balance (expert)
  
  let minBalance = 0.4;
  if (targetDifficulty < 0.2) {
    minBalance = 0.4 + targetDifficulty * 1.0; // 40-60%
  } else if (targetDifficulty < 0.4) {
    minBalance = 0.6 + (targetDifficulty - 0.2) * 0.75; // 60-75%
  } else if (targetDifficulty < 0.7) {
    minBalance = 0.75 + (targetDifficulty - 0.4) * 0.33; // 75-85%
  } else {
    minBalance = 0.85 + (targetDifficulty - 0.7) * 0.33; // 85-95%
  }
  
  const variance = Math.random() * 0.04 - 0.02;
  minBalance = Math.max(0.3, Math.min(0.95, minBalance + variance));
  
  return {
    type: 'balance',
    value: Math.round(minBalance * 100) / 100
  };
}

/**
 * Generate grape requirement (specific grape type)
 */
function generateGrapeRequirement(_customer: Customer): ContractRequirement {
  // Pick a random grape from available types (imported from constants)
  const targetGrape = AVAILABLE_GRAPES[Math.floor(Math.random() * AVAILABLE_GRAPES.length)];
  
  return {
    type: 'grape',
    value: 1, // Binary: must match
    params: {
      targetGrape
    }
  };
}

/**
 * Generate grape color requirement (red or white)
 */
function generateGrapeColorRequirement(_customer: Customer): ContractRequirement {
  // Pick a random color from available types (imported from constants)
  const targetGrapeColor = AVAILABLE_GRAPE_COLORS[Math.floor(Math.random() * AVAILABLE_GRAPE_COLORS.length)] as 'red' | 'white';
  
  return {
    type: 'grapeColor',
    value: 1, // Binary: must match
    params: {
      targetGrapeColor
    }
  };
}

/**
 * Generate land value requirement with target difficulty
 */
function generateLandValueRequirement(_customer: Customer, targetDifficulty: number = 0.3): ContractRequirement {
  // Map difficulty to land value thresholds
  // 0.0-0.2 = 0.2-0.4 land value (easy)
  // 0.2-0.4 = 0.4-0.6 land value (medium)
  // 0.4-0.7 = 0.6-0.8 land value (hard)
  // 0.7-1.0 = 0.8-0.95 land value (expert)
  
  let minLandValue = 0.2;
  if (targetDifficulty < 0.2) {
    minLandValue = 0.2 + targetDifficulty * 1.0; // 0.2-0.4
  } else if (targetDifficulty < 0.4) {
    minLandValue = 0.4 + (targetDifficulty - 0.2) * 1.0; // 0.4-0.6
  } else if (targetDifficulty < 0.7) {
    minLandValue = 0.6 + (targetDifficulty - 0.4) * 0.67; // 0.6-0.8
  } else {
    minLandValue = 0.8 + (targetDifficulty - 0.7) * 0.5; // 0.8-0.95
  }
  
  const variance = Math.random() * 0.05 - 0.025;
  minLandValue = Math.max(0.15, Math.min(0.95, minLandValue + variance));
  
  return {
    type: 'landValue',
    value: Math.round(minLandValue * 100) / 100
  };
}

/**
 * Calculate contract pricing based on requirements and difficulty
 */
async function calculateContractPricing(customer: Customer, requirements: ContractRequirement[]): Promise<{
  pricePerBottle: number;
  quantity: number;
}> {
  // Base price depends on customer purchasing power and market share
  const basePrice = CONTRACT_PRICING.baseMin + (customer.purchasingPower * (CONTRACT_PRICING.baseMax - CONTRACT_PRICING.baseMin));
  
  // Calculate total difficulty score
  let totalDifficultyScore = 0;
  let requirementCount = requirements.length;
  
  requirements.forEach(req => {
    const { score } = calculateRequirementDifficulty(req);
    totalDifficultyScore += score;
  });
  
  const avgDifficulty = requirementCount > 0 ? totalDifficultyScore / requirementCount : 0;
  
  // Premium multiplier based on difficulty and number of requirements (from constants)
  const difficultyMultiplier = 1.0 + (avgDifficulty * (CONTRACT_PRICING.difficultyMultiplierMax - 1.0));
  const countMultiplier = 1.0 + ((requirementCount - 1) * CONTRACT_PRICING.requirementCountBonus);
  
  const premiumMultiplier = difficultyMultiplier * countMultiplier;
  
  const pricePerBottle = Math.round(basePrice * premiumMultiplier * customer.priceMultiplier * 100) / 100;
  
  // Quantity based on customer market share and type
  // Most customers have 0.5-2% market share (0.005-0.02 on 0-1 scale)
  // Use square root scaling to give smaller customers more reasonable quantities
  const marketShareScaled = Math.sqrt(customer.marketShare);
  
  // Base quantities from imported constants
  const baseQuantity = CONTRACT_BASE_QUANTITIES[customer.customerType];
  
  // Market share scaling with high randomness (0.25-1.75x variation, ±75%)
  const randomFactor = 0.25 + Math.random() * 1.5;
  const quantity = Math.round(baseQuantity * marketShareScaled * randomFactor);
  
  // Minimum quantities from imported constants
  const minQuantity = CONTRACT_MIN_QUANTITIES[customer.customerType];
  
  return { pricePerBottle, quantity: Math.max(minQuantity, quantity) };
}

/**
 * Generate multi-year contract terms
 */
function generateMultiYearTerms() {
  const durationYears = Math.floor(Math.random() * (MULTI_YEAR_CONFIG.maxYears - MULTI_YEAR_CONFIG.minYears + 1)) + MULTI_YEAR_CONFIG.minYears;
  const deliveriesPerYear = Math.floor(Math.random() * (MULTI_YEAR_CONFIG.maxDeliveriesPerYear - MULTI_YEAR_CONFIG.minDeliveriesPerYear + 1)) + MULTI_YEAR_CONFIG.minDeliveriesPerYear;
  
  return {
    durationYears,
    deliveriesPerYear,
    totalDeliveries: durationYears * deliveriesPerYear,
    deliveriesCompleted: 0
  };
}
