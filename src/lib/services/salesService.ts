// Sales service for wine order generation and fulfillment
import { v4 as uuidv4 } from 'uuid';
import { WineOrder, WineBatch, OrderType } from '../types';
import { saveWineOrder, loadWineOrders, updateWineOrderStatus, loadWineBatches, saveWineBatch } from '../database';
import { triggerGameUpdate } from '../../hooks/useGameUpdates';
import { getGameState } from '../gameState';
import { addTransaction } from './financeService';
import { formatCompletedWineName } from './wineBatchService';
import { SALES_CONSTANTS } from '../constants';
import { calculateOrderAmount, calculateSymmetricalMultiplier, calculateSteppedBalance } from '../utils/calculator';
import { notificationService } from '../../components/layout/NotificationCenter';

// Use order type configurations from constants
const ORDER_TYPE_CONFIG = SALES_CONSTANTS.ORDER_TYPES;

// ===== SALES-SPECIFIC CALCULATIONS =====

/**
 * Calculate rejection probability based on price ratio
 * Uses asymmetrical multiplier to create increasing rejection chance as bid price becomes too high
 * 
 * Business Logic:
 * - bidPrice: The value the buyer has to bid to get the wine (computer-generated customer offer)
 * - finalPrice: The calculated perceived value of the wine (not production cost, which isn't simulated)
 * - Customers reject when they have to pay MORE than the wine's perceived value (bad deal)
 * - Customers never reject when they can get wine at or below its perceived value (good deal)
 * - Premium order types (Private Collector, Export) are more tolerant of high prices
 * 
 * @param bidPrice - The price the customer is bidding (their offer)
 * @param finalPrice - The calculated perceived value of the wine
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
  
  console.log(`  → Premium Ratio: ${premiumRatio.toFixed(2)}x`);
  console.log(`  → Sigmoid Mapped Input: ${mappedInput.toFixed(3)}`);
  console.log(`  → Shifted Input (+0.4): ${shiftedInput.toFixed(3)}`);
  
  // Use stepped balance function to get rejection probability
  // This creates sophisticated rejection curve with proper 0-1 output
  const rejectionProbability = calculateSteppedBalance(shiftedInput);
  console.log(`  → Stepped Balance Output: ${rejectionProbability.toFixed(3)}`);
  
  return rejectionProbability;
}

// ===== ORDER GENERATION =====

// Generate a random wine order for available bottled wines
export async function generateWineOrder(): Promise<WineOrder | null> {
  const allBatches = await loadWineBatches();
  
  // Filter to only bottled wines with quantity > 0
  const bottledWines = allBatches.filter(batch => 
    batch.stage === 'bottled' && 
    batch.process === 'bottled' && 
    batch.quantity > 0
  );
  
  if (bottledWines.length === 0) {
    return null; // No wines available for sale
  }
  
  // Randomly select a wine batch
  const selectedBatch = bottledWines[Math.floor(Math.random() * bottledWines.length)];
  
  // Randomly select order type
  const orderTypes = Object.keys(ORDER_TYPE_CONFIG) as OrderType[];
  const weights = orderTypes.map(type => ORDER_TYPE_CONFIG[type].chance);
  const selectedType = weightedRandomSelect(orderTypes, weights);
  
  const config = ORDER_TYPE_CONFIG[selectedType];
  
  // Get asking price (user-set or default) and base calculated price
  const askingPrice = selectedBatch.askingPrice ?? selectedBatch.finalPrice;
  const basePrice = selectedBatch.finalPrice;
  
  // Generate sophisticated price multiplier using symmetrical distribution
  const [minMultiplier, maxMultiplier] = config.priceMultiplierRange;
  const randomValue = Math.random(); // 0-1 random input
  const sophisticatedMultiplier = calculateSymmetricalMultiplier(randomValue, minMultiplier, maxMultiplier);
  const bidPrice = Math.round(askingPrice * sophisticatedMultiplier * 100) / 100;
  
  // Check for outright rejection based on price ratio
  const rejectionProbability = calculateRejectionProbability(bidPrice, basePrice);
  const rejectionRandomValue = Math.random();
  
  console.log(`=== PRICE REJECTION CHECK ===`);
  console.log(`Order Type: ${selectedType}`);
  console.log(`Wine: ${formatCompletedWineName(selectedBatch)}`);
  console.log(`Final Price (wine value): €${basePrice.toFixed(2)}`);
  console.log(`Asking Price: €${askingPrice.toFixed(2)}`);
  console.log(`Bid Price: €${bidPrice.toFixed(2)}`);
  console.log(`Premium Ratio: ${(bidPrice / basePrice).toFixed(2)}x`);
  console.log(`Rejection Probability: ${(rejectionProbability * 100).toFixed(1)}%`);
  console.log(`Random Value: ${(rejectionRandomValue * 100).toFixed(1)}%`);
  console.log(`Rejected: ${rejectionRandomValue < rejectionProbability ? 'YES' : 'NO'}`);
  console.log(`=============================`);
  
  if (rejectionRandomValue < rejectionProbability) {
    // Customer outright rejects the price and walks away
    const notificationMessage = `A ${selectedType} was interested in ${formatCompletedWineName(selectedBatch)}, but outright rejected our asking price.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }
  
  // Calculate order amount adjustment based on price difference
  const orderAmountMultiplier = calculateOrderAmount(
    { askingPrice },
    basePrice,
    selectedType
  );
  
  // Generate baseline quantity from order type range, then scale by price sensitivity
  // The range acts as a baseline market appetite; calculateOrderAmount scales this.
  const [minQty, maxQty] = config.quantityRange;
  const baseQuantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

  // Scale baseline by the computed multiplier - unlimited multiplication allowed
  const desiredQuantity = Math.floor(baseQuantity * orderAmountMultiplier);

  // Check if the desired quantity meets the minimum order requirement
  if (desiredQuantity < minQty) {
    console.log(`=== QUANTITY REJECTION CHECK ===`);
    console.log(`Order Type: ${selectedType}`);
    console.log(`Wine: ${formatCompletedWineName(selectedBatch)}`);
    console.log(`Final Price (wine value): €${basePrice.toFixed(2)}`);
    console.log(`Asking Price: €${askingPrice.toFixed(2)}`);
    console.log(`Bid Price: €${bidPrice.toFixed(2)}`);
    console.log(`Price Difference: ${((askingPrice / basePrice - 1) * 100).toFixed(1)}%`);
    console.log(`Base Quantity Range: [${minQty}, ${maxQty}]`);
    console.log(`Base Quantity: ${baseQuantity}`);
    console.log(`Order Amount Multiplier: ${orderAmountMultiplier.toFixed(2)}x`);
    console.log(`Desired Quantity: ${desiredQuantity}`);
    console.log(`Minimum Required: ${minQty}`);
    console.log(`Rejected: YES (quantity too low)`);
    console.log(`===============================`);
    
    // Order rejected - asking price too high, customer backs down
    const notificationMessage = `A ${selectedType} wanted to buy ${formatCompletedWineName(selectedBatch)}, but with our current asking price the amount they could afford simply became too low.`;
    
    // Trigger notification for rejected order
    notificationService.info(notificationMessage);
    
    return null; // No order generated
  }

  // No inventory cap - allow orders larger than available inventory
  const requestedQuantity = desiredQuantity;
  
  // Calculate fulfillable quantity based on current inventory
  const fulfillableQuantity = Math.min(requestedQuantity, selectedBatch.quantity);
  const fulfillableValue = Math.round(fulfillableQuantity * bidPrice * 100) / 100;
  
  const gameState = getGameState();
  const order: WineOrder = {
    id: uuidv4(),
    orderedAt: {
      week: gameState.week || 1,
      season: gameState.season || 'Spring',
      year: gameState.currentYear || 2024
    },
    orderType: selectedType,
    wineBatchId: selectedBatch.id,
    wineName: formatCompletedWineName(selectedBatch),
    requestedQuantity,
    offeredPrice: bidPrice, // Store as offeredPrice in the order object for compatibility
    totalValue: Math.round(requestedQuantity * bidPrice * 100) / 100,
    fulfillableQuantity,
    fulfillableValue,
    askingPriceAtOrderTime: askingPrice, // Store the asking price at order time
    status: 'pending'
  };
  
  await saveWineOrder(order);
  triggerGameUpdate();
  return order;
}

// Weighted random selection helper
function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1]; // Fallback
}

// ===== ORDER MANAGEMENT =====

// Get all pending wine orders
export async function getPendingOrders(): Promise<WineOrder[]> {
  return await loadWineOrders();
}

// Fulfill a wine order (sell the wine) - supports partial fulfillment
export async function fulfillWineOrder(orderId: string): Promise<boolean> {
  const orders = await loadWineOrders();
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return false;
  }
  
  // Get the wine batch
  const allBatches = await loadWineBatches();
  const wineBatch = allBatches.find(batch => batch.id === order.wineBatchId);
  
  if (!wineBatch) {
    return false;
  }
  
  // Calculate how many bottles we can actually fulfill
  const fulfillableQuantity = Math.min(order.requestedQuantity, wineBatch.quantity);
  const fulfillableValue = Math.round(fulfillableQuantity * order.offeredPrice * 100) / 100; // order.offeredPrice is the bidPrice
  
  if (fulfillableQuantity === 0) {
    return false; // No inventory available
  }
  
  // Remove bottles from inventory
  const updatedBatch: WineBatch = {
    ...wineBatch,
    quantity: wineBatch.quantity - fulfillableQuantity
  };
  
  await saveWineBatch(updatedBatch);
  
  // Add money to player account through finance system
  await addTransaction(
    fulfillableValue,
    `Wine Sale: ${order.wineName}${fulfillableQuantity < order.requestedQuantity ? ` (${fulfillableQuantity}/${order.requestedQuantity} bottles)` : ''}`,
    'Wine Sales'
  );
  
  // Update order with fulfillment details and mark as fulfilled or partially fulfilled
  const updatedOrder: WineOrder = {
    ...order,
    fulfillableQuantity,
    fulfillableValue,
    status: fulfillableQuantity < order.requestedQuantity ? 'partially_fulfilled' : 'fulfilled'
  };
  
  await saveWineOrder(updatedOrder);
  
  triggerGameUpdate();
  return true;
}

// Reject a wine order
export async function rejectWineOrder(orderId: string): Promise<boolean> {
  await updateWineOrderStatus(orderId, 'rejected');
  triggerGameUpdate();
  return true;
}

// Check if we should generate a new order (simple probability)
export function shouldGenerateOrder(): boolean {
  return Math.random() < SALES_CONSTANTS.ORDER_GENERATION_CHANCE;
}
