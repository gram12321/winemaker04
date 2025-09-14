// Order generation service - handles wine order creation with pricing and rejection logic
import { v4 as uuidv4 } from 'uuid';
import { WineOrder, Customer } from '../../types';
import { saveWineOrder, loadVineyards } from '../../database/database';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { getGameState } from '../gameState';
import { formatCompletedWineName } from '../wineBatchService';
import { SALES_CONSTANTS } from '../../constants';
import { calculateOrderAmount, calculateSteppedBalance } from '../../utils/calculator';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { calculateCustomerRelationship } from './createCustomer';
import { calculateCustomerRelationshipBoost } from '../../database/prestigeService';
import { getCurrentPrestige } from '../gameState';
import { activateCustomer } from '../../database/customerDatabaseService';
import { getCurrentCompany } from '../gameState';

// Use customer type configurations from constants
const CUSTOMER_TYPE_CONFIG = SALES_CONSTANTS.CUSTOMER_TYPES;

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
  const rejectionProbability = calculateSteppedBalance(shiftedInput);
  
  return rejectionProbability;
}

// ===== ORDER GENERATION =====


// Generate a wine order when a customer is interested (wine value + quality-based decision)
export async function generateOrder(customer: Customer, specificWineBatch: any, multipleOrderModifier: number = 1.0): Promise<WineOrder | null> {
  // Get current company ID for loading vineyards
  const currentCompany = getCurrentCompany();
  const companyId = currentCompany?.id || '00000000-0000-0000-0000-000000000000';
  
  const allVineyards = await loadVineyards(companyId);
  
  // Use the provided customer and wine batch (no backwards compatibility)
  const orderCustomer = customer;
  const selectedBatch = specificWineBatch;
  
  // Find the corresponding vineyard for pricing context
  const vineyard = allVineyards.find(v => v.id === selectedBatch.vineyardId);
  
  if (!vineyard) {
    console.warn(`Vineyard not found for batch ${selectedBatch.id}`);
    return null;
  }
  
  // Use customer's order type and characteristics
  const config = CUSTOMER_TYPE_CONFIG[orderCustomer.customerType];
  
  // Get asking price (user-set or default) and base calculated price
  const askingPrice = selectedBatch.askingPrice ?? selectedBatch.finalPrice;
  const basePrice = selectedBatch.finalPrice; // This is now calculated by the new pricing service
  
  // Calculate current relationship using fresh prestige value
  const currentPrestige = await getCurrentPrestige();
  const baseRelationship = calculateCustomerRelationship(orderCustomer.marketShare, currentPrestige);
  const relationshipBoosts = await calculateCustomerRelationshipBoost(orderCustomer.id);
  const currentRelationship = baseRelationship + relationshipBoosts;
  
  // Apply relationship modifier to price multiplier
  const relationshipPriceBonus = 1 + currentRelationship * 0.001; // 0.1% per relationship point
  const relationshipAdjustedMultiplier = orderCustomer.priceMultiplier * relationshipPriceBonus;
  
  // Use customer's individual price multiplier with relationship bonus
  const bidPrice = Math.round(askingPrice * relationshipAdjustedMultiplier * 100) / 100;
  
  // Check for outright rejection based on price ratio
  let rejectionProbability = calculateRejectionProbability(bidPrice, basePrice);
  
  // Apply relationship modifier to rejection probability (better relationships = less likely to reject)
  const relationshipRejectionModifier = 1 - currentRelationship * 0.005; // 0.5% reduction per relationship point
  rejectionProbability = rejectionProbability * Math.max(0.1, relationshipRejectionModifier); // Minimum 10% of base rejection
  
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
  const purchasingPowerMultiplier = orderCustomer.purchasingPower;
  const wineTraditionMultiplier = orderCustomer.wineTradition;
  const marketShareMultiplier = 1 - orderCustomer.marketShare; // Relative to 1
  
  // Estimate the base multiplier
  const totalMultiplier = purchasingPowerMultiplier * wineTraditionMultiplier * marketShareMultiplier;
  const estimatedBaseMultiplier = orderCustomer.priceMultiplier / totalMultiplier;
  
  // Order evaluation in progress (no logging needed)
  
  if (rejectionRandomValue < rejectionProbability) {
    // Customer outright rejects the price and walks away
    const notificationMessage = `${orderCustomer.name} from ${orderCustomer.country} was interested in ${formatCompletedWineName(selectedBatch)}, but outright rejected our asking price.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }
  
  // Calculate order amount adjustment based on price difference
  // Use customer's bid price vs our asking price to determine quantity sensitivity
  const orderAmountMultiplier = calculateOrderAmount(
    { askingPrice: bidPrice }, // Customer's actual bid price
    askingPrice,               // Our asking price (what we want to charge)
    orderCustomer.customerType
  );
  
  // Generate baseline quantity from order type range, then scale by price sensitivity and customer characteristics
  // The range acts as a baseline market appetite; calculateOrderAmount and customer quantityMultiplier scale this.
  const [minQty, maxQty] = config.quantityRange;
  const baseQuantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

  // Scale baseline by price sensitivity and regional factors (removed customer quantity multiplier)
  // Convert market share from decimal (0.01) to percentage multiplier (1.01) for quantity calculation
  const relationshipQuantityBonus = 1 + currentRelationship * 0.002; // 0.2% per relationship point
  const quantityMarketShareMultiplier = (1 + orderCustomer.marketShare) * relationshipQuantityBonus; // 0.01 → 1.01x + relationship bonus
  const desiredQuantity = Math.floor(
    baseQuantity * 
    orderAmountMultiplier * 
    orderCustomer.purchasingPower * 
    orderCustomer.wineTradition * 
    quantityMarketShareMultiplier
  );

  // Quantity calculation completed (no logging needed)

  // Check if the desired quantity meets the minimum order requirement
  if (desiredQuantity < minQty) {
    
    // Order rejected - asking price too high, customer backs down
    const notificationMessage = `${orderCustomer.name} from ${orderCustomer.country} wanted to buy ${formatCompletedWineName(selectedBatch)}, but with our current asking price the amount they could afford simply became too low.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }

  // Calculate fulfillable quantity based on current inventory  
  const fulfillableQuantity = Math.min(desiredQuantity, selectedBatch.quantity);
  const fulfillableValue = Math.round(fulfillableQuantity * bidPrice * 100) / 100;
  
  const gameState = getGameState();
  const order: WineOrder = {
    id: uuidv4(),
    orderedAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    },
    customerType: orderCustomer.customerType,
    wineBatchId: selectedBatch.id,
    wineName: formatCompletedWineName(selectedBatch),
    requestedQuantity: desiredQuantity,
    offeredPrice: bidPrice, // Store as offeredPrice in the order object for compatibility
    totalValue: Math.round(desiredQuantity * bidPrice * 100) / 100,
    fulfillableQuantity,
    fulfillableValue,
    askingPriceAtOrderTime: askingPrice, // Store the asking price at order time
    status: 'pending',
    
    // Customer information for sophisticated order tracking
    customerId: orderCustomer.id,
    customerName: orderCustomer.name,
    customerCountry: orderCustomer.country,
    customerRelationship: currentRelationship,
    
    // Calculation data for tooltips and analysis
    calculationData: {
      // Price multiplier calculation
      estimatedBaseMultiplier,
      purchasingPowerMultiplier,
      wineTraditionMultiplier,
      marketShareMultiplier,
      finalPriceMultiplier: orderCustomer.priceMultiplier,
      
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
      wasRejected: false // This order was accepted
    }
  };
  
  await saveWineOrder(order, companyId);
  
  // Activate customer if they're not already active (store their relationship)
  if (!orderCustomer.activeCustomer) {
    await activateCustomer(orderCustomer.id, currentRelationship, companyId);
  }
  
  triggerGameUpdate();
  
  // Order created successfully (no logging needed)
  
  return order;
}

