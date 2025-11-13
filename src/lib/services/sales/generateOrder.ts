// Order generation service - handles wine order creation with pricing and rejection logic
import { v4 as uuidv4 } from 'uuid';
import { WineOrder, Customer, WineBatch, Vineyard, GrapeVariety, DifficultyPreference } from '../../types/types';
import { loadVineyards } from '../../database/activities/vineyardDB';
import { saveWineOrder } from '../../database/customers/salesDB';
import { getGameState } from '../core/gameState';
import { formatCompletedWineName } from '../wine/winery/inventoryService';
import { SALES_CONSTANTS } from '../../constants/constants';
import { ECONOMY_SALES_MULTIPLIERS } from '../../constants/economyConstants';
import { calculateOrderAmount, calculateSkewedMultiplier } from '../../utils/calculator';
import { notificationService } from '../core/notificationService';
import { NotificationCategory } from '../../types/types';
import { calculateCustomerRelationship } from './createCustomer';
import { calculateCustomerRelationshipBoosts } from './relationshipService';
import { getCurrentPrestige } from '../core/gameState';
import { activateCustomer } from '../../database/customers/customerDB';
import { calculateEstimatedPrice, calculateFeaturePriceMultiplier, calculateGrapeDifficulty } from '@/lib/services';

// Use customer type configurations from constants
const CUSTOMER_TYPE_CONFIG = SALES_CONSTANTS.CUSTOMER_TYPES;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface DifficultyImpact {
  grapeDifficulty: number | null;
  affinity: number;
  priceFactor: number;
  quantityFactor: number;
  rejectionFactor: number;
}

function resolveDifficultyPreference(customer: Customer): DifficultyPreference | undefined {
  return customer.difficultyPreference ?? CUSTOMER_TYPE_CONFIG[customer.customerType]?.difficultyPreference;
}

function evaluateDifficultyImpact(grape: GrapeVariety, preference?: DifficultyPreference): DifficultyImpact {
  if (!preference || preference.weight <= 0) {
    return {
      grapeDifficulty: null,
      affinity: 0.5,
      priceFactor: 1,
      quantityFactor: 1,
      rejectionFactor: 1
    };
  }

  const breakdown = calculateGrapeDifficulty(grape);
  const difficulty = breakdown.score;
  const tolerance = preference.tolerance > 0 ? preference.tolerance : 0.0001;
  const delta = difficulty - preference.target;
  const normalized = Math.abs(delta) / tolerance;

  let affinity = Math.exp(-normalized * normalized);
  const directionalBias = clamp(preference.bias, 0, 1) - 0.5;
  if (delta >= 0) {
    affinity *= 1 + directionalBias;
  } else {
    affinity *= 1 - directionalBias;
  }
  affinity = clamp(affinity, 0, 1);

  const weight = clamp(preference.weight, 0, 1);
  const centered = (affinity - 0.5) * weight;

  const priceFactor = clamp(1 + centered * 0.4, 0.6, 1.4);
  const quantityFactor = clamp(1 + centered * 0.6, 0.5, 1.6);
  const rejectionFactor = clamp(1 - centered * 0.7, 0.5, 1.6);

  return {
    grapeDifficulty: difficulty,
    affinity,
    priceFactor,
    quantityFactor,
    rejectionFactor
  };
}

// ===== REJECTION CALCULATIONS =====

/**
 * Calculate rejection probability based on price ratio
 * Uses asymmetrical multiplier to create increasing rejection chance as bid price becomes too high
 * 
 * Business Logic:
 * - bidPrice: The value the buyer has to bid to get the wine (computer-generated customer offer)
 * - finalPrice: The calculated perceived value of the wine (using new pricing system)
 * - Customers reject when they have to pay MORE than the wine's perceived value (bad deal)
 * - Customers never reject when they can get wine at or below its perceived value (good deal)
 * - Premium order types (Private Collector, Export) are more tolerant of high prices
 * 
 * @param bidPrice - The price the customer is bidding (their offer)
 * @param finalPrice - The calculated perceived value of the wine (from pricing service)
 * @returns Rejection probability between 0 and 1
 */
function calculateRejectionProbability(bidPrice: number, finalPrice: number): number {
  if (bidPrice <= finalPrice) {
    return 0; // No rejection if getting wine at or below its perceived value (good deal)
  }
  
  // Calculate how much above wine value the customer has to pay
  const premiumRatio = bidPrice / finalPrice; // > 1.0 means paying premium
  
  // Map unlimited premium ratio to 0-1 using sigmoid mapping (no tolerance)
  const mappedInput = 1 - (1 / premiumRatio);
  
  // Shift input up by 0.4 to skip polynomial range and get higher rejection rates
  const shiftedInput = Math.min(1.0, mappedInput + 0.4);
  
  // Use stepped balance function to get rejection probability 0-1
  const rejectionProbability = calculateSkewedMultiplier(shiftedInput);
  
  return rejectionProbability;
}

// ===== ORDER GENERATION =====


// Generate a wine order when a customer is interested (wine value + quality-based decision)
export async function generateOrder(
  customer: Customer, 
  specificWineBatch: WineBatch, 
  multipleOrderModifier: number = 1.0,
  vineyard?: Vineyard,
  currentPrestige?: number
): Promise<WineOrder | null> {
  // Use provided vineyard or load if not provided (for backwards compatibility)
  let vineyardData = vineyard;
  if (!vineyardData) {
    const allVineyards = await loadVineyards();
    vineyardData = allVineyards.find(v => v.id === specificWineBatch.vineyardId);
    
    if (!vineyardData) {
      console.warn(`Vineyard not found for batch ${specificWineBatch.id}`);
      return null;
    }
  }
  
  // Use customer's order type and characteristics
  const config = CUSTOMER_TYPE_CONFIG[customer.customerType];
  const difficultyPreference = resolveDifficultyPreference(customer);
  const difficultyImpact = evaluateDifficultyImpact(specificWineBatch.grape, difficultyPreference);
  
  // Calculate current relationship using provided prestige or fresh lookup
  const prestigeValue = currentPrestige ?? await getCurrentPrestige();
  
  // Recalculate estimated price to include post-bottling developments and prestige effects
  const basePrice = calculateEstimatedPrice(
    specificWineBatch,
    vineyardData,
    prestigeValue,
    vineyardData.vineyardPrestige
  );

  // Resolve asking price (user-set overrides calculated price)
  const resolvedAskingPrice = clamp(
    specificWineBatch.askingPrice ?? basePrice,
    0.01,
    SALES_CONSTANTS.MAX_PRICE
  );
  const askingPrice = Math.round(resolvedAskingPrice * 100) / 100;
  
  const baseRelationship = calculateCustomerRelationship(customer.marketShare, prestigeValue);
  const relationshipBoosts = await calculateCustomerRelationshipBoosts(customer.id);
  const currentRelationship = baseRelationship + relationshipBoosts;
  
  // Apply relationship modifier to price multiplier
  const relationshipPriceBonus = 1 + currentRelationship * 0.001; // 0.1% per relationship point
  const relationshipAdjustedMultiplier = customer.priceMultiplier * relationshipPriceBonus;
  
  // Apply feature price sensitivity (oxidation, etc.)
  const featurePriceMultiplier = calculateFeaturePriceMultiplier(specificWineBatch, customer.customerType);
  
  // Use customer's individual price multiplier with relationship bonus and feature sensitivity
  let bidPrice = askingPrice * relationshipAdjustedMultiplier * featurePriceMultiplier;
  bidPrice *= difficultyImpact.priceFactor;
  bidPrice = Math.round(bidPrice * 100) / 100;
  bidPrice = Math.max(0, Math.min(bidPrice, SALES_CONSTANTS.MAX_PRICE));
  
  // Check for outright rejection based on price ratio
  let rejectionProbability = calculateRejectionProbability(bidPrice, basePrice);
  rejectionProbability = clamp(rejectionProbability * difficultyImpact.rejectionFactor, 0, 1);
  
  // Apply relationship modifier to rejection probability (better relationships = less likely to reject)
  const relationshipRejectionModifier = 1 - currentRelationship * 0.005; // 0.5% reduction per relationship point
  rejectionProbability = rejectionProbability * Math.max(0.1, relationshipRejectionModifier); // Minimum 10% of base rejection
  
  // Apply economy price tolerance (reduce/increase rejection based on phase)
  const economyPhase = (getGameState().economyPhase || 'Stable') as keyof typeof ECONOMY_SALES_MULTIPLIERS;
  const priceToleranceMultiplier = ECONOMY_SALES_MULTIPLIERS[economyPhase].priceToleranceMultiplier;
  rejectionProbability = rejectionProbability / priceToleranceMultiplier;

  // Apply multiple order modifier - add rejection penalty for multiple orders
  // If base rejection is 0% (discount), add penalty instead of multiplying
  // If base rejection > 0%, multiply as before
  if (rejectionProbability === 0) {
    // No base rejection (discount situation) - add multiple order penalty
    // Convert modifier to penalty: 0.6x modifier = 40% penalty, 0.1x modifier = 90% penalty
    const multipleOrderPenalty = 1 - multipleOrderModifier;
    rejectionProbability = multipleOrderPenalty;
  } else {
    // Has base rejection - multiply as before
    rejectionProbability = rejectionProbability / multipleOrderModifier;
  }
  rejectionProbability = Math.max(0, Math.min(1, rejectionProbability)); // Clamp to 0-1 range
  
  const rejectionRandomValue = Math.random();
  
  // Calculate the multipliers for storage
  const purchasingPowerMultiplier = customer.purchasingPower;
  const wineTraditionMultiplier = customer.wineTradition;
  const marketShareMultiplier = 1 - customer.marketShare; // Relative to 1
  
  // Estimate the base multiplier
  const totalMultiplier = purchasingPowerMultiplier * wineTraditionMultiplier * marketShareMultiplier;
  const estimatedBaseMultiplier = customer.priceMultiplier / totalMultiplier;
  
  // Order evaluation in progress (no logging needed)
  
  if (rejectionRandomValue < rejectionProbability) {
    // Customer outright rejects the price and walks away
    const notificationMessage = `${customer.name} from ${customer.country} was interested in ${formatCompletedWineName(specificWineBatch)}, but outright rejected our asking price.`;
    
    // Trigger notification for rejected order
    await notificationService.addMessage(notificationMessage, 'generateOrder.generateOrderForSpecificWine', 'Order Rejected', NotificationCategory.SALES_ORDERS);
    
    return null; // No order generated
  }
  
  // Calculate order amount adjustment based on price difference
  // Use customer's bid price vs our asking price to determine quantity sensitivity
  const orderAmountMultiplier = Math.max(
    0,
    calculateOrderAmount(
      { askingPrice: bidPrice }, // Customer's actual bid price
      askingPrice,               // Our asking price (what we want to charge)
      customer.customerType
    ) * difficultyImpact.quantityFactor
  );
  
  // Generate baseline quantity from order type range, then scale by price sensitivity and customer characteristics
  // The range acts as a baseline market appetite; calculateOrderAmount and customer quantityMultiplier scale this.
  const [minQty, maxQty] = config.quantityRange;
  const baseQuantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

  // Scale baseline by price sensitivity and regional factors (removed customer quantity multiplier)
  // Convert market share from decimal (0.01) to percentage multiplier (1.01) for quantity calculation
  const relationshipQuantityBonus = 1 + currentRelationship * 0.002; // 0.2% per relationship point
  const quantityMarketShareMultiplier = (1 + customer.marketShare) * relationshipQuantityBonus; // 0.01 → 1.01x + relationship bonus
  let desiredQuantity = Math.floor(
    baseQuantity * 
    orderAmountMultiplier * 
    customer.purchasingPower * 
    customer.wineTradition * 
    quantityMarketShareMultiplier
  );

  // Apply economy quantity multiplier
  const quantityMultiplier = ECONOMY_SALES_MULTIPLIERS[economyPhase].quantityMultiplier;
  desiredQuantity = Math.max(0, Math.floor(desiredQuantity * quantityMultiplier));

  // Quantity calculation completed (no logging needed)

  // Check if the desired quantity meets the minimum order requirement
  if (desiredQuantity < minQty) {
    
    // Order rejected - asking price too high, customer backs down
    const notificationMessage = `${customer.name} from ${customer.country} wanted to buy ${formatCompletedWineName(specificWineBatch)}, but with our current asking price the amount they could afford simply became too low.`;
    
    // Trigger notification for rejected order
    await notificationService.addMessage(notificationMessage, 'generateOrder.generateOrderForSpecificWine', 'Order Rejected', NotificationCategory.SALES_ORDERS);
    
    return null; // No order generated
  }

  // Calculate fulfillable quantity based on current inventory  
  const fulfillableQuantity = Math.min(desiredQuantity, specificWineBatch.quantity);
  let fulfillableValue = Math.round(fulfillableQuantity * bidPrice * 100) / 100;
  
  // Cap the fulfillable value to prevent database overflow
  fulfillableValue = Math.min(fulfillableValue, SALES_CONSTANTS.MAX_PRICE);
  
  const gameState = getGameState();
  const order: WineOrder = {
    id: uuidv4(),
    orderedAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    },
    customerType: customer.customerType,
    wineBatchId: specificWineBatch.id,
    wineName: formatCompletedWineName(specificWineBatch),
    requestedQuantity: desiredQuantity,
    offeredPrice: bidPrice, // Store as offeredPrice in the order object for compatibility
    totalValue: Math.min(Math.round(desiredQuantity * bidPrice * 100) / 100, SALES_CONSTANTS.MAX_PRICE),
    fulfillableQuantity,
    fulfillableValue,
    askingPriceAtOrderTime: askingPrice, // Store the asking price at order time
    status: 'pending',
    
    // Customer information for sophisticated order tracking
    customerId: customer.id,
    customerName: customer.name,
    customerCountry: customer.country,
    customerRelationship: currentRelationship,
    
    // Calculation data for tooltips and analysis
    calculationData: {
      // Price multiplier calculation
      estimatedBaseMultiplier,
      purchasingPowerMultiplier,
      wineTraditionMultiplier,
      marketShareMultiplier,
      finalPriceMultiplier: customer.priceMultiplier,
      relationshipBonusMultiplier: relationshipPriceBonus,
      relationshipAdjustedMultiplier,
      featurePriceMultiplier, // Feature impact on price (oxidation, etc.)
      
      // Quantity calculation
      baseQuantity,
      priceSensitivity: orderAmountMultiplier,
      quantityMarketShareMultiplier,
      finalQuantity: desiredQuantity,
      
      // Rejection analysis
      baseRejectionProbability: calculateRejectionProbability(bidPrice, basePrice),
      multipleOrderModifier,
      finalRejectionProbability: rejectionProbability,
      randomValue: rejectionRandomValue,
      wasRejected: false, // This order was accepted
      difficulty: difficultyImpact.grapeDifficulty !== null ? {
        grapeDifficulty: difficultyImpact.grapeDifficulty,
        affinity: difficultyImpact.affinity,
        priceFactor: difficultyImpact.priceFactor,
        quantityFactor: difficultyImpact.quantityFactor,
        rejectionFactor: difficultyImpact.rejectionFactor
      } : undefined
    }
  };
  
  await saveWineOrder(order);
  

  if (!customer.activeCustomer) {
    await activateCustomer(customer.id, currentRelationship);
  }
  

  
  return order;
}

