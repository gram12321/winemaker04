// Lender generation service - creates lenders with type-based characteristics
import { v4 as uuidv4 } from 'uuid';
import { Lender, LenderType } from '../../types/types';
import { LENDER_TYPE_DISTRIBUTION, LENDER_PARAMS, LENDER_GENERATION } from '../../constants/economyConstants';
import { LENDER_NAMES } from '../../constants/namesConstants';
import { calculateSkewedMultiplier, NormalizeScrewed1000To01WithTail } from '../../utils/calculator';
import { randomInRange } from '../../utils/utils';
import { saveLenders, loadLenders, checkLendersExist } from '../../database/core/lendersDB';

/**
 * Generate lender name based on type
 */
function generateLenderName(lenderType: LenderType): string {
  switch (lenderType) {
    case 'Bank':
      const bankNames = LENDER_NAMES.banks;
      return bankNames[Math.floor(Math.random() * bankNames.length)];
    
    case 'Investment Fund':
      const fundNames = LENDER_NAMES.investmentFunds;
      return fundNames[Math.floor(Math.random() * fundNames.length)];
    
    case 'Private Lender':
      const prefixes = LENDER_NAMES.privateLenderPrefixes;
      const suffixes = LENDER_NAMES.privateLenderSuffixes;
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      return `${prefix} ${suffix}`;
    
    default:
      return 'Unknown Lender';
  }
}


/**
 * Generate lenders for a company
 * Creates 15-25 lenders with type-based distribution and characteristics
 */
export async function generateLenders(): Promise<Lender[]> {
  const lenderCount = LENDER_GENERATION.MIN_LENDERS + 
    Math.floor(Math.random() * (LENDER_GENERATION.MAX_LENDERS - LENDER_GENERATION.MIN_LENDERS + 1));
  
  const lenders: Lender[] = [];
  
  // Generate lenders based on type distribution
  for (let i = 0; i < lenderCount; i++) {
    // Determine lender type based on distribution
    const rand = Math.random();
    let lenderType: LenderType;
    
    if (rand < LENDER_TYPE_DISTRIBUTION.Bank) {
      lenderType = 'Bank';
    } else if (rand < LENDER_TYPE_DISTRIBUTION.Bank + LENDER_TYPE_DISTRIBUTION['Investment Fund']) {
      lenderType = 'Investment Fund';
    } else {
      lenderType = 'Private Lender';
    }
    
    const params = LENDER_PARAMS[lenderType];
    
    // Generate characteristics
    const riskTolerance = randomInRange(params.riskToleranceRange[0], params.riskToleranceRange[1]);
    const flexibility = randomInRange(params.flexibilityRange[0], params.flexibilityRange[1]);
    const marketPresence = calculateSkewedMultiplier(Math.random()); // Like customer market share
    const baseInterestRate = randomInRange(params.baseInterestRange[0], params.baseInterestRange[1]);
    
    // Generate loan parameters
    const minLoanAmount = params.loanAmountRange[0];
    const maxLoanAmount = params.loanAmountRange[1];
    const minDurationSeasons = params.durationRange[0];
    const maxDurationSeasons = params.durationRange[1];
    
    // Generate origination fee parameters
    const originationFeeConfig = params.originationFeeRange;
    const originationFee = {
      basePercent: randomInRange(originationFeeConfig.basePercentRange[0], originationFeeConfig.basePercentRange[1]),
      minFee: randomInRange(originationFeeConfig.minFeeRange[0], originationFeeConfig.minFeeRange[1]),
      maxFee: randomInRange(originationFeeConfig.maxFeeRange[0], originationFeeConfig.maxFeeRange[1]),
      creditRatingModifier: randomInRange(originationFeeConfig.creditRatingModifierRange[0], originationFeeConfig.creditRatingModifierRange[1]),
      durationModifier: randomInRange(originationFeeConfig.durationModifierRange[0], originationFeeConfig.durationModifierRange[1])
    };
    
    const lender: Lender = {
      id: uuidv4(),
      name: generateLenderName(lenderType),
      type: lenderType,
      riskTolerance,
      flexibility,
      marketPresence,
      baseInterestRate,
      minLoanAmount,
      maxLoanAmount,
      minDurationSeasons,
      maxDurationSeasons,
      originationFee,
      blacklisted: false
    };
    
    lenders.push(lender);
  }
  
  return lenders;
}

/**
 * Initialize lenders for a company if they don't exist
 */
export async function initializeLenders(companyId?: string): Promise<void> {
  try {
    const lendersExist = await checkLendersExist(companyId);
    
    if (!lendersExist) {
      const lenders = await generateLenders();
      await saveLenders(lenders, companyId);
    }
  } catch (error) {
    console.error('Error initializing lenders:', error);
    throw error;
  }
}

/**
 * Load all lenders for the current company
 */
export async function getAllLenders(): Promise<Lender[]> {
  try {
    return await loadLenders();
  } catch (error) {
    console.error('Error loading lenders:', error);
    return [];
  }
}

/**
 * Calculate lender availability with prestige influence
 */
export function calculateLenderAvailability(
  lender: Lender, 
  creditRating: number, 
  companyPrestige?: number
): {
  isAvailable: boolean;
  baseRequirement: number;
  prestigeBonus: number;
  adjustedRequirement: number;
  normalizedPrestige: number;
} {
  // Normalize prestige to 0-1 scale (prestige influence is secondary to credit rating)
  const normalizedPrestige = companyPrestige ? NormalizeScrewed1000To01WithTail(companyPrestige) : 0;
  
  // Primary requirement: Credit rating must meet risk tolerance
  const baseRequirement = lender.riskTolerance * 100;
  
  // Secondary influence: Prestige can help with slightly higher risk tolerance
  // Prestige provides up to 20% reduction in risk tolerance requirement
  const prestigeBonus = normalizedPrestige * 20; // Max 20% bonus from prestige
  const adjustedRequirement = baseRequirement - prestigeBonus;
  
  const isAvailable = creditRating >= adjustedRequirement && !lender.blacklisted;
  
  return {
    isAvailable,
    baseRequirement,
    prestigeBonus,
    adjustedRequirement,
    normalizedPrestige
  };
}

/**
 * Get available lenders (not blacklisted) for loan applications
 * Includes both credit rating and prestige influence
 */
export async function getAvailableLenders(creditRating: number, companyPrestige?: number): Promise<Lender[]> {
  try {
    const allLenders = await loadLenders();
    
    return allLenders.filter(lender => {
      const availability = calculateLenderAvailability(lender, creditRating, companyPrestige);
      return availability.isAvailable;
    });
  } catch (error) {
    console.error('Error getting available lenders:', error);
    return [];
  }
}
