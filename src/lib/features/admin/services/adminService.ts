import { v4 as uuidv4 } from 'uuid';
import { clearAllAchievements, clearAllCompanies, clearAllCompaniesAndUsers, clearAllCustomers, clearAllUsers, fullDatabaseReset } from '@/lib/database/admin/adminDB';
import { addTransaction, getCurrentPrestige, clearPrestigeCache, getGameState, highscoreService, initializeCustomers, updateGameState } from '@/lib/services';
import { insertPrestigeEvent } from '@/lib/database';
import { calculateAbsoluteWeeks, formatNumber, getRandomFromArray, randomInt } from '@/lib/utils';
import { GAME_INITIALIZATION, SEASONS, WEEKS_PER_SEASON } from '@/lib/constants';
import type { Season } from '@/lib/types/types';
import { userFeature } from '@/lib/features/user';
import { getCurrentCompany } from '@/lib/services/core/gameState';
import { companyService } from '@/lib/services/user/companyService';
import { researchUpgradeAdminIntegration } from '@/lib/features/researchUpgrade/adminIntegration';
import { awardExperience, getAllStaff } from '@/lib/services/user/staffService';

// ===== ADMIN BUSINESS LOGIC FUNCTIONS =====

/**
 * Admin function to set staff XP for a specific skill category
 * @param staffId - ID of the staff member
 * @param category - XP category (e.g., 'skill:field', 'grape:Chardonnay')
 * @param amount - Amount of XP to set (replaces current value)
 */
export async function adminSetStaffXP(
  staffId: string,
  category: string,
  amount: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const allStaff = await getAllStaff();
    const staff = allStaff.find(s => s.id === staffId);

    if (!staff) {
      return {
        success: false,
        error: 'Staff member not found'
      };
    }

    const currentXP = staff.experience?.[category] || 0;
    const difference = amount - currentXP;

    // Use awardExperience to set the XP (by awarding the difference)
    await awardExperience(staffId, difference, [category]);

    return {
      success: true,
      message: `Set ${category} XP to ${amount} for ${staff.name}`
    };
  } catch (error) {
    console.error('Error setting staff XP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Set gold/money for the active company
 */
export async function adminSetGoldToCompany(amount: number): Promise<void> {
  const targetAmount = amount || 10000;

  // Get current money from game state
  const gameState = getGameState();
  const currentMoney = gameState.money || 0;

  // Calculate the difference needed to reach target amount
  const difference = targetAmount - currentMoney;

  // Only add transaction if there's a difference
  if (difference !== 0) {
    await addTransaction(difference, `Admin: Set to ${formatNumber(targetAmount, { currency: true })} (was ${formatNumber(currentMoney, { currency: true })})`, 'admin_cheat');
  }
}

/**
 * Set player cash balance for the user associated with the active company
 */
export async function adminSetPlayerBalance(
  amount: number,
  userIdOverride?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const targetAmount = amount || 10000;

    // Get current company to find associated user
    const currentCompany = getCurrentCompany();
    if (!currentCompany) {
      return { success: false, error: 'No active company found' };
    }

    // Get full company data to access userId
    const company = await companyService.getCompany(currentCompany.id);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    const targetUserId = userIdOverride || company.userId;
    if (!targetUserId) {
      return { success: false, error: 'Company is not associated with a user' };
    }

    // Set the player balance
    const result = await userFeature.wallet.setBalance(targetUserId, targetAmount);

    if (result.success) {
      return {
        success: true,
        message: `Player balance set to ${formatNumber(targetAmount, { currency: true })} for user ${targetUserId}`
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to set player balance'
      };
    }
  } catch (error) {
    console.error('Error setting player balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set player balance'
    };
  }
}

/**
 * Add prestige to the active company
 */
export async function adminAddPrestigeToCompany(amount: number): Promise<void> {
  const parsedAmount = amount || 100;

  try {
    const gameState = getGameState();
    const currentWeek = calculateAbsoluteWeeks(
      gameState.week!,
      gameState.season!,
      gameState.currentYear!
    );

    // Add prestige event using the proper service layer
    await insertPrestigeEvent({
      id: uuidv4(),
      type: 'admin_cheat',
      amount_base: parsedAmount,
      created_game_week: currentWeek,
      decay_rate: 0, // Admin prestige doesn't decay
      source_id: null,
      payload: {
        reason: 'Admin cheat',
        addedAmount: parsedAmount
      }
    });

    // Clear prestige cache to force recalculation
    clearPrestigeCache();
    await getCurrentPrestige();

  } catch (error) {
    console.error('Failed to add prestige event:', error);
    throw error;
  }
}

/**
 * Clear all highscores
 */
export async function adminClearAllHighscores(): Promise<{ success: boolean; message?: string }> {
  return await highscoreService.clearHighscores();
}

/**
 * Clear company value highscores
 */
export async function adminClearCompanyValueHighscores(): Promise<{ success: boolean; message?: string }> {
  return await highscoreService.clearHighscores('company_value');
}

/**
 * Clear company value per week highscores
 */
export async function adminClearCompanyValuePerWeekHighscores(): Promise<{ success: boolean; message?: string }> {
  return await highscoreService.clearHighscores('company_value_per_week');
}

/**
 * Clear all companies from database
 */
export async function adminClearAllCompanies(): Promise<void> {
  await clearAllCompanies();
}

/**
 * Clear all users from database
 */
export async function adminClearAllUsers(): Promise<void> {
  await clearAllUsers();
}

/**
 * Clear all companies and users from database
 */
export async function adminClearAllCompaniesAndUsers(): Promise<void> {
  await clearAllCompaniesAndUsers();
}

/**
 * Recreate all customers
 */
export async function adminRecreateCustomers(): Promise<void> {
  try {
    // First clear all existing customers
    await clearAllCustomers();

    // Then recreate them
    await initializeCustomers(1); // Initialize with base prestige
  } catch (error) {
    console.error('Error recreating customers:', error);
    throw error;
  }
}

/**
 * Admin force: Generate test orders bypassing prestige checks
 * Uses the real sophisticated order generation logic with full wine evaluation
 */
export async function adminGenerateTestOrders(): Promise<{ totalOrdersCreated: number; customersGenerated: number }> {
  // Import needed functions
  const { generateOrder } = await import('@/lib/services/sales/generateOrder');
  const { getAllCustomers } = await import('@/lib/services/sales/createCustomer');
  const { getAllWineBatches } = await import('@/lib/services/wine/winery/inventoryService');
  const { loadVineyards } = await import('@/lib/database/activities/vineyardDB');
  const { getCurrentPrestige } = await import('@/lib/services/core/gameState');
  const { SALES_CONSTANTS } = await import('@/lib/constants/constants');

  // Get or create customers
  let allCustomers = await getAllCustomers();
  if (allCustomers.length === 0) {
    console.log('No customers found, creating them...');
    await initializeCustomers();
    allCustomers = await getAllCustomers();
  }

  if (allCustomers.length === 0) {
    console.log('❌ Failed to create customers');
    return { totalOrdersCreated: 0, customersGenerated: 0 };
  }

  // Select random customer
  const customer = getRandomFromArray(allCustomers);
  const customerTypeConfig = SALES_CONSTANTS.CUSTOMER_TYPES[customer.customerType];

  // Load all available wines and vineyards (like real order generation)
  const [allBatches, allVineyards] = await Promise.all([
    getAllWineBatches(),
    loadVineyards()
  ]);
  const availableWines = allBatches.filter((batch: any) => batch.state === 'bottled' && batch.quantity > 0);

  if (availableWines.length === 0) {
    console.log('❌ No bottled wines available for orders');
    return { totalOrdersCreated: 0, customersGenerated: 0 };
  }

  // Get current prestige for realistic order evaluation
  const currentPrestige = await getCurrentPrestige();

  // Try to generate orders using the sophisticated flow (with diminishing returns)
  const orders = [];

  for (let i = 0; i < availableWines.length && orders.length < 3; i++) {
    const wineBatch = availableWines[i];
    const ordersPlaced = orders.length;

    // Calculate diminishing returns (same as real flow)
    const gameState = getGameState();
    const economyPhase = (gameState.economyPhase || 'Stable');
    const ECONOMY_SALES_MULTIPLIERS: Record<string, { multipleOrderPenaltyMultiplier: number }> = {
      Crash: { multipleOrderPenaltyMultiplier: 0.5 },
      Recession: { multipleOrderPenaltyMultiplier: 0.7 },
      Stable: { multipleOrderPenaltyMultiplier: 1.0 },
      Expansion: { multipleOrderPenaltyMultiplier: 1.2 },
      Boom: { multipleOrderPenaltyMultiplier: 1.5 }
    };
    const multiplePenaltyBoost = ECONOMY_SALES_MULTIPLIERS[economyPhase]?.multipleOrderPenaltyMultiplier || 1.0;
    const effectivePenalty = customerTypeConfig.multipleOrderPenalty * multiplePenaltyBoost;
    const multipleOrderModifier = Math.pow(effectivePenalty, ordersPlaced);

    // Find vineyard
    const vineyard = allVineyards.find((v: any) => v.id === wineBatch.vineyardId);
    if (!vineyard) continue;

    // Generate order using real logic (includes rejection probability, pricing, etc.)
    const order = await generateOrder(customer, wineBatch, multipleOrderModifier, vineyard, currentPrestige);

    if (order) {
      orders.push(order);
    }
  }

  if (orders.length > 0) {
    console.log('✅ Admin orders generated:', {
      customer: customer.name,
      customerType: customer.customerType,
      ordersCreated: orders.length,
      totalValue: orders.reduce((sum, o) => sum + o.totalValue, 0).toFixed(2),
      wines: orders.map(o => o.wineName)
    });
  } else {
    console.log('❌ No orders generated (all wines rejected by customer)');
  }

  return {
    totalOrdersCreated: orders.length,
    customersGenerated: 0
  };
}

/**
 * Admin force: Generate test contract bypassing all checks
 * Uses the EXACT SAME contract generation logic as normal gameplay:
 * - Quantity calculation based on customer market share and type
 * - Requirement generation based on customer type and relationship
 * - Pricing based on difficulty and customer purchasing power
 * Only difference: bypasses eligibility and chance checks
 */
export async function adminGenerateTestContract(): Promise<{ success: boolean; message: string }> {
  const { getAllCustomers } = await import('@/lib/services/sales/createCustomer');
  const { generateContractForCustomer } = await import('@/lib/services/sales/contractGenerationService');
  const { saveWineContract } = await import('@/lib/database/sales/contractDB');

  // Get or create customers
  let allCustomers = await getAllCustomers();
  if (allCustomers.length === 0) {
    console.log('No customers found, creating them...');
    await initializeCustomers();
    allCustomers = await getAllCustomers();
  }

  if (allCustomers.length === 0) {
    return { success: false, message: 'No customers available' };
  }

  // Select a random customer
  const customer = getRandomFromArray(allCustomers);

  // Use the real contract generation logic (same quantity/pricing as normal contracts)
  // This shares the exact same calculateContractPricing function as normal gameplay
  const contract = await generateContractForCustomer(customer);

  // Save to database
  await saveWineContract(contract);

  console.log('✅ Admin contract generated:', {
    customer: customer.name,
    type: customer.customerType,
    requirements: contract.requirements.map(r => `${r.type}: ${r.value}`),
    quantity: contract.requestedQuantity,
    value: contract.totalValue.toFixed(2),
    multiYear: contract.terms ? `${contract.terms.durationYears} years` : 'single'
  });

  return {
    success: true,
    message: `Contract generated for ${customer.name}: ${contract.requestedQuantity} bottles @ ${formatNumber(contract.offeredPrice, { currency: true, decimals: 2 })}/bottle`
  };
}

export async function adminGenerateTestBottlePresaleContract(): Promise<{ success: boolean; message: string }> {
  const { getAvailableBuyers } = await import('@/lib/services/sales/sellGrapesService');
  const { saveForwardContract } = await import('@/lib/database/sales/forwardContractDB');
  const { FORWARD_CONTRACT_CONFIG } = await import('@/lib/constants/contractConstants');

  const buyers = await getAvailableBuyers();
  if (buyers.length === 0) {
    return { success: false, message: 'No bulk buyers available' };
  }

  const buyer = getRandomFromArray(buyers);
  const gameState = getGameState();
  const createdWeek = gameState.week || 1;
  const createdSeason = (gameState.season || 'Spring') as Season;
  const createdYear = gameState.currentYear || 2024;

  const nextSeasonMap: Record<Season, Season> = {
    Spring: 'Summer',
    Summer: 'Fall',
    Fall: 'Winter',
    Winter: 'Spring'
  };

  const dueSeason = nextSeasonMap[createdSeason];
  const dueYear = createdSeason === 'Winter' ? createdYear + 1 : createdYear;

  const quantityBottles = randomInt(
    Math.max(FORWARD_CONTRACT_CONFIG.minQuantityKg, 120),
    Math.min(FORWARD_CONTRACT_CONFIG.maxQuantityKg, 1200)
  );
  const unitPricePerBottle = Math.round((4.5 + Math.random() * 4.5) * Math.max(0.8, buyer.priceMultiplier || 1) * 100) / 100;
  const totalValue = Math.round(quantityBottles * unitPricePerBottle * 100) / 100;
  const upfrontPaidAmount = Math.round(totalValue * FORWARD_CONTRACT_CONFIG.upfrontPercent * 100) / 100;
  const finalPaymentAmount = Math.round((totalValue - upfrontPaidAmount) * 100) / 100;
  const defaultPenaltyAmount = Math.round(upfrontPaidAmount * FORWARD_CONTRACT_CONFIG.defaultPenaltyPercentOnAdvance * 100) / 100;

  await saveForwardContract({
    id: uuidv4(),
    companyId: '',
    buyerId: buyer.id,
    buyerName: buyer.name,
    targetState: 'bottled',
    targetGrape: Math.random() < 0.5 ? undefined : getRandomFromArray(['Chardonnay', 'Pinot Noir', 'Sauvignon Blanc', 'Sangiovese', 'Tempranillo', 'Barbera', 'Primitivo']),
    quantityKg: quantityBottles,
    deliveredKg: 0,
    unitPricePerKg: unitPricePerBottle,
    totalValue,
    upfrontPercent: FORWARD_CONTRACT_CONFIG.upfrontPercent,
    upfrontPaidAmount,
    finalPaymentAmount,
    defaultPenaltyAmount,
    status: 'offered',
    createdWeek,
    createdSeason,
    createdYear,
    dueWeek: 1,
    dueSeason,
    dueYear,
  });

  return {
    success: true,
    message: `Bottle pre-sale offer generated for ${buyer.name}: ${quantityBottles.toLocaleString()} bottles @ ${formatNumber(unitPricePerBottle, { currency: true, decimals: 2 })}/bottle`
  };
}

export async function adminGenerateTestForwardPresaleContract(): Promise<{ success: boolean; message: string }> {
  const { getAvailableBuyers } = await import('@/lib/services/sales/sellGrapesService');
  const { saveForwardContract } = await import('@/lib/database/sales/forwardContractDB');
  const { FORWARD_CONTRACT_CONFIG } = await import('@/lib/constants/contractConstants');

  const buyers = await getAvailableBuyers();
  if (buyers.length === 0) {
    return { success: false, message: 'No grape buyers available' };
  }

  const buyer = getRandomFromArray(buyers);
  const gameState = getGameState();
  const createdWeek = gameState.week || 1;
  const createdSeason = (gameState.season || 'Spring') as Season;
  const createdYear = gameState.currentYear || 2024;

  const nextSeasonMap: Record<Season, Season> = {
    Spring: 'Summer',
    Summer: 'Fall',
    Fall: 'Winter',
    Winter: 'Spring'
  };

  const dueSeason = nextSeasonMap[createdSeason];
  const dueYear = createdSeason === 'Winter' ? createdYear + 1 : createdYear;

  const quantityKg = randomInt(
    Math.max(FORWARD_CONTRACT_CONFIG.minQuantityKg, 250),
    Math.min(FORWARD_CONTRACT_CONFIG.maxQuantityKg, 1500)
  );
  const unitPricePerKg = Math.round((2.1 + Math.random() * 1.6) * Math.max(0.8, buyer.priceMultiplier || 1) * 100) / 100;
  const totalValue = Math.round(quantityKg * unitPricePerKg * 100) / 100;
  const upfrontPaidAmount = Math.round(totalValue * FORWARD_CONTRACT_CONFIG.upfrontPercent * 100) / 100;
  const finalPaymentAmount = Math.round((totalValue - upfrontPaidAmount) * 100) / 100;
  const defaultPenaltyAmount = Math.round(upfrontPaidAmount * FORWARD_CONTRACT_CONFIG.defaultPenaltyPercentOnAdvance * 100) / 100;

  const targetStates = ['grapes', 'must_ready', 'must_fermenting', 'bottled', 'any'] as const;
  const targetState = getRandomFromArray(targetStates);

  await saveForwardContract({
    id: uuidv4(),
    companyId: '',
    buyerId: buyer.id,
    buyerName: buyer.name,
    targetState,
    targetGrape: Math.random() < 0.5 ? undefined : getRandomFromArray(['Chardonnay', 'Pinot Noir', 'Sauvignon Blanc', 'Sangiovese', 'Tempranillo', 'Barbera', 'Primitivo']),
    quantityKg,
    deliveredKg: 0,
    unitPricePerKg,
    totalValue,
    upfrontPercent: FORWARD_CONTRACT_CONFIG.upfrontPercent,
    upfrontPaidAmount,
    finalPaymentAmount,
    defaultPenaltyAmount,
    status: 'offered',
    createdWeek,
    createdSeason,
    createdYear,
    dueWeek: 1,
    dueSeason,
    dueYear,
  });

  return {
    success: true,
    message: `Grape forward pre-sale offer generated for ${buyer.name}: ${quantityKg.toLocaleString()} kg @ ${formatNumber(unitPricePerKg, { currency: true, decimals: 2 })}/kg`
  };
}


/**
 * Clear all achievements
 */
export async function adminClearAllAchievements(): Promise<void> {
  await clearAllAchievements();
}

interface AdminGameDatePayload {
  week: number;
  season: Season;
  year: number;
}

/**
 * Set the game date (week, season, year) for the active company
 */
export async function adminSetGameDate({ week, season, year }: AdminGameDatePayload): Promise<void> {
  const normalizedWeek = Number.isFinite(week)
    ? Math.min(Math.max(Math.floor(week), 1), WEEKS_PER_SEASON)
    : GAME_INITIALIZATION.STARTING_WEEK;

  const normalizedSeason = SEASONS.includes(season) ? season : GAME_INITIALIZATION.STARTING_SEASON;

  const normalizedYear = Number.isFinite(year)
    ? Math.max(Math.floor(year), GAME_INITIALIZATION.STARTING_YEAR)
    : GAME_INITIALIZATION.STARTING_YEAR;

  await updateGameState({
    week: normalizedWeek,
    season: normalizedSeason,
    currentYear: normalizedYear
  });
}

/**
 * Grant all research projects to the active company
 */
export async function adminGrantAllResearch(): Promise<{ success: boolean; unlocked: number; alreadyUnlocked: number }> {
  return researchUpgradeAdminIntegration.grantAllResearch();
}

/**
 * Remove all research unlocks from the active company
 */
export async function adminRemoveAllResearch(): Promise<{ success: boolean; removed: number }> {
  return researchUpgradeAdminIntegration.removeAllResearch();
}

/**
 * Full database reset - clears all tables
 */
export async function adminFullDatabaseReset(): Promise<void> {
  await fullDatabaseReset();
}
