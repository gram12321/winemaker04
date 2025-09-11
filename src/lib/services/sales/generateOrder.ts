// Order generation service - handles wine order creation with pricing and rejection logic
import { v4 as uuidv4 } from 'uuid';
import { WineOrder, Customer } from '../../types';
import { saveWineOrder, loadWineBatches, loadVineyards } from '../../database';
import { triggerGameUpdate } from '../../../hooks/useGameUpdates';
import { getGameState } from '../../gameState';
import { formatCompletedWineName } from '../wineBatchService';
import { SALES_CONSTANTS } from '../../constants';
import { calculateOrderAmount, calculateSteppedBalance } from '../../utils/calculator';
import { notificationService } from '../../../components/layout/NotificationCenter';
import { getAvailableBottledWines } from '../../utils/wineFilters';
import { createCustomer } from './createCustomer';

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
    console.log(`  → No rejection: bidPrice (€${bidPrice.toFixed(2)}) <= finalPrice (€${finalPrice.toFixed(2)})`);
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
export async function generateOrder(customer?: Customer): Promise<WineOrder | null> {
  const allBatches = await loadWineBatches();
  const allVineyards = await loadVineyards();
  
  // Filter to only bottled wines with quantity > 0
  const bottledWines = getAvailableBottledWines(allBatches);
  
  if (bottledWines.length === 0) {
    return null; // No wines available for sale
  }
  
  // Generate customer if not provided (single order scenario)
  const orderCustomer = customer || createCustomer();
  
  // Randomly select a wine batch
  const selectedBatch = bottledWines[Math.floor(Math.random() * bottledWines.length)];
  
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
  
  // Use customer's individual price multiplier (already generated from range during customer creation)
  const bidPrice = Math.round(askingPrice * orderCustomer.priceMultiplier * 100) / 100;
  
  // Check for outright rejection based on price ratio
  const rejectionProbability = calculateRejectionProbability(bidPrice, basePrice);
  const rejectionRandomValue = Math.random();
  
  console.log(`=== SOPHISTICATED ORDER PRICING ===`);
  console.log(`Customer: ${orderCustomer.name} (${orderCustomer.country})`);
  console.log(`Customer Type: ${orderCustomer.customerType}`);
  console.log(`Customer Characteristics:`);
  console.log(`  - Purchasing Power: ${(orderCustomer.purchasingPower * 100).toFixed(1)}%`);
  console.log(`  - Wine Tradition: ${(orderCustomer.wineTradition * 100).toFixed(1)}%`);
  console.log(`  - Market Share: ${(orderCustomer.marketShare * 100).toFixed(1)}%`);
  console.log(`Price Multiplier Calculation:`);
  console.log(`  - Base Range: ${config.priceMultiplierRange[0]}x - ${config.priceMultiplierRange[1]}x`);
  
  // Calculate the multipliers for display
  const purchasingPowerMultiplier = orderCustomer.purchasingPower;
  const wineTraditionMultiplier = orderCustomer.wineTradition;
  const marketShareMultiplier = 1 - orderCustomer.marketShare; // Relative to 1
  
  // Estimate the base multiplier
  const totalMultiplier = purchasingPowerMultiplier * wineTraditionMultiplier * marketShareMultiplier;
  const estimatedBaseMultiplier = orderCustomer.priceMultiplier / totalMultiplier;
  
  console.log(`  - Estimated Base Multiplier: ${estimatedBaseMultiplier.toFixed(3)}x (random from range)`);
  console.log(`  - Purchasing Power: ${(orderCustomer.purchasingPower * 100).toFixed(1)}% → ${purchasingPowerMultiplier.toFixed(3)}x`);
  console.log(`  - Wine Tradition: ${(orderCustomer.wineTradition * 100).toFixed(1)}% → ${wineTraditionMultiplier.toFixed(3)}x`);
  console.log(`  - Market Share: ${(orderCustomer.marketShare * 100).toFixed(1)}% → ${marketShareMultiplier.toFixed(3)}x (relative to 1)`);
  console.log(`  - Formula: ${estimatedBaseMultiplier.toFixed(3)} × ${purchasingPowerMultiplier.toFixed(3)} × ${wineTraditionMultiplier.toFixed(3)} × ${marketShareMultiplier.toFixed(3)} = ${orderCustomer.priceMultiplier.toFixed(3)}x`);
  console.log(`Quantity Multiplier: ${orderCustomer.quantityMultiplier.toFixed(3)}x (base: ${config.baseQuantityMultiplier}x)`);
  console.log(`Wine: ${formatCompletedWineName(selectedBatch)}`);
  console.log(`Pricing Breakdown:`);
  console.log(`  - Final Price (wine value): €${basePrice.toFixed(2)}`);
  console.log(`  - Asking Price: €${askingPrice.toFixed(2)}`);
  console.log(`  - Customer Bid: €${askingPrice.toFixed(2)} × ${orderCustomer.priceMultiplier.toFixed(3)}x = €${bidPrice.toFixed(2)}`);
  console.log(`  - Premium Ratio: ${(bidPrice / basePrice).toFixed(2)}x`);
  console.log(`Rejection Analysis:`);
  console.log(`  - Rejection Probability: ${(rejectionProbability * 100).toFixed(1)}%`);
  console.log(`  - Random Value: ${(rejectionRandomValue * 100).toFixed(1)}%`);
  console.log(`  - Rejected: ${rejectionRandomValue < rejectionProbability ? 'YES' : 'NO'}`);
  console.log(`====================================`);
  
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
  const quantityMarketShareMultiplier = 1 + orderCustomer.marketShare; // 0.01 → 1.01x
  const desiredQuantity = Math.floor(
    baseQuantity * 
    orderAmountMultiplier * 
    orderCustomer.purchasingPower * 
    orderCustomer.wineTradition * 
    quantityMarketShareMultiplier
  );

  console.log(`=== QUANTITY CALCULATION ===`);
  console.log(`Customer Type Range: ${minQty} - ${maxQty} bottles (typical order size for ${orderCustomer.customerType})`);
  console.log(`Base Quantity (random): ${baseQuantity} bottles (randomly selected from range)`);
  console.log(`Price Sensitivity: ${orderAmountMultiplier.toFixed(3)}x (bid €${bidPrice.toFixed(2)} vs asking €${askingPrice.toFixed(2)} = ${(bidPrice/askingPrice).toFixed(3)}x ratio)`);
  console.log(`Regional Factors:`);
  console.log(`  - Purchasing Power: ${(orderCustomer.purchasingPower * 100).toFixed(1)}% → ${orderCustomer.purchasingPower.toFixed(3)}x`);
  console.log(`  - Wine Tradition: ${(orderCustomer.wineTradition * 100).toFixed(1)}% → ${orderCustomer.wineTradition.toFixed(3)}x`);
  console.log(`  - Market Share: ${(orderCustomer.marketShare * 100).toFixed(1)}% → ${quantityMarketShareMultiplier.toFixed(3)}x (1 + ${orderCustomer.marketShare.toFixed(3)})`);
  console.log(`Calculation: ${baseQuantity} × ${orderAmountMultiplier.toFixed(3)} × ${orderCustomer.purchasingPower.toFixed(3)} × ${orderCustomer.wineTradition.toFixed(3)} × ${quantityMarketShareMultiplier.toFixed(3)} = ${desiredQuantity} bottles`);
  console.log(`Minimum Required: ${minQty} bottles (if below this, order is rejected)`);
  console.log(`=============================`);

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
    customerCountry: orderCustomer.country
  };
  
  await saveWineOrder(order);
  triggerGameUpdate();
  
  console.log(`=== ORDER CREATED ===`);
  console.log(`Order ID: ${order.id}`);
  console.log(`Customer: ${orderCustomer.name} (${orderCustomer.country})`);
  console.log(`Wine: ${order.wineName}`);
  console.log(`Quantity: ${order.requestedQuantity} bottles`);
  console.log(`Bid Price: €${order.offeredPrice.toFixed(2)}`);
  console.log(`Total Value: €${order.totalValue.toFixed(2)}`);
  console.log(`Fulfillable: ${order.fulfillableQuantity} bottles (€${order.fulfillableValue?.toFixed(2) || 'N/A'})`);
  console.log(`====================`);
  
  return order;
}

